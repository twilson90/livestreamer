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
    #closed;
    #info_interval;

    get process() { return this.#process; }
    get logger() { return this.#logger; }

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
        this.#closed = false;
        
        this.#logger.info(`Starting ${this.opts.exec}...`);
        this.#logger.debug(`${this.opts.exec} args:`, args);
        
        this.#process = child_process.spawn(this.opts.exec === "ffmpeg" ? globals.core.conf["core.ffmpeg_executable"]: globals.core.conf["core.ffplay_executable"], args, {windowsHide: true, ...spawn_opts});

        globals.core.set_priority(this.#process.pid, os.constants.priority.PRIORITY_HIGHEST);

        this.#process.on("error", (e) => {
            // must consume errors! om nom nom
            if (this.#closed) return;
            if (e.message.match(/kill EPERM/)) return;
            this.#logger.error(e);
            this.stop();
        });
        this.#process.on("close", (code) => {
            this.#closed = true;
            clearInterval(this.#info_interval);
            this.emit("end");
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
        listener.on("line", line=>{
            this.#logger.debug(line);
            this.emit("line", line);
            var m = line.match(/^(?:frame=\s*(.+?)\s+)?(?:fps=\s*(.+?)\s+)?(?:q=\s*(.+?)\s+)?(?:size=\s*(.+?)\s+)(?:time=\s*(.+?)\s+)(?:bitrate=\s*(.+?)\s+)(?:speed=(.+?)x\s+)/);
            if (m) {
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
    }

    async stop() {
        if (this.#closed) return;
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