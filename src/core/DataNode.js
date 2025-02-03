import events from "node:events";
import * as utils from "./utils.js";

export class DataNode extends events.EventEmitter {
    $ = new utils.Observer();
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
            utils.set(this.$, k.split("/"), v);
        }
    }
    
    destroy() {
        // safe to call multiple times.
        this.#destroyed = true;
        utils.Observer.destroy(this.$);
    }

    toString() {
        return `[${this.constructor.name}:${this.id}]`;
    }
}

export default DataNode;