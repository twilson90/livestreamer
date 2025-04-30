import { UI } from "./ui.js";
import { all_equal } from "../../all_equal.js";
import { json_copy } from "../../json_copy.js";
import { try_catch } from "../../try_catch.js";
import * as reflect from "../../reflect.js";
import deep_equals from "../../deep_equals.js";

/** @import {UISettings, UISetting, UIEvents} from './exports.js' */

/** 
 * @template ItemType 
 * @template ValueType 
 * @typedef {(this:Property<ItemType,ValueType>,value:ValueType,item:ItemType)=>string} PropertyModifer 
 */

/**
 * @template ItemType
 * @template ValueType
 * @template {Property<ItemType,ValueType>} [ThisType=Property<ItemType,ValueType>]
 * @typedef {UISettings<ThisType> & {
*   "name": UISetting<ThisType,string>,
*   "items": UISetting<ThisType,ItemType[]>,
*   "default": (this:ThisType, item:ItemType)=>ValueType,
*   "data": (this:ThisType, item:ItemType, path:string[])=>ValueType,
*   "modifiers": PropertyModifer<ItemType,ValueType>[],
*   "nullify_default": UISetting<ThisType,boolean>,
* }} PropertySettings
*/

/** @typedef {UIEvents & {change:[PropertyChangeEvent]}} PropertyEvents */

var undefined_value = Object.freeze([undefined]);

/** @template ItemType @template ValueType */
class ValueContext {
    /** @type {Property<ItemType,ValueType>} */
    #prop;
    #raw_values;
    #values;
    #is_indeterminate;
    #has_defaults;
    #is_default;
    #is_changed;
    #valid;

    /** @param {Property<ItemType,ValueType>} prop @param {ValueType[]} raw_values */
    constructor(prop, raw_values) {
        this.#prop = prop;
        this.#raw_values = raw_values;
    }
    
    /** @returns {ValueType[]} */
    get raw_values() {
        return this.#raw_values || undefined_value;
    }

    /** @returns {ValueType[]} */
    get values() {
        if (!this.#values) {
            var defaults = this.#prop.defaults;
            this.#values = this.raw_values.map((v,i)=>json_copy(v ?? defaults[i]));
        }
        return this.#values;
    }

    /** @returns {boolean} */
    get is_indeterminate() {
        if (this.#is_indeterminate === undefined) {
            this.#is_indeterminate = !deep_equals(...this.values);
        }
        return this.#is_indeterminate;
    }

    /** @returns {boolean} */
    get has_defaults() {
        if (this.#has_defaults === undefined) {
            this.#has_defaults = this.#prop.defaults.some(d=>d != undefined);
        }
        return this.#has_defaults;
    }

    /** @returns {boolean} */
    get is_default() {
        if (this.#is_default === undefined) {
            this.#is_default = deep_equals(this.values, this.#prop.defaults);
        }
        return this.#is_default;
    }

    /** @returns {boolean} */
    get is_changed() {
        if (this.#is_changed === undefined) {
            var datas = this.#prop.datas;
            var defaults = this.#prop.defaults;
            this.#is_changed = this.values.some((v,i)=>{
                return !deep_equals(v??null, datas[i]??defaults[i]??null);
            });
        }
        return this.#is_changed;
    }

    /** @returns {boolean|string} */
    get valid() {
        if (this.#valid === undefined) {
            var valid = true;
            var values = this.values;
            for (var value of values) {
                for (var validator of this.#prop.validators) {
                    valid = validator.apply(this, [value]);
                    if (valid !== true) break;
                }
            }
            this.#valid = valid;
        }
        return this.#valid;
    }
}

/** @template ItemType @template ValueType */
class PropertyContext {
    /** @type {Property<ItemType,ValueType>} */
    #prop;
    #parent_property;
    #items;
    #datas;
    #defaults;
    #datas_error;
    #path;

    /** @param {Property<ItemType,ValueType>} prop */
    constructor(prop) {
        this.#prop = prop;
    }

    /** @returns {Property} */
    get parent_property() {
        if (!this.#parent_property) {
            for (var ui of this.#prop.iterate_parents()) {
                if (ui instanceof Property) {
                    this.#parent_property = ui;
                    break;
                }
            }
        }
        return this.#parent_property;
    }

    /** @returns {ItemType[]} */
    get items() {
        if (!this.#items) {
            var pp = this.parent_property;
            this.#items = this.#prop.get_setting("items") || (pp && pp.items) || [undefined];
        }
        return this.#items;
    }

