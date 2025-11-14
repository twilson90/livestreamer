import events from "node:events";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import child_process from "node:child_process";
import tree_kill from "tree-kill-promise";
import {globals, utils, Logger, Cache} from "./exports.js";
// import which from "which";

const default_observes = [
    "playlist",
    "playlist-count",
    "playlist-pos",
    "idle-active",
    "time-pos",
    "volume",
    "mute",
    "pause",
    "eof-reached",
];

const default_options = {
    executable: "mpv",
    cwd: ".",
    ipc: false,
};

const features_cache = {};
/** @return {Promise<{version:{},args:{},props:{},filters:{},libavfilters:{}}>} */
async function get_features(executable) {
    features_cache[executable] = features_cache[executable] || (async()=>{
        var features = {
            version: {},
            args: {},
            props: {},
            filters: {},
            libavfilters: {}
        };
        let get_version = async ()=>{
            var str = (await utils.execa(executable, ["--version"])).stdout;
            features.version.full = str;
            features.version.mpv = str.match(/^mpv (\S+)/m)?.[1];
            features.version.libplacebo = str.match(/^libplacebo version: (\S+)/m)?.[1];
            features.version.ffmpeg = str.match(/^FFmpeg version: (\S+)/m)?.[1];
            var libs = str.split(/^FFmpeg library versions:$/m)?.[1] ?? "";
            for (let [_, lib, v] of libs.matchAll(/^\s+(\S+)\s+(\S+)$/gm)) {
                features.version[lib] = v;
            }
        };
        let get_options = async ()=>{
            var str = (await utils.execa(executable, ["--list-options"])).stdout;
            for (var m of str.matchAll(/^\s*--(\S+)(?:\s+(.+))?$/gm)) {
                features.args[m[1]] = true;
                features.props[m[1]] = true;
                if (m[2]?.match(/^Flag /)) {
                    features.args["no-" + m[1]] = true;
                }
            }
        };
        let get_filters = async (type)=>{
            let str = (await utils.execa(executable, [`--${type}=help`])).stdout;
            str.split(/^Available libavfilter filters:/m).forEach((str, i)=>{
                var list = [...str.matchAll(/^\s*(\S+)/gm)].map(m=>m[1]);
                for (let filter of list) {
                    ((i==0)?features.filters:features.libavfilters)[filter] = true;
                }
            })
        };
        await Promise.all([
            get_version(),
            get_options(),
            get_filters("vf"),
            get_filters("af"),
        ]);
        return features;
    })();

    return features_cache[executable];
}

export class MPVWrapper extends events.EventEmitter {
    #message_id;
    #observed_id;
    /** @type {Record<number, {command: any[], resolve: (value: any) => void, reject: (reason?: any) => void}>} */
    #socket_requests;
    #observed_prop_id_map;
    #destroyed = false;
    #closed = false;
    #observed_props;
    /** @type {import("child_process").ChildProcessWithoutNullStreams} */
    #process;
    #load_id = 0;
    /** @type {net.Socket} */
    #socket;
    #socket_path = "";
    #version;
    #options;
    #args;
    #is_piped = false;
    #ended = false;
    #id = "";
    /** @type {Logger} */
    #logger;
    /** @type {Promise<void>} */
    #done;
    /** @type {Promise<void>} */
    #ipc_ready;

