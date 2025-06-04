import * as reflect from "./reflect.js";
import { EventEmitter } from "./EventEmitter.js";

export const Null$ = Symbol("Null$");
export const Proxy$Target = Symbol("Proxy$Target");

/** @typedef {{set: (target: any, prop: PropertyKey, value: any) => boolean, get: (target: any, prop: PropertyKey) => any, deleteProperty: (target: any, prop: PropertyKey) => boolean}} Proxy$HandlerOpts */
export class Proxy$Handler extends EventEmitter {
    /** @type {Proxy$HandlerOpts} */
    #opts;
    /** @param {Proxy$HandlerOpts} opts */
    constructor(opts) {
        super();
        this.#opts = {...opts};
    }

    get(target, prop) {
        if (prop === Proxy$Target) return target;
        if (this.#opts.get) return this.#opts.get(target, prop);
        var value = Reflect.get(target, prop);
        if (value instanceof Proxy$) {
            value = (value[Proxy$Target] ?? value).__proxy__;
        }
        this.emit("get", target, prop, value);
        return value;
    }
    
    set(target, prop, value) {
        var curr = target[prop];
        if (this.#opts.set) return this.#opts.set(target, prop, value);
        if (typeof value === "object" && value !== null && typeof curr === "object" && curr !== null) {
            var proto = Object.getPrototypeOf(curr);
            var new_ob = new (proto.constructor)();
            if (new_ob instanceof Proxy$) new_ob = new_ob.__proxy__;
            value = Object.assign(new_ob, value);
        }
        this.emit("set", target, prop, value); // important that we do this before setting.
        Reflect.set(target, prop, value);
        return true;
    }
    deleteProperty(target, prop) {
        if (this.#opts.deleteProperty) return this.#opts.deleteProperty(target, prop);
        Reflect.deleteProperty(target, prop);
        this.emit("delete", target, prop);
        return true;
    }
}

export class Collection$Handler extends Proxy$Handler {
    /** @type {() => T} */
    #generator;
    /** @type {T} */
    #null_item;
    constructor(generator) {
        super();
        this.#generator = generator;
    }
    get(target, prop) {
        if (prop === Null$) {
            if (!this.#null_item) this.#null_item = this.#generator();
            if (this.#null_item instanceof Proxy$) this.#null_item = this.#null_item.__proxy__;
            return this.#null_item;
        }
        return super.get(target, prop);
    }
    set(target, prop, value) {
        if (prop === Null$) return false;
        if (this.#generator) target[prop] = this.#generator();
        return super.set(target, prop, value);
    }
    deleteProperty(target, prop) {
        if (prop === Null$) return false;
        return super.deleteProperty(target, prop);
    }
}

export class Proxy$ {
    /** @type {this} */
    #proxy;
    /** @type {Proxy$Handler} */
    #proxy_handler;
    /** @param {Proxy$Handler} handler */
    constructor(handler) {
        if (!handler) handler = new Proxy$Handler();
        this.#proxy_handler = handler;
        this.#proxy = new Proxy(this, handler);
    }
    get __proxy__() {
        return this.#proxy;
    }
    get __proxy_handler__() {
        return this.#proxy_handler;
    }
}

// /** @template T @param {Proxy$Handler} handler @returns {Record<PropertyKey,T>} */
// export function Object$(handler) {
//     return (new class extends Proxy$ {
//         constructor() {
//             super(handler);
//         }
//     }).__proxy__;
// }

/** @template T @param {() => T} generator @returns {Record<PropertyKey,T>} */
export function Collection$(generator) {
    return (new class extends Proxy$ {
        constructor() {
            super(new Collection$Handler(generator));
        }
    }).__proxy__;
}

export class ProxyID$ extends Proxy$ {
    id = "";
    get _is_null() { return !this.id; }
}

/** @param {Proxy$} $ @param {Object} data */
export function apply$($, data) {
    if (data.init) {
        let [path, d] = data.init;
        var target = reflect.get($.__proxy__, path);
        if (target) Object.assign(target, d);
        else reflect.set($.__proxy__, path, d);
    }
    if (data.changes) {
        for (var [type, path, value] of data.changes) {
            // there are some cases when the target does not exist because we've already deleted it in the frontend for immediate feedback... this is a bit dodgy though.
            try {
                if (type == "delete") {
                    reflect.deleteProperty($.__proxy__, path);
                } else {
                    reflect.set($.__proxy__, path, value);
                }
            } catch {}
        }
    }
}
