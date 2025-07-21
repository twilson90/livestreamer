import fs from "fs-extra";
import path from "node:path";
import {globals} from "./exports.js";
import {utils, DataNodeID, DataNodeID$, AccessControl} from "../core/exports.js";
/** @import { StreamTarget } from './exports.js' */

// stream_targets
// streams
// name
// description
// rtmp_host
// rtmp_key
// title
// url
// access_control
// ts
// limit
// locked

export class Target$ extends DataNodeID$ {
    name = "";
    description = "";
    rtmp_host = "";
    rtmp_key = "";
    title = "";
    url = "";
    access_control = new AccessControl();
    ts = 0;
    locked = false;
    limit = 1;
}

/** @extends {DataNodeID<Target$>} */
export class Target extends DataNodeID {
    #data;
    get stream_targets() { return Object.values(globals.app.streams).map(s=>s.stream_targets[this.id]).filter(st=>st); }
    get streams() { return this.stream_targets.map(st=>st.stream); }
    get name() { return this.$.name; }
    get description() { return this.$.description; }
    get rtmp_host() { return this.$.rtmp_host; }
    get rtmp_key() { return this.$.rtmp_key; }
    get title() { return this.$.title; }
    get url() { return this.$.url; } // viewing url
    get access_control() { return this.$.access_control; }
    get ts() { return this.$.ts; }
    get limit() { return this.$.limit; } // number of streams that can be done concurrently
    get locked() { return this.$.locked; }
    /** @param {StreamTarget} st */
    config(data, st) { return (this.#data.config || utils.noop)(data, st); }

    constructor(data) {
        data = {
            limit: 1,
            ...data
        };
        super(data.id, new Target$());
        this.#data = data;
        
        globals.app.targets[this.id] = this;
        globals.app.$.targets[this.id] = this.$;

        this.#update(data);
    }

    #update(data) {
        data = {...data};
        delete data.config;
        delete data.stream_priority;
        delete data.stream_id;
        Object.assign(this.$, data);
        if (!this.$.locked || !this.$.ts) this.$.ts = Date.now();
        if (!this.$.access_control) this.$.access_control = new AccessControl();
    }
    
    /** @param {Target} data */
    async update(data) {
        this.#update(data);
        await this.save();
    }

    async save() {
        if (this.locked) return;
        var data = {...this.$};
        await globals.app.safe_write_file(path.resolve(globals.app.targets_dir, this.id), JSON.stringify(data, null, 4));
    }

    async ondestroy() {
        for (var st of this.stream_targets) {
            await st.destroy();
        }
        delete globals.app.targets[this.id];
        delete globals.app.$.targets[this.id];
        if (!this.locked) {
            await fs.unlink(path.resolve(globals.app.targets_dir, this.id)).catch(utils.noop);
        }
        return super.ondestroy();
    }
}

export default Target;