import events from "node:events";
import net from "node:net";
import readline from "node:readline";
import * as utils from "./utils.js";

var _ignore_data_changes = false;

/** @typedef {{name:string,pid:number,ppid:number,sock:net.Socket}} Process */
export class IPC extends events.EventEmitter {
    /** @type {Record<any,Process>} */
    processes = {};
    /** @type {Record<PropertyKey,net.Socket>} */
    #socks = {};
    /** @type {net.Socket} */
    #master_sock;
    #socket_last_id = 0;
    /** @type {Record<PropertyKey,Function(...args:any):any>} */
    #responses = {};
    #rid = 0;
    /** @type {Promise<void>} */
    #ready_resolve;
    /** @type {net.Server} */
    #server;
    $ = new utils.Observer();

    constructor(is_master, name, socket_path) {
        super();
        this.is_master = is_master;
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
        
        utils.Observer.listen(this.$, c=>{
            if (_ignore_data_changes) return;
            if (c.nested) return;
            this.emit("internal:data-change", c);
        });
        
        if (this.is_master) {
            this.#server = net.createServer((sock)=>{
                let pid;
                let sock_id = ++this.#socket_last_id;
                this.#socks[sock_id] = sock;
                sock.on('close', ()=>{
                    delete this.#socks[sock_id];
                    if (this.processes[pid]) {
                        delete this.processes[pid];
                        this.emit("internal:processes", {processes: this.processes});
                    }
                });
                digest_sock_messages(sock, ({event, data})=>{
                    if (event === "internal:register") {
                        pid = data.process.pid;
                        this.processes[pid] = {...data.process, sock};
                        this.emit("internal:processes", {processes: this.processes});
                    } else if (event === "internal:send") {
                        let {pid, event, data:_data} = data;
                        this.send(pid, event, _data);
                    } else if (event === "internal:emit") {
                        let {event, data:_data} = data;
                        this.emit(event, _data);
                    } else {
                        throw new Error(`Unrecognized event: ${event}`);
                    }
                });
            }).listen(socket_path);
        } else {
            this.ready = new Promise(resolve=>{this.#ready_resolve=resolve});
        }
    }
    connect() {
        if (this.is_master) return;
        this.#master_sock = net.createConnection(this.socket_path);
        this.#master_sock.on('connect', ()=>{
            write(this.#master_sock, "internal:register", {process: this.process});
            this.#ready_resolve(true);
        });
        digest_sock_messages(this.#master_sock, async ({event,data})=>{
            if (event === "internal:processes") {
                this.processes = data.processes;
            } else if (event === "internal:request") {
                let {rid, origin, request, args} = data;
                Promise.resolve(this.#responses[request](...args))
                    .then((result)=>[result, null])
                    .catch((err)=>[null, err])
                    .then(([result,err])=>{
                        this.send(origin, `internal:response:${rid}`, [result, err]);
                    });
            } else if (event === "internal:data-change") {
                _ignore_data_changes = true;
                utils.Observer.apply_changes(this.$, [data]);
                _ignore_data_changes = false;
            }
            super.emit(event, data);
        });
        this.#master_sock.on('error', (err)=>{
            console.error(err)
        });
        return this.ready;
    }
    async emit(event, data) {
        if (this.is_master) {
            super.emit(event, data);
            return Promise.all(Object.values(this.#socks).map(sock=>write(sock, event, data)));
        } else {
            await this.ready;
            return write(this.#master_sock, `internal:emit`, {event, data});
        }
    }
    async send(pid, event, data) {
        if (this.is_master) {
            return utils.retry_until(async()=>{
                let p = await this.wait_for_process(pid);
                return write(p.sock, event, data);
            }, 5, 1000, `IPC.send ${pid} ${event}`);
        } else {
            await this.ready;
            return write(this.#master_sock, `internal:send`, {pid, event, data});
        }
    }
    get_process(pid) {
        return this.processes[pid] || Object.values(this.processes).find(p=>p.name === pid);
    }
    async wait_for_process(pid) {
        return this.get_process(pid) || new Promise((resolve)=>{
            var listener;
            this.on("internal:processes", listener = ()=>{
                var p = this.get_process(pid);
                if (p) {
                    resolve(p);
                    this.off("internal:processes", listener);
                }
            });
        });
    }
    respond(request, listener) {
        if (this.#responses[request]) throw new Error(`IPC: '${request}' response already setup`);
        this.#responses[request] = listener;
    }
    async request(pid, request, args, timeout=10000) {
        return new Promise(async (resolve,reject)=>{
            let rid = ++this.#rid;
            if (!args) args = [];
            setTimeout(()=>reject(`internal:request ${rid} ${request} timed out.`), timeout);
            this.send(pid, "internal:request", { rid, request, args, origin: this.pid });
            this.once(`internal:response:${rid}`, ([result,err])=>{
                if (err && _default === undefined) reject(err);
                else resolve(result ?? _default);
            })
        });
    }
    async destroy() {
        if (this.#server) {
            await new Promise(r=>this.#server.close(r));
            for (var id of Object.keys(this.#socks)) {
                this.#socks[id].destroy();
            }
            // await fs.rm(this.socket_path);
        }
    }
}

/** @param {net.Socket} sock */
function digest_sock_messages(sock, cb) {
    readline.createInterface(sock).on("line", (line)=>{
        if (line) cb(JSON.parse(line));
    });
}
/** @param {net.Socket} sock @param {any} packet */
function write(sock, event, data) {
    return new Promise((resolve,reject)=>{
        let payload = JSON.stringify({event, data})+"\n";
        sock.write(payload, (err)=>{
            if (err) reject(err)
            else resolve();
        });
    });
}

export default IPC;