    /** @returns {boolean} */
    get datas_error() { return this.datas && !!this.#datas_error; }
    
    /** @returns {ValueType[]} */
    get datas() {
        if (!this.#datas) {
            this.#datas_error = false;
            var items = this.items;
            var path = this.path;
            this.#datas =
                ("data" in this.#prop.settings && items.map(item=>this.#prop.get_setting("data", item, path))) ||
                // (pp && pp.datas.map(data=>try_catch(()=>reflect.get(data, this.name_split)))) ||
                items.map(item=>{
                    var data = undefined;
                    try {
                        data = reflect.get(item, path);
                    } catch {
                        this.#datas_error = true;
                    }
                    return data;
                });
        }
        return this.#datas;
    }

    /** @returns {ValueType[]} */
    get defaults() {
        if (!this.#defaults) {
            var items = this.items;
            this.#defaults = ("default" in this.#prop.settings && items.map((item,i)=>this.#prop.get_setting("default", item))) || items.map(item=>undefined);
        }
        return this.#defaults;
    }

    get path() {
        if (!this.#path) {
            var pp = this.parent_property;
            this.#path = (pp) ? [...pp.path, ...this.#prop.name_split] : [...this.#prop.name_split];
        }
        return this.#path;
    }
}

/** 
 * @template ItemType
 * @template ValueType
 * @template {PropertySettings<ItemType,ValueType,Property>} Settings
 * @template {PropertyEvents} Events
 * @extends {UI<Settings,Events>} 
 */
export class Property extends UI {
    #name_id = "";
    #name = "";
    /** @type {string[]} */
    #name_split = [];
    /** @type {PropertyModifer<ItemType,ValueType>[]} */
    #modifiers = [];
    #last_datas_hash;
    /** @type {((value:any)=>boolean|string)[]} */
    #validators = [];
    #last_values_hash;
    /** @type {PropertyContext<ItemType,ValueType>} */
    #context = new PropertyContext(this);
    /** @type {ValueContext<ItemType,ValueType>} */
    #value_context = new ValueContext(this, [undefined]);

    /** @returns {Property} */
    get parent_property() { return this.#context.parent_property; }
    /** @returns {ItemType[]} */
    get items() { return this.#context.items || undefined_value; }
    /** @returns {ValueType[]} */
    get datas() { return this.#context.datas || undefined_value; }
    /** @returns {ValueType[]} */
    get defaults() { return this.#context.defaults || undefined_value; }
    /** @returns {string[]} */
    get path() { return this.#context.path; }
    /** @returns {string[]} */
    get name_split() { return this.#name_split; }
    get is_valid() { return this.is_disabled || this.is_indeterminate || this.valid === true; }
    get validators() { return this.#validators; }

    get is_indeterminate() { return this.#value_context.is_indeterminate; }
    get has_defaults() { return this.#value_context.has_defaults; }
    get is_default() { return this.#value_context.is_default; }
    get is_changed() { return this.#value_context.is_changed; }
    get valid() { return this.#value_context.valid; }
    get has_datas() { return "data" in this.settings || !!(this.name && !this.#context.datas_error); }
    /** @returns {ValueType[]} */
    get raw_values() { return this.#value_context.raw_values || undefined_value; }
    /** @returns {ValueType[]} */
    get values() { return this.#value_context.values || undefined_value; }
    set value(v) { this.set_value(v); }
    get value() { return this.values[0]; }
    set values(v) { this.set_values(v); }
    get raw_value() { return this.raw_values[0]; }
    get item() { return this.items[0]; }
    get data() { return this.datas[0]; }
    get items_values() {
        var items = this.items;
        var values = this.values;
        return items.map((item,i)=>({item, value:values[i]}));
    }
    get name() { return this.#name; }
    get name_id() { return this.#name_id; }
    get modifiers() { return this.#modifiers; }

    /** @param {Settings} settings */
    constructor(settings) {
        super(null, {
            "nullify_default": true,
            ...settings
        });
        
        var name = this.get_setting("name");
        if (typeof name === "number") name = String(name);
        this.#name = name || "";
        this.#name_id = `${this.#name||"undefined"}-${this.id}`;
        this.#name_split = this.#name ? this.#name.split("/") : [];

        this.elem.addEventListener("mousedown", (e)=>{
            if (e.ctrlKey) {
                console.log(this);
                window.$0 = this;
                // e.stopPropagation();
            }
        });
    }

    reset(trigger=true) {
        var defaults = this.defaults;
        this.set_values(this.items.map((_,i)=>defaults[i]), {trigger:trigger?"change":false});
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

        var changed = this.#set_values(values);
        var trigger = (options.trigger === "change") ? changed : !!options.trigger;

        if (changed || trigger) { // || trigger is it necessary?
            var ev = new PropertyChangeEvent(this, trigger);
            this.emit("change", ev, {bubbles:true});
        }
        
        this.update();

        return changed;
    }

    #set_values(values) {
        var defaults = this.defaults;
        if (!Array.isArray(values)) values = this.items.map(item=>values);
        var new_raw_values = this.items.map((item,i)=>{
            var value = values[i];
            if (typeof(value) == "number") {
                var min = this.get_setting("min", item);
                var max = this.get_setting("max", item);
                var precision = this.get_setting("precision", item);
                if (max !== undefined) value = Math.min(value, +max);
                if (min !== undefined) value = Math.max(value, +min);
                if (precision !== undefined) value = +value.toFixed(precision)
            }
            for (var m of this.modifiers) {
                value = m.apply(this, [value, item]);
            }
            if (this.get_setting("nullify_default") && deep_equals(value, defaults[i])) return undefined;
            return value;
        });
        var new_values_hash = JSON.stringify(new_raw_values);
        this.#value_context = new ValueContext(this, new_raw_values);

        if (this.#last_values_hash === new_values_hash) return false;
        this.#last_values_hash = new_values_hash;

        return true;
    }

    __data_update() {
        if ("value" in this.settings) {
            this.set_value(this.get_setting("value"));
            return;
        }

        this.#value_context = new ValueContext(this, this.raw_values);

        if (!this.has_datas) return;
        
        var datas = this.datas;
        let datas_hash = JSON.stringify(datas);
        let new_values;
        if (this.#last_datas_hash !== datas_hash)  {
            new_values = datas;
        }
        this.#last_datas_hash = datas_hash;
        if (new_values) this.set_values(new_values);
    }

    __update_context() {
        
        super.__update_context();

        this.#context = new PropertyContext(this);

        this.__data_update();
    }
}

export class PropertyChangeEvent {
    /** @param {Property} prop */
    constructor(prop, trigger = false) {
        this.property = prop;
        this.name = prop.name;
        this.path = prop.path;
        this.values = prop.values;
        this.value = this.values[0];
        this.raw_values = prop.raw_values;
        this.raw_value = this.raw_values[0];
        this.trigger = trigger;
    }
}

export default Property;