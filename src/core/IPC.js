import events from "node:events";
import net from "node:net";
import readline from "node:readline";
import {globals, utils} from "./exports.js";

/** @typedef {{name:string,pid:number,ppid:number,sock:net.Socket}} Process */

class IPC extends events.EventEmitter {
    /** @type {Record<PropertyKey,Process>} */
    #processes = {};
    get processes() { return this.#processes; }

    constructor(name, socket_path) {
        super();
        this.socket_path = socket_path;
        this.pid = process.pid;
        this.ppid = process.ppid;
        /** @type {Process} */
        this.process = {
            name,
            pid: this.pid,
            ppid: this.ppid,
            sock: null
        };
        this.processes[this.pid] = this.process;
    }

    async destroy() {}
    
    async send(pid, event, data) {}

    get_process(pid) {
        return this.processes[pid] || Object.values(this.processes).find(p=>p.name === pid);
    }
}

export class IPCMaster extends IPC {
    #socket_last_id = 0;
    /** @type {Record<PropertyKey,net.Socket>} */
    #socks = {};
    /** @type {net.Server} */
    #server;
    /** @type {Record<PropertyKey,Array<{listener:Function,id:number}>>} */
    #listener_map = {};

    constructor(name, socket_path) {
        super(name, socket_path);
        this.#server = net.createServer((sock)=>{
            let pid;
            let sock_id = ++this.#socket_last_id;
            this.#socks[sock_id] = sock;
            sock.on("error", handle_socket_error);
            sock.on("close", ()=>{
                delete this.#socks[sock_id];
                if (this.processes[pid]) {
                    delete this.processes[pid];
                    let processes = this.processes;
                    this.emit("internal:processes", {processes});
                }
            });
            digest_sock_messages(sock, ({event, data: event_data})=>{
                if (event === "internal:register") {
                    pid = event_data.process.pid;
                    this.processes[pid] = {...event_data.process, sock};
                    let processes = this.processes;
                    this.emit("internal:processes", {processes});
                } else if (event === "internal:send") {
                    let {pid, event, data:_data} = event_data;
                    this.send(pid, event, _data);
                } else if (event === "internal:on") {
                    let {event, id} = event_data;
                    if (!this.#listener_map[event]) this.#listener_map[event] = {};
                    var key = JSON.stringify([pid, event, id]);
                    this.on(event, this.#listener_map[event][key] = (data)=>this.send(pid, event, data));
                } else if (event === "internal:off") {
                    let {event, id} = event_data;
                    if (!this.#listener_map[event]) this.#listener_map[event] = {};
                    var key = JSON.stringify([pid, event, id]);
                    this.off(event, this.#listener_map[event][key]);
                } else if (event === "internal:emit") {
                    let {event, data} = event_data;
                    this.emit(event, data);
                } else {
                    throw new Error(`Unrecognized event: ${event}`);
                }
            });
        });
        this.#server.listen(socket_path);
    }
    async send(pid, event, data) {
        return utils.retry_until(async()=>{
            let p = await this.wait_for_process(pid);
            return write(p.sock, event, data);
        }, 5, 1000, `IPC.send ${pid} ${event}`);
    }
    async wait_for_process(pid) {
        return this.get_process(pid) || new Promise((resolve)=>{
            var listener;
            super.on("internal:processes", listener = ()=>{
                var p = this.get_process(pid);
                if (p) {
                    resolve(p);
                    super.off("internal:processes", listener);
                }
            });
        });
    }
    async destroy() {
        await new Promise(r=>this.#server.close(r));
        for (var id of Object.keys(this.#socks)) {
            this.#socks[id].destroy();
        }
    }
}

export class IPCFork extends IPC {
    /** @type {net.Socket} */
    #master_sock;
    #ready;
    /** @type {Array<{listener:Function,id:number}>} */
    #listeners = [];
    /** @type {Record<PropertyKey,number>} */
    #listener_id_map = {};
    /** @type {Record<PropertyKey,Function(...args:any):any>} */
    #responses = {};
    #rid = 0;

    get ready() { return this.#ready; }

    constructor(name, socket_path) {
        super(name, socket_path);
        this.#ready = this.#init();
    }
    #init() {
        return new Promise((resolve)=>{
            this.#master_sock = net.createConnection(this.socket_path, ()=>{
                write(this.#master_sock, "internal:register", {process: this.process});
                resolve(true);
            });
            this.#master_sock.on("error", handle_socket_error);
            digest_sock_messages(this.#master_sock, async ({event,data})=>{
                super.emit(event, data);
            });
            this.on("internal:processes", ({processes})=>{
                utils.clear(this.processes);
                Object.assign(this.processes, processes);
            });
            this.on("internal:request", async ({rid, origin, request, args})=>{
                let [result, error] = await Promise.resolve(this.#responses[request](...args))
                    .then((result)=>[result, null])
                    .catch((err)=>[null, err]);
                this.send(origin, `internal:response:${rid}`, [result, error]);
            });
        });
    }
    async emit(event, data) {
        await this.#ready;
        return write(this.#master_sock, `internal:emit`, {event, data});
    }
    async on(event, listener) {
        super.on(event, listener);
        await this.#ready;
        if (!this.#listener_id_map[event]) this.#listener_id_map[event] = 0;
        var id = this.#listener_id_map[event]++;
        this.#listeners.push({listener, id});
        return write(this.#master_sock, `internal:on`, {event, id});
    }
    async off(event, listener) {
        super.off(event, listener);
        await this.#ready;
        var i = this.#listeners.findIndex((l)=>listener === l.listener);
        if (i >= 0) {
            var {id} = this.#listeners.splice(i, 1)[0];
            return write(this.#master_sock, `internal:off`, {event, id});
        }
    }
    async send(pid, event, data) {
        await this.#ready;
        return write(this.#master_sock, `internal:send`, {pid, event, data});
    }
    respond(request, listener) {
        if (this.#responses[request]) throw new Error(`IPC: '${request}' response already setup`);
        this.#responses[request] = listener;
    }
    async request(pid, request, args, timeout=10000) {
        await this.#ready
        return new Promise(async (resolve,reject)=>{
            let rid = ++this.#rid;
            if (!Array.isArray(args)) args = [args];
            setTimeout(()=>reject(`internal:request ${rid} ${request} timed out.`), timeout);
            this.send(pid, "internal:request", { rid, request, args, origin: this.pid });
            this.once(`internal:response:${rid}`, ([result,err])=>{
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
    async get(pid, ...paths) {
        await this.#ready;
        var res = await this.request(pid, "internal:get", [...paths]).catch(utils.noop);
        if (res && paths.length == 1) return res[0];
        return res;
    }

    destroy() {
        this.#master_sock.destroy();
    }
}

function handle_socket_error(e) {
    console.error(e);
}

/** @param {net.Socket} sock */
function digest_sock_messages(sock, cb) {
    readline.createInterface(sock).on("line", (line)=>{
        if (line) cb(JSON.parse(line));
    });
}

/** @param {net.Socket} sock @param {any} packet */
function write(sock, event, data) {
    return new Promise((resolve, reject)=>{
        if (sock.closed) return;
        let payload = JSON.stringify({event, data})+"\n";
        try {
            if (!sock.destroyed && sock.writable) {
                sock.write(payload, (err)=>{
                    if (sock.closed || err) return;
                    // if (err) console.error(err); // maybe just write error?
                    resolve();
                });
            }
        } catch (e) {}
    });
}