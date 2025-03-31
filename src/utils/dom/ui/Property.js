import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import { PropertyChangeEvent } from "./PropertyChangeEvent.js";
import { Tooltip } from "./Tooltip.js";
import { UI, Button, traverse } from "./ui.js";
import { fix_options } from "../fix_options.js";
import { get_value } from "../get_value.js";
import { has_focus } from "../has_focus.js";
import { set_inner_html } from "../set_inner_html.js";
import { set_select_options } from "../set_select_options.js";
import { toggle_attribute } from "../toggle_attribute.js";
import { set_value } from "../set_value.js";
import { set_attribute } from "../set_attribute.js";
import { toggle_class } from "../toggle_class.js";
import { all_equal } from "../../all_equal.js";
import { count_decimals } from "../../count_decimals.js";
import { json_copy } from "../../json_copy.js";
import { $ } from "../render_html.js";
import { remove_attribute } from "../remove_attribute.js";
import { deep_entries } from "../../deep_entries.js";
import { deep_diff } from "../../deep_diff.js";
import * as reflect from "../../reflect.js";

/** @import {UISettings,UISetting} from './ui.js' */

/**
 * @typedef {UISettings & {
 * "setup":Function():Input[],
 * "placeholder":UISetting<string>,
 * "invalid_class":UISetting<string>,
 * "default":UISetting<any>,
 * "reset":UISetting<boolean>,
 * "hidden":UISetting<boolean>,
 * "copy":UISetting<boolean>,
 * "nullify_defaults":UISetting<boolean>,
 * "name":UISetting<string>,
 * "label":UISetting<string>,
 * "info":UISetting<string>,
 * "prefix":UISetting<string>,
 * "suffix":UISetting<string>,
 * "options":UISetting<Array<any>>,
 * "data":Function(item:ItemType,path:string):any,
 * "vertical":UISetting<boolean>,
 * }} PropertySettings
*/

const editable_input_types = {
    "text":1,
    "number":1,
    "password":1,
    "email":1,
    "search":1,
    "tel":1,
    "url":1,
}

/** @template ItemType @extends {UI<PropertySettings, {change:PropertyChangeEvent}>} */
export class Property extends UI {
    get input() { return this.inputs[0]; }
    get _value() { return this._values[0]; }
    set value(v) { return this.set_value(v); }
    get value() { return this.iterate_values().next().value; }
    set values(v) { return this.set_values(v); }
    get values() { return [...this.iterate_values()]; }
    *iterate_values() {
        var nullify_defaults = this.is_nullify_defaults;
        for (var i = 0; i < this._values.length; i++) {
            var value = (nullify_defaults && this._values[i] == null) ? this.get_setting("default", this.items[i], i) : this._values[i];
            yield json_copy(value);
        }
    }

    /** @type {boolean} */
    get is_indeterminate() { return !all_equal(this.values); }
    /** @type {boolean} */
    get is_default() {
        if (this.is_nullify_defaults) return this._values.every((v)=>v==null);
        return this.items.every((item,i)=>JSON.stringify(this.get_setting("default", item, i))===JSON.stringify(this.values[i]));
    }
    /** @type {boolean} */
    get is_nullify_defaults() {
        var res = this.get_setting("nullify_defaults");
        if (res == undefined) {
            var container = this.container;
            res = container ? container.get_setting("nullify_defaults") : false;
        }
        return res;
    }
    /** @type {PropertyContainer<ItemType>} */
    get container() {
        for (var ui of this.iterate_parents()) {
            if (ui instanceof Property) return;
            if (ui instanceof PropertyContainer) return ui;
        }
    }
    get is_hidden() {
        return this.items.some(item=>this.get_setting("hidden", item)); // (this.parent||{}).hidden || 
    }
    get is_disabled() {
        return this.items.some(item=>this.get_setting("disabled", item)) || this.disabled_parent || !this.is_options_consistant;
    }
    get is_valid() {
        return this.inputs.every(i=>i._last_valid === true || i._last_valid === undefined);
    }
    /** @type {ItemType} */
    get item() {
        return this.items[0];
    }
    get datas() {
        return this.items.map(item=>this.get_setting("data", item));
    }
    get data() {
        return this.datas[0];
    }
    
