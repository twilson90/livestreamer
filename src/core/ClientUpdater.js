import * as utils from "./utils.js";
/** @import ClientServer from "./ClientServer.js" */
/** @import ClientBase from "./ClientBase.js" */
/** @import { ObserverChangeEvent, Observer } from '../utils/Observer.js' */

/** @template {ClientBase} T */
export class ClientUpdater {
    /** @type {ObserverChangeEvent[]} */
    #$_changes = [];
    /** @type {function():Iterable<T>} */
    #clients;
    #update_interval;
    /** @type {Observer} */
    #observer;

    /** @param {Observer} observer */
    /** @param {function():Iterable<T>} clients */
    /** @param {function(ObserverChangeEvent):boolean} filter */
    constructor(observer, clients, filter) {
        if (!filter) filter = (c)=>true;
        this.#observer = observer;
        this.#clients = clients;
        var debounced_update = utils.debounce(()=>this.update_clients(), 0);
        this.#observer.on("change", c=>{
            if (c.subtree) return;
            if (!filter(c)) return;
            this.#$_changes.push(c);
            debounced_update();
        });
    }

    update_clients() {
        if (!this.#$_changes.length) return;
        var $ = utils.Observer.flatten_changes(this.#$_changes);
        utils.clear(this.#$_changes);
        for (var c of this.#clients()) {
            c.send({$});
        }
    }

    destroy() {
        clearInterval(this.#update_interval);
    }
}

export default ClientUpdater;