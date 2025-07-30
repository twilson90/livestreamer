import events from "node:events";
import {utils} from "./exports.js";
/** @import {Client} from "./exports.js" */

/** @typedef {{filter: (change:utils.ObserverChangeEvent)=>boolean}} ClientUpdaterOpts */

/** @template {Client} T */
class ClientInfo {
    /** @param {T} client */
    constructor(client) {
        this._destroy = () => {
            client.destroy();
        };
    }
}

/** @template {Client} T @typedef {{subscribe: [T], unsubscribe: [T]}} Events */

/** @template {Client} T @extends {events.EventEmitter<Events<T>>} */
export class ClientUpdater extends events.EventEmitter {
    /** @type {utils.Observer} */
    #observer;
    /** @type {ClientUpdaterOpts} */
    #opts;
    /** @type {Map<T,ClientInfo<T>} */
    #client_map = new Map();
    /** @type {Set<T>} */
    #new_clients = new Set();
    /** @type {[string, string[], any][]} */
    #$_changes = [];
    #path = [];
    #is_destroyed = false;
    #onchange;

    get clients() { return [...this.#client_map.keys()]; }
    get has_clients() { return !!this.#client_map.size; }

    /** @param {utils.Observer} observer @param {ClientUpdaterOpts} opts */
    constructor(observer, path, opts) {
        super();
        this.#observer = observer;
        this.#path = path || [];
        this.#opts = opts || {};
        this.on("destroy", ()=>{
            if (this.#onchange) this.#observer.off("change", this.#onchange);
        });
    }

    #debounced_update = utils.debounce(this.#update_clients.bind(this), 0);
    
    #update_clients() {
        if (this.#is_destroyed) return;

        if (this.#new_clients.size) {
            let $ = {...this.#observer.$};
            if (this.#opts.filter) {
                $ = utils.deep_filter($, (path, new_value)=>{
                    var c = {type:"set", path, new_value};
                    return this.#opts.filter(c);
                });
            }
            for (var client of this.#new_clients) {
                $.client_id = client.id;
                $.ts = Date.now();
                var payload = { init: [this.#path, $] };
                client.send(payload);
            }
            this.#new_clients.clear();
        }

        if (this.#$_changes.length) {
            var changes = this.#$_changes;
            var payload = { changes };
            for (var client of this.#client_map.keys()) client.send(payload);
            utils.clear(this.#$_changes);
        }

        if (this.#client_map.size && !this.#onchange) {
            /** @type {(change:utils.ObserverChangeEvent)=>void} */
            this.#onchange = (c)=>{
                if (c.subtree) return;
                if (!this.has_clients) return;
                if (this.#opts.filter && !this.#opts.filter(c)) return;
                let path = [...this.#path, ...c.path];
                let d = c.type === "delete" ? [c.type, path] : [c.type, path, c.new_value];
                this.#$_changes.push(d);
                this.#debounced_update();
            };
            this.#observer.on("change", this.#onchange);
        } else if (!this.#client_map.size && this.#onchange) {
            this.#observer.off("change", this.#onchange);
            this.#onchange = null;
        }
    }

    /** @param {T} client */
    subscribe(client) {
        if (this.#client_map.has(client)) return;
        this.#new_clients.add(client);
        var info = new ClientInfo(client);
        this.#client_map.set(client, info);
        client.on("destroy", info._destroy);
        this.emit("subscribe", client);
        this.#debounced_update();
    }

    /** @param {T} client */
    unsubscribe(client) {
        if (!this.#client_map.has(client)) return;
        var info = this.#client_map.get(client);
        this.#client_map.delete(client);
        this.#new_clients.delete(client);
        client.off("destroy", info._destroy);
        this.emit("unsubscribe", client);
    }

    destroy() {
        if (this.#is_destroyed) return;
        this.#is_destroyed = true;
        this.emit("destroy");
    }
}

export default ClientUpdater;