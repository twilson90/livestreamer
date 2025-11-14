import tippy from "tippy.js";
import { fix_options } from "../../fix_options.js";
import { get_value } from "../get_value.js";
import { has_focus } from "../has_focus.js";
import { set_inner_html } from "../set_inner_html.js";
import { set_select_options } from "../set_select_options.js";
import { toggle_attribute } from "../toggle_attribute.js";
import { set_value } from "../set_value.js";
import { set_attribute } from "../set_attribute.js";
import { toggle_class } from "../toggle_class.js";
import { all_equal } from "../../all_equal.js";
import { $ } from "../render_html.js";
import { remove_attribute } from "../remove_attribute.js";
import { toggle_display } from "../toggle_display.js";

import { UI, Button } from "./ui.js";
import { Tooltip } from "./Tooltip.js";
import { Property } from "./Property.js";

/** @import {PropertySettings, PropertyEvents, UISetting} from './exports.js' */
/** @import {OptionSettings} from '../exports.js' */

/** @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} InputElement */

const editable_input_types = {
    "text":1,
    "number":1,
    "password":1,
    "email":1,
    "search":1,
    "tel":1,
    "url":1,
    "color":1,
}

/**
 * @template ItemType
 * @template ValueType
 * @template ThisType [ThisType=InputProperty<ItemType,ValueType>]
 * @typedef {PropertySettings<ItemType,ValueType,ThisType> & {
 *  "setup": ()=>InputElement[],
 *  "placeholder": UISetting<ThisType,string>,
 *  "invalid_class": UISetting<ThisType,string>,
 *  "reset": UISetting<ThisType,boolean>,
 *  "copy": UISetting<ThisType,boolean>,
 *  "label": UISetting<ThisType,string>,
 *  "info": UISetting<ThisType,string>,
 *  "prefix": UISetting<ThisType,string>,
 *  "suffix": UISetting<ThisType,string>,
 *  "options": UISetting<ThisType,any[]>,
 *  "vertical": UISetting<ThisType,boolean>,
 *  "focus": (this:ThisType,input:InputElement)=>void,
 *  "blur": (this:ThisType,input:InputElement)=>void,
 *  "readonly": UISetting<ThisType,boolean>,
 *  "change_on_input": UISetting<ThisType,boolean>,
 * }} InputPropertySettings
 */

/** @typedef {PropertyEvents & {focus:[InputElement],blur:[InputElement]}} InputPropertyEvents */

/** 
 * @template ItemType 
 * @template ValueType
 * @template {InputPropertySettings<ItemType,ValueType,InputProperty>} [Settings=InputPropertySettings<ItemType,ValueType,InputProperty>]
 * @template {InputPropertyEvents} [Events=InputPropertyEvents]
 * @extends {Property<ItemType,ValueType,Settings,Events>} 
 */
export class InputProperty extends Property {
    /** @type {InputElement[]} */
    #inputs = [];
    /** @type {((value:ValueType)=>string)[]} */
    #input_modifiers = [];
    /** @type {((value:ValueType, input:InputElement)=>any)[]} */
    #output_modifiers = [];
    /** @type {Tooltip} */
    #validation_tooltip = null;
    #force_update_inputs = false;
    #last_valid;
    #is_focussed = false;
    #focus_promise = null;

