import WebSocket from "ws";
import path from "node:path";
import fs from "fs-extra";
import events from "events";;
import {globals, Logger, utils} from "./exports.js";
/** @import { Client } from './exports.js' */


/**
 * @template { Client } T 
 * @typedef {{
 *  connect:[T],
 *  disconnect:[T]
 * }} Events
 */

/**
 * @template { Client } T
 * @extends {events.EventEmitter<Events<T>>}
 */
export class ClientServer extends events.EventEmitter {
    /** @type {Record<PropertyKey,T>} */
    clients = {};
    #ready;
    get ready() { return this.#ready; }

    /** @param {WebSocket.Server} wss  @param {new () => T} ClientClass */
    constructor(id, wss, ClientClass, auth) {
        super();
        this.id = id;
        this.clients_dir = path.join(globals.app.clients_dir, id);
        this.auth = auth;
        this.logger = new Logger(`client-server`);
        this.logger.on("log", (log)=>{
            globals.app.logger.log(log)
        });
        this.wss = wss;
        this.ClientClass = ClientClass;
        this.#ready = this.#init();
    }
    
    async #init() {
        await fs.mkdir(this.clients_dir, {recursive:true});

        this.wss.on("connection", async (ws, request)=>{
            await globals.app.ready;
            var user = null;
            user = await globals.app.authorise(request);
            if (this.auth && !user) {
                ws.close(1014, "go away");
                return;
            }
            var alive = true;
            var client = new this.ClientClass(user);
            client.init(this, ws, request);

            var heartbeat_interval = setInterval(()=>{
                if (!alive) {
                    this.logger.info(`${client.id} websocket did not send ping.`);
                    ws.terminate();
                }
                alive = false;
            }, (60 * 1000));
            
            this.emit("connect", client);

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
                client.onmessage(m);
            });
            ws.on('error',(e)=>{
                client.onerror(e);
            });
            ws.on("close", (code)=>{
                client.onclose(code);
                clearInterval(heartbeat_interval);
                this.emit("disconnect", client);
                client.destroy();
            });
        });
    }
}

export default ClientServer;