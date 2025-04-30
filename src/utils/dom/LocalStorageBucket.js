import { debounce } from "../debounce.js";
import EventEmitter from "../EventEmitter.js";
import { json_copy } from "../json_copy.js";

export class LocalStorageBucket extends EventEmitter {
    get data() { return { ...this.#defaults, ...this.#data }; }
    get keys() { return Object.keys(this.data); }
    get defaults() { return this.#defaults; }

    #name;
    #data = {};
    #hashes = {};
    #defaults;
    #default_hashes = {};
    #last_data_hash;
    #interval;

    constructor(name, defaults) {
        super();
        this.save = debounce(this.#save, 0);
        this.#name = name;
        this.#defaults = defaults ? json_copy(defaults) : {};
        this.#default_hashes = Object.fromEntries(Object.entries(this.#defaults).map(([k,v])=>[k, JSON.stringify(v)]));
        // in case it is altered in another window.
        // this.load();
        // this.#save();
    }
    get(k) {
        return this.#data[k] ?? this.#defaults[k];
    }
    set(k, new_value) {
        if (new_value == undefined) new_value = this.#defaults[k];
        var new_hash = JSON.stringify(new_value);
        var default_hash = this.#default_hashes[k];
        var old_hash = this.#hashes[k];
        if (new_hash === old_hash) return;
        var old_value = this.get(k);
        if (new_hash === default_hash) {
            delete this.#data[k];
        } else {
            this.#data[k] = new_value;
        }
        this.#hashes[k] = new_hash;
        this.emit("change", { name: k, old_value, new_value });
        this.save();
    }
    unset(k) {
        if (!(k in this.#data)) return;
        this.set(k, this.#defaults[k]);
    }
    toggle(k) {
        this.set(k, !this.get(k));
    }
    load() {
        var new_values = { ...this.#defaults };
        try {
            Object.assign(new_values, JSON.parse(localStorage.getItem(this.#name)));
        } catch {
            return;
        }
        for (var k in new_values) {
            this.set(k, new_values[k]);
        }
        if (!this.#interval) this.#interval = setInterval(() => this.load(), 5000);
    }
    #save() {
        this.#last_data_hash = JSON.stringify(this.#data);
        localStorage.setItem(this.#name, this.#last_data_hash);
    }
    destroy() {
        clearInterval(this.#interval);
    }
}

export default LocalStorageBucket;