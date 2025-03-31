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

import "./ui.scss";

var ID = 0;
const PRE = "uis";
const EXPANDO = `${PRE}-${Date.now()}`;

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
/** @template [T=UI] @param {Element} elem @param {new() => T} type @returns {T}
 * @description Returns the closest UI element (including if the element itself matches) */
export function closest(elem, type=UI) {
    for (var ui of parents(elem, true)) {
        if (ui instanceof type) return ui;
    }
}

/** @template T @typedef {(T|(this:UI)=>T)} UISetting<T> */
/**
 * @typedef {{
 *   hidden: UISetting<boolean>,
 *   disabled: UISetting<boolean>,
 *   class: UISetting<string>,
 *   style: UISetting<string>,
 *   gap: UISetting<string>,
 *   title: UISetting<string>,
 *   display: UISetting<string>,
 *   align: UISetting<string>,
 *   justify: UISetting<string>,
 *   flex: UISetting<string>,
 *   id: UISetting<string>,
 *   children: UISetting<UI[]>,
 *   content: UISetting<string>,
 *   click: (this:UI, e:Event)=>void,
 *   render: (this:UI, e:Event)=>void,
 *   mousedown: (this:UI, e:Event)=>void,
 *   mouseup: (this:UI, e:Event)=>void,
 *   dblclick: (this:UI, e:Event)=>void,
 *   pre_update: (this:UI, e:Event)=>void,
 *   update: (this:UI, e:Event)=>void,
 *   post_update: (this:UI, e:Event)=>void
 * }} UISettings
 **/
/** @template {UISettings<UI>} Settings @template Events @extends {EventEmitter<Events>} */

export class UI extends EventEmitter {
    /** @type {Settings} */
    settings;
    get is_disabled() { return !!this.get_setting("disabled"); }
    set is_disabled(value) {
        if (this.settings.disabled == value) return;
        this.settings.disabled = value;
        this.update();
    }
    get disabled_parent() {
        var parent = this.parent;
        return (parent ? parent.is_disabled || parent.disabled_parent : false);
    }
    get is_hidden() { return !!this.get_setting("hidden"); }
    set is_hidden(value) {
        if (this.settings.hidden == value) return;
        this.settings.hidden = value;
        this.update();
    }
    get root() {
        for (var p of this.iterate_parents());
        return p;
    }
    get visible() { return is_visible(this.elem); } // not the opposite of hidden
    get descendents() { return [...this.iterate_descendents()]; }
    get parents() { return [...this.iterate_parents()]; }
    get parent() { return closest(this.elem.parentElement); }
    get children() { return [...this.iterate_children()]; }

    get id() { return this.__UID__; }
    get style() { return this.elem.style; }
    get index() { return get_index(this.elem); }

    /** @type {Set<UI>} */
    _children = new Set();
    /** @type {UI} */
    _parent;
    #updating = false;

    iterate_children() { return traverse(this.elem, false); }
    /** @return {Generator<UI>} */
    *iterate_descendents() {
        for (var c of this.children) {
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
        this.settings = { ...settings };

        if ("class" in this.settings) {
            var classes = this.get_setting("class");
            if (typeof classes === "string") classes = classes.split(/\s+/);
            this.elem.classList.add(...classes);
        }
        if ("style" in this.settings) {
            Object.assign(this.elem.style, this.get_setting("style"));
        }

        var is_connected = this.elem.isConnected;

        // this.__update_display();
        // this.render = debounce_next_frame(()=>this.__render());
        /* if (is_connected) {
            this.root.register(this);
        } */
        this.get_setting("init");

        if (is_connected) {
            // this.update(true);
            this.update();
        }
    }

    #update() {
        var resolve;
        this.#updating = new Promise((r) => resolve = r);
        this.__update();
        this.__render();
        this.#updating = null;
        resolve();
    }
    #update_next_frame = debounce_next_frame(() => this.#update());

