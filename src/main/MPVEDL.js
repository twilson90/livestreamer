import * as utils from "../core/utils.js";

export const MAX_EDL_REPEATS = 1024;
export const EDL_GENERAL_HEADERS = ["new_stream", "no_clip", "delay_open", "mp4_dash", "global_tags", "no_chapters", "track_meta"];

export class MPVEDLEntry {
    constructor(file_or_header, named_params) {
        if (file_or_header instanceof MPVEDLEntry) {
            named_params = file_or_header.params;
            file_or_header = file_or_header.file_or_header;
        }
        this.file_or_header = file_or_header;
        this.params = Object.assign({}, named_params);
    }
    append(k, v) {
        if (arguments.length === 1 && typeof k === "object") {
            for (let j in k) this.params[j] = String(k[j]);
        } else {
            this.params[k] = v;
        }
    }
    toString() {
        let parts = [this.file_or_header.toString()];
        for (var k in this.params) {
            let v = String(this.params[k]);
            v = MPVEDL.escape(v, true);
            parts.push(`${k}=${v}`);
        }
        return parts.join(",");
    }
}

export class MPVEDL {
    get duration() {
        var d = [0];
        for (var e of this.entries) {
            if (e.file_or_header == "!new_stream") d.push(0);
            if (e.params.length) d[d.length-1] += +e.params.length;
        }
        return Math.max(...d);
    }
    /** @type {MPVEDLEntry[]} */
    entries = [];
    get length() { return this.entries.length; }

    /** @param {Iterable<MPVEDLEntry>} entries */
    constructor(entries) {
        /** @type {MPVEDLEntry[]} */
        if (entries) this.append(...entries);
    }

    static escape(str, check=false) {
        str = String(str);
        if (check && !str.match(/[,;\n!]/)) return str;
        // returns incorrect length if slanted apostrophe in string
        return `%${Buffer.byteLength(str, "utf8")}%${str}`;
    }

    /** @param {string} filename @param {{start:number, end:number, duration:number, offset:number, loops:number}} opts */
    static repeat(filename, opts) {
        let edl = new MPVEDL();
        let clip_start = Math.max(0, opts.start || 0);
        let clip_end = Math.max(0, opts.end || opts.duration || 0);
        let clip_length = Math.max(0, clip_end - clip_start);
        let clip_offset = opts.offset || 0;
        if (clip_length < 0.01) clip_length = 0;
        let duration = Math.max(0, opts.duration || (clip_length * (opts.loops || 1)));
        for (let k of EDL_GENERAL_HEADERS) {
            if (k in opts) {
                let header = `!${k}`;
                if (typeof opts[k] === "object") header.append(opts[k]);
                edl.append(header);
            }
        }
        if (filename) {
            let t = utils.loop(clip_start + clip_offset, clip_start, clip_end);
            if (clip_length == 0) {
                edl.append(new MPVEDLEntry(MPVEDL.escape(filename), {
                    start: t.toFixed(3)
                }));
            } else {
                let d_left = duration;
                let i = 0;
                while (d_left > 0 && i < MAX_EDL_REPEATS) {
                    let e = Math.min(t + clip_length, t + d_left, clip_end)
                    let d = e - t;
                    edl.append(new MPVEDLEntry(MPVEDL.escape(filename), {
                        start:t.toFixed(3),
                        length:d.toFixed(3)
                    }));
                    d_left -= d;
                    i++;
                    if (e == clip_end) t = clip_start;
                }
            }
        }
        return edl;
    }

    /** @param {MPVEDLEntry[]} entries */
    append(...entries) {
        for (let e of entries) {
            if (!(e instanceof MPVEDLEntry)) e = new MPVEDLEntry(e);
            this.entries.push(e);
        }
    }

    toString(full=false) {
        var entries = this.entries.map(e=>e.toString());
        if (full) return [`# mpv EDL v0`, ...entries].join("\n");
        else return `edl://${entries.join(";")}`;
    }
    
    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]();
    }
}