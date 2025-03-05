import EventEmitter from "./EventEmitter.js";
import {Observer, Observer_SET, Observer_DELETE, ObserverChangeEvent} from "./Observer.js";
import * as utils from "./utils.js";

const STACK_LIMIT = 256;

export class Entry {
    /** @param {History} parent @param {ObserverChangeEvent[]} changes */
    constructor(name, changes) {
        var ts = Date.now();
        this.name = name;
        this.num_changes = changes.length;
        this.changes = changes
        this.forward_changes = Observer.flatten_changes(changes)
        this.backward_changes = Observer.flatten_changes(changes, true);
        this.ts = ts;
        this.$ = { name, ts, changes: changes.length };
    }
}

export default class History extends EventEmitter {
    #applying = false;
    /** @type {Record<string|undefined,Entry>} */
    #stack = {};
    /** @type {{ pos:number, stack:Entry[] }} */
    $ = new Observer().$;
    #curr_changes = [];

    get start() { return this.$.start; }
    get end() { return this.$.end; }
    get position() { return this.$.position; }
    get size() { return this.end-this.start; }

    /** @param {Observer} target @param {function(ObserverChangeEvent):boolean} filter */
    constructor(target, filter) {
        super();
        this.clear();
        this.target = target;
        target.on("change", (c)=>{
            if (this.#applying) return;
            if (filter && !filter(c)) return;
            this.#curr_changes.push(c);
        });
    }

    clear() {
        this.$.position = 0;
        this.$.start = 0;
        this.$.end = 0;
        this.$.stack = {};
        this.#stack = {};
        this.#curr_changes = [];
    }

    #remove(id) {
        if (!(id in this.#stack)) return;
        delete this.#stack[id];
        delete this.$.stack[id];
    }

    push(name) {
        for (var i = this.$.end; i >= this.$.position; i--) this.#remove(i);
        var new_start = Math.max(this.$.start, this.$.end - STACK_LIMIT);
        for (var i = this.$.start; i < new_start; i++) this.#remove(i);
        this.$.start = new_start;
        var prev = this.#stack[this.$.position-1];
        if (prev && !prev.num_changes) {
            name = name || prev.name;
            this.#remove(this.$.position-1);
        } else {
            this.$.position++;
        }
        this.$.end = this.$.position;
        var entry = new Entry(name, [...this.#curr_changes]);
        this.#stack[this.$.position-1] = entry;
        this.$.stack[this.$.position-1] = entry.$;
        this.#curr_changes = [];
        return entry;
    }

    goto(new_pos) {
        new_pos = utils.clamp(new_pos, this.$.start, this.$.end);
        if (this.$.position == new_pos) return;
        this.#applying = true;
        if (this.#curr_changes.length) {
            var old_pos = this.$.position;
            this.push("");
            new_pos += (this.$.position - old_pos);
        }
        var reverse = new_pos<this.$.position;
        if (reverse) {
            for (var i = this.$.position-1; i >= new_pos; i--) {
                Observer.apply_changes(this.target.$, this.#stack[i].backward_changes)
            }
        } else {
            for (var i = this.$.position; i < new_pos; i++) {
                Observer.apply_changes(this.target.$, this.#stack[i].forward_changes);
            }
        }
        this.$.position = new_pos;
        this.#applying = false;
        this.emit("change");
    }

    redo() {
        this.goto(this.$.position + 1);
    }

    undo() {
        this.goto(this.$.position - 1);
    }
}
export { History }