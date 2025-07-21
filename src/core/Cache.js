import path from "node:path";
import fs from "fs-extra";
import events from "events";
import {globals, utils} from "./exports.js";

/** @typedef {{data:any, expires:number}} CacheData */

/** @extends {events.EventEmitter<{delete:[CacheData],set:[CacheData]}>} */
export class Cache extends events.EventEmitter {
    /** @type {Record<string, CacheData>} */
    #cache = {};
    /** @type {Record<string, NodeJS.Timeout>} */
    #timeouts = {};
    #dir;
    #opts;
    #ready;
    get ready() { return this.#ready; }
    get dir() { return this.#dir; }

    constructor(dir, opts = {}) {
        super();
        opts = {
            ttl: 0,
            ...opts
        };
        this.#opts = opts;
        this.#dir = path.resolve(globals.app.cache_dir, dir);
        this.#ready = this.#init();
    }
    get keys() {
        return Object.keys(this.#cache);
    }
    get entries() {
        return Object.entries(this.#cache).map(([key, d])=>[key, d.data]);
    }
    get values() {
        return Object.values(this.#cache).map(d=>d.data);
    }

    async #init() {
        await fs.mkdir(this.#dir, {recursive:true});
        for (let key of await fs.readdir(this.#dir)) {
            let filepath = path.join(this.#dir, key);
            try {
                let d = JSON.parse(await fs.readFile(filepath, "utf8"));
                this.#set(key, d);
            } catch {
                await fs.rm(filepath).catch(utils.noop);
            }
        }
    }

    async destroy() {
        for (let key of Object.keys(this.#cache)) {
            await this.delete(key);
        }
    }

    #get_cache_filename(key) {
        return path.join(this.#dir, key);
    }

    #delete(key) {
        var d = this.#cache[key];
        delete this.#cache[key];
        this.emit("delete", {key, data:d.data});
    }

    /** @param {string} key @param {CacheData} d */
    #set(key, d) {
        this.#cache[key] = d;
        this.emit("set", {key, data:d.data});
        if (d.expires) {
            clearTimeout(this.#timeouts[key]);
            var t = d.expires - Date.now();
            if (t <= 0) this.delete(key);
            else this.#timeouts[key] = setTimeout(()=>this.delete(key), d.expires - Date.now());
        }
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
        clearTimeout(this.#timeouts[key]);
        this.#delete(key);
        var filename = this.#get_cache_filename(key);
        await fs.rm(filename).catch(utils.noop);
    }

    /** @param {string} key @param {any} data @param {number} ttl @description ttl if explicitly set to 0 or false will have infinite ttl, undefined or null will use the default ttl set in the constructor */
    async set(key, data, ttl) {
        if (ttl == undefined) ttl = this.#opts.ttl;
        var expires = ttl ? (Date.now() + ttl) : null;
        if (isNaN(expires)) expires = null;
        /** @type {CacheData} */
        var d = {data, expires};
        this.#set(key, d);
        var filename = this.#get_cache_filename(key);
        await globals.app.safe_write_file(filename, JSON.stringify(d));
    }
}
export default Cache;