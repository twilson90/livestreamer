import events from "node:events";
import {utils} from "./exports.js";

export class DataNode$ {}

/** @typedef {{destroy:[]}} DefaultEvents */

/** @template {DataNode$} T @template Events @extends {events.EventEmitter<DefaultEvents & Events>} */
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
        utils.deep_merge(this.$, datas, {delete_nulls:true});
    }
    
    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        await this.ondestroy();
        this.emit("destroy");
        this.observer.removeAllListeners();
        this.removeAllListeners();
    }

    ondestroy(){}
}

export default DataNode;