import events from "node:events";
import {utils} from "./exports.js";

export class DataNode$ {}

/** @template {DataNode$} T */
export class DataNode extends events.EventEmitter {
    get $() { return this.observer.$; }
    #destroyed = false;
    get destroyed() { return this.#destroyed; }

    /** @param {T} $ */
    constructor($) {
        super();
        this.observer = new utils.Observer($);
    }
    
    set_values(...datas) {
        var changes = utils.tree_from_pathed_entries(datas);
        for (var k in changes) {
            this.$[k] = changes[k];
        }
    }
    
    update_values(...datas) {
        var changes = utils.tree_from_pathed_entries(datas);
        utils.deep_merge(this.$, changes);
        /* var expanded = [];
        for (var data of datas) {
            if (Array.isArray(data)) expanded.push(data);
            else expanded.push(...Object.entries(data));
        }
        for (var [k,v] of expanded) {
            var path = k.split("/");
            if (v == null) utils.reflect.deleteProperty(this.$, path);
            else utils.reflect.set(this.$, path, v);
        } */
    }
    
    destroy() {
        // safe to call multiple times.
        this.#destroyed = true;
        this.observer.removeAllListeners();
    }
}

export default DataNode;