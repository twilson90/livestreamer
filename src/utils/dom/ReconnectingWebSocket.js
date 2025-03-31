import EventEmitter from "../EventEmitter.js";

export class ReconnectingWebSocket extends EventEmitter {
    last_ping = 0;
    #ready_promise;
    get requests() { return this._requests; }

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

    request(data, timeout) {
        return new Promise((resolve, reject) => {
            var rid = ++this._requests;
            this._request_ids[rid] = (response) => {
                if (response.error) reject(response.error.message);
                else resolve(response.result);
            };
            this.send(Object.assign({
                __id__: rid,
            }, data));
            if (timeout) {
                setTimeout(() => reject(`WebSocket2 request ${rid} timed out`), timeout);
            }
        }).catch((e) => console.error(e));
    }

    async send(data) {
        await this.ready_promise;
        if (data instanceof ArrayBuffer || data instanceof Blob) {
            this.ws.send(data);
        } else {
            this.ws.send(JSON.stringify(data));
        }
    }

    #init_websocket() {
        this._request_ids = {};
        this._requests = 0;

        var heartbeat_interval_id, last_ping_ts;
        var url = this.url;
        var protocols = this.protocols;
        if (typeof url === "function") url = url();
        if (typeof protocols === "function") protocols = protocols();
        this.ws = new WebSocket(url, protocols);
        this.emit("connecting");
        this.ws.addEventListener("open", (e) => {
            clearTimeout(this._reconnect_timeout);
            this.emit("open", e);
            heartbeat_interval_id = setInterval(send_ping, 30 * 1000);
            send_ping();
        });
        var send_ping = () => {
            last_ping_ts = Date.now();
            this.ws.send("ping");
        };

        this.ws.addEventListener("message", (e) => {
            this.emit("message", e);
            if (e.data === "pong") {
                this.last_ping = Date.now() - last_ping_ts;
                return;
            }
            var data;
            try {
                data = JSON.parse(e.data);
            } catch (ex) {
                console.error(ex);
                return;
            }
            if (data) {
                if (data.__id__ !== undefined) {
                    var cb = this._request_ids[data.__id__];
                    delete this._request_ids[data.__id__];
                    cb(data);
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
            if (e.code == 1014) {
                // bad gateway, don't bother.
                console.error("Connection refused: Bad gateway.");
            } else {
                if (!this.options.auto_reconnect) return;
                clearTimeout(this._reconnect_timeout);
                this._reconnect_timeout = setTimeout(() => {
                    this.#init_websocket();
                }, this.options.auto_reconnect_interval);
            }
        });
        this.ws.addEventListener("error", (e) => {
            this.emit("error", e);
        });
    }

    async ping() {
        var ts = Date.now();
        if (await this.request({ call: "ping" }, 5000)) {
            this.last_ping = Date.now() - ts;
        }
        return this.last_ping;
    }
}

export default ReconnectingWebSocket;