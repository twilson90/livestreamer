import http from "node:http";
import https from "node:https";
import WebSocket, { WebSocketServer } from "ws";
import {globals} from "./exports.js";

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
export class WebServer {
    /** @type {http.Server} */
    server;
    /** @type {Record<PropertyKey, import("node:net").Socket>} */
    #socks = {};
    /** @param {http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse>} handler @param {typeof default_opts} opts */
    constructor(handler, opts) {

        opts = {...default_opts, ...opts};

        /** @type {https.ServerOptions<typeof http.IncomingMessage, typeof http.ServerResponse>} */
        var http_opts = {};

        this.socket_path = globals.app.get_socket_path(`${globals.app.name}_http`);
        globals.app.logger.info(`Starting HTTP server on socket ${this.socket_path}...`);
        globals.app.logger.info(globals.app.get_urls().http);
        // console.info(globals.app.get_urls(globals.app.name).url);
        /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
        var check_auth = (req, res)=>{
            if (typeof opts.auth === "function") {
                return opts.auth(req, res)
            }
            return !!opts.auth;
        }
        this.server = http.createServer(http_opts, async (req, res)=>{
            await globals.app.ready;
            // accesslog(req, res, undefined, (l)=>core.logger.debug(l));
            if (check_auth(req, res)) {
                let auth_res = await globals.app.authorise(req, opts.auth_key, res);
                if (!opts.allow_unauthorised && !auth_res) {
                    res.setHeader('WWW-Authenticate', 'Basic realm="Authorized"');
                    res.statusCode = 401;
                    res.write('Authorization required');
                    res.end();
                    return;
                }
                req.user = auth_res;
            }
            //if (req.headers.referrer || req.headers.referer) {
            // var url = new URL(req.headers.referrer || req.headers.referer);
            var allow_origin = opts.allow_origin;
            // var allow_origin = [...new Set([`${url.protocol}//${url.hostname}:*`, `${url.protocol}//${core.hostname}:*`])].join(" ");
            // res.setHeader('Access-Control-Allow-Origin', allow_origin);
            var urls = globals.app.get_urls();
            // res.setHeader('Access-Control-Allow-Origin', "*");
            res.setHeader('Access-Control-Allow-Origin', [urls.http, urls.https].join(" "));
            res.setHeader('Access-Control-Allow-Credentials', true);
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            //'Origin, Accept, X-Requested-With, Content-Type, Authorization, Access-Control-Allow-Headers, Access-Control-Request-Method, Access-Control-Request-Headers'
            res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${allow_origin}`);
            // res.setHeader('Content-Security-Policy', `default-src 'self' ${host}`);

            //}
            res.setHeader('Vary', "Origin");
            if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                res.end();
            } else if (handler) {
                handler(req, res);
            }
        });
        this.server.listen(this.socket_path);
        
        if (opts.ws) {
            this.server.on('upgrade', async (req, socket, head)=>{
                await globals.app.ready;

                if (check_auth(req)) {
                    let auth_res = await globals.app.authorise(req, opts.auth_key);
                    if (!opts.allow_unauthorised && !auth_res) {
                        socket.write('HTTP/1.1 401 Unauthorized');
                        socket.destroy();
                        return;
                    }
                    req.user = auth_res;
                }
                this.wss.handleUpgrade(req, socket, head, (socket)=>{
                    this.wss.emit('connection', socket, req);
                });
            });
            this.wss = new WebSocketServer(opts.ws);
            this.wss.on("error", (error)=>{
                globals.app.logger.error(error);
            });
        }
        var sock_id = 0;
        this.server.on("connection", (sock)=>{
            var id = ++sock_id;
            this.#socks[id] = sock;
            sock.on('close', ()=>{
                delete this.#socks[id];
            });
        });
    }

    async destroy() {
        await new Promise(r=>this.server.close(r));
        for (var id of Object.keys(this.#socks)) {
            this.#socks[id].destroy();
        }
    }
}
export default WebServer;