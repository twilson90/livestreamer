import { AutoSizeController } from "../AutoSizeController.js";
import { $ } from "../render_html.js";
import { Property } from "./Property.js";
/** @import {PropertySettings} from "./Property.js" */

/**
 * @typedef {PropertySettings & {
 *   'textarea.rows': UISetting<number>,
 *   'textarea.grow': UISetting<boolean>,
 *   'textarea.return_blur': UISetting<boolean>,
 *   'textarea.break_all': UISetting<boolean>,
 *   'textarea.max_length': UISetting<number>,
 *   'textarea.show_count': UISetting<boolean>
 * }} TextAreaPropertySettings
 */
/** @extends {Property<TextAreaPropertySettings>} */

export class TextAreaProperty extends Property {
    /** @param {Settings} settings */
    constructor(settings) {
        var input_el = $(`<textarea style="resize:none"></textarea>`)[0];
        super(input_el, {
            "default": "",
            "textarea.rows": 4,
            "textarea.grow": false,
            "textarea.return_blur": false,
            "textarea.break_all": false,
            "textarea.max_length": null,
            "textarea.show_count": false,
            ...settings,
        });
        /** @type {AutoSizeController} */
        var asc;
        var rows = this.get_setting("textarea.rows");
        var grow = this.get_setting("textarea.grow");
        var break_all = this.get_setting("textarea.break_all");
        if (break_all) {
            this.input.style["word-break"] = "break-all";
        }
        if (grow) {
            asc = new AutoSizeController(input_el, rows, false);
        } else if (rows) {
            this.input.rows = rows;
        }
        var max_length = this.get_setting("textarea.max_length");
        if (max_length) input_el.maxLength = max_length;
        if (this.get_setting("textarea.show_count")) {
            ["input", "propertychange", "paste"].forEach(ev => input_el.addEventListener(ev, () => this.update_char_count()));
            this.char_count = $(`<div></div>`)[0];
            this.header_el.append(this.char_count);
            this.update_char_count();
        }
        input_el.addEventListener("keydown", (e) => {
            if (e.key == "Enter") {
                if (this.get_setting("textarea.return_blur")) {
                    e.preventDefault();
                    input_el.blur();
                }
            }
        });
        this.on("update", () => {
            if (asc) asc.update();
        });
    }
    update_char_count() {
        this.char_count.innerHTML = `(${this.input.value.length}/${this.get_setting("textarea.max_length") || "-"})`;
    }
}

export default TextAreaProperty;