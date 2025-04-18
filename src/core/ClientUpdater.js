import {utils} from "./exports.js";
/** @import {Client} from "./exports.js" */

/** @typedef {{filter: (path:string[])=>boolean}} ClientUpdaterOpts */
export class ClientUpdater {
    /** @type {utils.Observer} */
    #observer;
    /** @type {ClientUpdaterOpts} */
    #opts;
    /** @type {Set<Client>} */
    #clients = new Set();
    /** @type {utils.ObserverChangeEvent[]} */
    #$_changes = [];
    #path = [];
    /** @type {(change:utils.ObserverChangeEvent)=>void} */
    #onchange;
    #is_destroyed = false;

    /** @param {utils.Observer} observer @param {ClientUpdaterOpts} opts */
    constructor(observer, path, opts) {

        this.#observer = observer;
        this.#path = path;
        this.#opts = opts || {};
        this.#onchange;
        observer.on("change", this.#onchange = (c)=>{
            if (c.subtree) return;
            if (this.#opts.filter && !this.#opts.filter(c.path)) return;
            this.#$_changes.push(c);
            this.#debounced_update();
        });
    }

    #debounced_update = utils.debounce(this.#update_clients.bind(this), 0);
    
    #update_clients() {
        if (this.#is_destroyed) return;
        if (!this.#$_changes.length) return;
        var changes = this.#$_changes.map(c=>[c.type, [...this.#path, ...c.path], c.new_value]);
        var payload = {changes};
        for (var c of this.#clients) c.send(payload);
        utils.clear(this.#$_changes);
    }

    /** @param {Client} client */
    add_client(client) {
        if (this.#clients.has(client)) return;
        this.#clients.add(client);
        var $ = this.#observer.$;
        if (this.#opts.filter) $ = utils.deep_filter($, this.#opts.filter);
        var init = utils.pathed_key_to_lookup(this.#path, {...$, client_id:client.id, ts:Date.now()});
        var payload = {init};
        client.send(payload);
    }

    /** @param {Client} client */
    remove_client(client) {
        this.#clients.delete(client);
    }

    /** @param {Client[]} clients */
    add_clients(clients) {
        for (var c of clients) this.add_client(c);
    }
    /** @param {Client[]} clients */
    remove_clients(clients) {
        for (var c of clients) this.remove_client(c);
    }

    destroy() {
        this.#is_destroyed = true;
        this.#observer.off("change", this.#onchange);
    }
}

export default ClientUpdater;