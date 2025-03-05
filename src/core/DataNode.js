import events from "node:events";
import * as utils from "./utils.js";

export class DataNode extends events.EventEmitter {
    observer = new utils.Observer();
    get $() { return this.observer.$; }
    /** @type {string} */
    get id() { return this.$.id; } // always a string
    #destroyed = false;
    get destroyed() { return this.#destroyed; }

    constructor(id) {
        super();
        if (id == null) id = utils.uuid4();
        else id = String(id);
        this.$.id = id;
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

    toString() {
        return `[${this.constructor.name}:${this.id}]`;
    }
}

export default DataNode;