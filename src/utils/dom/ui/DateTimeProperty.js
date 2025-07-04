import { join_datetime } from "../../join_datetime.js";
import { split_datetime } from "../../split_datetime.js";
import { has_focus } from "../has_focus.js";
import { $ } from "../render_html.js";
import { InputProperty } from "./InputProperty.js";
import { UI, Button } from "./ui.js";
import { toggle_class } from "../toggle_class.js";
/** @import {InputPropertySettings} from "./exports.js" */

/**
 * @typedef {InputPropertySettings & {
 *   'datetime.apply_timezone': UISetting<boolean>,
 *   'datetime.after_now': UISetting<boolean>
 * }} DateTimePropertySettings
 */
/** @extends {InputProperty<DateTimePropertySettings>} */
export class DateTimeProperty extends InputProperty {
    get today_str() { return new Date().toISOString().split("T")[0]; }

    /** @param {Settings} settings */
    constructor(settings) {
        var date_input = $(`<input type="date" style="flex:1">`)[0];
        var time_input = $(`<input type="time" style="flex:1">`)[0];
        var inputs = [date_input, time_input];
        var wrapper = new UI({ class: `datetime-property-wrapper`, flex:1 });
        wrapper.append(date_input, time_input);

        super(wrapper.elem, {
            "datetime.apply_timezone": true,
            "datetime.after_now": false,
            "default": NaN,
            "multiple": true,
            ...settings,
            setup: false
        });

        var now_button = new Button(`<button><i class="far fa-clock"></i></button>`, {
            title: "Set to current date and time",
            "click": ()=>{
                var min = 1000 * 60;
                this.set_value(Math.floor(+new Date() / min) * min, { trigger: true });
            }
        });
        this.buttons_el.prepend(now_button);

        this.validators.push((value)=>{
            if (!this.get_setting("datetime.after_now")) return true;
            // if (!inputs.some(input => input.value)) return true;
            if (!value) return true;
            var before_now = value < Math.floor(Date.now() / 1000) * 1000;
            var before_today = new Date(inputs[0].value) < new Date(this.today_str);
            if (before_today) return "Date is in the past.";
            else if (!before_today && before_now) return "Time is in the past.";
            return true;
        });

        inputs.forEach(input => {
            input.addEventListener("change", () => {
                if (input === time_input && !date_input.value) date_input.value = new Date().toISOString().split("T")[0];
                if (input === date_input && !time_input.value) time_input.value = "00:00";

                var date = +join_datetime(date_input.value, time_input.value, this.get_setting("datetime.apply_timezone"));
                if (!isNaN(date)) this.set_value(date, { trigger: "change" });
            });
            input.addEventListener("focus", ()=>{
                this.update_next_frame()
            });
            input.addEventListener("blur", ()=>{
                this.update_next_frame()
            });
        });

        this.on("render", (e) => {
            var value = +new Date(this.value) || NaN;
            if (isNaN(value)) {
                date_input.value = "";
                time_input.value = "";
            } else {
                var [date, time] = split_datetime(value, this.get_setting("datetime.apply_timezone"));
                if (!has_focus(date_input)) date_input.value = date;
                if (!has_focus(time_input)) time_input.value = time.slice(0, 5);
            }
        });
    }
}

export default DateTimeProperty;