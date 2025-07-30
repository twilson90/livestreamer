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
    
    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        await this._destroy();
        this.emit("destroy");
        this.#observer.removeAllListeners();
        this.removeAllListeners();
    }

    _destroy(){}
}

export default DataNode;