import * as reflect from "./reflect.js";

export const Null$ = Symbol("Null$");
export const Proxy$Target = Symbol("Proxy$Target");

/**
 * @typedef {{
 *  get:(key:PropertyKey,value:any)=>any
 *  set:(key:PropertyKey,value:any)=>void
 *  deleteProperty:(key:PropertyKey,value:any)=>boolean
 * }} Proxy$Options
 */

export class Proxy$ {
    /** @param {Proxy$Options} opts @returns {Proxy$} */
    constructor(opts) {
        if (!opts) opts = {};
        var proxy = new Proxy(this, {
            get(target, prop) {
                if (prop === Proxy$Target) return target;
                if (opts.get) return opts.get(prop, target[prop]);
                var value = Reflect.get(target, prop, proxy);
                return value;
            },
            set(target, prop, value) {
                var curr = target[prop];
                if (opts.set) value = opts.set(prop, value);
                if (typeof value === "object" && value !== null && typeof curr === "object" && curr !== null) {
                    var proto = Object.getPrototypeOf(curr);
                    var new_ob = new (proto.constructor)();
                    if (new_ob.__proxy__) new_ob = new_ob.__proxy__;
                    value = Object.assign(new_ob, value);
                }
                Reflect.set(target, prop, value, proxy);
                return true;
            },
            deleteProperty(target, prop) {
                if (prop in target) {
                    if (!opts.deleteProperty || opts.deleteProperty(prop, target[prop]) !== false) {
                        delete target[prop];
                    }
                }
                return true;
            }
        });
        Object.defineProperty(this, `__proxy__`, {
            value: proxy
        });
    }
}

/**
 * @template T
 * @typedef {{
 *  deleteProperty:(prop:PropertyKey,value:T)=>boolean
 * }} Collection$Options
 */

/** @template T */
export class Collection$ {
    /** @param {() => T} generator @param {Collection$Options<T>} opts */
    constructor(generator, opts) {
        if (!opts) opts = {};
        var null_item;
        var proxy = new Proxy(this, {
            get(target, prop) {
                if (prop === Proxy$Target) return target;
                if (prop === Null$) {
                    if (!null_item) null_item = generator();
                    return null_item.__proxy__;
                };
                var item = Reflect.get(target, prop, proxy);
                return item ? item.__proxy__ : null;
            },
            set(target, prop, value) {
                if (prop === Null$) return false;
                delete proxy[prop]; // trigger deleteProperty
                var new_item = generator();
                for (var k in value) new_item.__proxy__[k] = value[k];
                target[prop] = new_item.__proxy__;
                return true;
            },
            deleteProperty(target, prop) {
                if (prop === Null$) return false;
                if (prop in target) {
                    if (!opts.deleteProperty || opts.deleteProperty(prop, target[prop]) !== false) {
                        delete target[prop];
                    }
                }
                return true;
            },
            /* ownKeys(target) {
                return Reflect.ownKeys(target).filter(prop=>prop !== Null$);
            } */
        });
        Object.defineProperty(this, `__proxy__`, {
            value: proxy
        });
    }

    /** @template T @param {() => T} generator @param {Collection$Options} opts @returns {Record<PropertyKey,T>} */
    static create(generator, opts){
        return (new class extends Collection$ {
            constructor() {
                super(generator, opts);
            }
        }).__proxy__;
    }
}

export class ProxyID$ extends Proxy$ {
    id = "";
    get _is_null() { return !this.id; }
}

export function apply$($, data) {
    if (data.init) {
        let [path, d] = data.init;
        var target = reflect.get($.__proxy__, path);
        if (target) Object.assign(target, d);
        else reflect.set($.__proxy__, path, d);
    }
    if (data.changes) {
        for (var [type, path, value] of data.changes) {
            if (type == "delete") {
                reflect.deleteProperty($.__proxy__, path);
            } else {
                reflect.set($.__proxy__, path, value);
            }
        }
    }
}
