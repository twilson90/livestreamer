import EventEmitter from "../../EventEmitter.js";

import { $ } from "../render_html.js";
import { debounce_next_frame } from "../debounce_next_frame.js";
import { remove_children } from "../remove_children.js";
import { get_index } from "../get_index.js";
import { is_visible } from "../is_visible.js";
import { set_children } from "../set_children.js";
import { set_inner_html } from "../set_inner_html.js";
import { toggle_attribute } from "../toggle_attribute.js";
import { toggle_class } from "../toggle_class.js";
import { DeferredReady } from "../../DeferredReady.js";
import { array_remove } from "../../array_remove.js";

/** @import events from "node:events" */

var ID = 0;
const PRE = "_ui_";
const EXPANDO = `${PRE}-${Date.now()}`;
// var updating;

/** @param {Element} type @param {function(UI):boolean|boolean} deep @param {boolean} include_self @returns {Generator<UI>} */
export function *traverse(elem, deep=false, include_self=false) {
    if (include_self && elem[EXPANDO]) yield elem[EXPANDO];
    if (!elem.children) return;
    for (var c of elem.children) {
        var found = !!c[EXPANDO]
        if (found) yield c[EXPANDO];
        var check = typeof deep === "function" ? deep(c[EXPANDO]) : !!deep;
        if (!found || check) {
            yield* traverse(c, deep);
        }
    }
}
/** @returns {Generator<UI>} */
export function *parents(elem, include_self=false) {
    if (!include_self) elem = elem.parentElement;
    while(elem) {
        if (elem[EXPANDO]) yield elem[EXPANDO];
        elem = elem.parentElement;
    }
}

/**
 * @template T
 * @param {Element} elem
 * @param {new (...args: any[]) => T} type
 * @returns {T}
 * @description Returns the closest UI element (including if the element itself matches)
 */
export function closest(elem, type = UI) {
    for (var ui of parents(elem, true)) {
        if (ui instanceof type) return ui;
    }
}

export function find(elem, type = UI) {
    for (var ui of traverse(elem, true, true)) {
        if (ui instanceof type) return ui;
    }
}

/** @template {UI} [ThisType=UI] @template Value @typedef {(Value|(this:ThisType)=>Value)} UISetting */
/**
 * @template {UI} [ThisType=UI]
 * @typedef {{
 *   hidden: UISetting<ThisType,boolean>,
 *   disabled: UISetting<ThisType,boolean>,
 *   class: UISetting<ThisType,string>,
 *   style: UISetting<ThisType,string>,
 *   gap: UISetting<ThisType,string>,
 *   title: UISetting<ThisType,string>,
 *   display: UISetting<ThisType,string>,
 *   align: UISetting<ThisType,string>,
 *   justify: UISetting<ThisType,string>,
 *   flex: UISetting<ThisType,string>,
 *   id: UISetting<ThisType,string>,
 *   children: UISetting<ThisType,UI[]>,
 *   content: UISetting<ThisType,string>,
 *   update_children: UISetting<ThisType,boolean>,
 *   click: (this:ThisType, e:Event)=>void,
 *   click_async: (this:ThisType, e:Event)=>Promise<void>,
 *   render: (this:ThisType, e:Event)=>void,
 *   mousedown: (this:ThisType, e:Event)=>void,
 *   mouseup: (this:ThisType, e:Event)=>void,
 *   dblclick: (this:ThisType, e:Event)=>void,
 *   update: (this:ThisType, e:Event)=>void,
 *   post_update: (this:ThisType, e:Event)=>void
 * }} UISettings
 **/

/** 
 * @typedef {{
 *   update: [boolean],
 *   post_update: [],
 *   render: [],
 *   destroy: []
 * }} UIEvents 
 */

/**
* @template {UISettings<UI>} [Settings=UISettings<UI>]
* @template {UIEvents} [Events=UIEvents]
* @extends {EventEmitter<Events>}
*/
export class UI extends EventEmitter {
    /** @type {Settings} */
    #settings;
    #updating = false;
    #layout_hash;
    #destroyed = false;
    #async_click_promise;
    #content_override = null;
    #content_timeout;
    #temp_content_deferred = new DeferredReady();
    #index = -1;
    /** @type {UI} */
    #parent;
    /** @type {UI[]} */
    __children = [];

