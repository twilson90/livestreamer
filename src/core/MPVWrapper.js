import events from "node:events";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import readline from "node:readline";
import child_process from "node:child_process";
import {globals, utils, Logger} from "./exports.js";
// import which from "which";

const TIMEOUT = 10 * 1000;
const default_observes = [
    "playlist",
    "playlist-count",
    "playlist-pos",
    "idle-active",
    "time-pos",
    "volume",
    "mute",
];

export class MPVWrapper extends events.EventEmitter {
    #message_id;
    #observed_id;
    #socket_requests;
    #observed_properties;
    #quitting = false;
    #closed = false;
    #observed_props;
    #loading = false;
    /** @type {import("child_process").ChildProcessWithoutNullStreams} */
    #process;
    /** @type {net.Socket} */
    #socket;
    #socket_path = "";
    options;
    args;
    logger;

    get observed_props() { return this.#observed_props; }
    get process() { return this.#process; }
    get loading() { return this.#loading; }
    get quitting() { return this.#quitting; }
    get cwd() { return path.resolve(this.options.cwd); }

    constructor(options) {
        super();

        this.options = options = {
            executable: globals.app.mpv_path,
            cwd: ".",
            ipc: true,
            ...options,
        };
        
        this.#socket_path = globals.app.get_socket_path(`mpv-${utils.uuid4()}`);

        this.logger = new Logger("mpv");
    }

    /** @param {string[]} args */
    async start(args=[]) {
        args = [
            ...args,
            "--idle",
            // "--msg-level=all=trace", // IMPORTANT: when this is set, the stdout pipe will produce multiple logs before the video data starts!
            // "--msg-level=all=debug", // also some weirdness here...
            // "--msg-level=all=status,ipc=v"
            // "--msg-level=all=trace,ipc=v"
        ];
        args.push(`--input-ipc-server=${this.#socket_path}`);
        var is_piped = args.find(a=>a.match(/^--o=(-|pipe:)/));
        this.args = args;
        this.#message_id = 0;
        this.#observed_id = 0;
        this.#socket_requests = {}
        this.#observed_properties = {};
        this.#observed_props = {};
        
        this.logger.info("Starting MPV...");
        this.logger.info("MPV args:", args);
        
        this.#process = child_process.spawn(this.options.executable, args, {
            cwd: this.cwd,
            windowsHide: true,
            // stdio: ['ignore', is_piped ? 'pipe' : 'ignore', 'ignore'],
            stdio: is_piped ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'ignore'],
            maxBuffer: 1024 * 1024 * 16, // 16 MB buffer size
        });

        this.emit("before-start", this.#process);

        this.#process.on("close", (e)=>{
            this.#closed = true;
            this.quit();
        });
        this.#process.on("error", (e)=>{
            // must consume errors! om nom nom
            if (this.#closed) return;
            console.error(e);
        });

        var std_info = is_piped ? this.#process.stderr : this.#process.stdout;
        std_info.on("data", (data)=>{
            // data;
            this.logger.debug(data.toString());
        });

