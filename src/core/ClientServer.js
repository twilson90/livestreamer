import {WebSocketServer} from "ws";
import path from "node:path";
import fs from "node:fs";
import events from "events";;
import {globals, Logger, utils} from "./exports.js";
/** @import { Client, WebServer } from './exports.js' */


/**
 * @template { Client } T 
 * @typedef {{
 *  connect:[T],
 *  disconnect:[T]
 * }} Events
 */

/**
 * @template { Client<any> } T
 * @extends {events.EventEmitter<Events<T>>}
 */
export class ClientServer extends events.EventEmitter {
    /** @type {Record<PropertyKey,T>} */
    clients = {};
    #destroyed = false;

    get destroyed() { return this.#destroyed; }

    /** @param {WebServer} server  @param {new () => T} ClientClass */
    constructor(name, server, ClientClass) {
        super();
        this.name = name;
        this.clients_dir = path.join(globals.app.clients_dir, name);
        this.logger = new Logger(`client-server`);
        globals.app.logger.add(this.logger);
        this.ClientClass = ClientClass;
        
        fs.mkdirSync(this.clients_dir, {recursive:true});

        server.on("connection", (ws, request)=>{
            var alive = true;
            var client = new this.ClientClass(globals.app.generate_uid(`client-${name}`));
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
                } else if (m === "pong") {
                    ws.send("ping");
                    alive = true;
                } else {
                    client._message(m);
                }
            });
            ws.on('error',(e)=>{
                client._error(e);
            });
            ws.on("close", (code)=>{
                client._close(code);
                clearInterval(heartbeat_interval);
                this.emit("disconnect", client);
                client.destroy();
            });
        });
    }

    async get_client_info(ip_hash) {
        var filename = path.join(this.clients_dir, `${ip_hash}.json`);
        var lines = (await utils.file_exists(filename)) ? (await utils.read_last_lines(filename, 512, "utf8")) : [];
        return Object.fromEntries(lines.map((line)=>{
            var data = JSON.parse(line.trim());
            return [data.id, data];
        }));
    }

    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.logger.destroy();
    }
}

export default ClientServer;