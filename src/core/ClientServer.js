import WebSocket from "ws";
import path from "node:path";
import fs from "fs-extra";
import globals from "./globals.js";
import Logger from "./Logger.js";
import * as utils from "./utils.js";
/** @import { ClientBase } from './types.d.ts' */

/** @template { ClientBase } T  */
export class ClientServer {
    /** @type {Record<PropertyKey,T>} */
    clients = {};

    /** @param {WebSocket.Server} wss @param {utils.Observer} observer  @param {new () => T} ClientClass */
    constructor(id, wss, observer, ClientClass, auth) {
        this.id = id;
        this.clients_dir = path.join(globals.core.clients_dir, id);
        this.observer = observer;
        this.auth = auth;
        this.logger = new Logger(`client-server`);
        this.logger.on("log", (log)=>{
            globals.core.logger.log(log)
        });
        this.wss = wss;
        this.ClientClass = ClientClass;
    }
    
    async init() {
        await fs.mkdir(this.clients_dir, {recursive:true});

        wss.on("connection", async (ws, request)=>{
            var user = null;
            user = await globals.core.authorise(request);
            if (this.auth && !user) {
                ws.close(1014, "go away");
                return;
            }
            var alive = true;
            var client = new this.ClientClass(this, ws, request, user);
            client.init();

            var heartbeat_interval = setInterval(()=>{
                if (!alive) {
                    this.logger.info(`${client.id} websocket did not send ping.`);
                    ws.terminate();
                }
                alive = false;
            }, (60 * 1000));

            ws.on('message',(data, isBinary)=>{
                if (isBinary) return;
                var m = data.toString();
                if (m === "ping") {
                    ws.send("pong");
                    alive = true;
                    return;
                } else if (m === "pong") {
                    ws.send("ping");
                    alive = true;
                    return;
                }
                client._onmessage(m);
            });
            ws.on('error',(e)=>{
                client._onerror(e);
            });
            ws.on("close", (code)=>{
                client._onclose(code);
                clearInterval(heartbeat_interval);
                delete this.clients[client.id];
            });
        });
    }
}

export default ClientServer;