    update(immediate = false) {
        if (this.#updating) return this.#updating;
        if (immediate) return this.#update();
        else return this.#update_next_frame();
    }

    init() { }

    __update() {
        this.get_setting("pre_update");
        this.emit("pre_update");

        this.get_setting("update");
        this.emit("update");

        for (var c of this.children) {
            c.__update();
        }

        this.get_setting("post_update");
        this.emit("post_update");
    }

    update_settings(settings) {
        Object.assign(this.settings, settings);
        return this.update();
    }
    __render() {
        var hidden = this.is_hidden;
        if (hidden !== undefined) toggle_class(this.elem, "d-none", hidden);
        toggle_attribute(this.elem, "disabled", this.is_disabled || this.disabled_parent);

        if ("gap" in this.settings) {
            var gap = this.get_setting("gap");
            if (typeof gap !== "string" || gap.match(/^[0-9.]+$/)) gap = `${parseFloat(gap)}px`;
            this.elem.style.setProperty("gap", gap);
        }
        if ("title" in this.settings) this.elem.title = this.get_setting("title");
        if ("display" in this.settings) this.elem.style.display = this.get_setting("display");
        if ("align" in this.settings) this.elem.style.alignItems = this.get_setting("align");
        if ("justify" in this.settings) this.elem.style.justifyContent = this.get_setting("justify");
        if ("flex" in this.settings) this.elem.style.flex = this.get_setting("flex");
        if ("id" in this.settings) this.elem.id = this.get_setting("id");
        if ("children" in this.settings) set_children(this.elem, this.get_setting("children"));
        if ("content" in this.settings) set_inner_html(this.elem, this.get_setting("content"));

        if ("click" in this.settings) this.elem.onclick = (e) => this.#do_event(e);
        if ("mousedown" in this.settings) this.elem.onmousedown = (e) => this.#do_event(e);
        if ("mouseup" in this.settings) this.elem.onmouseup = (e) => this.#do_event(e);
        if ("dblclick" in this.settings) this.elem.ondblclick = (e) => this.#do_event(e);

        this.get_setting("render");
        this.emit("render");

        for (var c of this.children) {
            c.__render();
        }
    }

    /** @param {Event} e */
    #do_event(e) {
        var res = this.get_setting(e.type, e);
        this.emit(e.type);
        return res;
    }

    /** @template {keyof Settings} T @param {T} key @param {...any} args */
    get_setting(key, ...args) {
        var setting = this.settings[key];
        if (typeof setting === "function") {
            setting = setting.apply(this, args);
        }
        return setting;
    }

    /* get_settings_group(key) {
        return Object.fromEntries(Object.entries(this.settings).filter(([k,v])=>k.startsWith(key+".")).map(([k,v])=>[k.slice(key.length+1),v]));
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
        if (this.elem) this.elem.remove();
        this.emit("destroy");
    }
    update_layout(layout) {
        var hash = JSON.stringify(layout, (k, p) => p instanceof UI ? p.id : p);
        if (hash !== this._layout_hash) {
            this._layout_hash = hash;
            this.elem.innerHTML = "";
            var process = (parent, layout) => {
                for (var o of layout) {
                    if (Array.isArray(o)) {
                        let r = new FlexRow({ "hidden": () => r.children.every(c => c.hidden) });
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

/** @return {Iterable<HTMLElement>} */
function *handle_els(o) {
    if (Array.isArray(o)) for (var c of o) for (var c2 of handle_els(c)) yield c2;
    else if (o instanceof UI) yield o.elem;
    else if (typeof o === "string") for (var c of $(o)) yield c;
    else if (o) yield o;
}

/** @typedef {UISettings & {'header':UISetting<string>, 'header_size':UISetting<number>}} BoxSettings */

/** @extends {UI<BoxSettings>} */
export class Box extends UI {
    /** @param {BoxSettings} settings */
    constructor(settings) {
        super(null, {
            header: undefined,
            header_size: 3,
            ...settings
        });
        if (this.settings.header) {
            this.append(new Header(this.settings.header));
        }
        this.elem.classList.add("box");
    }
}

export class Button extends UI {
    /** @param {HTMLElement} elem @param {UISettings} settings */
    constructor(elem, settings) {
        super(elem || `<button></button>`, {
            title: () => {
                if (!this.elem.children.length) return this.elem.innerHTML;
                if (original_title) return original_title;
            },
            ...settings
        });
        var original_title = this.elem.title;
        this.elem.classList.add("button");
    }
}

export class Column extends UI {
    /** @param {UISettings} settings */
    constructor(settings) {
        super(null, settings);
        this.elem.classList.add("column");
    }
}

export class Header extends UI {
    /** @param {UISettings} settings */
    constructor(settings) {
        super(null, settings);
        this.elem.classList.add("header");
    }
}

export class Label extends UI {
    /** @param {UISettings} settings */
    constructor(settings) {
        super("<label></label>", settings);
    }
}

export class Link extends UI {
    /** @param {HTMLElement} elem @param {UISettings} settings */
    constructor(elem, settings) {
        super(elem || `<a></a>`, settings);
        this.on("render", () => {
            if ("href" in this.settings) this.elem.href = this.get_setting("href");
            if ("target" in this.settings) this.elem.target = this.get_setting("target");
        });
    }
}

export class Row extends UI {
    /** @param {UISettings} settings */
    constructor(settings) {
        super(null, settings);
        this.elem.classList.add("row");
    }
}

export class Separator extends UI {
    /** @param {UISettings} settings */
    constructor(settings) {
        super("<hr>", settings);
    }
}

export class FlexColumn extends Column {
    /** @param {UISettings} settings */
    constructor(settings) {
        super(settings);
        this.elem.classList.add("flex");
    }
}

export class FlexRow extends Row {
    /** @param {HTMLElement} elem @param {UISettings} settings */
    constructor(settings) {
        super(settings);
        this.elem.classList.add("flex");
    }
}

export default UI;