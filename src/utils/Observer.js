import {is_iterable} from "./is_iterable.js";
import {reverse_iterator} from "./reverse_iterator.js";
import {json_copy} from "./json_copy.js";
import {clear} from "./clear.js";
import {debounce} from "./debounce.js";
import EventEmitter from "./EventEmitter.js";

var uid = 0;
export const Observer_core = Symbol("Observer_core");
export const Observer_target = Symbol("Observer_target");

export const Observer_SET = "set";
export const Observer_DELETE = "delete";
export const Observer_UPDATE = "update";

export class ObserverChangeEvent {
    /** @type {string[]} */
    path;
    /** @type {"set"|"delete"|"update"} */
    type;
    subtree = false;
    old_value;
    new_value;
    constructor(path, type, old_value, new_value, subtree=false) {
        this.path = path;
        this.type = type;
        this.old_value = json_copy(old_value);
        this.new_value = json_copy(new_value);
        this.subtree = subtree;
    }
}

/** @typedef {{change:ObserverChangeEvent}} EventMap */ // delayed_change:ObserverChangeEvent
/** @template T @extends {EventEmitter<EventMap>} */
export class Observer extends EventEmitter {
    /** @type {Map<string, [Observer,string]>} */
    #parents = new Map();
    #$;
    #opts;
    id = uid++;
    /** @type {T} */
    get $(){ return this.#$; }

    /** @param {T} target @param {any} opts */
    constructor(target, opts) {
        super();

        if (Observer.is_proxy(target) || target instanceof Observer) {
            throw new Error(`Observer target is already being observed.`, {target})
        }

        if (!target) target = {};
        opts = {
            subtree: true,
            recursive: true,
            ...opts
        };
        this.#opts = opts;

        var walk = (o, delegate, path=[])=>{
            if (typeof o !== "object" || o === null) return;
            for (var k in o) {
                var sub_path = [...path, k];
                delegate.apply(o, [sub_path, o[k]]);
                walk(o[k], delegate,  sub_path);
            }
        };
        var klaw = (o, delegate, path=[])=>{
            if (typeof o !== "object" || o === null) return;
            for (var k in o) {
                var sub_path = [...path, k];
                klaw(o[k], delegate, sub_path);
                delegate.apply(o, [sub_path, o[k]]);
            }
        };
        var try_unregister_child = (child, prop)=>{
            if (!opts.recursive) return;
            var child_observer = Observer.get_observer(child);
            if (!child_observer) return;
            if (this.#opts.subtree) {
                klaw(child, (path,value)=>{
                    var full_path = [prop, ...path];
                    this.emit("change", new ObserverChangeEvent(full_path, Observer_DELETE, value, undefined, true));
                });
            }
            var key = JSON.stringify([this.id, prop]);
            child_observer.#parents.delete(key);
        };
        var try_register_child = (child, prop)=>{
            if (!opts.recursive) return;
            var child_observer = Observer.get_observer(child);
            if (!child_observer) return;
            if (this.#opts.subtree) {
                walk(child, (path,value)=>{
                    var full_path = [prop, ...path];
                    this.emit("change", new ObserverChangeEvent(full_path, Observer_SET, undefined, value, true));
                });
            }
            var key = JSON.stringify([this.id, prop]);
            child_observer.#parents.set(key, [this, prop]);
        };

        // -----------------

        // !! Arrays (shift(), splice(), etc.) produce TONS of events... consider replacing arrays with special object that doesnt emit so many changes.

        this.#$ = new Proxy(target, {
            get: (target, prop)=>{
                if (prop === Observer_core) return this;
                if (prop === Observer_target) return target;
                return target[prop];
            },
            set: (target, prop, new_value)=>{
                var old_value = target[prop];
                new_value = Observer.resolve_proxy(new_value);
                if (old_value !== new_value) {
                    try_unregister_child(old_value, prop);
                    var exists = (prop in target);
                    
                    target[prop] = new_value;

                    try_register_child(new_value, prop);

                    var e = new ObserverChangeEvent([prop], exists ? Observer_UPDATE : Observer_SET, old_value, new_value, false);
                    this.emit("change", e);
                }
                return true;
            },
            deleteProperty: (target, prop)=>{
                if (prop in target) {
                    var old_value = target[prop];
                    delete target[prop];
                    var e = new ObserverChangeEvent([prop], Observer_DELETE, old_value, undefined, false);
                    this.emit("change", e);
                    try_unregister_child(old_value, prop);
                }
                return true;
            }
        });

