import path from "node:path";
import fs from "fs-extra";
import globals from "./globals.js";
import * as utils from "./utils.js";

export class Cache extends utils.EventEmitter {
    #cache = {};
    #timeouts = {};
    #dir;
    #opts;

    get dir() { return this.#dir; }

    constructor(dir, opts = {}) {
        super();
        opts = {
            ttl: 0,
            ...opts
        };
        this.#opts = opts;
        this.#dir = path.resolve(globals.core.cache_dir, dir);
    }
    get keys() {
        return Object.keys(this.#cache);
    }
    get entries() {
        return Object.entries(this.#cache);
    }
    get values() {
        return Object.values(this.#cache).map(d=>d.data);
    }

    async init() {
        await fs.mkdir(this.#dir, {recursive:true});
        for (let key of await fs.readdir(this.#dir)) {
            let filename = this.#get_cache_filename(key);
            try {
                let d = JSON.parse(await fs.readFile(filename, "utf8"));
                this.#cache[key] = d;
                if (d.expires) this.#setup_expire(key, d.expires);
            } catch {
                await fs.rm(filename).catch(utils.noop);
            }
        }
    }

    async destroy() {
        for (let key of Object.keys(this.#cache)) {
            await this.delete(key);
        }
    }

    #get_cache_filename(key) {
        return path.join(this.#dir, utils.md5(key));
    }

    #setup_expire(key, expires) {
        clearTimeout(this.#timeouts[key]);
        this.#timeouts[key] = setTimeout(()=>this.delete(key), expires - Date.now());
    }

    /** @param {string} key */
    get(key) {
        let d = this.#cache[key];
        if (d) return d.data;
    }

    /** @param {string} key */
    async delete(key) {
        if (!this.#cache[key]) return;
        var {data} = this.#cache[key];
        this.emit("delete", {key, data});
        clearTimeout(this.#timeouts[key]);
        delete this.#cache[key];
        var filename = this.#get_cache_filename(key);
        await fs.rm(filename).catch(utils.noop);
    }

    /** @param {string} key */
    async set(key, data, ttl=null) {
        if (!ttl) ttl = this.#opts.ttl;
        var d = {data, expires: ttl ? (Date.now() + ttl) : null};
        this.#cache[key] = d;
        this.emit("set", {key, data});

        if (d.expires) this.#setup_expire(key, d.expires);
        var filename = this.#get_cache_filename(key);
        await fs.writeFile(filename, JSON.stringify(d));
    }
}
export default Cache;