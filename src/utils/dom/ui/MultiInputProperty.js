import { InputProperty } from "./InputProperty.js";
import { PropertyGroup } from "./PropertyGroup.js";
/** @import {InputPropertySettings,PropertyEvents} from './exports.js' */

/** 
 * @template ItemType 
 * @template ValueType
 * @template {InputPropertySettings<ItemType,ValueType,MultiInputProperty>} [Settings=InputPropertySettings<ItemType,ValueType,MultiInputProperty>]
 * @template {PropertyEvents} [Events=PropertyEvents]
 * @extends {InputProperty<ItemType,ValueType,Settings,Events>} 
 */
export class MultiInputProperty extends InputProperty {
    /** @param {Settings} settings */
    constructor(settings) {
        var group = new PropertyGroup();
        super(group.elem, {
            "setup": false,
            ...settings
        });
        group.elem.classList.add("property-multiple");
        this.group = group;
        /** @type {InputProperty[]} */
        var props = this.get_setting("props");
        if (!Array.isArray(props)) props = [props];
        for (var prop of props) {
            group.append(prop);
        }
    }

    set_values(values_maps, options) {
        this.group.set_values(values_maps, options);
    }
    
    __data_update() {}
    get has_datas() { return this.group.properties.some(p=>p.has_datas); }
    get is_changed() { return this.group.properties.some(p=>p.is_changed); }
    get raw_values() {
        var defaults = this.defaults;
        return try_make_arrays(this.group.raw_values.map((v,i)=>{
            if (Object.values(v).every(v=>v == undefined)) return undefined;
            var res = Object.fromEntries(Object.entries(v).map(([k,v])=>[k,v??defaults[i][k]]));
            return res;
        }));
    }
    get values() { return try_make_arrays(this.group.values); }
    get defaults() { return try_make_arrays(this.group.defaults); }
    // get datas() { return this.group.datas; }
}

/** @param {Record<string,any>[]} values */
function try_make_arrays(values) {
    return values.map(map=>{
        if (map) {
            var keys = Object.keys(map);
            var is_keys_numeric = keys.every(k=>/^\d+$/.test(k));
            if (is_keys_numeric) {
                var max = Math.max(...keys.map(k=>parseInt(k)));
                return Array.from({...map, length:max+1});
            }
        }
        return map;
    });
}

export default MultiInputProperty;