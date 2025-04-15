import events from "node:events";
import {utils} from "./exports.js";
import { deep_merge } from "./utils.js";

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
    
    update_values(datas) {
        deep_merge(this.$, datas, {delete_nulls:true});
    }
    
    destroy() {
        // safe to call multiple times.
        this.#destroyed = true;
        this.observer.removeAllListeners();
    }
}

export default DataNode;