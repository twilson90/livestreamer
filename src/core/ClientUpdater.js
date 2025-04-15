import {utils} from "./exports.js";
/** @import {ClientServer, Client} from "./exports.js" */
export class ClientUpdater extends utils.EventEmitter {
    /** @type {utils.Observer} */
    #observer;
    /** @type {ClientUpdaterOpts} */
    #opts;
    /** @type {Client[]} */
    #clients = [];
    /** @type {utils.ObserverChangeEvent[]} */
    #$_changes = [];

    /** @param {utils.Observer} observer @param {ClientUpdaterOpts} opts */
    constructor(observer, opts) {
        super();

        this.#observer = observer;
        this.#opts = opts;
        
        observer.on("change", c=>{
            if (c.subtree) return;
            // if (this.#opts.filter && !this.#opts.filter(c)) return;
            this.#$_changes.push(c);
            this.#debounced_update();
        });
    }

    #debounced_update = utils.debounce(this.#update_clients.bind(this), 0);
    
    #update_clients() {
        if (!this.#$_changes.length) return;
        var changes = this.#$_changes.map(c=>[c.type, c.path, c.new_value]);
        var payload = {changes};
        for (var c of this.#clients) c.send(payload);
        utils.clear(this.#$_changes);
    }

    /** @param {Client} client */
    add_client(client) {
        var $ = this.#observer.$;
        var payload = {init:{...$, client_id:client.id, ts:Date.now()}};
        client.send(payload);
        this.#clients.push(client);
    }
    /** @param {Client} client */
    remove_client(client) {
        client.send(payload);
    }
}

export default ClientUpdater;