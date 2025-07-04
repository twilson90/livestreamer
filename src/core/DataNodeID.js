import fs from "fs-extra";
import path from "node:path";
import {utils, DataNode, DataNode$, globals} from "./exports.js";

export class DataNodeID$ extends DataNode$ {
    id = "";
    constructor() {
        super();
    }
}

/** @template {DataNodeID$} T @template Events @extends {DataNode<T, Events>} */
export class DataNodeID extends DataNode {
    /** @type {string} */
    get id() { return this.$.id; } // always a string

    /** @param {string} id @param {T} $ */
    constructor(id, $) {
        super($);
        if (id) id = String(id);
        else id = utils.uuidb64();
        this.$.id = id;
    }

    toString() {
        return `[${this.constructor.name}:${this.id}]`;
    }
}

export default DataNodeID;