    get inputs() { return this.#inputs; }
    get input() { return this.#inputs[0]; }
    get input_modifiers() { return this.#input_modifiers; }
    get output_modifiers() { return this.#output_modifiers; }
    get is_focussed() { return this.#is_focussed; }
    
    /** @param {HTMLElement} contents @param {Settings} settings */
    constructor(contents, settings) {
        super({
            "contents": contents,
            "setup": ()=>{
                var inputs_selector = `.fake-input,input,select,textarea,[contenteditable=true]`;
                var inputs = [...this.inner_el.children].map(e=>{
                    if (e.matches(inputs_selector)) return [e];
                    return [...e.querySelectorAll(inputs_selector)];
                }).flat();
                var type = "text";
                if (inputs.length) {
                    if (inputs[0].nodeName === "INPUT") type = inputs[0].type;
                    else if (inputs[0].nodeName === "SELECT") type = "select";
                    else if (inputs[0].nodeName === "TEXTAREA") type = "textarea";
                }
                this.elem.dataset.input_type = type;
                return inputs;
            },
            // "event":(e)=>e.type === "change",
            "placeholder": "",
            "invalid_class": "invalid",
            "disabled": false,
            "reset": ()=>"default" in this.settings && !this.get_setting("copy"),
            "hidden": false,
            "copy":false,
            "inline": false,
            "readonly": false,
            "change_on_input": false,
            ...settings
        });
        
        this.elem.classList.add("property");
        
        if (this.settings.label) {
            this.header_el = $(`<div class="property-header"></div>`)[0];
            this.label = new UI(`<label>&nbsp;</label>`, {
                /* click:(e)=>{
                    e.preventDefault();
                    this.input.focus();
                } */
            });
            set_attribute(this.label.elem, "for", this.name_id);
            this.header_el.append(this.label);
            this.append(this.header_el);
        }
        
        if (this.settings.info) {
            this.info_elem = $(`<span><i class="fas fa-question-circle info"></i></span>`)[0];
            this.header_el.append(this.info_elem);
            this.tooltip = new Tooltip(this.info_elem);
        }

        this.outer_el = $(`<div class="property-outer"></div>`)[0];
        this.append(this.outer_el);
        
        /** @type {HTMLElement} */
        this.inner_el = $(`<div class="property-inner"></div>`)[0];
        this.outer_el.append(this.inner_el);
        
        this.buttons_el = new UI(`<div class="property-buttons"></div>`).elem;
        this.outer_el.append(this.buttons_el);

        var add_prefix_suffix = (name)=>{
            if (!this.settings[name]) return;
            let el = this.get_setting(name);
            el = (typeof el === "string") ? $(el) : el;
            let wrapper_el = $(`<div class="property-input-${name}"></div>`)[0];
            wrapper_el.append(el);
            this.inner_el.append(wrapper_el);
        }
        add_prefix_suffix("prefix");
        
        this.input_wrapper_el = $(`<div class="property-input-wrapper"></div>`)[0];
        this.inner_el.append(this.input_wrapper_el);
        
        contents = this.get_setting("contents");
        contents = (typeof contents === "string") ? $(contents) : contents;
        if (!Array.isArray(contents)) contents = [contents];
        for (let c of contents) {
            if (c) this.input_wrapper_el.append(c);
        }

        add_prefix_suffix("suffix");

        /** @type {InputElement[]} */
        var inputs = this.get_setting("setup") || [];
        if (!Array.isArray(inputs)) inputs = [inputs];

        var update_value = (input, trigger)=>{
            if (input.type === "color" && !trigger) return;
            var value = this.apply_input_modifiers(get_value(input));
            if (this.is_numeric && isNaN(value)) value = 0;
            return this.set_value(value, {trigger});
        }

        inputs.forEach((input, i)=>{
            if (input.matches(".fake-input") || input.matches("[contenteditable=true]")) {
                input.tabIndex = "-1"
            }
            set_attribute(input, "id", this.name_id);
            input.addEventListener("change", (e)=>{
                update_value(input, true)
            });
            input.addEventListener("input", (e)=>{
                update_value(input, this.get_setting("change_on_input"));
            });
            if (input.nodeName === "INPUT" || input.isContentEditable) {
                input.addEventListener("keydown", (e)=>{
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.target.blur();
                    }
                    if (input.type !== "number" && this.is_numeric) {
                        var changed = false;
                        if (e.key == "ArrowUp") changed = this.step(1)
                        else if (e.key == "ArrowDown") changed = this.step(-1)
                        if (changed) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }
                });
            }
        });
        this.#inputs = inputs;

        this.elem.addEventListener("focusin", (e)=>{
            if (this.#is_focussed) return;
            if (!this.#inputs.includes(e.target)) return;
            /** @type {InputElement} */
            var input = e.target;
            this.#focus_promise = new Promise(resolve=>{
                this.#is_focussed = true;
                var input_value_on_focus = get_value(input);
                var on_blur = (e)=>{
                    if (document.activeElement === input) return;
                    var input_value_on_blur = get_value(input);
                    this.#is_focussed = false;
                    input.removeEventListener("blur", on_blur);
                    this.get_setting("blur", [input]);
                    this.emit("blur", input);
                    var result = false;
                    if (input_value_on_blur !== input_value_on_focus) {
                        result = update_value(input, true);
                    }
                    resolve(result);
                    // this.update_next_frame();
                };
                input.addEventListener("blur", on_blur);
            });
            this.get_setting("focus", [input]);
            this.emit("focus", input);
            this.update_next_frame();
        });

        if (this.input) {
            if (this.settings["placeholder"] === undefined) this.settings["placeholder"] = this.input.placeholder;
            if (this.settings["readonly"] === undefined) this.settings["readonly"] = this.input.readOnly;
            if (this.settings["min"] === undefined && this.input.min) this.settings["min"] = this.apply_input_modifiers(+this.input.min, this.input);
            if (this.settings["max"] === undefined && this.input.max) this.settings["max"] = this.apply_input_modifiers(+this.input.max, this.input);
            if (this.settings["step"] === undefined && this.input.step) this.settings["step"] = this.apply_input_modifiers(+this.input.step, this.input);
        }
        this.is_numeric = ((this.input && this.input.type === "number") || this.settings["step"] !== undefined || this.settings["precision"] !== undefined || this.settings["min"] !== undefined || this.settings["max"] !== undefined || this.settings["spinner"] !== undefined);
        if (this.is_numeric) {
            this.settings["step"] = this.settings["step"] || 1;
            
            if (this.settings["spinner"] !== false && this.input.type !== "range") {
                this.spinner_ui = new UI();
                this.spinner_ui.elem.classList.add("spinner");
                this.up_button = new Button(`<button><i class="fas fa-caret-up"></i></button>`, {
                    "click":(e)=>this.step(1),
                    "disabled":()=>this.value>=this.get_setting("max", this.item),
                });
                this.down_button = new Button(`<button><i class="fas fa-caret-down"></i></button>`, {
                    "click":(e)=>this.step(-1),
                    "disabled":()=>this.value<=this.get_setting("min", this.item),
                });
                this.spinner_ui.append(this.up_button, this.down_button);
                this.buttons_el.append(this.spinner_ui);
            }
        }

        if (this.get_setting("copy")) {
            var copy_hide_timeout;
            var copy_tippy;
            this.copy_button = new Button(`<button class="copy"><i class="fas fa-copy"></i></button>`, {
                "click":(e)=>{
                    e.preventDefault();
                    this.input.select();
                    window.navigator.clipboard.writeText(this.input.value);
                    if (!copy_tippy) {
                        copy_tippy = tippy(this.input, {
                            content:"Copied!",
                            trigger:"manual",
                            zIndex: 999999,
                            onShow:(instance)=>{
                                clearTimeout(copy_hide_timeout);
                                copy_hide_timeout = setTimeout(()=>instance.hide(),1500);
                            }
                        });
                    }
                    copy_tippy.show();
                },
                "title": "Copy",
            });
            this.buttons_el.append(this.copy_button);

            for (let input of this.inputs) {
                input.addEventListener("mousedown", (e)=>{
                    input.select();
                    if (e.button == 0) e.preventDefault();
                });
            }
        }
        
        if (this.settings.reset !== false) {
            this.reset_button = new Button(`<button class="reset"><i class="fas fa-undo"></i></button>`, {
                "click":()=>this.reset(),
                "title": "Reset",
                "hidden": ()=>!this.get_setting("reset") || this.get_setting("readonly"),
            });
            this.buttons_el.append(this.reset_button);
        }

        this.on("render", this.#render);
    }

    step(dir) {
        var step = +this.get_setting("step", this.item);
        this.#force_update_inputs = true;
        let str = step.toString();
        const decimals = (str.includes("e-")) ? +str.split("e-")[1] : (str.split('.')[1] || '').length;
        const factor = 10 ** decimals;
        return this.set_values(Math.round((this.value + (step*dir))*factor)/factor, {trigger:"change"});
    }

    apply_input_modifiers(value, input) {
        for (var m of this.input_modifiers) {
            value = m.apply(this, [value, input]);
        }
        return value;
    }
    
    apply_output_modifiers(value, input) {
        for (var m of this.output_modifiers) {
            value = m.apply(this, [value, input]);
        }
        return value;
    }

    #render() {

        var item = this.item;
        var is_default = this.is_default;
        var is_changed = this.is_changed;
        var values = this.values;
        var defaults = this.defaults;
        
        var has_options = "options" in this.settings;
        var options = has_options ? this.items.map((item)=>this.get_setting("options",item)||[]) : null;
        var is_options_consistant = has_options && (options.length <= 1 || all_equal(options.map(o=>JSON.stringify(o))));
        var is_indeterminate = this.is_indeterminate || (has_options && !is_options_consistant);
        var is_disabled = this.is_disabled || (has_options && !is_options_consistant);
        var readonly = !!this.get_setting("readonly");
        var width = this.get_setting("width");
        // var min_width = this.get_setting("min-width");
            
        toggle_class(this.elem, "vertical", !!this.get_setting("vertical"))
        toggle_class(this.elem, "is-null", values[0] == null);
        set_attribute(this.elem, "data-input-type", this.input?.type || "");
        toggle_class(this.elem, "not-default", this.has_defaults && !is_default); // !is_focussed && 
        toggle_class(this.elem, "changed", this.has_datas && is_changed); // !is_focussed && 
        toggle_class(this.elem, "inline", !!this.get_setting("inline"));

        if (width != null) {
            this.elem.style.setProperty("--ui-property-width", typeof width == "number" ? `${width}px` : width);
            this.elem.style.flex = "none";
        }
        
        /* if (this.reset_button) {
            this.reset_button.disabled = is_default
        } */

        if (options) {
            /** @type {OptionSettings<ValueType>[]} */
            let datas = [];
            if (!is_options_consistant || is_indeterminate) datas.push({value:"", text:"Multiple values", style:{"display":"none"}});
            if (is_options_consistant) datas.push(...options[0]);
            datas = fix_options(datas);
            let default_hash = JSON.stringify(defaults[0]);
            for (var o of datas) {
                if (JSON.stringify(o.value) === default_hash) o.text += " *";
            }
            for (var input of this.inputs) {
                if (input.nodeName === "SELECT") set_select_options(input, datas);
            }
        }

        // var is_focussed = dom.has_focus(this.inner_el, true, true);
        // var is_focussed = this.inputs.some(input=>dom.has_focus(input, false, true));
        // var is_focussed = dom.has_focus(this.input_wrapper_el, false, true);
        
        if (this.label) {
            set_inner_html(this.label.elem, this.get_setting("label"));
        }

        if (this.tooltip) {
            let info = this.get_setting("info");
            toggle_display(this.info_elem, !!info);
            if (typeof info === "string") info = info.replace(/\n/g, "<br>");
            this.tooltip.set_content(info);
        }
        
        for (var input of this.inputs) {
            var value = values[0];
            var is_focussed = this.#is_focussed;
            var is_editable = (input.isContentEditable || (input.nodeName === "INPUT" && input.type in editable_input_types) || input.nodeName === "TEXTAREA") && !input.readOnly;

            // var is_text_field = !input.readOnly && (input.isContentEditable || input.type in editable_input_types || input.nodeName === "TEXTAREA");
            // !is_text_field || 
            if (!is_focussed || !is_editable || this.#force_update_inputs) {
                if (is_indeterminate) {
                    value = "";
                } else {
                    value = this.apply_output_modifiers(value, input);
                }
                if (typeof value === "number" && this.settings["precision"] !== undefined) {
                    value = value.toFixed(this.get_setting("precision", item));
                    if (value.includes(".")) value = value.replace(/\.?0+$/,"");
                }
                if (input.type == "color") {
                    if (is_indeterminate) value = "#ffffff";
                    else if (!value) value = "#000000";
                }
                if (input.matches(".fake-input") || input.matches("[contenteditable=true]")) {
                    set_inner_html(input, value);
                } else if (typeof input.value !== "undefined") {
                    set_value(input, value);
                }
            }
            
            // input.disabled = disabled;
            toggle_attribute(input, "disabled", is_disabled===true);
            if (readonly !== undefined) {
                input.readOnly = readonly;
                // set_attribute(input, "readonly", readonly);
            }
            if ("step" in this.settings) {
                var step = Math.min(this.items.map(item=>+this.get_setting("step", item)));
                if (!isNaN(step)) input.step = step;
            }
            if ("min" in this.settings) {
                var min = Math.min(this.items.map(item=>+this.get_setting("min", item)));
                if (!isNaN(min)) input.min = min;
            }
            if ("max" in this.settings) {
                var max = Math.max(this.items.map(item=>+this.get_setting("max", item)));
                if (!isNaN(max)) input.max = max;
            }

            var is_checkbox = input.nodeName === "INPUT" && input.type === "checkbox";
            
            if (is_checkbox) {
                input.indeterminate = is_indeterminate;
            }
            
            var placeholder = is_indeterminate ? "Multiple values" : this.get_setting("placeholder");
            if (input.placeholder !== placeholder) input.placeholder = placeholder;

            var title = this.get_setting("title") || "";
            if (!("title" in this.settings) && this.label) {
                title = this.label.elem.textContent;
            }
            if (is_indeterminate) title = "Multiple values";
            if (title) set_attribute(input, "title", title);
            else remove_attribute(input, "title");
        }
        
        var valid = this.valid;
        var invalid_class = this.get_setting("invalid_class");
        if (invalid_class) toggle_class(this.elem, invalid_class, valid !== true);
        if (this.#last_valid !== valid) {
            this.#last_valid = valid;
            valid = valid || "Invalid input";
            if (typeof valid === "string") {
                if (!this.#validation_tooltip) this.#validation_tooltip = new Tooltip(this.input_wrapper_el);
                this.#validation_tooltip.set_content(valid);
            } else {
                if (this.#validation_tooltip) this.#validation_tooltip.destroy();
                this.#validation_tooltip = null;
            }
        }
        this.#force_update_inputs = false;
    }

    async __data_update() {
        if (this.#is_focussed) {
             // if resolves true then the property has just changed, so we don't need to update the inputs on the data.
            if (await this.#focus_promise) return;
        }
        super.__data_update();
    }

    /* destroy() {
        if (this.container) this.container.unregister_properties(this);
        super.destroy();
    } */
}

/** 
 * @typedef {
 *   (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) & {_validation_tooltip:Tooltip}
 * } Input 
 */

export default InputProperty;