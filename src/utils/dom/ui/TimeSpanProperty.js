import { seconds_to_timespan_str } from "../../seconds_to_timespan_str.js";
import { timespan_str_to_seconds } from "../../timespan_str_to_seconds.js";
import { $ } from "../render_html.js";
import { InputProperty } from "./InputProperty.js";
/** @import {InputPropertySettings} from "./exports.js" */

/**
 * @template ItemType
 * @template ValueType
 * @template {TimeSpanProperty} ThisType
 * @typedef {InputPropertySettings<ItemType,ValueType,ThisType> & {
 *   'timespan.zero_infinity': UISetting<ThisType,boolean>,
 *   'timespan.format': UISetting<ThisType,string>
 * }} TimeSpanPropertySettings
 */

/** 
 * @template ItemType
 * @template {number} ValueType
 * @template {TimeSpanPropertySettings<ItemType,ValueType,TimeSpanProperty>} Settings
 * @template {PropertyEvents} Events
 * @extends {InputProperty<ItemType, ValueType, Settings, Events>} 
 */
export class TimeSpanProperty extends InputProperty {
    /** @param {Settings} settings */
    constructor(settings) {
        var input = $(`<input type="text">`)[0];
        super(input, {
            "timespan.format": "hh:mm:ss",
            "timespan.zero_infinity": false,
            "step": 1.0,
            ...settings
        });
        this.input_modifiers.push((v) => {
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v.toLowerCase() === "infinity") return 0;
            v = timespan_str_to_seconds(v, this.get_setting("timespan.format"));
            // var step = this.get_setting("step");
            // v = Math.round(v / step) * step;
            return v;
        });
        this.output_modifiers.push((v) => {
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v == 0) return "Infinity";
            return seconds_to_timespan_str(Math.round(v * 1000) / 1000, this.get_setting("timespan.format"));
        });
    }
}

export default TimeSpanProperty;