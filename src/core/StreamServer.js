import net from "node:net";
import fs from "node:fs";
import stream from "node:stream"
import { globals, Logger, utils } from "./exports.js";

var socket_uid = 0;
export class StreamServer extends stream.Transform {
    /** @type {net.Server} */
    #server;
    /** @type {Set<net.Socket>} */
    #clients = new Set();
    #name = "";
    #socket = "";
    #destroyed = false;
    #ready;

    get name() { return this.#name; }
    get clients() { return [...this.#clients]; }
    get socket() { return this.#socket; }
    get ready() { return this.#ready; }

    constructor(name) {
        super();
        this.#name = name || `socket-server-${utils.uuid4()}`;
        this.logger = new Logger(name);
        // this.on("data", utils.noop); // necessary to keep it flowing when no clients.
        this.init();
    }

    init() {
        return this.#ready = this.#ready || this.#init();
    }

    async #init() {
        this.#socket = globals.app.get_socket_path(this.#name, true);
        this.#server = net.createServer((socket) => {
            let id = ++socket_uid;
            this.#clients.add(socket);
            // this.pipe(socket, { end: false });
            this.logger.info(`Client ${id} connected to ${this.#socket}`);
            socket.on("error", (e) => {
                if (this.#destroyed) return;
                this.logger.error(new Error(`Socket error: ${e.message}`));
            });
            socket.on('close', () => {
                this.logger.info(`Client ${id} disconnected`);
                this.#clients.delete(socket);
                // this.unpipe(socket)
            });
        });
        return new Promise(resolve => {
            this.#server.listen(this.#socket, 128, () => {
                fs.chmodSync(this.#socket, 0o777);
                this.logger.info(`Socket server initialized at ${this.#socket}`);
                resolve();
            });
        });
    }

    _transform(chunk, encoding, callback) {
        for (var sock of this.#clients) {
            if (sock.writable) sock.write(chunk)
        }
        callback();
    }

    _destroy(err, callback) {
        this.#server.close((err) => {
            if (err) this.logger.error(err);
        });
        for (var sock of this.#clients) {
            sock.end();
        }
        callback(err);
    }
}

export default StreamServer;