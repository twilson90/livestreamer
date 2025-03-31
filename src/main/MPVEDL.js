import * as utils from "../core/utils.js";
import path from "node:path";

export const MAX_EDL_REPEATS = 1024;
export const EDL_GENERAL_HEADERS = ["new_stream", "no_clip", "delay_open", "mp4_dash", "global_tags", "no_chapters", "track_meta"];

function shorten(filename) {
    var filepath = utils.pathify(filename);
    if (!filepath) return filename;
    var alt = path.relative(process.cwd(), filepath); // can significantly shorten path
    return (alt.length < filepath.length) ? alt : filepath;
}

export class MPVEDLEntry {
    /** @type {string|MPVEDL} */
    #header;
    /** @type {Record<string, string>} */
    #params;

    get header() { return this.#header; }
    get params() { return this.#params; }

    constructor(header, named_params) {
        if (header instanceof MPVEDLEntry) {
            named_params = {...header.#params, ...named_params};
            header = header.#header;
        } else if (Array.isArray(header) && arguments.length == 1) {
            [header, named_params] = header;
        }
        this.#header = header;
        this.#params = {
            ...named_params,
        }
    }
    toString() {
        let header = (typeof this.#header === "string") ? this.#header : this.#header.toString();
        header = (header.startsWith("!")) ? header : MPVEDL.escape_value(shorten(header.toString()));
        let parts = [header];
        for (var k in this.#params) {
            parts.push(`${MPVEDL.escape_key(k)}=${MPVEDL.escape_value(this.#params[k].toString())}`);
        }
        return parts.join(",");
    }
}

export class MPVEDL {
    get duration() {
        var d = [0];
        for (var e of this.#entries) {
            if (e.header == "!new_stream") d.push(0);
            if (e.params.length) d[d.length-1] += +e.params.length;
        }
        return Math.max(...d);
    }
    /** @type {MPVEDLEntry[]} */
    #entries = [];
    get entries() { return this.#entries[Symbol.iterator](); }
    get length() { return this.#entries.length; }

    /** @param {Iterable<MPVEDLEntry>} entries */
    constructor(entries) {
        /** @type {MPVEDLEntry[]} */
        if (entries) this.append(...entries);
    }

    /** @param {string} str @param {boolean} force */
    static escape_key(str, force=false) {
        if (!force && !str.match(/[=%,;\n!]/)) return str;
        // str.length returns incorrect length if slanted apostrophe in string, Buffer.byteLength is correct
        return `%${Buffer.byteLength(str, "utf8")}%${str}`;
    }

    /** @param {string} str @param {boolean} force */
    static escape_value(str, force=false) {
        if (!force && !str.match(/[,;\n!]/)) return str;
        // str.length returns incorrect length if slanted apostrophe in string, Buffer.byteLength is correct
        return `%${Buffer.byteLength(str, "utf8")}%${str}`;
    }

    /** @param {string} filename @param {{start:number, end:number, duration:number, offset:number, loops:number}} opts */
    static repeat(filename, opts) {
        /** @type {MPVEDLEntry[]} */
        let entries = [];
        let clip_start = Math.max(0, opts.start || 0);
        let clip_end = Math.max(0, opts.end || opts.duration || 0);
        let clip_length = Math.max(0, clip_end - clip_start);
        let clip_offset = opts.offset || 0;
        if (clip_length < 0.01) clip_length = 0;
        let duration = Math.max(0, opts.duration || (clip_length * (opts.loops || 1)));
        if (filename) {
            let t = utils.loop(clip_start + clip_offset, clip_start, clip_end);
            if (clip_length == 0) {
                entries.push(new MPVEDLEntry(filename, {
                    start: t.toFixed(3)
                }));
            } else {
                let d_left = duration;
                let i = 0;
                while (d_left > 0 && i < MAX_EDL_REPEATS) {
                    let e = Math.min(t + clip_length, t + d_left, clip_end)
                    let d = e - t;
                    entries.push(new MPVEDLEntry(filename, {
                        start:t.toFixed(3),
                        length:d.toFixed(3)
                    }));
                    d_left -= d;
                    i++;
                    if (e == clip_end) t = clip_start;
                }
            }
        }
        return entries;
    }

    /** @param {any[]} entries */
    append(...entries) {
        for (let e of entries) {
            this.#entries.push(new MPVEDLEntry(e));
        }
    }

    /** @param {any[]} entries */
    prepend(...entries) {
        for (let e of entries) {
            this.#entries.unshift(new MPVEDLEntry(e));
        }
    }

    toString(full=false) {
        var entries = this.#entries.map(e=>e.toString());
        if (full) return [`# mpv EDL v0`, ...entries].join("\n");
        else return `edl://${entries.join(";")}`;
    }
}