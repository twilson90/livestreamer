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
*   "valid": (this:ThisType, value:ValueType)=>boolean|string,
*   "min": UISetting<ThisType,Number>,
*   "max": UISetting<ThisType,Number>,
*   "precision": UISetting<ThisType,Number>,
* }} PropertySettings
*/

/** @typedef {UIEvents & {change:[PropertyChangeEvent]}} PropertyEvents */

var undefined_values = Object.freeze([undefined]);

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
    #raw_values = [undefined];
    /** @type {PropertyContext<ItemType,ValueType>} */

    #parent_property;
    /** @returns {Property} */
    get parent_property() {
        if (!this.#parent_property) {
            for (var ui of this.iterate_parents()) {
                if (ui instanceof Property) {
                    this.#parent_property = ui;
                    break;
                }
            }
        }
        return this.#parent_property;
    }

    #items;
    /** @returns {ItemType[]} */
    get items() {
        if (!this.#items) {
            var pp = this.parent_property;
            this.#items = this.get_setting("items") || (pp && pp.items) || [undefined];
        }
        return this.#items;
    }

    #datas_error;
    /** @returns {boolean} */
    get datas_error() { return this.datas && !!this.#datas_error; }
    
    #datas;
    /** @returns {ValueType[]} */
    get datas() {
        if (!this.#datas) {
            this.#datas_error = false;
            var items = this.items;
            var path = this.path;
            this.#datas =
                ("data" in this.settings && items.map(item=>this.get_setting("data", item, path))) ||
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

    #defaults;
    /** @returns {ValueType[]} */
    get defaults() {
        if (!this.#defaults) {
            var items = this.items;
            this.#defaults = ("default" in this.settings && items.map((item,i)=>this.get_setting("default", item))) || items.map(item=>undefined);
        }
        return this.#defaults;
    }

    get default() { return this.defaults[0]; }

    #path;
    get path() {
        if (!this.#path) {
            var pp = this.parent_property;
            this.#path = (pp) ? [...pp.path, ...this.name_split] : [...this.name_split];
        }
        return this.#path;
    }
    
    #values;
    /** @returns {ValueType[]} */
    get values() {
        if (!this.#values) {
            var defaults = this.defaults;
            this.#values = this.raw_values.map((v,i)=>json_copy(v ?? defaults[i]));
        }
        return this.#values;
    }

    #is_indeterminate;
    /** @returns {boolean} */
    get is_indeterminate() {
        if (this.#is_indeterminate === undefined) {
            this.#is_indeterminate = !deep_equals(...this.values);
        }
        return this.#is_indeterminate;
    }

    #has_defaults;
    /** @returns {boolean} */
    get has_defaults() {
        if (this.#has_defaults === undefined) {
            this.#has_defaults = this.defaults.some(d=>d != undefined);
        }
        return this.#has_defaults;
    }

    #is_default;
    /** @returns {boolean} */
    get is_default() {
        if (this.#is_default === undefined) {
            this.#is_default = deep_equals(this.values, this.defaults);
        }
        return this.#is_default;
    }

    #is_changed;
    /** @returns {boolean} */
    get is_changed() {
        if (this.#is_changed === undefined) {
            var datas = this.datas;
            var defaults = this.defaults;
            this.#is_changed = this.values.some((v,i)=>{
                return !deep_equals(v??null, datas[i]??defaults[i]??null);
            });
        }
        return this.#is_changed;
    }

    #valid;
    /** @returns {boolean|string} */
    get valid() {
        if (this.#valid === undefined) {
            var valid = true;
            for (var value of this.values) {
                if ("valid" in this.settings) {
                    valid = this.get_setting("valid", value);
                }
                if (valid === true) {
                    for (var validator of this.validators) {
                        valid = validator.apply(this, [value]);
                        if (valid !== true) break;
                    }
                }
            }
            this.#valid = valid;
        }
        return this.#valid;
    }

    /** @returns {string[]} */
    get name_split() { return this.#name_split; }
    get is_valid() { return this.is_disabled || this.is_indeterminate || this.valid === true; }
    get validators() { return this.#validators; }
    get has_datas() { return "data" in this.settings || !!(this.name && !this.datas_error); }
    /** @returns {ValueType[]} */
    get raw_values() { return this.#raw_values; }
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
        if (this.settings.validators) {
            this.#validators.push(...this.settings.validators);
        }
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
        this.#raw_values = this.items.map((item,i)=>{
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
        var new_values_hash = JSON.stringify(this.#raw_values);
        
        this.#values = undefined;
        this.#is_indeterminate = undefined;
        this.#has_defaults = undefined;
        this.#is_default = undefined;
        this.#is_changed = undefined;

        var changed = this.#last_values_hash !== new_values_hash;
        this.#last_values_hash = new_values_hash;

        return changed;
    }

    __data_update() {
        if (this.name || "data" in this.settings) {
            var datas = this.datas;
            let datas_hash = JSON.stringify(datas);
            if (this.#last_datas_hash !== datas_hash)  {
                this.#last_datas_hash = datas_hash;
                this.set_values(datas);
            }
        }
    }

    __before_update() {
        super.__before_update();

        this.#items = undefined;
        this.#datas = undefined;
        this.#defaults = undefined;
        this.#path = undefined;
        this.#valid = undefined;

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