    get options() { return this.#options; }
    get args() { return this.#args; }
    get observed_props() { return this.#observed_props; }
    get process() { return this.#process; }
    get destroyed() { return this.#destroyed; }
    get cwd() { return path.resolve(this.#options.cwd); }
    get load_id() { return this.#load_id; }
    /** @returns {[number, number, number]} */
    get version() { return this.#version; }
    get stdin() { return this.#process.stdin; }
    get stdout() { return this.#process.stdout; }
    get stderr() { return this.#process.stderr; }
    get id() { return this.#id; }
    get ended() { return this.#ended; }
    get logger() { return this.#logger; }
    get done() { return this.#done; }
    get ipc_ready() { return this.#ipc_ready; }

    /** @returns {number} */
    get time() { return this.#observed_props["time-pos"]; }
    /** @returns {number} */
    get volume() { return this.#observed_props["volume"]; }
    /** @returns {boolean} */
    get mute() { return this.#observed_props["mute"]; }
    /** @returns {boolean} */
    get idle_active() { return this.#observed_props["idle-active"]; }
    /** @returns {any[]} */
    get playlist() { return this.#observed_props["playlist"]; }
    /** @returns {number} */
    get playlist_count() { return this.#observed_props["playlist-count"]; }
    /** @returns {number} */
    get playlist_pos() { return this.#observed_props["playlist-pos"]; }
    /** @returns {number} */
    get pause() { return this.#observed_props["pause"]; }

    /** @param {typeof default_options} options */
    constructor(options) {
        super();

        this.#id = utils.uuid4();

        this.#options = {
            ...default_options,
            executable: globals.app.mpv_path,
            ...options,
        };

        this.#logger = new Logger("mpv");
    }

    features() { return get_features(this.#options.executable); }

    /** @param {string[]} args */
    start(args) {
        if (this.#done) throw new Error("MPVWrapper already started");
        this.#done = new Promise((resolve, reject)=>{
            // ({resolve, reject} = utils.onceify({resolve, reject}));
            args = [
                ...(args||[]),
                // "--idle",
                // "--msg-level=all=trace", // IMPORTANT: when this is set, the stdout pipe will produce multiple logs before the video data starts!
                // "--msg-level=all=debug", // also some weirdness here...
                // "--msg-level=all=status,ipc=v"
                // "--msg-level=ipc=v"
            ];
            if (this.#options.ipc) {
                this.#socket_path = globals.app.get_socket_path(`mpv-${this.#id}`, true);
                args.push(`--input-ipc-server=${this.#socket_path}`);
            }
            this.#is_piped = !!args.find(a=>a.match(/^--o=(-|pipe:)/));
            this.#args = args;
            this.#message_id = 0;
            this.#observed_id = 0;
            this.#socket_requests = {}
            this.#observed_prop_id_map = {};
            this.#observed_props = {};
            
            this.#logger.debug("Starting MPV...");
            // this.#logger.debug("MPV args:", args);
            
            this.#process = child_process.spawn(this.#options.executable, args, {
                cwd: this.cwd,
                windowsHide: this.#is_piped,
                stdio: ['pipe', 'pipe', this.#is_piped ? 'pipe' : 'ignore'],
                // maxBuffer: 1024 * 1024 * 16, // 16 MB buffer size
            });
            // this.#process.stdout._readableState.highWaterMark = 8*1024;

            this.emit("before-start", this.#process);

            var end = ()=>{
                this.#ended = true;
                resolve();
            }
            if (this.#is_piped) {
                // this.#process.stdout.on("end", end);
                this.#process.stdout.on("close", end);
            } else {
                this.#process.on("close", end);
            }

            this.#process.on("close", (code)=>{
                this.#closed = true;
                try {
                    if (this.#socket) this.#socket.end(()=>this.#socket.destroy());
                    fs.unlinkSync(this.#socket_path);
                } catch (e) { }
                if (!this.#destroyed && code) reject(code);
                else resolve();
            });
            this.#process.on("error", (e)=>{
                reject(e);
            });

            var std_info = this.#is_piped ? this.#process.stderr : this.#process.stdout;
            const rl = readline.createInterface(std_info);
            std_info.on("close", ()=>rl.close());
            rl.on("error", utils.noop);
            rl.on("line", (line)=>{
                this.#logger.debug(line.trim());
            });

            // globals.app.set_priority(this.#process.pid, os.constants.priority.PRIORITY_HIGHEST);

            if (this.#options.ipc) {
                this.#ipc_ready = (async()=>{
                    this.#logger.debug("Waiting for MPV IPC to signal open...");

                    await this.#init_socket();

                    for (var o of default_observes) {
                        this.observe_property(o).catch((e)=>this.#logger.error(e));
                        this.get_property(o).then(v=>this.#observed_props[o] = v).catch(utils.noop);
                    }
            
                    var version = await this.get_property('mpv-version');
                    this.#version = version ? version.split("mpv ")[1].split(".").slice(0, 3).map(s=>parseInt(s.match(/\d+/)[0])) : [0,0,0];
                })();
            }
        });
        return this.#done;
    }

    async stop() {
        if (!this.#socket) return;
        this.set_property("keep-open", false).catch(utils.noop);
        return Promise.race([
            this.#done.catch(utils.noop),
            new Promise((resolve, reject)=>{
                // ({resolve, reject} = utils.onceify({resolve, reject}));
                if (this.#observed_props["idle-active"]) return resolve();
                this.once("idle", ()=>resolve());
                this.command("stop").catch(reject);
            }),
        ]).then(()=>true);
    }

    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        var stop = ()=>this.stop().catch(utils.noop);
        var terminate = ()=>tree_kill(this.#process.pid, "SIGTERM").catch(utils.noop);
        var kill = ()=>tree_kill(this.#process.pid, "SIGKILL").catch(utils.noop);
        if (this.#is_piped) {
            stop();
            setTimeout(()=>{
                if (!this.#closed) {
                    this.#logger.warn("Sending MPV terminate signal...");
                    terminate();
                }
            }, 3000);
            setTimeout(()=>{
                if (!this.#closed) {
                    this.#logger.warn("Killing MPV with force...");
                    kill();
                }
            }, 6000);
        } else {
            kill();
        }
        return this.#done
            .catch(utils.noop)
            .finally(()=>this.logger.destroy())
    }

    #init_socket() {
        return new Promise(async (resolve, reject)=>{
            var giveup = false;
            var connected, onerror;
            while (!connected) {
                if (this.#closed) reject(new Error("MPV process closed"));
                if (giveup) return;
                connected = await new Promise((resolve)=>{
                    this.#socket = new net.Socket();
                    this.#socket.on("error", onerror=()=>resolve(false));
                    this.#socket.connect({path: this.#socket_path}, ()=>resolve(true));
                });
                await utils.timeout(100);
            }
            this.#socket.off("error", onerror);
            // ------------
            var socket_listener = readline.createInterface(this.#socket);
            this.#socket.on("close", ()=>{
                socket_listener.close();
                this.destroy();
            });
            this.#socket.on("error", (error)=>{
                this.#logger.warn("socket error:", error);
            });
            socket_listener.on("error", (e)=>{
                if (this.#closed) return;
                this.#logger.error(e);
            });
            socket_listener.on("line", (msg)=>{
                if (msg.length > 0) {
                    try {
                        msg = JSON.parse(msg);
                    } catch {
                        this.#logger.error(`Invalid JSON MPV Socket message:`, msg);
                        return;
                    }
                    if (msg.request_id && msg.request_id !== 0) {
                        var req = this.#socket_requests[msg.request_id];
                        delete this.#socket_requests[msg.request_id];
                        if (msg.error === "success") {
                            req.resolve(msg.data);
                        } else {
                            req.reject(Object.assign(new Error(`MPV IPC Error: ${msg.error}`), msg));
                        }
                    } else {
                        this.emit("message", msg);
                        if ("event" in msg) {
                            if (msg.event == "property-change") {
                                this.#observed_props[msg.name] = msg.data;
                                if (msg.name === "eof-reached" && msg.data) {
                                    this.emit("eof-reached");
                                }
                            }
                            this.emit(msg.event, msg);
                        }
                    }
                }
            });
            // this.version = await this.command("get_version");
            this.#logger.debug("MPV IPC successfully binded");
            resolve();
        });
    }

    // ----------------------------------------------

    load_next(mode = "weak") {
        if (!this.#socket) return;
        if ((this.#observed_props["playlist-pos"]+1) >= this.#observed_props["playlist-count"]) {
            if (mode === "weak") return false;
            return this.command("stop");
        } else {
            return this.on_load_promise(this.command("playlist-next", mode));
        }
    }

    playlist_prev(mode = "weak") {
        if (!this.#socket) return;
        if (this.#observed_props["playlist-pos"] == 0) {
            if (mode === "weak") return false;
            return this.command("stop").then(()=>true);
        }
        return this.on_load_promise(this.command("playlist-prev", mode));
    }
    
    playlist_jump(position, force_play=true) {
        if (!this.#socket) return;
        if (position < 0 || position >= this.#observed_props["playlist-count"]) return false;
        var prom = (force_play) ? this.command("playlist-play-index", position) : this.set_property("playlist-current-pos", position);
        return this.on_load_promise(prom);
    }
    
    async playlist_remove(position) {
        if (!this.#socket) return;
        if (position < 0 || position >= this.#observed_props["playlist-count"]) return false;
        var item = this.#observed_props["playlist"][position];
        await this.on_playlist_change_promise(this.command("playlist-remove", position));
        return item ? item.id : null;
    }
    
    playlist_move(index1, index2) {
        if (!this.#socket) return;
        return this.on_playlist_change_promise(this.command("playlist-move", index1, index2));
    }
    
    // removes every file from playlist EXCEPT currently played file.
    playlist_clear() {
        if (!this.#socket) return;
        if (this.#observed_props["playlist-count"] == 0) return;
        var n = (this.#observed_props["playlist-pos"] > -1) ? 1 : 0;
        return this.on_playlist_change_promise(this.command("playlist-clear"), n);
    }
    
    loadlist(url, flags = "replace") {
        if (!this.#socket) return;
        var prom = this.command("loadlist", url, flags);
        if (flags == "append") return this.on_playlist_change_promise(prom);
        return this.on_load_promise(prom);
    }

    set_property(property, value) {
        if (!this.#socket) return;
        return this.command("set_property", property, value);
    }

    get_property(property) {
        if (!this.#socket) return;
        return this.command("get_property", property);
    }

    add_property(property, value) {
        if (!this.#socket) return;
        return this.command("add", property, value);
    }

    multiply_property(property, value) {
        return this.command("multiply", property, value);
    }

    cycle_property(property) {
        if (!this.#socket) return;
        return this.command("cycle", property);
    }

    observe_property(property) {
        if (!this.#socket) return;
        if (this.#observed_prop_id_map[property] !== undefined) return;
        const prop_id = ++this.#observed_id;
        this.#observed_prop_id_map[property] = prop_id;
        return this.command("observe_property", prop_id, property);
    }

    unobserve_property(property) {
        if (!this.#socket) return;
        if (this.#observed_prop_id_map[property] === undefined) return;
        const prop_id = this.#observed_prop_id_map[property];
        delete this.#observed_prop_id_map[property];
        return this.command("unobserve_property", prop_id);
    }

    request_log_messages(level) {
        if (!this.#socket) return;
        return this.command("request_log_messages", level);
    }

    async seek(seconds, flags="absolute+exact") {
        if (!this.#socket) return;
        var msg_handler;
        let seek_event_started = false;
        return new Promise((resolve,reject)=>{
            msg_handler = (msg)=>{
                if ("event" in msg) {
                    if (msg.event === "seek") {
                        seek_event_started = true;
                    } else if (seek_event_started && msg.event === "playback-restart") {
                        resolve(true);
                    }
                }
            }
            this.on("message", msg_handler);
            this.command("seek", seconds, flags).catch(reject);
        }).finally(()=>{
            this.off("message", msg_handler);
        });
    }

    // need to figurte out if mpv is version 0.38 or later, then we can add index as 3rd  param.
    /** @returns {Promise<any,MPVLoadFileError>} */
    async loadfile(source, flags = "replace", index = -1, options = null) {
        if (!this.#socket) return;
        var params = [source, flags]; //, options
        options = options || {};
        if (this.#version[0] == 0 && this.#version[1] < 38) {
            params.push(options);
            if (index > -1) {
                this.#logger.warn("mpv version 0.38 or later is required for index as 3rd param");
            }
        } else {
            params.push(index, options);
        }
        var prom = this.command("loadfile", ...params);
        var item;
        if (flags === "replace" || (flags === "append-play" && this.#observed_props["idle-active"])) {
            await this.on_load_promise(prom);
            item = this.#observed_props["playlist"][this.#observed_props["playlist-pos"]];
        } else {
            var new_count = this.#observed_props["playlist-count"]+1;
            await this.on_playlist_change_promise(prom, new_count);
            item = this.#observed_props["playlist"][new_count-1];
        }
        return item ? item.id : null;
    }

    // ----------------------------------------------

    async command(...command) {
        if (!this.#socket) return;
        return new Promise(async (resolve, reject)=>{
            const request_id = ++this.#message_id;
            const msg = { command, request_id };
            this.#socket_requests[request_id] = {command,resolve,reject};
            if (!this.#socket.destroyed && this.#socket.writable) {
                this.#socket.write(JSON.stringify(msg) + "\n", (e)=>{
                    if (e) {
                        delete this.#socket_requests[request_id];
                        this.logger.error("COMMAND ERROR", command);
                        reject(Object.assign(new Error(`MPV command error: Failed to write`), e));
                    }
                });
            }
        });
    }

    // remember playlist-count observe message always comes after playlist
    async on_playlist_change_promise(promise, count) {
        if (!this.#socket) return;
        var handler;
        await new Promise((resolve, reject)=>{
            // setTimeout(()=>reject(`on_playlist_change_promise timed out`), TIMEOUT);
            if (count === undefined) {
                handler = (e)=>{
                    if (e.name == "playlist") resolve();
                }
            } else {
                handler = (e)=>{
                    if (e.name == "playlist-count" && e.data == count) resolve();
                }
            }
            this.on("property-change", handler);
            if (promise) promise.catch(reject);
        }).finally(()=>{
            this.off("property-change", handler);
        });
    }

    /** @param {Promise<any,MPVLoadFileError>} promise */
    async on_load_promise(promise) {
        if (!this.#socket) return;
        var handler;
        let start_event;
        var load_id = ++this.#load_id;
        return new Promise((resolve, reject)=>{
            // setTimeout(()=>reject(`File load timed out`), TIMEOUT);
            handler = (msg)=>{
                // console.log(msg);
                if (this.#load_id != load_id) {
                    reject(new MPVLoadFileError("override", "Another file was loaded."));
                    return;
                }
                if ("event" in msg) {
                    if (msg.event === "start-file") {
                        start_event = msg;
                    } else if (msg.event === "file-loaded" && start_event) {
                        resolve();
                        return;
                    } else if (msg.event === "end-file" && start_event && start_event.playlist_entry_id == msg.playlist_entry_id) {
                        reject(new MPVLoadFileError("ended", "File immediately ended."));
                        return;
                    }
                }
            };
            if (promise) promise.catch(reject);
            this.on("message", handler);
        }).finally(()=>{
            this.off("message", handler);
        });
    }
}

export class MPVLoadFileError extends Error {
    constructor(type, message) {
        super(message);
        this.type = type;
    }
    toString() {
        return `LoadFileError (${this.type}): ${this.message}`;
    }
}

export default MPVWrapper;