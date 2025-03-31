import { join_datetime } from "../../join_datetime.js";
import { split_datetime } from "../../split_datetime.js";
import { has_focus } from "../has_focus.js";
import { $ } from "../render_html.js";
import { Property } from "./Property.js";
/** @import {PropertySettings} from "./Property.js" */

/**
 * @typedef {PropertySettings & {
 *   'datetime.apply_timezone': UISetting<boolean>,
 *   'datetime.after_now': UISetting<boolean>
 * }} DateTimePropertySettings
 */
/** @extends {Property<DateTimePropertySettings>} */
export class DateTimeProperty extends Property {
    get today_str() { return new Date().toISOString().split("T")[0]; }

    /** @param {Settings} settings */
    constructor(settings) {
        var date_input = $(`<input type="date">`)[0];
        var time_input = $(`<input type="time">`)[0];
        var inputs = [date_input, time_input];

        super({
            "datetime.apply_timezone": true,
            "datetime.after_now": false,
            "default": NaN,
            "multiple": true,
            ...settings,
            setup: false
        });

        inputs.forEach(input => {
            input.addEventListener("change", () => {
                this.set_value(join_datetime(date_input.value, time_input.value, this.get_setting("datetime.apply_timezone")), { trigger: "change" });
            });
            input.addEventListener("focus", () => this.update());
            input.addEventListener("blur", () => this.update());
        });

        this.on("render", (e) => {
            var value = this.value || NaN;
            if (!isNaN(value)) {
                var [date, time] = split_datetime(value, this.get_setting("datetime.apply_timezone"));
                if (!has_focus(date_input)) date_input.value = date;
                if (!has_focus(time_input)) time_input.value = time.slice(0, 5);
            }
        });
        this.validators.push((_, input) => {
            if (!this.get_setting("datetime.after_now")) return true;
            if (!inputs.some(input => input.value)) return true;
            var before_now = this.value < Math.floor(Date.now() / 1000) * 1000;
            var before_today = new Date(inputs[0].value) < new Date(this.today_str);
            if (before_today && input == date_input) return "Date is in the past.";
            else if (!before_today && before_now && input == time_input) return "Time is in the past.";
            return true;
        });
    }
}

export default DateTimeProperty;