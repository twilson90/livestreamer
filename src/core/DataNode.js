import events from "node:events";
import {utils} from "./exports.js";

export class DataNode$ {}

/** @typedef {{destroy:[]}} DefaultEvents */

/** @template {DataNode$} T @template Events @extends {events.EventEmitter<DefaultEvents & Events>} */
export class DataNode extends events.EventEmitter {
    #destroyed = false;
    /** @type {utils.Observer<T>} */
    #observer;
    get destroyed() { return this.#destroyed; }
    get observer() { return this.#observer; }
    get $() { return this.observer.$; }

    /** @param {T} $ */
    constructor($) {
        super();
        this.#observer = new utils.Observer($);
    }
    
    update_values(data) {
        for (var k in data) {
            if (data[k] == null) delete this.$[k];
            else this.$[k] = data[k];
        }
    }
    
    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        await this.ondestroy();
        this.emit("destroy");
        this.#observer.removeAllListeners();
        this.removeAllListeners();
    }

    ondestroy(){}
}

export default DataNode;