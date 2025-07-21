import * as reflect from "./reflect.js";
import { EventEmitter } from "./EventEmitter.js";

export const Null$ = Symbol("Null$");
export const Proxy$TargetSymbol = Symbol("Proxy$Target");
export const Proxy$HandlerSymbol = Symbol("Proxy$Handler");

/**
 * @typedef {{
 *   set: (target: any, prop: PropertyKey, value: any) => boolean,
 *   get: (target: any, prop: PropertyKey) => any,
 *   deleteProperty: (target: any, prop: PropertyKey) => boolean,
 *   change: (target: any, prop: PropertyKey, value: any) => boolean,
 * }} Proxy$HandlerOpts
 **/


/**
 * @typedef {{
 *   get: [any, PropertyKey, any],
 *   set: [any, PropertyKey, any],
 *   deleteProperty: [any, PropertyKey],
 *   change: [any, PropertyKey, any],
 * }} Proxy$HandlerEvents 
 */

/** @typedef {(this: Proxy$Handler, handler: Proxy$Handler) => void} Proxy$HandlerCallback */

/** @extends {EventEmitter<Proxy$HandlerEvents>} */
export class Proxy$Handler extends EventEmitter {
    /** @param {Proxy$HandlerCallback} callback */
    constructor(callback) {
        super();
        if (callback) callback.apply(this, [this]);
    }

    get(target, prop) {
        if (prop === Proxy$TargetSymbol) return target;
        if (prop === Proxy$HandlerSymbol) return this;
        var value = Reflect.get(target, prop);
        if (value instanceof Proxy$) {
            value = (value[Proxy$TargetSymbol] ?? value).__proxy__;
        }
        this.emit("get", target, prop, value);
        return value;
    }
    
    set(target, prop, value) {
        var curr = target[prop];
        if (typeof value === "object" && value !== null && typeof curr === "object" && curr !== null) {
            var proto = Object.getPrototypeOf(curr);
            var new_ob = new (proto.constructor)();
            if (new_ob instanceof Proxy$) new_ob = new_ob.__proxy__;
            value = Object.assign(new_ob, value);
        }
        this.emit("set", target, prop, value); // important that we do this before setting.
        this.emit("change", target, prop);
        Reflect.set(target, prop, value);
        return true;
    }

    deleteProperty(target, prop) {
        // var old_value = target[prop];
        Reflect.deleteProperty(target, prop);
        this.emit("delete", target, prop);
        this.emit("change", target, prop, undefined);
        return true;
    }
}

export class Collection$Handler extends Proxy$Handler {
    /** @type {() => T} */
    #generator;
    /** @type {T} */
    #null_item;
    /** @param {() => T} generator @param {Proxy$HandlerCallback} callback */
    constructor(generator, callback) {
        super(callback);
        this.#generator = generator ?? (()=>new Proxy$());
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

/** @template T @template {Proxy$Handler} [Handler=Proxy$Handler] */
export class Proxy$ {
    /** @type {this} */
    #proxy;
    #proxy_handler;
    /** @param {Handler} handler */
    constructor(handler) {
        if (!handler) handler = new Proxy$Handler();
        this.#proxy_handler = handler;
        this.#proxy = new Proxy(this, handler);
    }
    /** @returns {T} */
    get __proxy__() {
        return this.#proxy;
    }
    /** @returns {Handler} */
    get __proxy_handler__() {
        return this.#proxy_handler;
    }
}

export function get_proxy_target(obj) {
    if (obj instanceof Proxy$) obj = obj.__proxy__;
    return obj[Proxy$TargetSymbol];
}

/** @returns {Proxy$Handler} */
export function get_proxy_handler(obj) {
    if (obj instanceof Proxy$) obj = obj.__proxy__;
    return obj[Proxy$HandlerSymbol];
}

/** @template T @param {() => T} generator @param {Proxy$HandlerCallback} callback @returns {Proxy$<Record<PropertyKey,T>,Collection$Handler>} */
export function Collection$(generator, callback) {
    return (new class extends Proxy$ {
        constructor() {
            super(new Collection$Handler(generator, callback));
        }
    });
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
