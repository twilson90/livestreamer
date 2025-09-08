import stream from "node:stream";
import child_process from "node:child_process";
import readline from "node:readline";
import {utils} from "./exports.js";
/** @import * as events from "events" */

/** @typedef {{pts_time:number,dts_time:number,pts:number,dts:number}} PTSData **/
export class FFProbePTSPassThrough extends stream.Transform {
    #ffprobe;
    #rl;
    pts_time = 0;
    dts_time = 0;
    pts = 0;
    dts = 0;

    /** @param {string[]} format @param {stream.TransformOptions} opts */
    constructor(format, opts) {
        super(opts);
        this.#ffprobe = child_process.spawn('ffprobe', [
            ...(format ? ["-f", format] : []),
            "-i", "pipe:0",
            "-show_packets",
            "-select_streams", "v:0",
            "-v", "quiet"
        ]);
        var emit = utils.debounce_next_tick(()=>this.emit("pts", {pts_time: this.pts_time, dts_time: this.dts_time, pts: this.pts, dts: this.dts}));
        this.#rl = readline.createInterface(this.#ffprobe.stdout);
        this.#rl.on('line', (line) => {
            let m;
            let do_emit = false;
            if (m = line.match(/^pts_time=(.+)$/)) {
                this.pts_time = Math.max(this.pts_time, +m[1]);
                do_emit = true;
            } else if (m = line.match(/^dts_time=(.+)$/)) {
                this.dts_time = Math.max(this.dts_time, +m[1]);
                do_emit = true;
            } else if (m = line.match(/^pts=(.+)$/)) {
                this.pts = Math.max(this.pts, +m[1]);
                do_emit = true;
            } else if (m = line.match(/^dts=(.+)$/)) {
                this.dts = Math.max(this.dts, +m[1]);
                do_emit = true;
            }
            if (do_emit) emit();
        });
    }
    
    _transform(chunk, encoding, callback) {
        this.push(chunk);
        this.#ffprobe.stdin.write(chunk);
        callback();
    }
}