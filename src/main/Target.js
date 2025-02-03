import fs from "fs-extra";
import path from "node:path";
import DataNode from "../core/DataNode.js";
import * as utils from "../core/utils.js";
import globals from "./globals.js";
/** @import { StreamTarget } from './types.d.ts' */

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

export class Target extends DataNode {
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
    config(data, st) { return (this.#data.config || (()=>{}))(data, st); }

    constructor(data) {
        data = {
            limit: 1,
            ...data
        };
        super(data.id);
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
        // utils.rename_property(data, "url", "view_url");
        Object.assign(this.$, data);
        if (!this.$.locked) this.$.ts = Date.now();
        if (!this.$.ts) this.$.ts = Date.now();
        if (!this.$.access_control) this.$.access_control = {};
        globals.app.fix_access_control(this.$.access_control);
    }
    
    /** @param {Target} data */
    async update(data) {
        this.#update(data);
        await this.save();
    }

    async save() {
        if (!this.locked) {
            var data = {...this.$};
            await fs.writeFile(path.resolve(globals.app.targets_dir, this.id), JSON.stringify(data, null, 4));
        }
    }
    
    async destroy() {
        super.destroy();
        for (var st of this.stream_targets) {
            await st.destroy();
        }
        delete globals.app.targets[this.id];
        delete globals.app.$.targets[this.id];
        if (!this.locked) {
            await fs.unlink(path.resolve(globals.app.targets_dir, this.id)).catch(()=>{});
        }
    }
}

export default Target;