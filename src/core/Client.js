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
    user = {
        user_id: "",
        email: "",
        username: "",
        is_admin: false,
    }
}

/** @template {Client$} T @extends {DataNodeID<T>} */
export class Client extends DataNodeID {

    get ip() { return this.$.ip; }
    get ip_hash() { return this.$.ip_hash; }
    get username() { return this.$.user.username; }
    get is_admin() { return !!this.$.user.is_admin; }
    api = {};

    /** @param {T} $ */
    constructor($) {
        super(null, $);
    }

    oninit() { throw new Error("not implemented"); }

    /** @param {ClientServer<Client>} server @param {http.IncomingMessage} req @param {WebSocket} ws */
    async init(server, ws, req) {
        this.server = server;
        this.ws = ws;
        this.server.clients[this.id] = this;
        
        this.request = req;
        this.url = new URL("http://localhost"+req.url);
        
        var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(",")[0];

        this.logger = new Logger(`client-${this.id}`);
        this.logger.on("log", (log)=>this.server.logger.log(log));
        
        this.$.user = req.user;
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

    onclose(code) {
        this.logger.info(`disconnected.`);
        this.destroy();
    }

    async onmessage(m) {
        this.logger.debug(`message: ${m}`);
        var json;
        try {
            json = JSON.parse(m);
        } catch {
            this.logger.warn("Bad request.");
            return;
        }
        if (json.request) {
            let {request} = json;
            let {method, arguments:args, id} = request;
            let result, error;
            // var fn_path = Array.isArray(request.path) ? request.path : String(request.path).split(/[\.\/]+/);
            let run = async()=>{
                if (method && typeof this.api[method] == "function") {
                    return this.api[method].apply(this, args || []);
                }
                throw new Error(`Invalid request: ${JSON.stringify(request)}`);
            };
            result = await run().catch(e=>error = e);
            if (error) {
                this.logger.error(error);
                error = error.toString();
            }
            this.send({
                request: { id, result, error },
            });
        }
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