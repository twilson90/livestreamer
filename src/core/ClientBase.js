import http from "node:http";
import WebSocket from "ws";
import fs from "fs-extra";
import path from "node:path";
import * as utils from "./utils.js";
import globals from "./globals.js";
import Logger from "./Logger.js";
import DataNode from "./DataNode.js";
/** @import { ClientServer } from './types.d.ts' */

export class ClientBase extends DataNode {

    get ip() { return this.$.ip; }
    get ip_hash() { return this.$.ip_hash; }
    get username() { return this.$.username; }
    get is_admin() { return !!this.$.is_admin; }
    #initialized = false;

    /** @param {ClientServer<ClientBase>} server @param {http.IncomingMessage} req @param {WebSocket} ws */
    constructor(server, ws, req, userdata) {
        super();

        server.clients[this.id] = this;
        
        this.server = server;
        this.ws = ws;
        this.request = req;
        this.url = new URL("http://localhost"+req.url);
        
        var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(",")[0];

        this.logger = new Logger(`client-${this.id}`);
        this.logger.on("log", (log)=>server.logger.log(log));
        
        Object.assign(this.$, {
            ip: ip,
            ip_hash: utils.md5(ip),
            init_ts: Date.now(),
            client_id: this.id,
            ts: Date.now(),
        });
        if (userdata && typeof userdata === "object") {
            Object.assign(this.$, userdata);
        }
        this.logger.info(`${JSON.stringify(this.$)} connected`);
        
        this.client_history_path = path.join(server.clients_dir, `${this.ip_hash}.json`);
    }

    _init() { throw new Error("not implemented"); }

    async init() {
        await utils.append_line_truncate(this.client_history_path, JSON.stringify(this.$), 32);
        this.send({
            $: {
                client_id: this.id,
                ts: Date.now(),
            }
        });
        this._init();
    }

    async get_client_info(id) {
        var c = this.server.clients[id];
        if (c) return c.get_info();
    }

    async get_info() {
        var lines = (await fs.exists(this.client_history_path)) ? (await utils.read_last_lines(this.client_history_path, 512, "utf8")) : [];
        return Object.fromEntries(lines.map((line)=>{
            var data = JSON.parse(line.trim());
            return [data.id, data];
        }));
    }

    _onclose(code) {
        this.logger.info(`disconnected.`);
        this.destroy();
    }

    async _onmessage(m) {
        this.logger.debug(`message: ${m}`);
        var request;
        try {
            request = JSON.parse(m);
        } catch {
            this.logger.warn("Bad request.");
            return;
        }
        var request_id = request.__id__;
        var result, error;
        // var fn_path = Array.isArray(request.path) ? request.path : String(request.path).split(/[\.\/]+/);
        var run = ()=>{
            if (request.call) result = utils.ref.call(this, request.call, request.arguments);
            else if (request.get) result = utils.ref.get(this, request.get);
            else if (request.set) result = utils.ref.set(this, request.set, request.value);
            else if (request.delete) result = utils.ref.deleteProperty(this, request.delete);
            else error = `Invalid request: ${JSON.stringify(request)}`;
        };
        if (globals.core.debug) {
            run();
        } else {
            try { run(); } catch (e) { error = e; }
        }
        result = await Promise.resolve(result).catch(e=>{
            error = e;
            if (globals.core.debug) throw e;
        });
        result = {
            __id__: request_id,
            result,
        };
        if (error) {
            this.logger.error(error);
            result.error = { message: error.toString() }
        }
        this.send(result);
        this.server.update_clients();
    }

    _onerror(error){
        this.logger.error(error);
    }

    send(d) {
        this.ws.send(JSON.stringify(d, (k,v)=>(v===undefined)?null:v));
    }
    ping(){ return 1; }

    destroy() {
        super.destroy();
        this.ws.close();
    }
}

export default ClientBase;