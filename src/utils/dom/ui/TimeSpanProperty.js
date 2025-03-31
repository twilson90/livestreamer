import { seconds_to_timespan_str } from "../../seconds_to_timespan_str.js";
import { timespan_str_to_seconds } from "../../timespan_str_to_seconds.js";
import { $ } from "../render_html.js";
import { Property } from "./Property.js";
/** @import {PropertySettings} from "./Property.js" */

/**
 * @typedef {PropertySettings & {
 *   'timespan.zero_infinity': UISetting<boolean>,
 *   'timespan.format': UISetting<string>
 * }} TimeSpanPropertySettings
 */
/** @extends {Property<TimeSpanPropertySettings>} */
export class TimeSpanProperty extends Property {
    /** @param {TimeSpanPropertySettings} settings */
    constructor(settings) {
        var input = $(`<input type="text">`)[0];
        super(input, {
            "timespan.format": "hh:mm:ss",
            "timespan.zero_infinity": false,
            "step": 1.0,
            "default": 0,
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