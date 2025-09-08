import * as utils from "../core/utils.js";
import path from "node:path";

/** @typedef {{start:number, end:number, duration:number, offset:number, loops:number}} ClipOpts */

const delim_map = Object.fromEntries(["\n", ",", "%", "=", ";"].map(c=>[c, Buffer.from(c, 'utf8')[0]]));

export const MAX_EDL_REPEATS = 1024;
export const EDL_GENERAL_HEADERS = ["new_stream", "no_clip", "delay_open", "mp4_dash", "global_tags", "no_chapters", "track_meta"];

/* function shorten(filename) {
    var filepath = utils.pathify(filename);
    if (!filepath) return filename;
    var alt = path.relative(process.cwd(), filepath); // can significantly shorten path
    return (alt.length < filepath.length) ? alt : filepath;
} */

export class MPVEDLEntry {
    /** @type {string|MPVEDL} */
    #header = "";
    /** @type {Record<string, string>} */
    #params = {};

    get header() { return this.#header; }
    get params() { return this.#params; }
    get is_file() { return !this.#header.startsWith("!"); }

    constructor(header, named_params) {
        if (header instanceof MPVEDLEntry) {
            named_params = {...header.#params, ...named_params};
            header = header.#header;
        } else if (Array.isArray(header) && arguments.length == 1) {
            [header, named_params] = header;
        }
        this.#header = header;
        Object.assign(this.#params, named_params);
    }

    toString() {
        let header = (typeof this.#header === "string") ? this.#header : this.#header.toString();
        header = (header.startsWith("!")) ? header : MPVEDL.escape(header.toString());
        let parts = [header];
        for (var k in this.#params) {
            parts.push(`${k}=${MPVEDL.escape_if_necessary(this.#params[k].toString())}`);
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
    get entries() { return this.#entries; }
    get length() { return this.#entries.length; }

    /** @param {Iterable<MPVEDLEntry>} entries */
    constructor(entries) {
        /** @type {MPVEDLEntry[]} */
        if (entries) this.append(...entries);
    }

    /** @param {string} str */
    static escape(str) {
        // str.length returns incorrect length if slanted apostrophe in string, Buffer.byteLength is correct
        return `%${Buffer.byteLength(str, "utf8")}%${str}`;
    }

    /** @param {string} str @param {boolean} force */
    static escape_if_necessary(str) {
        if (str.match(/[,;\n!]/)) return MPVEDL.escape(str);
        return str;
    }

    /** @param {string} filename @param {ClipOpts} opts */
    static clip(filename, opts) {
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
                while (d_left >= 0.001 && i < MAX_EDL_REPEATS) {
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
                if (i >= MAX_EDL_REPEATS) {
                    console.warn(`EDL entry ${filename} has too many repeats (${i})`);
                }
            }
        }
        return entries;
    }

    /** @param {string} str */
    static parse(str) {
        /** @param {string} str @param {number[]} delimiters */
        function *split(str, delimiters) {
            var buffer = Buffer.from(str, 'utf8');
            var last_index = 0;
            for (var i = 0; i < buffer.length; i++) {
                if (buffer[i] == delim_map["%"]) {
                    let s = ++i;
                    for (; buffer[i] != delim_map["%"]; i++);
                    let len = parseInt(buffer.subarray(s, i).toString('utf8'));
                    i += len;
                    continue;
                }
                if (delimiters.includes(buffer[i])) {
                    yield buffer.subarray(last_index, i).toString('utf8');
                    last_index = i + 1;
                }
            }
            buffer = buffer.subarray(last_index, i);
            if (buffer.length) yield buffer.toString('utf8');
        }

        function unescape_value(value) {
            var m;
            if (m = value.match(/^%[0-9]+%/)) {
                value = value.slice(m[0].length);
            }
            return value;
        }

        /** @param {string} str */
        function parse_entry(str) {
            var param_map = {};
            var params  = [...split(str, [delim_map[","]])];
            if (params[0].startsWith("!")) {
                let header = params.shift();
                for (let param of params) {
                    let [key, value] = [...split(param, [delim_map["="]])];
                    if (value) value = unescape_value(value);
                    param_map[key] = value;
                }
                return new MPVEDLEntry(header, param_map);
            }

            if (params.length > 3) throw new Error("Invalid EDL entry", params);
            var filename = unescape_value(params.shift());
            if (params.length) {
                for (let i=0; i<2; i++) {
                    let [key, value] = [...split(params[i], [delim_map["="]])];
                    if (!value) {
                        value = key;
                        key = (i == 0) ? "start" : "length";
                    }
                    param_map[key] = unescape_value(value);
                }
            }
            return new MPVEDLEntry(filename, param_map);
        }
        var sep = ";";
        if (str.startsWith("edl://")) {
            str = str.slice(6);
            sep = ";";
        } else {
            str = str.replace(/^# mpv EDL v0\n/, "");
            sep = "\n";
        }
        var edl = new MPVEDL();
        var buffer = Buffer.from(str, 'utf8')
        var entry_strs = [...split(buffer, [delim_map[sep]])];
        for (var entry of entry_strs) {
            edl.append(parse_entry(entry));
        }
        return edl;
    }

    /** @param {any[]} entries */
    append(...entries) {
        this.#entries.push(...entries.map(e=>e instanceof MPVEDLEntry ? e : new MPVEDLEntry(e)));
    }

    /** @param {any[]} entries */
    prepend(...entries) {
        this.#entries.unshift(...entries.map(e=>e instanceof MPVEDLEntry ? e : new MPVEDLEntry(e)));
    }

    toString(full=false) {
        var entries = this.#entries.map(e=>e.toString());
        if (full) return [`# mpv EDL v0`, ...entries].join("\n");
        else return `edl://${entries.join(";")}`;
    }
}