        globals.app.set_priority(this.#process.pid, os.constants.priority.PRIORITY_HIGHEST);
        
        this.logger.info("Waiting for MPV IPC to signal open...");
        
        if (!await this.#init_socket()) {
            await this.quit();
            return false;
        }

        if (!await this.get_property("idle-active")) {
            await new Promise(resolve=>this.once("idle", resolve));
        }

        for (var o of default_observes) {
            await this.observe_property(o).catch((e)=>this.logger.error(e));
            await this.get_property(o).then(v=>this.#observed_props[o] = v).catch(utils.noop);
        }
        
        return true;
    }

    async stop() {
        if (this.#quitting) return;
        if (this.#observed_props["idle-active"]) return;
        await this.command("stop");
        var handler;
        await new Promise((resolve)=>{
            handler = resolve;
            this.on("idle", handler);
        });
        this.off("idle", handler);
    }

    destroy() {
        return this.quit();
    }

    async quit() {
        if (this.#quitting) return;
        this.#quitting = true;
        this.emit("before-quit");
        if (this.#process && !this.#closed) {
            await new Promise(resolve=>{
                this.command("stop")
                    .catch(utils.noop)
                    .then(()=>{
                        this.command("quit").catch(utils.noop)
                    });
                this.#process.once("close", resolve);
                setTimeout(async ()=>{
                    if (this.#closed) return;
                    this.logger.warn("Quit signal not working. Terminating MPV process tree with SIGKILL...");
                    await utils.tree_kill(this.#process.pid, "SIGKILL");
                    resolve();
                }, 1000);
            }).catch((e)=>{
                this.logger.error("quit error:", e);
            });
        }
        this.emit("quit");
        if (this.#socket) {
            this.#socket.destroy();
        }
        await fs.unlink(this.#socket_path).catch(utils.noop);
        // this.logger.destroy();
    }

    #init_socket() {
        return new Promise(async (resolve, reject)=>{
            var giveup = false;
            setTimeout(()=>{
                giveup = true;
                reject(new Error("socket timeout"));
            }, TIMEOUT);
            var connected, onerror;
            while (!connected) {
                if (giveup) return;
                connected = await new Promise((resolve)=>{
                    this.#socket = new net.Socket();
                    this.#socket.on("error", onerror = (e)=>resolve(false));
                    this.#socket.connect({path: this.#socket_path}, ()=>resolve(true));
                });
                await utils.timeout(100);
            }
            this.#socket.off("error", onerror);
            this.#socket.on("close", ()=>this.quit());
            this.#socket.on("error", (error)=>{
                this.logger.error("socket error:", error);
            });
            var socket_listener = readline.createInterface(this.#socket);
            socket_listener.on("line", (msg)=>{
                if (msg.length > 0) {
                    try {
                        msg = JSON.parse(msg);
                    } catch {
                        this.logger.error(`Invalid JSON MPV Socket message:`, msg);
                        return;
                    }
                    if (msg.request_id && msg.request_id !== 0) {
                        var req = this.#socket_requests[msg.request_id];
                        delete this.#socket_requests[msg.request_id];
                        if (msg.error === "success") req.resolve(msg.data);
                        else req.reject({error: msg.error, command:req.command});
                    } else {
                        if (msg.event == "property-change") {
                            this.#observed_props[msg.name] = msg.data;
                        }
                        this.emit("message", msg);
                        if ("event" in msg) {
                            this.emit(msg.event, msg);
                        }
                    }
                }
            });
            this.logger.info("MPV IPC successfully binded");
            resolve(true);
        });
    }

    // ----------------------------------------------

    load_next(mode = "weak") {
        if ((this.#observed_props["playlist-pos"]+1) >= this.#observed_props["playlist-count"]) {
            if (mode === "weak") return false;
            return this.command("stop");
        } else {
            return this.on_load_promise(this.command("playlist-next", mode));
        }
    }

    playlist_prev(mode = "weak") {
        if (this.#observed_props["playlist-pos"] == 0) {
            if (mode === "weak") return false;
            return this.command("stop").then(()=>true);
        }
        return this.on_load_promise(this.command("playlist-prev", mode));
    }
    
    playlist_jump(position, force_play=true) {
        if (position < 0 || position >= this.#observed_props["playlist-count"]) return false;
        var prom = (force_play) ? this.command("playlist-play-index", position) : this.set_property("playlist-current-pos", position);
        return this.on_load_promise(prom);
    }
    
    async playlist_remove(position) {
        if (position < 0 || position >= this.#observed_props["playlist-count"]) return false;
        var item = this.#observed_props["playlist"][position];
        await this.on_playlist_change_promise(this.command("playlist-remove", position));
        return item ? item.id : null;
    }
    
    playlist_move(index1, index2) {
        return this.on_playlist_change_promise(this.command("playlist-move", index1, index2));
    }
    
    // removes every file from playlist EXCEPT currently played file.
    playlist_clear() {
        if (this.#observed_props["playlist-count"] == 0) return;
        var n = (this.#observed_props["playlist-pos"] > -1) ? 1 : 0;
        return this.on_playlist_change_promise(this.command("playlist-clear"), n);
    }
    
    loadlist(url, flags = "replace") {
        var prom = this.command("loadlist", url, flags);
        if (flags == "append") return this.on_playlist_change_promise(prom);
        return this.on_load_promise(prom);
    }
    
    async reload() {
        var time_pos = this.#observed_props["time-pos"];
        return this.playlist_jump(this.#observed_props["playlist-pos"]).then(()=>this.seek(time_pos));
    }

    set_property(property, value) {
        return this.command("set_property", property, value);
    }

    get_property(property) {
        return this.command("get_property", property);
    }

    add_property(property, value) {
        return this.command("add", property, value);
    }

    multiply_property(property, value) {
        return this.command("multiply", property, value);
    }

    cycle_property(property) {
        return this.command("cycle", property);
    }

    observe_property(property) {
        if (this.#observed_properties[property] !== undefined) return;
        const prop_id = ++this.#observed_id;
        this.#observed_properties[property] = prop_id;
        return this.command("observe_property", prop_id, property);
    }

    unobserve_property(property) {
        if (this.#observed_properties[property] === undefined) return;
        const prop_id = this.#observed_properties[property];
        delete this.#observed_properties[property];
        return this.command("unobserve_property", prop_id);
    }

    request_log_messages(level) {
        return this.command("request_log_messages", level);
    }

    async seek(seconds, flags="absolute+exact") {
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

    async loadfile(source, flags = "replace", index = -1, options = {}) {
        var params = [source, flags];
        if (index != null) params.push(index);
        if (options) params.push(options);
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
        return new Promise(async (resolve, reject)=>{
            setTimeout(()=>reject(`command timeout: ${JSON.stringify(command)}`), TIMEOUT);
            if (this.#socket.closed) {
                this.logger.warn(`Command '${command}' failed, socket is destroyed.`);
                process.nextTick(()=>reject());
                return;
            }
            const request_id = ++this.#message_id;
            const msg = { command, request_id };
            this.#socket_requests[request_id] = {
                command: command,
                resolve: resolve,
                reject: reject,
            };
            try {
                this.#socket.write(JSON.stringify(msg) + "\n", (e)=>{
                    if (!this.#socket.closed && !this.#quitting) {
                        if (e) {
                            this.logger.error(e);
                            delete this.#socket_requests[request_id];
                            reject();
                        }
                    }
                });
            } catch (e) {
                this.logger.error(e);
            }
        })
    }

    // remember playlist-count observe message always comes after playlist
    async on_playlist_change_promise(promise, count) {
        var handler;
        await new Promise((resolve, reject)=>{
            setTimeout(()=>reject(`on_playlist_change_promise timed out`), TIMEOUT);
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
        }).catch((e)=>this.logger.error(e));
        this.off("property-change", handler);
        return true;
    }

    async on_load_promise(promise) {
        var handler;
        let started = false;
        this.#loading = true;
        return new Promise((resolve, reject)=>{
            setTimeout(()=>reject(`File load timed out`), TIMEOUT);
            handler = (msg)=>{
                // console.log(msg);
                if ("event" in msg) {
                    if (msg.event === "start-file") {
                        started = true;
                    } else if (msg.event === "file-loaded" && started) {
                        this.#loading = false;
                        resolve();
                    } else if (msg.event === "end-file" && started) {
                        reject("File immediately ended.");
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

export default MPVWrapper;