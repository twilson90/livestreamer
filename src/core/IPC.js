import events from "node:events";
import net from "node:net";
import readline from "node:readline";
import fs from "node:fs";
import {utils, errors, Logger, globals} from "./exports.js";

/** @typedef {{name:string,pid:number,sock:net.Socket}} ProcessDefinition */

const pid = process.pid
class IPC {
    /** @type {Record<PropertyKey,ProcessDefinition>} */
    #processes = {};
    /** @type {Record<PropertyKey,Function(...args:any):any>} */
    #responses = {};
    #destroyed = false;
    #emitter = new events.EventEmitter();
    /** @type {ProcessDefinition} */
    #process;
    /** @type {Logger} */
    #logger;
    #rid = 0;

    /** @protected */
    get emitter() { return this.#emitter; }
    get processes() { return this.#processes; }
    get process() { return this.#process; }
    get name() { return this.#process.name; }
    get logger() { return this.#logger; }

    constructor(name, socket_path) {
        this.socket_path = socket_path;
        this.#process = {
            name,
            pid,
            sock: null
        };
        this.#processes[name] = this.#process;
        this.#logger = new Logger(`ipc`);
    }

    get destroyed() { return this.#destroyed; }

    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        await this._destroy();
    }

    get_process(name) {
        return this.#processes[name];
    }

    /** @param {string} request @param {Function(...args:any):any} listener */
    respond(request, listener) {
        if (this.#responses[request]) {
            throw new Error(`IPC: '${request}' response already setup`);
        }
        this.#responses[request] = listener;
    }
    
    async emit_to(name, event, ...args) { throw new Error("IPC: emit_to not implemented")}

    async request(pid, request, args=undefined, timeout=0) {
        let rid = ++this.#rid;
        let resolve;
        return new Promise(async (_resolve,reject)=>{
            resolve = _resolve;
            await this.ready;
            if (!args) args = [];
            else if (!Array.isArray(args)) args = [args];
            if (timeout) {
                setTimeout(()=>reject(new errors.TimeoutError(`internal:request ${rid} ${request} timed out.`)), timeout);
            }
            this.emitter.on(`internal:response:${rid}`, resolve);
            this.emit_to(pid, "internal:request", { rid, request, args, origin: this.name });
        }).finally(()=>{
            this.emitter.off(`internal:response:${rid}`, resolve);
        });
    }

    /** @protected @param {net.Socket} sock */
    digest_sock_messages(sock, cb) {
        var lines = readline.createInterface(sock);
        sock.on("close", ()=>lines.close());
        lines.on("error", utils.noop);
        lines.on("line", (line)=>{
            var json;
            try {
                json = JSON.parse(line);
            } catch (e) {
                this.#logger.error(e);
                return;
            }
            var {event, args} = json;
            if (event === "internal:request") {
                let {rid, origin, request, args:request_args} = args[0];
                if (this.#responses[request]) {
                    Promise.resolve(this.#responses[request](...request_args))
                        .then((result)=>{
                            this.emit_to(origin, `internal:response:${rid}`, result);
                        });
                }
            } else {
                cb(json);
            }
        });
    }

    _handle_socket_error(e) {
        if (this.destroyed || globals.app.destroyed) return;
        this.#logger.error(e);
    }

    async _destroy() {}
}

export class IPCMaster extends IPC {
    #socket_last_id = 0;
    /** @type {Record<PropertyKey,net.Socket>} */
    #socks = {};
    /** @type {net.Server} */
    #server;
    /** @type {Record<PropertyKey,Record<PropertyKey,{listener:Function,ids:Set<number>}>>} */
    #listener_map = {};

    constructor(name, socket_path) {
        super(name, socket_path);
        this.#server = net.createServer((sock)=>{
            let sock_id = ++this.#socket_last_id;
            this.#socks[sock_id] = sock;
            sock.on("error", this._handle_socket_error);
            sock.on("close", ()=>{
                delete this.#socks[sock_id];
                var p = Object.values(this.processes).find(p=>p.sock===sock);
                if (p) {
                    delete this.processes[p.name];
                    this.emit("internal:processes", {processes:this.processes});
                }
            });
            this.digest_sock_messages(sock, ({event, args})=>{
                if (event === "internal:register") {
                    let {process} = args[0];
                    this.processes[process.name] = {...process, sock};
                    this.emit("internal:processes", {processes:this.processes});
                } else if (event === "internal:on") {
                    let {name, event, id} = args[0];
                    if (!this.#listener_map[event]) this.#listener_map[event] = {};
                    if (!this.#listener_map[event][name]) {
                        let listener = (data)=>{
                            this.emit_to(name, event, data);
                        };
                        this.#listener_map[event][name] = { listener, ids: new Set() };
                        this.emitter.on(event, listener);
                    }
                    this.#listener_map[event][name].ids.add(id);
                } else if (event === "internal:off") {
                    let {name, event, id} = args[0];
                    if (this.#listener_map[event] && this.#listener_map[event][name]) {
                        let {listener, ids} = this.#listener_map[event][name];
                        ids.delete(id);
                        if (ids.size === 0) {
                            this.emitter.off(event, listener);
                            delete this.#listener_map[event][name];
                        }
                        if (Object.keys(this.#listener_map[event]).length === 0) {
                            delete this.#listener_map[event];
                        }
                    }
                } else if (event === "internal:emit_to") {
                    let {name, event, args:_args} = args[0];
                    this.emit_to(name, event, ..._args);
                }
                this.emitter.emit(event, ...args);
            });
        });
        this.#server.listen(socket_path);
        this.logger.info(`Listening on socket ${socket_path}`);
        if (!fs.existsSync(socket_path)) {
            this.logger.info(`Socket ${socket_path} does not exist?`);
        }
    }
    on(event, listener) {
        this.emitter.on(event, listener);
    }
    once(event, listener) {
        this.emitter.once(event, listener);
    }
    off(event, listener) {
        this.emitter.off(event, listener);
    }
    emit(event, ...args) {
        this.emitter.emit(event, ...args);
        for (var sock of Object.values(this.#socks)) {
            write(sock, event, ...args);
        }
    }
    async emit_to(name, event, ...args) {
        if (name == "core") this.logger.warn("Cannot emit to core");
        let p = await this.wait_for_process(name);
        write(p.sock, event, ...args);
    }
    async wait_for_process(name) {
        var p = this.get_process(name);
        if (p) return p;
        return new Promise((resolve)=>{
            var listener;
            this.on("internal:processes", listener = ({processes})=>{
                var p = this.get_process(name);
                if (!p) return;
                resolve(p);
                this.off("internal:processes", listener);
            });
        });
    }

    async _destroy() {
        this.#server.close((err)=>{
            if (err) this.logger.error(err);
        });
        for (var id of Object.keys(this.#socks)) {
            this.#socks[id].end();
        }
    }
}

var reconnect_attempts = 0;
var max_reconnect_attempts = 0;
const RETRY_INTERVAL = 5000; // 5 seconds between retries

export class IPCFork extends IPC {
    /** @type {net.Socket} */
    #master_sock;
    #ready;
    /** @type {Array<{listener:Function,id:number}>} */
    #listeners = [];
    /** @type {Record<PropertyKey,number>} */
    #listener_id_map = {};

    get ready() { return this.#ready; }

    constructor(name, socket_path) {
        super(name, socket_path);
        this.#init();
    }

    #init() {
        this.#ready = new Promise((resolve)=>{
            this.#master_sock = net.createConnection(this.socket_path, ()=>{
                reconnect_attempts = 0;
                write(this.#master_sock, "internal:register", {process: this.process});
                resolve(true);
            });
            this.#master_sock.on("error", this._handle_socket_error);
            this.digest_sock_messages(this.#master_sock, ({event, args})=>{
                if (event === "internal:processes") {
                    let {processes} = args[0];
                    utils.clear(this.processes);
                    Object.assign(this.processes, processes);
                }
                this.emitter.emit(event, ...args);
            });
            this.#master_sock.on("close", ()=>{
                if (!this.destroyed) this.#handleDisconnect();
            });
        });
        return this.#ready;
    }

    #handleDisconnect() {
        if (!max_reconnect_attempts || reconnect_attempts < max_reconnect_attempts) {
            reconnect_attempts++;
            this.logger.info(`Attempting to reconnect (${reconnect_attempts}/${max_reconnect_attempts||"-"})...`);
            setTimeout(()=>{
                this.#init().catch(utils.noop);
            }, RETRY_INTERVAL);
        } else {
            this.logger.info('Max reconnection attempts reached. Giving up.');
            process.exit(1);
        }
    }

    // this doesnt actually emit to application but sends a signal to the master.
    async emit(event, ...args) {
        // this.emitter.emit(event, ...args);
        await this.#ready;
        write(this.#master_sock, event, ...args);
    }

    async on(event, listener) {
        this.emitter.on(event, listener);
        await this.#ready;
        if (!this.#listener_id_map[event]) this.#listener_id_map[event] = 0;
        var id = this.#listener_id_map[event]++;
        this.#listeners.push({listener, id});
        write(this.#master_sock, `internal:on`, {name:this.name, event, id});
    }

    async off(event, listener) {
        this.emitter.off(event, listener);
        await this.#ready;
        var i = this.#listeners.findIndex((l)=>listener === l.listener);
        if (i >= 0) {
            var {id} = this.#listeners.splice(i, 1)[0];
            write(this.#master_sock, `internal:off`, {name:this.name, event, id});
        }
    }

    async once(event, listener) {
        var _this = this;
        var wrapper = function(...args){
            _this.off(event, wrapper);
            listener.apply(this, args);
        };
        return this.on(event, wrapper);
    }

    async emit_to(name, event, ...args) {
        await this.#ready;
        if (name === "core") {
            write(this.#master_sock, event, ...args);
        } else {
            write(this.#master_sock, `internal:emit_to`, {name, event, args});
        }
    }

    _destroy() {
        this.#master_sock.destroy();
    }
}

/** @param {net.Socket} sock @param {string} event @param {any} packet */
function write(sock, event, ...args) {
    if (sock.writable) {
        let payload = JSON.stringify({event, args})+"\n";
        try { sock.write(payload); } catch (e) {}
    }
}