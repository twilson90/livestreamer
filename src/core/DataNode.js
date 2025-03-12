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
    
    update_values(...datas) {
        var expanded = [];
        for (var data of datas) {
            if (Array.isArray(data)) expanded.push(data);
            else expanded.push(...Object.entries(data));
        }
        for (var [k,v] of expanded) {
            var path = k.split("/");
            if (v == null) utils.ref.deleteProperty(this.$, path);
            else utils.ref.set(this.$, path, v);
        }
    }
    
    destroy() {
        // safe to call multiple times.
        this.#destroyed = true;
        this.observer.removeAllListeners();
    }
}

export default DataNode;