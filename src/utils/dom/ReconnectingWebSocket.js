import EventEmitter from "../EventEmitter.js";

export class ReconnectingWebSocket extends EventEmitter {
    last_ping = 0;
    #ready_promise;
    #rid = 0;
    #requests = {};

    constructor(options = {}) {
        super();
        this.options = {
            auto_reconnect: true,
            auto_reconnect_interval: 1000,
            ...options,
        };
        this.#reset_ready_promise();
    }

    #reset_ready_promise() {
        this.#ready_promise = new Promise(resolve => this.once("open", resolve));
    }

    connect(url) {
        this.url = url;
        this.#init_websocket();
    }

    get ready_state() {
        if (this.ws) return this.ws.readyState;
    }
    get ready_promise() { return this.#ready_promise; }

    async request(request) {
        await this.ready_promise;
        return new Promise((resolve, reject) => {
            var rid = ++this.#rid;
            this.#requests[rid] = (response) => {
                if (response.error) reject(response.error.message);
                else resolve(response.result);
            };
            request.id = rid;
            this.send({request});
        }).catch((e) => console.error(e));
    }

    async send(data) {
        await this.ready_promise;
        if (data instanceof ArrayBuffer || data instanceof Blob) {
            this.ws.send(data);
        } else {
            this.ws.send(JSON.stringify(data, (k,v)=>(v===undefined)?null:v));
        }
    }

    #init_websocket() {
        var heartbeat_interval_id;
        var url = this.url;
        var protocols = this.protocols;
        var reconnect_timeout;
        if (typeof url === "function") url = url();
        if (typeof protocols === "function") protocols = protocols();
        this.ws = new WebSocket(url, protocols);
        this.emit("connecting");
        this.ws.addEventListener("open", (e) => {
            clearTimeout(reconnect_timeout);
            this.emit("open", e);
            heartbeat_interval_id = setInterval(()=>this.ping(), 30 * 1000);
            this.#requests = {};
            this.#rid = 0;
            this.ping();
        });

        this.ws.addEventListener("message", (e) => {
            this.emit("message", e);
            if (e.data === "pong") {
                this.emit("pong");
                return;
            }
            var data;
            try {
                data = JSON.parse(e.data);
            } catch (ex) {
                console.error(ex);
                return;
            }
            if (data.request) {
                let {request} = data;
                if (request.id !== undefined) {
                    var cb = this.#requests[request.id];
                    delete this.#requests[request.id];
                    if (cb) cb(request);
                }
            }
            this.emit("data", data);
            // this event always runs before cb() promise as promises resolve later in another (pseudo) thread.
            // setTimeout(()=>this.emit("data", data), 0);
        });
        this.ws.addEventListener("close", (e) => {
            clearInterval(heartbeat_interval_id);
            this.emit("close", e);
            this.#reset_ready_promise();
            if (e.code == 401) {
                // bad gateway, don't bother.
                console.error("Connection refused: Unauthorized.");
            } else {
                if (!this.options.auto_reconnect) return;
                clearTimeout(reconnect_timeout);
                reconnect_timeout = setTimeout(() => {
                    this.#init_websocket();
                }, this.options.auto_reconnect_interval);
            }
        });
        this.ws.addEventListener("error", (e) => {
            this.emit("error", e);
        });
    }

    async ping() {
        var last_ping_ts = Date.now();
        this.ws.send("ping");
        await new Promise(resolve=>this.once("pong", resolve));
        this.last_ping = Date.now() - last_ping_ts;
        return this.last_ping;
    }
}

export default ReconnectingWebSocket;