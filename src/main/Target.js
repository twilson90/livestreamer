import fs from "fs-extra";
import path from "node:path";
import DataNode from "../core/DataNode.js";
import globals from "./globals.js";
/** @import { SessionBase, Stream, StreamTarget } from './types.d.ts' */

export class Target extends DataNode {
    get streams() { return Object.values(globals.app.streams).filter(s=>s.stream_targets[this.id]); }
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

    constructor(data) {
        data = {
            limit: 1,
            ...data
        };
        super(data.id);
        // this.config = config;
        globals.app.targets[this.id] = this;
        globals.app.$.targets[this.id] = this.$;

        this.user_config = data.config || (()=>{});
        delete data.config;
        delete data.stream_priority;
        delete data.stream_id;
        this.#update(data);
    }

    /** @param {StreamTarget} st */
    evaluate(st) {
        var data = { ...this.$, ...this.user_config(st), opts: { ...st.stream.session.$.target_opts[st.target.id] } };
        var {rtmp_url, rtmp_host, rtmp_key, opts} = data;
        if (!rtmp_url) {
            rtmp_url = rtmp_key ? rtmp_host.replace(/\/+$/, "") + "/" + rtmp_key.replace(/^\/+/, "") : rtmp_host;
        }
        rtmp_url = new URL(rtmp_url);
        for (var k in opts) {
            var v = opts[k];
            rtmp_url.searchParams.append(k, (typeof v === "boolean") ? Number(v) : String(v));
        }
        data.rtmp_url = rtmp_url.toString();
        return data;
    }

    #update(data) {
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
        delete globals.app.targets[this.id];
        delete globals.app.$.targets[this.id];
        if (!this.locked) {
            await fs.unlink(path.resolve(globals.app.targets_dir, this.id)).catch(()=>{});
        }
    }
}

export default Target;