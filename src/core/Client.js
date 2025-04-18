import http from "node:http";
import WebSocket from "ws";
import fs from "fs-extra";
import path from "node:path";
import {globals, utils, Logger, DataNodeID, DataNodeID$} from "./exports.js";
/** @import { ClientServer } from './exports.js' */

export class Client$ extends DataNodeID$ {
    ip = "";
    ip_hash = "";
    init_ts = 0;
    client_id = "";
    ts = 0;
    username = "";
    is_admin = false;
}

/** @template {Client$} T @extends {DataNodeID<T>} */
export class Client extends DataNodeID {

    get ip() { return this.$.ip; }
    get ip_hash() { return this.$.ip_hash; }
    get username() { return this.$.username; }
    get is_admin() { return !!this.$.is_admin; }

    /** @param {T} $ */
    constructor($) {
        super(null, $);
    }

    oninit() { throw new Error("not implemented"); }

    /** @param {ClientServer<Client>} this.server @param {http.IncomingMessage} req @param {WebSocket} ws */
    async init(server, ws, req) {
        this.server = server;
        this.ws = ws;
        this.server.clients[this.id] = this;
        
        this.request = req;
        this.url = new URL("http://localhost"+req.url);
        
        var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(",")[0];

        this.logger = new Logger(`client-${this.id}`);
        this.logger.on("log", (log)=>this.server.logger.log(log));
        
        this.$.ip = ip;
        this.$.ip_hash = utils.md5(ip);
        this.$.init_ts = Date.now();
        this.$.client_id = this.id;
        this.$.ts = Date.now();

        this.logger.info(`${JSON.stringify(this.$)} connected`);
        
        this.client_history_path = path.join(this.server.clients_dir, `${this.ip_hash}.json`);
        this.oninit();
        await utils.append_line_truncate(this.client_history_path, JSON.stringify(this.$), 32);
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

    onclose(code) {
        this.logger.info(`disconnected.`);
        this.destroy();
    }

    async onmessage(m) {
        this.logger.debug(`message: ${m}`);
        var request;
        try {
            request = JSON.parse(m);
        } catch {
            this.logger.warn("Bad request.");
            return;
        }
        var request_id = request.id;
        var result, error;
        // var fn_path = Array.isArray(request.path) ? request.path : String(request.path).split(/[\.\/]+/);
        var run = ()=>{
            if (request.call) result = utils.reflect.call(this, request.call, request.arguments);
            else if (request.get) result = utils.reflect.get(this, request.get);
            else if (request.set) result = utils.reflect.set(this, request.set, request.value);
            else if (request.delete) result = utils.reflect.deleteProperty(this, request.delete);
            else error = `Invalid request: ${JSON.stringify(request)}`;
        };
        if (globals.app.debug) {
            run();
        } else {
            try { run(); } catch (e) { error = e; }
        }
        result = await Promise.resolve(result).catch(e=>{
            error = e;
            if (globals.app.debug) throw e;
        });
        result = {
            id: request_id,
            result,
        };
        if (error) {
            this.logger.error(error);
            result.error = { message: error.toString() }
        }
        this.send(result);
    }

    onerror(error) {
        this.logger.error(error);
    }

    send(d) {
        this.ws.send(JSON.stringify(d, (k,v)=>(v===undefined)?null:v));
    }
    ping(){ return 1; }

    ondestroy() {
        delete this.server.clients[this.id];
        this.ws.close();
        super.ondestroy();
    }
}

export default Client;