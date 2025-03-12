import {utils} from "./exports.js";
/** @import {Client} from "./exports.js" */

/** @template {Client} T */
export class ClientUpdater extends utils.EventEmitter {
    /** @type {utils.ObserverChangeEvent[]} */
    #$_changes = [];
    #update_interval;
    /** @type {utils.Observer} */
    #observer;

    /** @param {utils.Observer} observer @param {function():Iterable<T>} clients @param {function(utils.ObserverChangeEvent):boolean} filter */
    constructor(observer, filter) {
        super();
        if (!filter) filter = (c)=>true;
        this.#observer = observer;
        var debounced_update = utils.debounce(()=>this.update(), 0);
        this.#observer.on("change", c=>{
            if (c.subtree) return;
            if (!filter(c)) return;
            this.#$_changes.push(c);
            debounced_update();
        });
    }

    update() {
        if (!this.#$_changes.length) return;
        var $ = utils.Observer.flatten_changes(this.#$_changes);
        utils.clear(this.#$_changes);
        this.emit("update", $);
    }

    destroy() {
        clearInterval(this.#update_interval);
    }
}

export default ClientUpdater;