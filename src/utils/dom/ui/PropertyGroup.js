import { Property } from "./Property.js";
import { traverse } from "./ui.js";
import { toggle_class } from "../toggle_class.js";
import { deep_diff } from "../../deep_diff.js";
import { Diff } from "../../Diff.js";
import { walk } from "../../walk.js";
/** @import {PropertySettings,PropertyEvents} from './exports.js' */

/** @typedef {{path:string[],new_value:any,old_value:any}} PropertyChange */

/** 
 * @template ItemType 
 * @template [ValueType=any]
 * @template {PropertySettings<ItemType,ValueType,PropertyGroup>} [Settings=PropertySettings<ItemType,ValueType,PropertyGroup>]
 * @template {PropertyEvents} [Events=PropertyEvents]
 * @extends {Property<ItemType,ValueType,Settings,Events>} 
 */
export class PropertyGroup extends Property {
    get is_valid() {
        return this.properties.filter(p=>!p.is_hidden).every(p=>p.is_valid);
    }
    get properties() {
        return [...this.iterate_properties()];
    }
    /** @yields {Property} */
    *iterate_properties() {
        for (var ui of traverse(this.elem, (ui) => !(ui instanceof Property))) {
            if (ui instanceof Property) yield ui;
        }
    }
    get changes() {
        var datas = this.datas;
        var values = this.raw_values;
        /** @returns {PropertyChange[]} */
        var walk = (o1, o2, path, changes) => {
            if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
                for (var k in o1) {
                    walk(o1[k], o2[k], [...path, k], changes);
                }
            } else if (o1 !== o2) {
                changes.push({path, new_value: o1, old_value: o2});
            }
            return changes;
        };
        return values.map((value,i)=>{
            var data = datas[i];
            return walk(value, data, [], []);
        });
    }
    get named_properties() {
        return this.properties.filter(p => p.name);
    }
    get named_property_map() {
        return Object.fromEntries(this.named_properties.map(p => [p.name, p]));
    }

    /** @param {Settings} settings */
    constructor(settings) {
        super({
            "show_changed": false,
            "show_not_default": true,
            ...settings,
        });

        this.elem.classList.add("property-group");

        this.elem.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.target.matches("input,select")) {
                e.target.blur();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        /* this.elem.addEventListener("focusin", (e) => {
            if (this.parent_property) return;
            this.update_next_frame();
        });
        this.elem.addEventListener("focusout", (e) => {
            if (this.parent_property) return;
            this.update_next_frame();
        }); */
        this.on("render", this.#render);
    }

    #render() {
        toggle_class(this.elem, "show-changed", this.get_setting("show_changed"));
        toggle_class(this.elem, "show-not-default", this.get_setting("show_not_default"));
    }

    // bad. property groups should be for getting, not setting.
    // /** @param {Record<string,any>[]} values @param {SetValueOptions} options */
    set_values(values_maps, options) {
        var props = this.named_property_map;
        var value_map = {};
        for (var map of values_maps) {
            for (var k in props) {
                if (!value_map[k]) value_map[k] = [];
                value_map[k].push(map ? map[k] : undefined);
            }
        }
        for (var k in props) {
            if (!(k in value_map)) continue;
            props[k].set_values(value_map[k], options);
        }
    }

    __data_update() {}
    get has_datas() { return false;}
    get raw_values() { return get_props(this, "raw_values"); }
    get values() { return get_props(this, "values"); }
    get defaults() { return get_props(this, "defaults"); }
    // get datas() { return get_props(this, "datas"); }
}

/** @param {PropertyGroup} pg @param {string} value_key */
var get_props = (pg, value_key)=>{
    var props = pg.named_properties;
    var res = [];
    var cached_values = Object.fromEntries(props.map(p=>[p.name, p[value_key]]));
    pg.items.forEach((item,i)=>{
        var map = {};
        var path_len = pg.path.length;
        for (var p of props) {
            var curr = map;
            var path = p.path.slice(path_len);
            var last = path.pop();
            for (var n of path) {
                if (!curr[n]) curr[n] = {};
                curr = curr[n];
            }
            curr[last] = cached_values[p.name][i];
        }
        res.push(map);
    });
    return res;
}

export default PropertyGroup;