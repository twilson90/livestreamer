import os from "node:os";
import fs from "fs-extra";
import stream from "node:stream";
import events from "node:events";
import readline from "node:readline";
import child_process from "node:child_process";
import {globals, utils, Logger} from "./exports.js";

class FFMPEGInfo {
    frame = 0;
    fps = 0;
    q = 0;
    size = 0;
    size_str = "";
    time = 0;
    bitrate = 0;
    bitrate_str = "";
    speed = 0;
    speed_alt = 0;
    /** @param {FFMPEGInfo} opts */
    constructor(opts) {
        Object.assign(this, opts);
    }
}

const default_opts = {
    log_filename: null,
    info_interval: 1000,
}

/** @extends {events.EventEmitter<{info:[FFMPEGInfo], line:string}>} */
export class FFMPEGWrapper extends events.EventEmitter {
    /** @type {import("child_process").ChildProcessWithoutNullStreams} */
    #process;
    #logger;
    #destroyed;
    #closed;
    #info_interval;
    #outputs = [];
    /** @type {FFMPEGInfo} */
    #last_info;
    /** @type {Promise<void>} */
    #done;

    get last_info() { return this.#last_info; }
    get process() { return this.#process; }
    get logger() { return this.#logger; }
    get outputs() { return this.#outputs; }
    get destroyed() { return this.#destroyed; }
    get closed() { return this.#closed; }
    get stderr() { return this.#process.stderr; }
    get stdin() { return this.#process.stdin; }
    get stdout() { return this.#process.stdout; }
    get done() { return this.#done; }

    /** @param {typeof default_opts} opts */
    constructor(opts) {
        super();
        this.opts = {
            ...default_opts,
            ...opts
        }
        this.#logger = new Logger("ffmpeg");
    }

    /** @param {string[]} args @param {child_process.SpawnOptionsWithoutStdio} spawn_opts */
    start(args, spawn_opts) {
        if (this.#done) throw new Error("FFMPEGWrapper already started");
        var res = new Promise((resolve, reject)=>{
                
            this.#logger.info(`Starting ffmpeg...`);
            this.#logger.debug(`ffmpeg args:`, args);
            
            this.#process = child_process.spawn(globals.app.ffmpeg_path, args, {windowsHide: true, ...spawn_opts});
            // globals.app.set_priority(this.#process.pid, os.constants.priority.PRIORITY_HIGHEST);

            this.#process.on("error", (e) => {
                reject(new Error(`FFMPEGWrapper process error: ${e.message}`));
                this.destroy();
            });

            this.#process.on("close", (code)=>{
                if (this.#closed) return;
                this.#closed = true;
                listener.close();
                clearInterval(this.#info_interval);
                if (!this.#destroyed && code) {
                    reject(new Error(`Error code ${code}: ${globals.app.debug ? last_lines.join("\n") : last_lines[last_lines.length-1]}`));
                } else {
                    resolve();
                }
            });
            
            let last_ts, last_hash;
            let listener = readline.createInterface(this.#process.stderr);
            var init_str = "", initialized = false;
            var last_lines = [];
            listener.on("error", (e)=>{
                if (this.#closed) return;
                this.logger.error(e);
            });
            listener.on("line", line=>{
                last_lines.push(line);
                if (last_lines.length > 64) last_lines.shift();
                this.#logger.debug(line);
                this.emit("line", line);
                if (!initialized) init_str += line+"\n";
                var m = line.match(/^(?:frame=\s*(.+?)\s+)?(?:fps=\s*(.+?)\s+)?(?:q=\s*(.+?)\s+)?(?:size=\s*(.+?)\s+)(?:time=\s*(.+?)\s+)(?:bitrate=\s*(.+?)\s+)(?:speed=(.+?)x\s+)/);
                if (m) {
                    if (!initialized) {
                        initialized = true;
                        let m;
                        let outputs = [];
                        for (m of init_str.matchAll(/Output #\d,\s+(.+?),\s+.+:\n([\s\S]+?)\n(?=[^\s])/g)) {
                            let format = m[1];
                            let metadata = {};
                            let streams = [];
                            let output = {format, metadata, streams}
                            var n = utils.build_hierarchy_from_indented_string(m[2]);
                            var add_nodes = (src, target)=>{
                                Object.keys(src).map(s=>{
                                    let m = s.match(/^(.+?)\s*:(.+)/);
                                    target[m[1]] = m[2].trim();
                                })
                            };
                            for (let k in n) {
                                let m;
                                if (k.match(/^Metadata:/)) {
                                    add_nodes(n[k], metadata);
                                } else if (m = k.match(/^Stream #(\d+):(\d+)\((.+?)\):\s+(.+?):\s+(.+)/)) {
                                    let metadata = {};
                                    let [_, file_id, stream_id, lang, type, info] = m;
                                    let stream = {file_id, stream_id, lang, type, metadata};
                                    type = type.toLowerCase();
                                    info = info.trim();
                                    if (type == "video") {
                                        // info.match(/^(.+?)\s*\((.+?)\), (.+?), (\d+)x(\d+)\s+\[SAR (\d+):(\d+) DAR (\d+):(\d+)\], (.+?), (.+?), (.+)/)
                                        let width = 0;
                                        let height = 0;
                                        info = info.split(/,\s+/);
                                        for (let i of info) {
                                            let m;
                                            if (m = i.match(/^(\d+)x(\d+)/)) {
                                                width = +m[1];
                                                height = +m[2];
                                            }
                                        }
                                        Object.assign(stream, {width,height});
                                    }
                                    for (let i in n[k]) {
                                        if (i.match(/^Metadata:/)) {
                                            add_nodes(n[k][i], metadata)
                                        }
                                    }
                                    streams.push(stream);
                                }
                            }
                            outputs.push(output);
                        }
                        this.#outputs = outputs;
                    }

                    let ts = Date.now();
                    let info = new FFMPEGInfo({
                        frame: parseInt(m[1]),
                        fps: parseInt(m[2]),
                        q: parseInt(m[3]),
                        size: utils.string_to_bytes(m[4]),
                        size_str: m[4],
                        time: utils.timespan_str_to_ms(m[5], "hh:mm:ss"),
                        bitrate: utils.string_to_bytes(m[6]),
                        bitrate_str: m[6],
                        speed: parseFloat(m[7]),
                        speed_alt: 1,
                    });
                    if (this.#last_info) {
                        info.speed_alt = (info.time - this.#last_info.time) / (ts - last_ts);
                    }
                    if (!this.opts.info_interval) this.emit("info", this.#last_info);
                    this.#last_info = info;
                    last_ts = ts;
                }
            });
            if (this.opts.info_interval) {
                this.#info_interval = setInterval(()=>{
                    var hash = JSON.stringify(this.#last_info);
                    if (hash == last_hash) return;
                    this.emit("info", this.#last_info);
                    last_hash = hash;
                }, this.opts.info_interval);
            }
            if (this.opts.log_filename) {
                var fs_stream = fs.createWriteStream(this.opts.log_filename);
                stream.promises.pipeline(this.stderr, fs_stream).catch(utils.pipe_error_handler(this.logger, "ffmpeg.stderr -> fs_stream"));
            }
        });
        this.#done = res.catch(utils.noop);
        return res;
    }

    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        if (!this.#closed) {
            this.#process.kill("SIGTERM");
            // this.#process.stdin.write('q');
        }
        setTimeout(()=>{
            if (!this.#closed) {
                this.#logger.warn("Killing ffmpeg with force...");
                this.#process.kill("SIGKILL");
            }
        }, 1000);
        return this.#done;
    }
}

export default FFMPEGWrapper;