    /** @returns {UI} */
    get parent() { return this.#parent; }
    /** @returns {number} @description The index of the DOM element in the parent */
    get index() { return this.#index; }

    get async_click_in_progress() { return !!this.#async_click_promise; }
    get is_hidden() { return ("hidden" in this.#settings) && !!this.get_setting("hidden"); }
    get settings() { return this.#settings; }
    get visible() { return is_visible(this.elem); } // not the opposite of hidden
    get descendents() { return [...this.iterate_descendents()]; }
    get parents() { return [...this.iterate_parents()]; }
    get children() { return [...this.__children]; }
    get root() {
        for (var p of this.iterate_parents());
        return p;
    }
    get destroyed() { return this.#destroyed; }
    get id() { return this.__UID__; }
    /** @type {boolean} */
    get is_disabled() {
        var parent = this.parent;
        return !!this.#async_click_promise || (parent && parent.is_disabled) || ("disabled" in this.#settings && !!this.get_setting("disabled"));
    }
    set layout(v) { this.set_layout(v); }

    /** @param {HTMLElement} parent */
    __register() {
        // this.#parent = parent;
        this.__unregister();
        this.#parent = closest(this.elem.parentElement, UI);
        this.#index = get_index(this.elem);
        if (this.#parent) this.#parent.__children.push(this);
    }

    __unregister() {
        if (this.#parent) {
            array_remove(this.#parent.__children, this);
            this.#parent = null;
            this.#index = -1;
        }
    }
    
    /** @returns {Generator<UI>} */
    *iterate_descendents() {
        for (var c of this.__children) {
            yield c;
            yield* c.iterate_descendents();
        }
    }
    *iterate_parents() {
        var p = this.parent;
        while (p) {
            yield p;
            p = p.parent;
        }
    }

    /** @param {HTMLElement} elem @param {Settings} settings */
    constructor(elem, settings) {
        super();
        if (this.__UID__) throw new Error("UI already initialized");
        this.__UID__ = ++ID;
        if (typeof elem === "object" && !(elem instanceof HTMLElement) && settings === undefined) {
            settings = elem;
            elem = null;
        }
        if (typeof elem === "string") elem = $(elem)[0];
        if (!elem) elem = document.createElement('div');
        /** @type {HTMLElement} */
        this.elem = elem;
        this.elem[EXPANDO] = this;
        this.elem.classList.add(PRE);
        this.elem.dataset.ui = this.__UID__;
        this.#settings = { ...settings };

        if ("class" in this.#settings) {
            var classes = this.get_setting("class");
            if (typeof classes === "string") classes = classes.split(/\s+/);
            this.elem.classList.add(...classes);
        }
        if ("style" in this.#settings) {
            Object.assign(this.elem.style, this.get_setting("style"));
        }

        // var is_connected = this.elem.isConnected;

        this.get_setting("init");

        /* if (is_connected) {
            // this.update(true);
            this.update();
        } */
    }
    
    override_content_temporarily(content, timeout) {
        clearTimeout(this.#content_timeout);
        this.#content_override = [content, this.#content_override ? this.#content_override[1] : this.elem.innerHTML];
        this.update();
        this.#temp_content_deferred.state = false;
        if (timeout) {
            this.#content_timeout = setTimeout(()=>{
                this.elem.innerHTML = this.#content_override[1];
                this.#content_override = null;
                this.update();
                this.#temp_content_deferred.state = true;
            }, timeout);
        }
        return this.#temp_content_deferred.ready;
    }

    update_next_frame = debounce_next_frame(() => this.update());

    update() {
        if (!this.elem.isConnected) return;
        if (this.#updating) return this.#updating;
        this.__update();
        this.__render();
    }

    __before_update() {}

    __update() {
        var resolve;
        this.#updating = new Promise((r)=>resolve=r);
        // this.emit("before_update");
        this.__before_update();

        this.get_setting("update");
        this.emit("update");
        
        if (this.get_setting("update_children") !== false) {
            var i = 0;
            for (var c of this.children) {
                c.__update();
                i++;
            }
        }
        
        this.#updating = null;
        resolve();

        this.get_setting("post_update");
        this.emit("post_update");
    }

    __render() {
        
        var is_hidden = this.is_hidden;
        var is_disabled = this.is_disabled;
        toggle_class(this.elem, "hidden", is_hidden);
        toggle_attribute(this.elem, "disabled", is_disabled);

        if ("gap" in this.#settings) {
            var gap = this.get_setting("gap");
            if (typeof gap !== "string" || gap.match(/^[0-9.]+$/)) gap = `${parseFloat(gap)}px`;
            this.elem.style.setProperty("gap", gap);
        }
        if ("title" in this.#settings) this.elem.title = this.get_setting("title") || "";
        if ("display" in this.#settings) this.elem.style.display = this.get_setting("display") || "";
        if ("align" in this.#settings) this.elem.style.alignItems = this.get_setting("align") || "";
        if ("justify" in this.#settings) this.elem.style.justifyContent = this.get_setting("justify") || "";
        if ("flex" in this.#settings) this.elem.style.flex = this.get_setting("flex") || "";
        if ("id" in this.#settings) this.elem.id = this.get_setting("id") || "";
        if ("children" in this.#settings) set_children(this.elem, this.get_setting("children"));
        if (this.#content_override) set_inner_html(this.elem, this.#content_override[0]);
        else if ("content" in this.#settings) set_inner_html(this.elem, this.get_setting("content"));

        if ("click" in this.#settings) this.elem.onclick = (e) => this.#do_event(e, "click");
        else if ("click_async" in this.#settings) {
            this.elem.onclick = async (e) => {
                this.#async_click_promise = Promise.resolve(this.#do_event(e, "click_async")).finally(()=>{
                    this.#async_click_promise = null;
                    this.update();
                });
                this.update();
            }
        }

        if ("mousedown" in this.#settings) this.elem.onmousedown = (e) => this.#do_event(e, "mousedown");
        if ("mouseup" in this.#settings) this.elem.onmouseup = (e) => this.#do_event(e, "mouseup");
        if ("dblclick" in this.#settings) this.elem.ondblclick = (e) => this.#do_event(e, "dblclick");

        this.get_setting("render");
        this.emit("render");

        if (this.get_setting("update_children") !== false) {
            for (var c of this.children) {
                c.__render();
            }
        }
    }

    /** @param {Event} e */
    #do_event(e, setting) {
        var res = this.get_setting(setting, e);
        this.emit(e.type);
        return res;
    }

    /**
     * @template {keyof Settings} K
     * @param {K} key
     * @returns {Settings[K] extends UISetting<any, infer Value> ? Value : Settings[K] extends Function ? ReturnType<Settings[K]> : Settings[K]}
    */
    get_setting(key, ...args) {
        var setting = this.#settings[key];
        while (typeof setting === "function") {
            setting = setting.apply(this, args);
        }
        return setting;
    }

    /* get_settings_group(key) {
        return Object.fromEntries(Object.entries(this.#settings).filter(([k,v])=>k.startsWith(key+".")).map(([k,v])=>[k.slice(key.length+1),v]));
    } */
    empty() {
        remove_children(this.elem);
        return this;
    }

    /** @template T @param {T} el @returns {T} */
    append(el) {
        this.elem.append(...arguments);
        return el;
    }

    /** @template T @param {T} el @returns {T} */
    prepend(el) {
        this.elem.prepend(...arguments);
        return el;
    }

    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.elem.remove();
        this.emit("destroy");
    }

    set_layout(layout) {
        var hash = JSON.stringify(layout, (k, p) => p instanceof UI ? p.id : p);
        if (hash === this.#layout_hash) return;
        this.#layout_hash = hash;
        this.empty();
        var process = (parent, layout) => {
            for (var o of layout) {
                if (Array.isArray(o)) {
                    let r = new FlexRow({ hidden(){ return this.children.every(c => c.is_hidden) } });
                    process(r, o);
                    this.append(r);
                } else if (typeof o === "string" && o.startsWith("-")) {
                    this.append(new Separator());
                } else if (o) {
                    parent.append(o);
                }
            }
        };
        process(this, layout);
        this.update();
    }

    emit(event, e, opts) {
        opts = {
            bubbles: false,
            ...opts,
        };
        var res = super.emit(event, e);
        if (res === false) return;
        if (opts.bubbles) {
            if (this.parent) {
                this.parent.emit(event, e, opts);
            }
        }
    }
}

var old_append = Element.prototype.append;
var old_prepend = Element.prototype.prepend;

Element.prototype.append = function(...children) {
    old_append.apply(this, [...handle_els(children)]);
}
Element.prototype.prepend = function(...children) {
    old_prepend.apply(this, [...handle_els(children)]);
}

/** @returns {Iterable<HTMLElement>} */
function *handle_els(o) {
    if (Array.isArray(o)) for (var c of o) for (var c2 of handle_els(c)) yield c2;
    else if (o instanceof UI) yield o.elem;
    else if (typeof o === "string") for (var c of $(o)) yield c;
    else if (o) yield o;
}

/** 
 * @template {Box} [ThisType=Box]
 * @typedef {UISettings<ThisType> & {
 *   'header': UISetting<ThisType,string>,
 *   'collapsible': UISetting<ThisType,boolean>,
 *   'collapsed': UISetting<ThisType,boolean>,
 * }} BoxSettings 
 */

/** 
 * @template {BoxSettings<Box>} [Settings=BoxSettings<Box>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Box extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        
        super(null, {
            ...settings
        });
        if ("header" in this.settings) {
            this.header = new Header(`<h5>${this.get_setting("header")}</h5>`);
            this.append(this.header);
        }
        if (this.get_setting("collapsible")) {
            this.elem.classList.add("collapsible");
            this.header.settings.click = ()=>{
                this.settings.collapsed = !this.settings.collapsed;
                this.update();
            }
            this.header.elem.style.cursor = "pointer";
        }
        this.content = new UI();
        this.content.elem.classList.add("inner");
        this.append(this.content);

        this.on("update", ()=>{
            this.elem.toggleAttribute("data-collapsed", this.get_setting("collapsed"));
        });
        this.elem.classList.add("box");
    }
}

/** 
 * @template {UISettings<Button>} [Settings=UISettings<Button>]
 * @template {UIEvents} Events
 * @extends {UI<Settings,Events>} 
 */
export class Button extends UI {

    /** @param {HTMLElement} elem @param {Settings} settings */
    constructor(elem, settings) {
        super(elem || `<button></button>`, {
            title: ()=>{
                if (!this.elem.children.length) return this.elem.innerHTML;
                if (original_title) return original_title;
            },
            ...settings,
        });
        var original_title = this.elem.title;
        this.elem.classList.add("button");
    }
}

/** 
 * @template {UISettings<Column>} [Settings=UISettings<Column>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Column extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        super(null, settings);
        this.elem.classList.add("column");
    }
}

/** 
 * @template {UISettings<Header>} [Settings=UISettings<Header>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Header extends UI {
    /** @param {Settings} settings */
    constructor(elem, settings) {
        super(elem || `<h5></h5>`, settings);
        this.elem.classList.add("header");
        this.elem.style.margin = "0";
    }
}

/** 
 * @template {UISettings<Label>} [Settings=UISettings<Label>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Label extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        super("<label></label>", settings);
    }
}

/** 
 * @template {UISettings<Link>} [Settings=UISettings<Link>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Link extends UI {
    /** @param {HTMLElement} elem @param {Settings} settings */
    constructor(elem, settings) {
        super(elem || `<a></a>`, settings);
        this.on("render", () => {
            if ("href" in this.settings) this.elem.href = this.get_setting("href");
            if ("target" in this.settings) this.elem.target = this.get_setting("target");
        });
    }
}

/** 
 * @template {UISettings<Row>} [Settings=UISettings<Row>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Row extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        super(null, settings);
        this.elem.classList.add("row");
    }
}

/** 
 * @template {UISettings<Separator>} [Settings=UISettings<Separator>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class Separator extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        super("<hr>", settings);
    }
}

/** 
 * @template {UISettings<FlexColumn>} [Settings=UISettings<FlexColumn>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class FlexColumn extends Column {
    /** @param {Settings} settings */
    constructor(settings) {
        super(settings);
        this.elem.classList.add("flex");
    }
}

/** 
 * @template {UISettings<FlexRow>} [Settings=UISettings<FlexRow>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class FlexRow extends Row {
    /** @param {Settings} settings */
    constructor(settings) {
        super(settings);
        this.elem.classList.add("flex");
    }
}

/** 
 * @template {UISettings<List>} [Settings=UISettings<List>]
 * @template {UIEvents} [Events=UIEvents]
 * @extends {UI<Settings,Events>} 
 */
export class List extends UI {
    /** @param {Settings} settings */
    constructor(settings) {
        super({
            ...settings,
        });
        this.elem.classList.add("list");
    }
    /** @returns {ListItemType[]} */
    get list_items() { return this.children; }
}

export function init(root) {
    if (!root) root = document.documentElement;
    var clazz = `${PRE}-root`;
    if (root.classList.contains(clazz)) return;
    /** @param {Element} el @param {function(UI):void} cb @param {UI} ui @param {UI[]} roots */
    var walk = (el, cb, parent_ui, roots=[])=>{
        if (el instanceof HTMLElement) {
            /** @type {UI} */
            var ui = el[EXPANDO];
            if (ui) {
                cb(ui);
                if (!parent_ui) roots.push(ui);
            }
            for (var c of el.children) {
                walk(c, cb, ui ?? parent_ui, roots);
            }
        }
        return roots;
    }
    var observer = new MutationObserver((e)=>{
        /** @type {UI} */
        var ui;
        for (var mutation of e) {
            if (mutation.type === "childList") {
                for (var el of mutation.removedNodes) {
                    walk(el, (ui)=>ui.__unregister());
                }
                for (var el of mutation.addedNodes) {
                    let roots = walk(el, (ui)=>ui.__register());
                    for (var ui of roots) ui.update();
                }
            }
            if (mutation.type === "attributes") {
                if (mutation.target instanceof HTMLElement) {
                    var ui = mutation.target[EXPANDO];
                    if (ui) ui.__register();
                }
            }
        }
    });
    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-ui"],
    });
    root.classList.add(clazz);
}

init();

export default UI;