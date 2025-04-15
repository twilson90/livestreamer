import { UI } from "./ui.js";
import { all_equal } from "../../all_equal.js";
import { json_copy } from "../../json_copy.js";
import { try_catch } from "../../try_catch.js";
import * as reflect from "../../reflect.js";

/** @import {UISettings, UISetting, UIEvents} from './exports.js' */

/** 
 * @template ItemType 
 * @template ValueType 
 * @typedef {(this:Property<ItemType,ValueType>,value:ValueType,item:ItemType)=>string} PropertyModifer 
 */

/**
 * @template ItemType
 * @template ValueType
 * @template {Property<ItemType,ValueType>} ThisType
 * @typedef {UISettings<ThisType> & {
*   "name": UISetting<ThisType,string>,
*   "items": UISetting<ThisType,ItemType[]>,
*   "default": (this:ThisType, item:ItemType)=>ValueType,
*   "data": (this:ThisType, item:ItemType, path:string[])=>ValueType,
*   "modifiers": PropertyModifer<ItemType,ValueType>[]
* }} PropertySettings
*/

/** @typedef {UIEvents & {change:PropertyChangeEvent}} PropertyEvents */

var undefined_value = Object.freeze([undefined]);

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
    #raw_values = [undefined];

    /** @returns {ValueType[]} */
    get raw_values() { return this.#raw_values; }
    /** @returns {ValueType[]} */
    get values() {
        var defaults = this.defaults;
        return this.raw_values.map((v,i)=>json_copy(v ?? defaults[i]));
    }
    /** @returns {Property} */
    get parent_property() { return this.__context.parent_property; }
    /** @returns {ItemType[]} */
    get items() { return this.__context.items || undefined_value; }
    /** @returns {ValueType[]} */
    get datas() { return this.__context.datas || undefined_value; }
    /** @returns {ValueType[]} */
    get defaults() { return this.__context.defaults || undefined_value; }
    
    /** @returns {string[]} */
    get path() {
        var pp = this.parent_property;
        return (pp) ? [...pp.path, ...this.name_split] : [...this.name_split];
    }
    /** @returns {string[]} */
    get name_split() { return this.#name_split; }
    get is_indeterminate() { return !all_equal(this.values.map(v=>JSON.stringify(v))); }
    get has_defaults() { return this.defaults.some(d=>d != undefined); }
    get has_datas() { return !!(this.name || ("data" in this.settings)); }
    get is_default() { return JSON.stringify(this.values) === JSON.stringify(this.defaults); }
    get is_changed() {
        var datas = this.datas;
        var defaults = this.defaults;
        return this.values.some((v,i)=>{
            return JSON.stringify(v??null) !== JSON.stringify(datas[i]??defaults[i]??null)
        });
    }

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
            ...settings
        });
        var name = this.get_setting("name");
        if (typeof name === "number") name = String(name);
        this.#name = name || "";
        this.#name_id = `${this.#name||"undefined"}-${this.id}`;
        this.#name_split = this.#name ? this.#name.split("/") : [];
        this.on("update", this.__data_update);
        this.on("update", ()=>{
            if ("value" in this.settings) this.set_value(this.get_setting("value"));
        });

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

        if (changed || trigger) {
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
            if (JSON.stringify(value) === JSON.stringify(defaults[i])) return undefined;
            return value;
        });
        var new_values_hash = JSON.stringify(new_raw_values);
        this.#raw_values = new_raw_values;

        if (this._last_values_hash === new_values_hash) return false;
        this._last_values_hash = new_values_hash;

        return true;
    }

    __data_update() {
        if (!this.has_datas) return;

        var datas = this.datas;
        
        // var raw_values = this.raw_values;
        // if (datas.every(d=>d == undefined)) return;
        // if (datas.length === raw_values.length && datas.every((d,i)=>d === raw_values[i])) return;

        let datas_hash = JSON.stringify(datas);
        let new_values;
        if (this.#last_datas_hash !== datas_hash)  {
            new_values = datas;
        }
        this.#last_datas_hash = datas_hash;
        if (new_values) this.set_values(new_values);
    }

    __update_context() {
        /** @type {Property} */
        var pp;
        for (var ui of this.iterate_parents()) {
            if (ui instanceof Property) {
                pp = ui;
                break;
            }
        }
        this.__context.parent_property = pp;
        
        var path = this.path;

        var items = this.__context.items = this.get_setting("items") || (pp && pp.items) || [undefined];

        var datas = this.__context.datas =
            ("data" in this.settings && items.map(item=>this.get_setting("data", item, path))) ||
            (pp && pp.datas.map(data=>try_catch(()=>reflect.get(data, this.name_split)))) ||
            items.map(item=>try_catch(()=>reflect.get(item, path)));
        
        var defaults = this.__context.defaults = ("default" in this.settings && items.map((item,i)=>this.get_setting("default", item))) || items.map(item=>undefined);
        
        super.__update_context();
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