        for (var k in this.#$) this.#$[k] = this.#$[k];
    }

    // /** @type {ObserverChangeEvent[]} */
    // #recent_changes = [];
    // #debounced_change = debounce(()=>{
    //     var seen = {};
    //     for (var e of this.#recent_changes) {
    //         seen[JSON.stringify(e.path)] = e;
    //     }
    //     for (var e of Object.values(seen)) {   
    //         this.emit("delayed_change", e);
    //     }
    //     clear(this.#recent_changes);
    // }, 0);

    emit(event, e) {
        super.emit(event, e);
        if (e instanceof ObserverChangeEvent) {
            // this.#recent_changes.push(e);
            // this.#debounced_change();
            for (var [parent, key] of this.#parents.values()) {
                e = new ObserverChangeEvent([key, ...e.path], e.type, e.old_value, e.new_value, e.subtree);
                parent.emit(event, e);
            }
        }
    }

    static RESET_KEY = "__RESET_0f726b__";
    /** @return {Observer} */
    static get_observer(proxy) {
        if (proxy) return proxy[Observer_core];
    }
    static is_proxy(proxy) {
        return !!Observer.get_observer(proxy);
    };
    static resolve_proxy(object) {
        if (!Observer.is_proxy(object) && typeof object === "object" && object !== null) {
            if (object instanceof Observer) return object.$;
            return new Observer(object).$;
        }
        return object;
    };
    static resolve(object) {
        if (typeof object === "object" && object !== null) {
            if (object instanceof Observer) return object;
            return Observer.get_observer(object) || new Observer(object);
        }
        return object;
    };
    /** @param {Iterable<ObserverChangeEvent>} changes */
    static flatten_changes(changes, reverse=false) {
        let result = {};
        if (reverse) changes = reverse_iterator(changes);
        for (let c of changes) {
            let key = c.path[c.path.length-1];
            let r = result;
            let last_r;
            for (let i = 0; i < c.path.length-1; i++) {
                let p = c.path[i];
                if (r[p] === undefined) r[p] = {};
                last_r = r;
                r = r[p];
            }
            if (typeof r === "object" && r !== null) {
                let value = reverse ? c.old_value : c.new_value;
                if (typeof value === "object" && value !== null) {
                    value = {
                        [Observer.RESET_KEY]: value.constructor.name,
                        ...value
                    };
                }
                r[key] = value;
            }
        }
        return result;
    };

    // root must be object, not array.
    static apply_changes(target, changes) {
        var apply = (target, changes) =>{
            for (var k in changes)  {
                if (k === Observer.RESET_KEY) continue;
                if (typeof changes[k] === 'object' && changes[k] !== null) {
                    if (Observer.RESET_KEY in changes[k]) {
                        
                        var old_constructor = target[k] ? target[k].constructor.name : undefined;
                        var new_constructor = "Object";
                        try { new_constructor = changes[k][Observer.RESET_KEY]; } catch { }
                        
                        if (target[k] && !globalThis[old_constructor]) {
                            Object.assign(clear(target[k]), new (target[k].constructor)());
                        } else if (target[k] && old_constructor === "Object" && old_constructor === new_constructor) {
                            clear(target[k]);
                        } else {
                            target[k] = new (globalThis[new_constructor])(); // so weird
                        }
                    }
                    if (typeof target[k] !== "object" || target[k] === null) {
                        target[k] = (Array.isArray(changes[k])) ? [] : {};
                    }
                    apply(target[k], changes[k]);
                    if (Array.isArray(changes[k])) target[k].length = changes[k].length;
                    
                } else if (changes[k] == null) {
                    delete target[k];
                } else {
                    target[k] = changes[k];
                }
            }
        };
        if (is_iterable(changes)) {
            changes = Observer.flatten_changes(changes);
        }
        apply(target, changes);
    }
}
export default Observer;