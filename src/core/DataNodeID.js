import {utils, DataNode, DataNode$} from "./exports.js";

export class DataNodeID$ extends DataNode$ {
    id = "";
    constructor(id) {
        super();
        this.id = id || utils.uuid4();
    }
}

/** @template {DataNodeID$} T @template Events @extends {DataNode<T, Events>} */
export class DataNodeID extends DataNode {
    /** @type {string} */
    get id() { return this.$.id; } // always a string

    /** @param {string} id @param {T} $ */
    constructor(id, $) {
        if (id) id = String(id);
        else id = utils.uuid4();
        super($);
        this.$.id = id;
    }

    toString() {
        return `[${this.constructor.name}:${this.id}]`;
    }
}

export default DataNodeID;