    /** @type {ItemType[]} */
    items = [null];
    _values = [null];
    /** @type {Input[]} */
    inputs = [];
    /** @type {Function(any):string[]} */
    raw_modifiers = [];
    /** @type {Function(any):string[]} */
    input_modifiers = [];
    /** @type {Function(any):any[]} */
    output_modifiers = [];
    /** @type {Function(any,Input):any[]} */
    validators = [];
    #force_update_inputs = false;

    get options() {
        return this.items.map((item)=>this.get_setting("options",item)||[]);
    }
    get is_options_consistant() {
        if (!this.items.length <= 1) return true;
        var last;
        for (var o of this.options) {
            var curr = JSON.stringify(o)
            if (last && curr != last) return false;
            last = curr;
        }
        return true;
    };
    
    /** @param {HTMLElement} contents @param {PropertySettings} settings */
    constructor(contents, settings) {
        super(null, {
            "contents": contents,
            "setup": ()=>{
                var inputs_selector = `.fake-input,input,select,textarea`;
                var inputs = [...this.inner_el.children].map(e=>{
                    if (e.matches(inputs_selector)) return [e];
                    return [...e.querySelectorAll(inputs_selector)];
                }).flat();
                return inputs;
            },
            // "event":(e)=>e.type === "change",
            "placeholder": "",
            "invalid_class": "invalid",
            "default": null,
            "disabled": false,
            "reset": true,
            "hidden": false,
            "copy":false,
            "nullify_defaults": undefined,
            ...settings
        });
        if (!("title" in this.settings) && ("label" in this.settings)) this.settings.title = this.settings.label;
        
        this.elem.classList.add("property");
        // this.values_valid = true;
        this.name = this.get_setting("name");
        if (this.name != null) this.name = String(this.name);
        this.name_id = `${this.name}-${this.id}`;
        
        if (this.settings.label) {
            this.header_el = $(`<div class="property-header"></div>`)[0];
            this.label = new UI(`<label>&nbsp;</label>`);
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

        add_prefix_suffix("suffix")

        var inputs = this.get_setting("setup") || [];
        if (!Array.isArray(inputs)) inputs = [inputs];
        inputs.forEach((input, i)=>{
            if (input.matches(".fake-input")) {
                input.tabIndex = "-1"
            }
            set_attribute(input, "id", this.name_id);
            var update_value = (trigger)=>{
                var value = get_value(input);
                value = this.apply_input_modifiers(value);
                this.set_value(value, {trigger});
            }
            input.addEventListener("change", (e)=>update_value(true));
            input.addEventListener("input", (e)=>update_value(false));
            input.addEventListener("blur", (e)=>this.update());
            input.addEventListener("focus", (e)=>this.update());
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
            /* Object.defineProperty(input, 'value', {
                get () { return this.get_value(); },
                set (value) { this.set_value(value, false); }
            }); */
        });
        this.inputs = inputs;

        if (this.input) {
            if (this.settings["placeholder"] === undefined) this.settings["placeholder"] = this.input.placeholder;
            if (this.settings["readonly"] ===undefined) this.settings["readonly"] = this.input.readOnly;
            if (this.settings["default"] === undefined) this.settings["default"] = this.apply_input_modifiers(this.input.value, this.input);
            if (this.settings["min"] === undefined && this.input.min) this.settings["min"] = this.apply_input_modifiers(+this.input.min, this.input);
            if (this.settings["max"] === undefined && this.input.max) this.settings["max"] = this.apply_input_modifiers(+this.input.max, this.input);
            if (this.settings["step"] === undefined && this.input.step) this.settings["step"] = this.apply_input_modifiers(+this.input.step, this.input);
        }
        this.is_numeric = ((this.input && this.input.type === "number") || this.settings["step"] !== undefined || this.settings["precision"] !== undefined || this.settings["min"] !== undefined || this.settings["max"] !== undefined || this.settings["spinner"] !== undefined);
        if (this.is_numeric) {
            this.settings["step"] = this.settings["step"] || 1;
            this.settings["precision"] = this.settings["precision"] || count_decimals(this.settings["step"]);
            
            if (this.settings["spinner"] !== false && this.input.type !== "range") {
                this.spinner_ui = new UI();
                this.spinner_ui.elem.classList.add("spinner");
                this.up_button = new Button(`<button><i class="fas fa-caret-up"></i></button>`, {
                    "click":(e)=>this.step(1),
                    "disabled":()=>this.value>=this.get_setting("max"),
                });
                this.down_button = new Button(`<button><i class="fas fa-caret-down"></i></button>`, {
                    "click":(e)=>this.step(-1),
                    "disabled":()=>this.value<=this.get_setting("min"),
                });
                this.spinner_ui.append(this.up_button, this.down_button);
                this.buttons_el.append(this.spinner_ui);
            }
        }

        if (this.get_setting("copy")) {
            var copy_hide_timeout;
            var copy_tippy;
            this.copy_button = new Button(`<button><i class="fas fa-copy"></i></button>`, {
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
            this.outer_el.append(this.copy_button);

            for (let input of this.inputs) {
                input.addEventListener("mousedown", (e)=>{
                    input.select();
                    if (e.button == 0) e.preventDefault();
                });
            }
        }
        
        if (this.get_setting("reset")) {
            this.reset_button = new Button(`<button><i class="fas fa-undo"></i></button>`, {
                "click":()=>this.reset(),
                "title": "Reset"
                // "hidden": ()=>!this.get_setting("reset"),
            });
            this.buttons_el.append(this.reset_button);
        }
        
        // this.elem.addEventListener("focusin", (e)=>{
        //     this.update();
        // });
        // this.elem.addEventListener("focusout", (e)=>{
        //     this.update();
        // });
        
        /* requestAnimationFrame(()=>{
            this.update_inputs(true);
        }); */
    }

    step(dir) {
        this.#force_update_inputs = true;
        var step = this.get_setting("step");
        return this.set_values(Math.round((this.value + (step*dir))/step)*step, {trigger:"change"});
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

    reset(trigger=true) {
        this.set_values(this.items.map((item,i)=>this.get_setting("default", item, i)), {trigger:trigger?"change":false});
    }

    /** @typedef {{trigger:boolean|"change"}} SetValueOptions */
    /** @param {SetValueOptions} options */
    set_value(value, options) {
        return this.set_values(this.items.map(_=>value), options);
    }

    /** @param {SetValueOptions} options */
    set_values(values, options) {
        options = {
            trigger: false,
            ...options
        };
        // console.trace(this.name, values, trigger);
        // if (!Array.isArray(values)) throw new Error("Values must be array...");

        var nullify_defaults = this.is_nullify_defaults;
        if (!Array.isArray(values)) values = this.items.map(item=>values);
        if (values.length != this.items.length) {
            throw new Error(`Values length (${values.length}) mismatch datas length (${this.items.length})...`);
        }

        var fix_value = (value)=>{
            if (typeof(value) == "number") {
                var min = this.get_setting("min");
                var max = this.get_setting("max");
                var precision = this.get_setting("precision");
                if (max !== undefined) value = Math.min(value, +max);
                if (min !== undefined) value = Math.max(value, +min);
                if (precision !== undefined) value = +value.toFixed(precision)
            }
            return value;
        };

        values = values.map((v)=>fix_value(v));
        
        // var old_values = this._values;
        this._values = this.items.map((item,i)=>{
            var default_value = fix_value(this.get_setting("default", item, i));
            var value;
            if (nullify_defaults) value = (JSON.stringify(values[i]) === JSON.stringify(default_value)) ? null : values[i];
            else value = (values[i] == null) ? default_value : values[i];
            value = json_copy(value);
            for (var m of this.raw_modifiers) {
                value = m.apply(this, [value]);
            }
            return value;
        });

        // --------------- DO NOT TOUCH ---------------

        // this._values_hash = JSON.stringify([this.values, this._values]);
        var values_hash = JSON.stringify(this._values);
        var non_null_values_hash = JSON.stringify(this.values);
        var changed = values_hash !== this._last_values_hash;
        var changed_non_null = non_null_values_hash !== this._last_non_null_values_hash;
        var trigger = (options.trigger === "change") ? changed : !!options.trigger;
        
        this._last_non_null_values_hash = non_null_values_hash;
        this._last_values_hash = values_hash;

        // --------------------------------------------

        if (changed || trigger) {
            var ev = new PropertyChangeEvent(this, trigger);
            this.emit("change", ev, {bubbles:true});
        }
        
        if (!trigger) this.#force_update_inputs = false;

        if (changed || changed_non_null || trigger) {
            this.update();
        }

        return changed;
    }
    
    data_update() {
        let values;
        if ("data" in this.settings) {
            values = this.items = [this.get_setting("data")];
        } else {
            var container = this.container;
            if (container && typeof this.name === "string") {
                let path = this.name.split("/");
                this.items = [...container.items];
                values = this.items.map(item=>container.get_setting("data", item, path));
            }
        }
        // if (!values) return;
        let hash = JSON.stringify(values);
        if (this._last_values_on_property_update !== hash) {
            this._last_values_on_property_update = hash;
            this.set_values(values);
        }
    }

    __update() {
        this.data_update();
        super.__update();
    }

    __render() {

        var is_default = this.is_default;
        var is_indeterminate = this.is_indeterminate;
        var readonly = this.get_setting("readonly");
        var disabled = this.is_disabled;
        var style_defaults = !!this.get_setting("reset");
        // var style_defaults = true;

        var width = this.get_setting("width");
            
        toggle_class(this.elem, "vertical", !!this.get_setting("vertical"))

        if (width != null) {
            this.elem.style.setProperty("--ui-property-min-width", typeof width == "number" ? `${width}px` : width);
        }
        
        /* if (this.reset_button) {
            this.reset_button.disabled = is_default
        } */

        if (this.settings["options"] !== undefined) {
            let items_options = this.options;
            let options = [];
            let options_consistant = this.is_options_consistant;
            if (!options_consistant) is_indeterminate = true;
            if (!options_consistant || is_indeterminate) options.push({value:"", text:"Multiple values", style:{"display":"none"}});
            if (options_consistant) options.push(...json_copy(items_options[0]));
            var default_value = this.get_setting("default", this.items[0], 0);
            options = fix_options(options);
            if (style_defaults) {
                options.forEach((o)=>{
                    if (o.value === default_value) o.text += " *";
                });
            }
            for (var input of this.inputs) {
                if (input.nodeName === "SELECT") set_select_options(input, options);
            }
        }

        // var is_focused = dom.has_focus(this.inner_el, true, true);
        // var is_focused = this.inputs.some(input=>dom.has_focus(input, false, true));
        // var is_focused = dom.has_focus(this.input_wrapper_el, false, true);
        
        for (var input of this.inputs) {
            var value = this.value;
            var is_focused = has_focus(input, false, true);
            var is_editable = (input.isContentEditable || input.type in editable_input_types) && !input.readOnly;

            // var is_text_field = !input.readOnly && (input.isContentEditable || input.type in editable_input_types || input.nodeName === "TEXTAREA");
            // !is_text_field || 
            if (!is_focused || !is_editable || this.#force_update_inputs) {
                if (input.type == "color" && (is_default || is_indeterminate)) value = "#ffffff";
                else if (is_indeterminate) value = "";
                if (typeof value === "number" && this.settings["precision"] !== undefined) {
                    value = value.toFixed(this.get_setting("precision"));
                    if (value.includes(".")) value = value.replace(/\.?0+$/,"");
                }
                value = this.apply_output_modifiers(value, input);
                if (input.matches(".fake-input")) {
                    set_inner_html(input, value);
                } else if (typeof input.value !== "undefined") {
                    set_value(input, value, {trigger:false});
                }
            }
        }
        this.#force_update_inputs = false;
        
        toggle_class(this.elem, "is-null", this.value === null);
        toggle_class(this.elem, "not-default", !is_default && style_defaults); // !is_focused && 
        // dom.toggle_class(this.elem, "is-default", is_default && style_defaults); // !is_focused && 

        for (var input of this.inputs) {
            // input.disabled = disabled;
            toggle_attribute(input, "disabled", disabled===true);
            if (readonly !== undefined) {
                input.readOnly = readonly;
                // set_attribute(input, "readonly", readonly);
            }
            if ("step" in this.settings) input.step = this.apply_output_modifiers(this.get_setting("step"), input);
            if ("min" in this.settings) input.min = this.apply_output_modifiers(this.get_setting("min"), input);
            if ("max" in this.settings) input.max = this.apply_output_modifiers(this.get_setting("max"), input);

            var is_checkbox = input.nodeName === "INPUT" && input.type === "checkbox";
            
            if (is_checkbox) {
                input.indeterminate = is_indeterminate;
            }
            
            var placeholder = is_indeterminate ? "Multiple values" : this.get_setting("placeholder");
            if (input.placeholder !== placeholder) input.placeholder = placeholder;

            var title = is_indeterminate ? "Multiple values" : this.get_setting("title") || "";
            if (title) set_attribute(input, "title", title);
            else remove_attribute(input, "title");
            
            var valid = disabled || is_indeterminate || (()=>{
                for (var validator of this.validators) {
                    valid = validator.apply(this, [this.value, input]);
                    if (valid !== true) return valid;
                }
                return true;
            })();
            
            var invalid_class = this.get_setting("invalid_class");
            if (invalid_class) toggle_class(input, invalid_class, valid !== true);

            if (valid === false) valid = "Invalid input";
            if (input._last_valid !== valid) {
                if (typeof valid === "string") {
                    if (!input._validation_tooltip) input._validation_tooltip = new Tooltip(input);
                    input._validation_tooltip.set_content(valid);
                } else {
                    if (input._validation_tooltip) {
                        input._validation_tooltip.destroy();
                        input._validation_tooltip = null;
                    }
                }
                input._last_valid = valid;
            }
        }

        if (this.label) {
            set_inner_html(this.label.elem, this.get_setting("label", this.item));
        }
        if (this.tooltip) {
            let info = this.get_setting("info");
            toggle_class(this.info_elem, "d-none", !info);
            if (typeof info === "string") info = info.replace(/\n/g, "<br>");
            this.tooltip.set_content(info);
        }
        super.__render();
    }

    /* destroy() {
        if (this.container) this.container.unregister_properties(this);
        super.destroy();
    } */
}

/**
 * @template ItemType
 * @typedef {UISettings & {
 *   'data': function(ItemType, string[])
 *   'items': UISetting<ItemType[]>
 *   'nullify_defaults': UISetting<boolean>
 *   'disabled': UISetting<boolean>
 * }} PropertyContainerSettings
 */

/** @template ItemType @extends {UI<PropertyContainerSettings<ItemType>, {change:PropertyChangeEvent}>} */
export class PropertyContainer extends UI {
    /** @type {ItemType[]} */
    _items = [null];
    #saved_values = {};
    get item() { return this.items[0]; }
    /** @returns {ItemType[]} */
    get items() {
        if ("items" in this.settings) return this.get_setting("items");
        return this._items;
    }
    set items(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) items = [null];
        this._items = [...items];
        this.update();
    }

    get is_default() {
        return this.properties.every(p => p.is_default);
    }
    get valid() {
        return this.properties.filter(p => !p.is_hidden).every(p => p.is_valid);
    }
    /** @type {object} */
    get id_property_lookup() { return Object.fromEntries(this.properties.map(p => [p.id, p._value])); }
    /** @type {object} */
    get named_property_lookup() { return Object.fromEntries(this.properties.filter(p => !p.is_indeterminate && p.name).map(p => [p.name, p._value])); }
    /** @type {object} */
    get named_property_lookup_not_null() { return Object.fromEntries(Object.entries(this.named_property_lookup).filter(([k, v]) => v != null)); }
    get properties() { return [...this.iterate_properties()]; }
    get named_properties() { return this.properties.filter(p => p.name); }
    get named_property_map() { return Object.fromEntries(this.named_properties.map(p => [p.name, p])); }
    *iterate_properties() {
        for (var ui of traverse(this.elem, (ui) => !(ui instanceof Property || ui instanceof PropertyContainer))) {
            if (ui instanceof Property) yield ui;
        }
    }

    /** @param {PropertyContainerSettings<ItemType>} settings */
    constructor(settings) {
        super(null, {
            data: (d, p) => reflect.get(d, p),
            nullify_defaults: false,
            disabled: false,
            ...settings
        });

        this.elem.classList.add("property-container");

        this.elem.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.target.matches("input,select")) {
                e.target.blur();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        this.elem.addEventListener("focusin", (e) => {
            this.update();
        });
        this.elem.addEventListener("focusout", (e) => {
            this.update();
        });
        this.on("change", (e) => {
            if (e.container !== this) return false;
        });
    }

    reset() {
        for (var p of this.iterate_properties()) {
            p.reset();
        }
    }
    refresh() {
        for (var p of this.iterate_properties()) {
            p._last_values_on_property_update = null;
        }
        return this.update();
    }
    save() {
        this.#saved_values = json_copy(this.properties.map(p=>p.value));
    }
    get changes() {
        return deep_entries(deep_diff(this.#saved_values, this.properties.map(p=>p.value)));
    }
    set_values(values) {
        //...
    }
}

export default Property;