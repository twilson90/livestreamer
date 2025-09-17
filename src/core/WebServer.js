import http from "node:http";
import https from "node:https";
import events from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { createHttpTerminator } from 'http-terminator';
import { globals, utils } from "./exports.js";

var default_opts = {
    allow_origin: "*",
    /** @type {boolean|(req:http.IncomingMessage, res:http.ServerResponse)=>boolean} */
    auth: false,
    allow_unauthorised: true,
    auth_key: "livestreamer_auth",
    ws: {
        noServer: true,
        perMessageDeflate: true,
        /* {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024
            },
            clientNoContextTakeover: true, // Defaults to negotiated value.
            serverNoContextTakeover: true, // Defaults to negotiated value.
            serverMaxWindowBits: 10, // Defaults to negotiated value.
            concurrencyLimit: 10, // Limits zlib concurrency for perf.
            threshold: 1024 // Size (in bytes) below which messages should not be compressed.
        } */
    },
}
/** @extends {events.EventEmitter<{
    "connection": [WebSocket, http.IncomingMessage],
}>} */
export class WebServer extends events.EventEmitter {
    /** @type {import("http-terminator").HttpTerminator} */
    #http_terminator;
    /** @type {import("http-terminator").HttpTerminator} */
    #https_terminator;
    /** @type {http.Server} */
    #http_server;
    /** @type {https.Server} */
    #https_server;
    /** @type {https.Server[]} */
    #servers = [];
    /** @param {http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse>} handler @param {typeof default_opts} opts */
    constructor(handler, opts) {

        super();

        opts = { ...default_opts, ...opts };

        /** @param {http.IncomingMessage} req @param {http.ServerResponse} res @param {import("node:stream").Duplex} socket */
        var check_auth = async (req, res, socket) => {
            let requires_auth = false;
            let is_websocket = req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket';
            if (typeof opts.auth === "function") {
                requires_auth = opts.auth(req, res);
            } else {
                requires_auth = !!opts.auth;
            }
            if (req.url === "/unauthorise") {
                globals.app.unauthorise(req, opts.auth_key, res);
                return true;
            }
            if (requires_auth) {
                let auth_res = await globals.app.authorise(req, opts.auth_key, res);
                if (!opts.allow_unauthorised && !auth_res) {
                    if (is_websocket) {
                        if (socket) {
                            socket.write('HTTP/1.1 401 Unauthorized');
                            socket.destroy();
                        }
                        return false;
                    } else {
                        res.setHeader('WWW-Authenticate', 'Basic realm="Authorized"');
                        res.statusCode = 401;
                        res.write('Authorization required');
                        res.end();
                        return false;
                    }
                }
                req.user = auth_res;
            }
            return true;
        }

        /** @type {http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse>} */
        var create_request_listener = (ssl) => {
            return async (req, res) => {
                await globals.app.ready;
                if (!await check_auth(req, res, null)) return;
                var allow_origin = opts.allow_origin;

                res.setHeader('Access-Control-Allow-Origin', allow_origin);
                res.setHeader('Access-Control-Allow-Credentials', true);
                res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', '*');
                //'Origin, Accept, X-Requested-With, Content-Type, Authorization, Access-Control-Allow-Headers, Access-Control-Request-Method, Access-Control-Request-Headers'
                res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${allow_origin}`);
                res.setHeader('Vary', "Origin");

                if (req.method === 'OPTIONS') {
                    res.statusCode = 200;
                    res.end();
                    return;
                }
                if (!globals.app.conf["core.http_proxy"]) {
                    if (globals.app.default_request_handler(req, res, ssl)) return;
                }
                if (handler) {
                    handler(req, res);
                }
            }
        }

        /** @param {http.Server|https.Server} server */
        var add_server = (server) => {
            this.#servers.push(server);
            server.terminator = createHttpTerminator({ server, gracefulTerminationTimeout: 1000 });
        }
        if (globals.app.conf["core.http_proxy"]) {
            let socket_path = globals.app.get_socket_path(`${globals.app.name}_http`, true);
            globals.app.logger.info(`Starting HTTP server on socket ${socket_path}...`);
            let server = http.createServer(create_request_listener());
            server.listen({
                path: socket_path,
            });
            add_server(server);
        } else {
            let http_port = globals.app.conf[`${globals.app.name}.http_port`];
            let https_port = globals.app.conf[`${globals.app.name}.https_port`];
            if (http_port) {
                globals.app.logger.info(`Starting HTTP server on port ${http_port}...`);
                let server = http.createServer(create_request_listener());
                server.listen({
                    port: http_port,
                });
                add_server(server);
            }
            if (https_port) {
                let cert = globals.app.get_ssl_cert();
                if (cert) {
                    globals.app.logger.info(`Starting HTTPS server on port ${https_port}...`);
                    let server = https.createServer({ ...cert }, create_request_listener(true));
                    server.listen({
                        port: https_port,
                    });
                    add_server(server);
                }
            }
        }

        if (opts.ws) {
            for (var s of this.#servers) {
                var wss = new WebSocketServer(opts.ws);
                wss.on("error", (error) => {
                    globals.app.logger.error(error);
                });
                s.on('upgrade', async (req, socket, head) => {
                    await globals.app.ready;
                    if (!await check_auth(req, null, socket)) return;
                    wss.handleUpgrade(req, socket, head, (socket) => {
                        this.emit('connection', socket, req);
                    });
                });
            }
        }
        globals.app.logger.info(`URL: ${globals.app.get_urls().url}/`);
    }

    async destroy() {
        for (var s of this.#servers) {
            s.closeAllConnections();
        }
        await this.#http_terminator?.terminate();
        await this.#https_terminator?.terminate();
    }
}
export default WebServer;