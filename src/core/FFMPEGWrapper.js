import os from "node:os";
import events from "node:events";
import readline from "node:readline";
import child_process from "node:child_process";
import globals from "./globals.js";
import Logger from "./Logger.js";
import * as utils from "./utils.js";

export class FFMPEGWrapper extends events.EventEmitter {
    /** @type {import("child_process").ChildProcessWithoutNullStreams} */
    #process;
    #logger;
    #stopped;
    #closed;
    #info_interval;
    #outputs = [];

    get process() { return this.#process; }
    get logger() { return this.#logger; }
    get outputs() { return this.#outputs; }

    constructor(opts) {
        super();
        this.opts = {
            exec: "ffmpeg",
            info_interval: 1000,
            ...opts
        }
        this.#logger = new Logger(this.opts.exec);
    }

    /** @param {string[]} args @param {child_process.SpawnOptionsWithoutStdio} spawn_opts */
    start(args, spawn_opts) {
        return new Promise((resolve)=>{
                
            this.#logger.info(`Starting ${this.opts.exec}...`);
            this.#logger.debug(`${this.opts.exec} args:`, args);
            
            this.#process = child_process.spawn(this.opts.exec === "ffmpeg" ? globals.core.conf["core.ffmpeg_executable"]: globals.core.conf["core.ffplay_executable"], args, {windowsHide: true, ...spawn_opts});

            globals.core.set_priority(this.#process.pid, os.constants.priority.PRIORITY_HIGHEST);

            var handle_error = (e)=>{
                this.emit("error", e);
                this.#logger.error(e);
            }

            this.#process.on("error", (e) => {
                // must consume errors! om nom nom
                if (this.#closed) return;
                if (e.message.match(/kill EPERM/)) return;
                handle_error(e);
                this.stop();
            });
            this.#process.on("close", (code) => {
                if (this.#closed) return;
                this.#closed = true;
                clearInterval(this.#info_interval);
                if (this.#stopped) this.emit("end");
                else if (code) handle_error(new Error(`Error code ${code}: ${last_line}`));
                resolve();
            });

            // this.#process.on("exit", () => {});
            // this.#process.stderr.on("error", (e)=>console.error("ffmpeg stderr error", e));
            // this.#process.stdin.on("error",  (e)=>console.error("ffmpeg stdin error", e));
            // this.#process.stdout.on("error", (e)=>console.error("ffmpeg stdout error", e));
            // this.#process.stderr.on("close", (e)=>{});
            // this.#process.stdin.on("close",  (e)=>{});
            // this.#process.stdout.on("close", (e)=>{});
            
            let last_info, last_ts, last_emitted_info;
            let listener = readline.createInterface(this.#process.stderr);
            var init_str = "", initialized = false;
            var last_line;
            listener.on("line", line=>{
                last_line = line;
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
                                    var [_, file_id, stream_id, lang, type, info] = m;
                                    var stream = {file_id, stream_id, lang, type, metadata};
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

                    var ts = Date.now();
                    var info = {
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
                    }
                    if (last_info) {
                        info.speed_alt = (info.time - last_info.time) / (ts - last_ts);
                    }
                    if (!this.opts.info_interval) this.emit("info", last_info);
                    last_info = info;
                    last_ts = ts;
                }
            });
            if (this.opts.info_interval) {
                this.#info_interval = setInterval(()=>{
                    if (last_info == last_emitted_info) return;
                    this.emit("info", last_info);
                    last_emitted_info = last_info
                }, this.opts.info_interval);
            }
        });
    }

    async stop() {
        if (this.#stopped) return;
        this.#stopped = true;
        return new Promise(resolve=>{
            this.#process.kill("SIGINT");
            var timeout = setTimeout(()=>{
                this.#process.kill("SIGKILL");
            }, 2000);
            this.#process.on("close", ()=>{
                clearTimeout(timeout);
                resolve();
            });
        })
    }

    async destroy() {
        await this.stop();
        // this.#logger.destroy();
    }
}

export default FFMPEGWrapper;