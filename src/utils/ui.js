import * as utils from './utils.js';
import * as dom from "./dom.js";
import "./ui.scss";

export class UI extends utils.EventEmitter {
    get disabled() { return !!this.get_setting("disabled"); }
    set disabled(value) {
        if (this.settings.disabled == value) return;
        this.settings.disabled = value;
        this.update();
    }
    get disabled_parent() {
        var parent = this.parent;
        return (parent ? parent.disabled || parent.disabled_parent : false);
    }
    get hidden() { return !!this.get_setting("hidden") }
    set hidden(value) {
        if (this.settings.hidden == value) return;
        this.settings.hidden = value;
        this.update();
    }
    get root() { return this.get_closest(Root); }
    get visible() { return dom.is_visible(this.elem); } // not the opposite of hidden
    get children() { return [...this._children]; }
    get descendents() { return [...this.get_descendents()]; }
    get parents() { return [...this.get_parents()]; }
    get parent() { return this._parent; }
    get id() { return this.__UID__; }
    get style() { return this.elem.style; }
    get index() { return dom.get_index(this.elem); }

    /** @type {Set<UI>} */
    _children = new Set();
    /** @type {UI} */
    _parent;

    /** @return {Generator<UI>} */
    *get_descendents() {
        for (var c of this._children) {
            yield c;
            for (var gc of c.get_descendents()) yield gc;
        }
    }
    *get_parents() {
        var p = this._parent
        while(p) {
            yield p;
            p = p._parent;
        }
    }
    /** @template [T=UI] @param {new() => T} type @returns {T} */
    get_closest(type=UI) {
        return closest(this.elem, type);
    }

    // get_children() { return find(this.elem, UI, false); }
    // get_descendents() { return find(this.elem, UI, true); }
    // get_parents() { return parents(this.elem); }

    constructor(elem, settings) {
        super();
        this.__UID__ = ++ID;
        if (typeof elem === "string") elem = dom.$(elem)[0];
        if (elem instanceof Document) elem = elem.body;
        if (!(elem instanceof Element) && !settings) {
            settings = elem;
            elem = null;
        }
        if (!elem) elem = document.createElement('div');
        /** @type {HTMLElement} */
        this.elem = elem;
        this.elem[EXPANDO] = this;
        this.elem.classList.add(PRE);

        this.settings = Object.assign({}, settings);

        if ("class" in this.settings) {
            var classes = this.get_setting("class");
            if (typeof classes === "string") classes = classes.split(/\s+/);
            this.elem.classList.add(...classes)
        }
        if ("style" in this.settings) {
            Object.assign(this.elem.style, this.get_setting("style"));
        }

        // this.__update_display();
        // this.render = debounce_next_frame(()=>this.__render());
        
        /* var is_connected = this.elem.isConnected;

        if (is_connected) {
            this.root.register(this);
        } */
        
        this.init();
        this.get_setting("init");

        /* if (is_connected) {
            this.update(true);
        } */
    }
    
    #update() { 
        this.__update();
        this.__render();
    }
    #update_next_frame = dom.debounce_next_frame(()=>this.#update());

    update(immediate=false) {
        if (immediate) this.#update();
        else return this.#update_next_frame();
    }

    init(){}

    __update() {
        this.get_setting("pre_update");
        this.emit("pre_update");

        this.get_setting("update");
        this.emit("update");

        for (var c of this._children) {
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
        var hidden = this.hidden;
        if (hidden !== undefined) dom.toggle_class(this.elem, "d-none", hidden);
        dom.toggle_attribute(this.elem, "disabled", this.disabled || this.disabled_parent);

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
        if ("children" in this.settings) dom.set_children(this.elem, this.get_setting("children"));
        if ("content" in this.settings) dom.set_inner_html(this.elem, this.get_setting("content"));
        
        if ("click" in this.settings) this.elem.onclick = (e)=>this.#do_event(e);
        if ("mousedown" in this.settings) this.elem.onmousedown = (e)=>this.#do_event(e);
        if ("mouseup" in this.settings) this.elem.onmouseup = (e)=>this.#do_event(e);
        if ("dblclick" in this.settings) this.elem.ondblclick = (e)=>this.#do_event(e);

        this.get_setting("render");
        this.emit("render");
        
        for (var c of this._children) {
            c.__render();
        }
    }

    /** @param {Event} e */
    #do_event(e) {
        var res = this.get_setting(e.type, e);
        this.emit(e.type);
        return res;
    }

    get_setting(key, ...args) {
        var setting = this.settings[key];
        if (typeof setting === "function") {
            setting = setting.apply(this, args);
        }
        return setting;
    }

    get_settings_group(key) {
        return Object.fromEntries(Object.entries(this.settings).filter(([k,v])=>k.startsWith(key+".")).map(([k,v])=>[k.slice(key.length+1),v]));
    }
    empty() {
        dom.empty(this.elem);
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
        var hash = JSON.stringify(layout, (k,p)=>p instanceof UI ? p.id : p);
        if (hash !== this._layout_hash) {
            this._layout_hash = hash;
            this.elem.innerHTML = "";
            var process = (parent, layout)=>{
                for (var o of layout) {
                    if (Array.isArray(o)) {
                        var r = this.append(new FlexRow({"hidden":function(){ return this.children.every(c=>c.hidden); }}));
                        process(r, o);
                    } else if (typeof o === "string" && o.startsWith("-")) {
                        this.append(new Separator());
                    } else if (o) {
                        parent.append(o);
                    }
                }
            }
            process(this, layout);
        }
        this.update();
    }

    /* clone() {
        return new this.constructor(elem, settings);
    } */
}

var ID = 0;
export const PRE = "uis";
export const EXPANDO = `${PRE}-${Date.now()}`;
export const VALIDATORS = {
    not_empty: (v)=>!!v||"Field cannot be empty",
    rtmp: (v)=>utils.is_valid_rtmp_url(v)||"Invalid RTMP URL",
    url: (v)=>utils.is_valid_url(v)||"Invalid URL",
    json: (v)=>{
        try { JSON.parse(v); return true; } catch { return false; }
    },
};

/** @template [T=UI] @param {Element} elem @param {new() => T} type @param {function(UI):boolean|boolean} cb @param {boolean} include_self @returns {Generator<T>} */
export function *find(elem, type=UI, cb=false, include_self=false) {
    if (!type) type = UI;
    if (include_self && elem[EXPANDO] && elem[EXPANDO] instanceof type) yield elem[EXPANDO];
    if (!elem.children) return;
    for (var c of elem.children) {
        var found = c[EXPANDO] && c[EXPANDO] instanceof type;
        if (found) yield c[EXPANDO];
        var check = typeof cb === "function" ? cb(c[EXPANDO]) : !!cb;
        if (!found || check) {
            for (var sc of find(c, type, cb)) {
                yield sc;
            }
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
    else if (typeof o === "string") for (var c of dom.$(o)) yield c;
    else if (o) yield o;
}

export class Column extends UI {
    init() {
        super.init();
        this.elem.classList.add("column");
    }
}
export class FlexColumn extends UI {
    init() {
        super.init();
        this.elem.classList.add("flex", "column");
    }
}
export class Row extends UI {
    init() {
        super.init();
        this.elem.classList.add("row");
    }
}
export class FlexRow extends UI {
    init() {
        super.init();
        this.elem.classList.add("flex", "row");
    }
}
export class Box extends UI {
    constructor(header, settings = {}) {
        super(null, {
            header_size: 3,
            ...settings
        });
        if (header) {
            this.append(new Header(header));
        }
        this.elem.classList.add("box");
    }
}
export class Header extends UI {
    constructor(inner, settings = {}) {
        super(inner, settings);
        this.elem.classList.add("header");
    }
}
export class Separator extends UI {
    constructor(settings) {
        super("<hr>", settings);
    }
}
export class Label extends UI {
    constructor(content, settings) {
        super("<label></label>", {
            content,
            ...settings,
        });
    }
}

export class Link extends UI {
    constructor(content, settings) {
        var el = dom.$(`<a>`)[0];
        el.innerHTML = content;
        super(el, {...settings});
        this.on("update", ()=>{
            if ("href" in this.settings) this.elem.href = this.get_setting("href");
            if ("target" in this.settings) this.elem.target = this.get_setting("target");
        });
    }
}
export class Button extends UI {
    constructor(content, settings) {
        var el = dom.$(`<button>`)[0];
        el.innerHTML = content;
        super(el, { ...settings });
    }
    init() {
        super.init();
        this.elem.classList.add("button");
    }
}
export class Root extends UI {
    /** @type {Set<UI>} */
    // connected_uis = new Set();
    constructor(root) {
        if (!root) root = document.body;

        super(root);

        this.ui_interval = setInterval(()=>{
            this.update();
        }, 1000);

        this.ui_observer = new MutationObserver(mutations=>{
            for (var mutation of mutations) {
                for (var node of mutation.addedNodes) {
                    for (var ui of find(node, UI, true, true)) { // [...find(node, UI, true, true)]].reverse()
                        this.#register(ui);
                    }
                }
                for (var node of mutation.removedNodes) {
                    for (var ui of find(node, UI, true, true)) {
                        this.#unregister(ui);
                    }
                }
            }
        });

        /* var events = ["keydown","keyup","mousedown","mouseup","click"];
        var update = this.update.bind(this);
        for (var ev of events) {
            root.addEventListener(ev, update)
            this.on("destroy", ()=>root.removeEventListener(ev, update));
        } */

        this.ui_observer.observe(root, { childList:true, subtree:true }); //, attributes:true
    }
    /** @param {UI} ui */
    async #register(ui) {
        // var is_connected = ui.elem.isConnected;
        this.#unregister(ui);
        ui._parent = closest(ui.elem.parentElement);
        if (ui instanceof Property) {
            ui._container = closest(ui.elem, PropertyContainer);
            if (ui._container) ui._container._properties.add(ui);
        }
        if (ui._parent) ui._parent._children.add(ui);
        
        // this.update(true);
        // ui.emit("register");
        
        // this.update();
        ui.emit("register");
        ui.update(true);

        // ui.update(true);
    }

    /** @param {UI} ui */
    #unregister(ui) {
        if (ui._parent) {
            ui._parent._children.delete(ui);
            ui._parent = null;
        }
        if (ui instanceof Property && ui._container) {
            ui._container._properties.delete(ui);
            ui._container = null;
        }
        ui.emit("unregister");
    }

    destroy() {
        super.destroy();
        clearInterval(this.ui_interval);
        this.ui_observer.disconnect();
    }
}

export class PropertyContainer extends UI {
    _datas = [null];
    get datas() { return this._datas.map(data=>this.get_setting("data", data)); }
    /** @type {object[]} */
    set datas(datas) {
        if (!Array.isArray(datas)) datas = [datas];
        if (!datas.length) datas = [null];
        this._datas = [...datas];
        this.__update_values();
    }
    get data() { return this.datas[0]; }
    set data(value) {
        this.datas = [value];
        this.update();
    }
    get valid() { return this.properties.filter(p=>!p.hidden).every(p=>p.valid); }
    /** @type {object} */
    get property_lookup() { return Object.fromEntries(this.properties.map(p=>[p.id, p._value])); }
    /** @type {object} */
    get named_property_lookup() { return Object.fromEntries(this.properties.filter(p=>!p.is_indeterminate && p.name).map(p=>[p.name, p._value])); }
    /** @type {object} */
    get named_property_lookup_not_null() { return Object.fromEntries(Object.entries(this.named_property_lookup).filter(([k,v])=>v!==null)); }
    get properties() { return [...this.iterate_properties()]; }
    *iterate_properties() {
        if (!this._properties) return;
        for (var p of this._properties) {
            yield p;
        }
        //return find(this.elem, Property, (ui)=>!(ui instanceof PropertyContainer));
    }
    get_properties_by_name(name) { return this.properties.filter(p=>p.name===name); }
    get_property_by_name(name) { return this.get_properties_by_name(name)[0]; }
    
    /** @type {Set<Property>} */
    _properties = new Set();

    constructor(settings) {
        super(null, Object.assign({
            data: (a)=>a,
            nullify_defaults: false,
            disabled: false,
            // autoregister: true,
        }, settings));

        this.elem.classList.add("property-container");

        this.datas = [null]; // necessary so update(null, {...}) can work

        this.elem.addEventListener("keydown", (e)=>{
            if (e.key === "Enter" && e.target.matches("input,select")) {
                e.target.blur();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    reset() {
        for (var p of this.iterate_properties()) p.reset(true);
    }

    __update_values() {
        for (var p of this.iterate_properties()) {
            if ("data" in p.settings) {
                var values = this.datas.map(d=>p.get_setting("data", d));
                p.set_values(values);
            } else if (p.name) {
                var path = p.name.split("/");
                var values = this.datas.map(d=>{
                    return d ? utils.try(()=>utils.get(d, path)) : null;
                });
                var hash = JSON.stringify(values);
                if (p._last_values_on_property_update !== hash) {
                    p._last_values_on_property_update = hash;
                    p.set_values(values);
                }
            }
        }
    }

    __update() {
        this.__update_values();
        super.__update();
    }
}

/** @typedef {(HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement)&{_validation_tooltip:Tooltip}} Input */

export class Property extends UI {
    get input() { return this.inputs[0]; }
    get _value() { return this._values[0]; }
    set value(v) { return this.set_value(v); }
    get value() { return this.iterate_values().next().value; } // this.indeterminate ? UI.Indeterminate : 
    set values(v) { return this.set_values(v); }
    get values() { return Array.from(this.iterate_values()); }
    /** @type {boolean} */
    get is_indeterminate() { return !utils.all_equal(this.values); }
    /** @type {boolean} */
    get is_default() {
        if (this.nullify_defaults) return this._values.every((v)=>v==null);
        return this.datas.every((item,i)=>JSON.stringify(this.get_setting("default",item))===JSON.stringify(this.values[i])); // was this._values[i]
    }
    /** @type {boolean} */
    get nullify_defaults() { return this.get_setting("nullify_defaults"); }
    get data() { return this.datas[0]; }
    get datas() {
        if ("data" in this.settings) return [this.get_setting("data")];
        return this._container ? this._container._datas : [null];
    }
    /** @type {PropertyContainer} */
    get container() {
        return this._container;
    }
    get hidden() {
        return this.datas.some(item=>this.get_setting("hidden", item)); // (this.parent||{}).hidden || 
    }
    get disabled() {
        return this.datas.some(item=>this.get_setting("disabled", item)) || this.disabled_parent || !this.options_consistant;
    }
    get valid() {
        return this.inputs.every(i=>i._last_valid === true || i._last_valid === undefined);
    }
    /** @type {PropertyContainer} */
    _container;
    
    /** @param {string} name @param {string} label @param {string|Element[]} contents @param {object} settings */
    constructor(name, label, contents, settings) {
        var pre_settings = {};
        if (name) pre_settings.name = name;
        if (label) pre_settings.label = label;
        if (contents) pre_settings.contents = contents;
        
        settings = {
            ...pre_settings,
            "setup": ()=>{
                var inputs_selector = `.fake-input,input,select,textarea`;
                var inputs = [...this.inner_el.children].map(e=>{
                    if (e.matches(inputs_selector)) return [e];
                    return Array.from(e.querySelectorAll(inputs_selector));
                }).flat();
                this.setup_generic_input(inputs);
                return inputs;
            },
            // "event":(e)=>e.type === "change",
            "placeholder": "",
            "invalid_class": "invalid",
            "default": null,
            "disabled": false,
            "reset": true,
            "hidden": false,
            "copy":false,
            "reset_on_dblclick": false,
            "nullify_defaults": ()=>{
                var container = this.container;
                return container ? container.get_setting("nullify_defaults") : false;
            },
            ...settings
        };
        /*
            "readonly": undefined,
            "spinner": undefined,
            "min": undefined,
            "max": undefined,
            "step": undefined,
            "round": undefined,
            "precision": undefined,
            "options": undefined,
        */

        super(null, settings);

        this.elem.classList.add("property");
        
        this._values = [null];
        /** @type {Input[]} */
        this.inputs = [];
        /** @type {Function(any):string[]} */
        this.modifiers = [];
        /** @type {Function(any):string[]} */
        this.input_modifiers = [];
        /** @type {Function(any):any[]} */
        this.output_modifiers = [];
        /** @type {Function(any,Input):any[]} */
        this.validators = [];
        this.options_consistant = true;
        // this.values_valid = true;
        this.name = this.get_setting("name");
        this.name_id = `${this.name}-${this.id}`;
        
        if ("label" in this.settings) {
            this.header_el = dom.$(`<div class="property-header"></div>`)[0];
            this.label = new UI(`<label>&nbsp;</label>`);
            dom.set_attribute(this.label.elem, "for", this.name_id);
            this.header_el.append(this.label);
            this.append(this.header_el);
        }
        
        if ("info" in this.settings) {
            this.info_elem = dom.$(`<span><i class="fas fa-question-circle info"></i></span>`)[0];
            this.header_el.append(this.info_elem);
            this.tooltip = new Tooltip(this.info_elem);
        }

        this.outer_el = dom.$(`<div class="property-outer"></div>`)[0];
        this.append(this.outer_el);
        
        /** @type {HTMLElement} */
        this.inner_el = dom.$(`<div class="property-inner"></div>`)[0];
        this.outer_el.append(this.inner_el);

        if ("icon" in this.settings) {
            let icon_el = this.get_setting("icon");
            icon_el = (typeof icon_el === "string") ? dom.$(icon_el) : icon_el;
            let wrapper_el = $(`<label class="property-input-icon"></label>`)[0];
            wrapper_el.setAttribute("for", this.name_id);
            wrapper_el.append(icon_el);
            this.inner_el.append(wrapper_el)
        }
        
        this.input_wrapper_el = dom.$(`<div class="property-input-wrapper"></div>`)[0];
        this.inner_el.append(this.input_wrapper_el);
        
        contents = this.get_setting("contents");
        contents = (typeof contents === "string") ? dom.$(contents) : contents;
        if (!Array.isArray(contents)) contents = [contents];
        for (let c of contents) {
            if (c) this.input_wrapper_el.append(c);
        }

        var suffix = this.get_setting("suffix");
        if (suffix) {
            var suffix_el = dom.$(`<div class="property-input-suffix"><div>`)[0];
            suffix_el.innerHTML = suffix;
            this.inner_el.append(suffix_el);
        }

        var inputs = this.get_setting("setup") || [];
        if (!Array.isArray(inputs)) inputs = [inputs];
        
        this.inputs = inputs;

        if (this.input) {
            if (this.settings["placeholder"] === undefined) this.settings["placeholder"] = this.input.placeholder;
            if (this.settings["readonly"] ===undefined) this.settings["readonly"] = this.input.readOnly;
            if (this.settings["default"] === undefined) this.settings["default"] = this.input.value;
            if (this.settings["min"] === undefined && this.input.min) this.settings["min"] = +this.input.min;
            if (this.settings["max"] === undefined && this.input.max) this.settings["max"] = +this.input.max;
            if (this.settings["step"] === undefined && this.input.step) this.settings["step"] = +this.input.step;
        }
        var multiple = this.get_setting("multiple");
        this.is_numeric = ((!multiple && this.input && this.input.type === "number") || this.settings["step"] !== undefined || this.settings["precision"] !== undefined || this.settings["round"] !== undefined || this.settings["min"] !== undefined || this.settings["max"] !== undefined || this.settings["spinner"] !== undefined);
        if (this.is_numeric) {
            this.settings["step"] = this.settings["step"] || 1;
            
            if (this.settings["spinner"] !== false && this.input.type !== "range") {
                this.spinner_ui = new UI();
                this.spinner_ui.elem.classList.add("spinner");
                this.up_button = new Button(`<i class="fas fa-caret-up"></i>`, {
                    "click":(e)=>this.set_values(this.value + this.get_setting("step"), {trigger:"change"}),
                    "disabled":()=>this.value>=this.get_setting("max"),
                });
                this.down_button = new Button(`<i class="fas fa-caret-down"></i>`, {
                    "click":(e)=>this.set_values(this.value - this.get_setting("step"), {trigger:"change"}),
                    "disabled":()=>this.value<=this.get_setting("min"),
                });
                this.spinner_ui.append(this.up_button, this.down_button);
                this.outer_el.append(this.spinner_ui);
            }
        }

        if (this.get_setting("copy")) {
            var copy_hide_timeout;
            var copy_tippy;
            this.copy_button = new Button(`<i class="fas fa-copy"></i>`, {
                "click":(e)=>{
                    e.preventDefault();
                    this.input.select();
                    window.navigator.clipboard.writeText(this.input.value);
                    if (!copy_tippy) {
                        copy_tippy = dom.tippy(this.input, {
                            content:"Copied!",
                            trigger:"manual",
                            zIndex: 999999,
                            onShow:(instance)=>{
                                clearTimeout(copy_hide_timeout);
                                copy_hide_timeout = setTimeout(()=>instance.hide(),1500);
                            }
                        });
                    }
                    copy_tippy.show();
                },
                "title": "Copy",
            });
            this.outer_el.append(this.copy_button);

            for (let input of this.inputs) {
                input.addEventListener("mousedown", (e)=>{
                    input.select();
                    if (e.button == 0) e.preventDefault();
                });
            }
        }
        
        if (this.get_setting("reset")) {
            this.reset_button = new Button(`<i class="fas fa-undo"></i>`, {
            "click":()=>this.reset(true),
            "title": "Reset",
            // "hidden": ()=>!this.get_setting("reset"),
        });
        this.outer_el.append(this.reset_button);
        
        if (this.get_setting("vertical")) {
            this.outer_el.classList.add("vertical")
        }
    }
        
        /* requestAnimationFrame(()=>{
            this.update_inputs(true);
        }); */
    }

    /** @param {HTMLElement[]} inputs */
    setup_generic_input(inputs) {
        inputs.forEach((input, i)=>{
            if (input.matches(".fake-input")) {
                input.tabIndex = "-1"
            }
            dom.set_attribute(input, "id", this.name_id);
            // set_attribute(input, "name", this.name);
            ["change", "input"].forEach(ev_type=>{
                input.addEventListener(ev_type, (e)=>{
                    if (ev_type == "input") this.emit("input", e);
                    var value = (this.get_setting("multiple")) ? inputs.map(input=>dom.get_value(input)) : dom.get_value(input);
                    value = this.apply_input_modifiers(value);
                    this.set_value(value, {trigger:(e.type=="change")?"change":false});
                });
            });
            /* input.addEventListener("blur", (e)=>{
                this.root.update();
            });
            input.addEventListener("focus", (e)=>{
                this.root.update();
            }); */
            input.addEventListener("blur", (e)=>{
                this.update();
            });
            input.addEventListener("focus", (e)=>{
                this.update();
            });
            if (input.nodeName === "INPUT" || input.isContentEditable) {
                input.addEventListener("keydown", (e)=>{
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.target.blur();
                    }
                    if (input.type !== "number" && this.is_numeric) {
                        var new_value;
                        if (e.key == "ArrowUp") new_value = this.value + this.get_setting("step");
                        else if (e.key == "ArrowDown") new_value = this.value - this.get_setting("step");
                        console.log(new_value);
                        if (new_value !== undefined) {
                            e.stopPropagation();
                            e.preventDefault();
                            this._force_update_inputs = true;
                            this.set_values(new_value, {trigger:"change"});
                        }
                    }
                });
            }
            input.addEventListener("dblclick", (e)=>{
                if (this.get_setting("reset_on_dblclick")) {
                    this.set_values(null, {trigger:"change"});
                }
            });
            
            /* Object.defineProperty(input, 'value', {
                get () { return this.get_value(); },
                set (value) { this.set_value(value, false); }
            }); */
        });
    }

    reset(trigger=false) {
        this.set_values(null, {trigger:trigger?"change":false});
    }

    /** @typedef {{trigger:boolean|"change"}} SetValueOptions */
    /** @param {SetValueOptions} options */
    set_value(value, options) {
        return this.set_values(this.datas.map(_=>value), options);
    }

    /** @param {SetValueOptions} options */
    set_values(values, options) {
        options = {
            trigger: false,
            ...options
        };
        // console.trace(this.name, values, trigger);
        // if (!Array.isArray(values)) throw new Error("Values must be array...");

        var datas = this.datas;
        if (!Array.isArray(values)) values = datas.map(item=>values);
        if (values.length != datas.length) {
            throw new Error(`Values length (${values.length}) mismatch datas length (${datas.length})...`);
        }

        var fix_value = (value)=>{
            if (typeof(value) == "number") {
                var min = this.get_setting("min");
                var max = this.get_setting("max");
                var round = this.get_setting("round");
                var precision = this.get_setting("precision");
                if (max !== undefined) value = Math.min(value, +max);
                if (min !== undefined) value = Math.max(value, +min);
                if (round !== undefined) value = utils.round_to_factor(value, round);
                if (precision !== undefined) value = +value.toFixed(precision)
            }
            for (var m of this.modifiers) {
                value = m.apply(this, [value]);
            }
            return value;
        };

        values = values.map((v)=>fix_value(v));
        
        this._values = utils.deep_copy(datas.map((data,i)=>{
            var default_value = fix_value(this.get_setting("default", data));
            if (this.nullify_defaults) return JSON.stringify(values[i]) === JSON.stringify(default_value) ? null : values[i];
            return (values[i] == null) ? default_value : values[i];
        }));

        // --------------- DO NOT TOUCH ---------------
        // -------- THIS IS A DELICATE MACHINE --------

        var values_hash = JSON.stringify([this.values, this._values, options.trigger]);
        var changed = values_hash !== this._last_changed_values_hash;
        if (changed) this._last_changed_values_hash = values_hash;
        var trigger = (options.trigger === "change") ? changed : !!options.trigger

        // --------------------------------------------

        this.update();

        var e = {
            "property": this,
            "datas": [...this.datas],
            "name": this.name,
            "_value": this._value,
            "_values": this._values,
            "value": this.value,
            "values": this.values,
            "trigger": trigger,
        };
        var container = this.container;
        if (changed || trigger) {
            this.emit("change", e);
            if (container) {
                container.emit("property-change", e);
                container.update();
            }
        }
        return changed;
    }

    __render() {
        super.__render();

        var is_default = this.is_default;
        var is_indeterminate = this.is_indeterminate;
        var default_value = this.get_setting("default", this.data);
        var readonly = this.get_setting("readonly");
        var disabled = this.disabled;
        var style_not_default = !!this.get_setting("reset");
        var is_multiple = !!this.get_setting("multiple");

        this.options_consistant = true;
        if (this.settings["options"] !== undefined) {
            var options = [];
            var items_options = this.datas.map((item)=>this.get_setting("options",item)||[]);
            this.options_consistant = (()=>{
                if (this.datas.length <= 1) return true;
                var last;
                for (var o of items_options) {
                    var curr = JSON.stringify(o)
                    if (last && curr != last) return false;
                    last = curr;
                }
                return true;
            })();
            if (!this.options_consistant) is_indeterminate = true;
            if (!this.options_consistant || is_indeterminate) options = [{value:"", text:"Multiple values", style:{"display":"none"}}];
            if (this.options_consistant) {
                options.push(...utils.deep_copy(items_options[0]));
            }

            options = dom.fix_options(options);
            if (style_not_default) {
                options.forEach((o)=>{
                    if (String(o.value) === String(default_value)) o.text += " *";
                });
            }
            this.inputs.filter(e=>e.nodeName==="SELECT").forEach(e=>dom.set_select_options(e, options));
        }

        var value = this.apply_output_modifiers(this.value);
        
        if (typeof value === "number" && this.settings["precision"] !== undefined) {
            value = value.toFixed(this.get_setting("precision"));
            if (value.includes(".")) value = value.replace(/\.?0+$/,"");
        }

        /** @param {Input} input */
        var update_value = (input, value)=>{
            if (is_indeterminate) {
                if (input.type == "color") value = "#000000";
                else value = "";
            }
            if (input.matches(".fake-input")) {
                dom.set_inner_html(input, value);
            } else {
                dom.set_value(input, value, {trigger:false});
            }
        };

        // var is_focused = dom.has_focus(this.inner_el, true, true);
        var is_focused = this.inputs.some(input=>dom.has_focus(input, false, true));
        // if (this.spinner_ui) {
        //     is_focused |= dom.has_focus(this.spinner_ui.elem, true, true);
        // }
        var is_text_field = this.inputs.some(input=>!input.readOnly && (input.isContentEditable || input.type === "text" || input.type === "number" || input.type === "password" || input.nodeName === "TEXTAREA"));
        
        if (this.name_id === "props/label-414") {
            console.log(value);
        }
        if (this.inputs.length) {
            if (!is_text_field || !is_focused || this._force_update_inputs) {
                if (is_multiple) {
                    this.inputs.forEach((input,i)=>update_value(input, value[i]));
                } else {
                    update_value(this.input, value);
                }
            }
        }

        this._force_update_inputs = false;

        for (var input of this.inputs) {
            // input.disabled = disabled;
            dom.toggle_attribute(input, "disabled", disabled===true);
            if (readonly !== undefined) {
                input.readOnly = readonly;
                // set_attribute(input, "readonly", readonly);
            }
            if ("step" in this.settings) input.step = this.get_setting("step");
            if ("min" in this.settings) input.min = this.get_setting("min");
            if ("max" in this.settings) input.max = this.get_setting("max");

            var is_checkbox = input.nodeName === "INPUT" && input.type === "checkbox";
            
            dom.toggle_class(input, "not-default", !is_default && style_not_default); // !is_focused && 
            
            if (is_checkbox) {
                input.indeterminate = is_indeterminate;
            }
            
            var placeholder = is_indeterminate ? "Multiple values" : this.get_setting("placeholder");
            if (input.placeholder !== placeholder) input.placeholder = placeholder;

            var title = is_indeterminate ? "Multiple values" : this.get_setting("title") || "";
            if (title) dom.set_attribute(input, "title", title);
            else dom.remove_attribute(input, "title");
            
            var valid = disabled || is_indeterminate || (()=>{
                for (var validator of this.validators) {
                    valid = validator.apply(this, [this.value, input]);
                    if (valid !== true) return valid;
                }
                return true;
            })();
            
            var invalid_class = this.get_setting("invalid_class");
            if (invalid_class) dom.toggle_class(input, invalid_class, valid !== true);

            if (valid === false) valid = "Invalid input";
            if (input._last_valid !== valid) {
                if (typeof valid === "string") {
                    if (!input._validation_tooltip) input._validation_tooltip = new Tooltip(input);
                    input._validation_tooltip.set_content(valid);
                } else {
                    if (input._validation_tooltip) {
                        input._validation_tooltip.destroy();
                        input._validation_tooltip = null;
                    }
                }
                input._last_valid = valid;
            }
        }

        if (this.label) {
            dom.set_inner_html(this.label.elem, this.get_setting("label", this.data));
        }
        if (this.tooltip) {
            let info = this.get_setting("info");
            if (typeof info === "string") info = info.replace(/\n/g, "<br>");
            this.tooltip.set_content(info);
        }
    }

    apply_input_modifiers(v) {
        for (var m of this.input_modifiers) {
            v = m.apply(this, [v]);
        }
        return v;
    }

    apply_output_modifiers(v) {
        for (var m of this.output_modifiers) {
            v = m.apply(this, [v]);
        }
        return v;
    }
    
    *iterate_values() {
        var datas = this.datas;
        for (var i = 0; i < this._values.length; i++) {
            yield (this._values[i] == null) ? this.get_setting("default",datas[i]) : this._values[i];
        }
    }

    /* destroy() {
        if (this.container) this.container.unregister_properties(this);
        super.destroy();
    } */
}

/** @typedef {UI & {props:PropertyContainer}} PropertyListItem */

export class PropertyList extends Property {
    constructor(name, label, settings = {}) {
        var wrapper = new UI(`<div class="property-list-wrapper fake-input"></div>`);
        super(name, label, wrapper.elem, {
            setup: false,
            item_size: 0,
            allow_empty: true,
            vertical: false,
            ...settings
        });
        var horizontal = !this.get_setting("vertical");
        wrapper.elem.classList.add(horizontal?"horizontal":"vertical");
        var list = new UI({class:`property-list`});
        var add_button = new Button(`<i class="fas fa-plus"></i>`, {
            title: "Add Item",
            "click":()=>{
                this.set_value([...this.value, {}], {trigger:true});
                this.once("render", ()=>{
                    list.elem.scrollLeft = 999999999;
                })
            }
        });
        var count_el = $(`<span class="property-list-count"></span>`)[0];
        this.header_el.append(count_el);
        var empty_el = dom.$(`<div class="empty">No Items</div>`)[0];
        wrapper.elem.append(empty_el);

        var item_size = this.get_setting("item_size");
        if (!Number.isNaN(item_size)) item_size = String(item_size)+"px";
        wrapper.elem.style.setProperty("--item-size", item_size);
        wrapper.append(list);
        this.outer_el.children[0].insertAdjacentElement("afterend", add_button.elem);

        var get_value = ()=>this.value ? [...this.value] : [];

        this.on("update", ()=>{
            var type = this.get_setting("type");
            /** @type {PropertyListItem[]} */
            var items = [...list._children];
            for (var i = 0; i < this.value.length; i++) {
                if (!items[i]) {
                    let ui = new UI({class:"buttons"});
                    var up_button = new Button(`<i class="fas fa-arrow-${horizontal?"left":"up"}"></i>`, {
                        "click":()=>{
                            this.set_value(utils.array_move_element(get_value(), item.index, item.index-1), {trigger:true})
                        },
                        "hidden":()=>this.value.length < 2,
                        "disabled":()=>item.index == 0,
                        "title": `Move ${horizontal?"Left":"Up"}`,
                    });
                    var down_button = new Button(`<i class="fas fa-arrow-${horizontal?"right":"down"}"></i>`, {
                        "click":()=>{
                            this.set_value(utils.array_move_element(get_value(), item.index, item.index+1), {trigger:true});
                        },
                        "hidden":()=>this.value.length < 2,
                        "disabled":()=>item.index == this.value.length-1,
                        "title": `Move ${horizontal?"Right":"Down"}`,
                    });
                    var delete_button = new Button(`<i class="fas fa-trash"></i>`, {
                        "click":()=>{
                            var val = get_value();
                            val.splice(item.index, 1);
                            this.set_value(val, {trigger:true});
                        },
                        "disabled":()=>(!this.get_setting("allow_empty") && this.value.length <= 1),
                        "title": "Delete",
                    });
                    ui.append(up_button, down_button, delete_button);
                    let item = new UI({class:"property-list-item"});
                    
                    /** @type {PropertyContainer} */
                    let props = new type();
                    item.props = props;
                    props.settings.data = ()=>this.value[item.index];
                    props.on("property-change", (e)=>{
                        if (e.trigger) {
                            this.set_value(items.map(item=>item.props.named_property_lookup), {trigger:true});
                        }
                    })

                    item.append(props, ui);
                    items[i] = item;
                    list.append(items[i]);
                }
                items[i].update();
            }
            for (; i < items.length; i++) {
                items[i].destroy();
            }
            empty_el.style.display=items.length?"none":"";
            list.elem.style.display=items.length?"":"none";
            dom.set_inner_html(count_el, `(${items.length})`);
        });
    }
}


export class DateTimeProperty extends Property {
    get today_str() { return new Date().toISOString().split("T")[0]; }

    constructor(name, label, settings = {}) {
        var inputs = dom.$(`<input type="date"><input type="time">`);

        super(name, label, inputs, Object.assign({
            "datetime.apply_timezone": true,
            "default": null,
            "multiple": true,
        }, settings));

        this.modifiers.push(value=>{
            return new Date(value ? value : NaN);
        })
        this.input_modifiers.push((values)=>{
            if (values.every(v=>v==="")) return NaN;
            if (!values[0]) values[0] = this.today_str
            if (!values[1]) values[1] = "00:00";
            return utils.join_datetime(values, this.get_setting("datetime.apply_timezone"));
        });

        this.output_modifiers.push((value)=>{
            var parts = ["",""];
            if (value) {
                parts = utils.split_datetime(value, this.get_setting("datetime.apply_timezone"));
            }
            return [parts[0], parts[1].slice(0,5)];
        });
        
        this.validators.push((_,input)=>{
            if (!this.get_setting("datetime.after_now")) return true;
            if (!inputs.some(input=>input.value)) return true;
            // inputs[0].min = utils.split_datetime(new Date())[0];
            var before_now = this.value < Math.floor(Date.now()/1000)*1000;
            var before_today = new Date(inputs[0].value) < new Date(this.today_str);
            if (before_today && input.type == "date") return "Scheduled date is in the past.";
            else if (!before_today && before_now && input.type == "time") return "Scheduled time is in the past.";
            return true;
        });
    }
}
export class TimeSpanProperty extends Property {
    constructor(name, label, settings = {}) {
        var input = dom.$(`<input type="text">`)[0];
        super(name, label, input, Object.assign({
            "timespan.format": "hh:mm:ss",
            "timespan.zero_infinity": false,
            "step": 1.0,
            "default": 0,
        }, settings));
        this.input_modifiers.push((v)=>{
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v.toLowerCase() === "infinity") return 0;
            v = utils.timespan_str_to_seconds(v, this.get_setting("timespan.format"));
            return v
        });
        this.output_modifiers.push((v)=>{
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v == 0) return "Infinity";
            return utils.ms_to_timespan_str(v * 1000, this.get_setting("timespan.format"))
        });
    }
}

export class TextAreaProperty extends Property {
    constructor(name, label, settings = {}) {
        var input_el = dom.$(`<textarea style="resize:none"></textarea>`)[0];
        super(name, label, input_el, Object.assign({
            "default": "",
            "textarea.rows": 4,
            "textarea.grow": false,
            "textarea.return_blur": false,
            "textarea.break_all": false,
        }, settings));
        /** @type {dom.AutoSizeController} */
        var asc;
        var rows = this.get_setting("textarea.rows");
        var grow = this.get_setting("textarea.grow");
        var break_all = this.get_setting("textarea.break_all");
        if (break_all) {
            this.input.style["word-break"] = "break-all";
        }
        if (grow) {
            asc = new dom.AutoSizeController(input_el, rows, false);
        } else if (rows) {
            this.input.rows = rows;
        }
        var max_length = this.get_setting("textarea.max_length");
        if (max_length) input_el.maxLength = max_length;
        if (this.get_setting("textarea.show_count")) {
            ["input", "propertychange", "paste"].forEach(ev=>input_el.addEventListener(ev, ()=>this.update_char_count()));
            this.char_count = dom.$(`<div></div>`)[0];
            this.header_el.append(this.char_count);
            this.update_char_count();
        }
        input_el.addEventListener("keydown", (e)=>{
            if (e.key == "Enter") {
                if (this.get_setting("textarea.return_blur")) {
                    e.preventDefault();
                    input_el.blur();
                }
            }
        })
        this.on("update", ()=>{
            if (asc) asc.update();
        });
    }
    update_char_count() {
        this.char_count.innerHTML = `(${this.input.value.length}/${this.get_setting("textarea.max_length")||"-"})`
    }
}

export class Tooltip {
    #content;
    /** @type {import('tippy.js').Instance} */
    #tippy;
    constructor(elem, content){
        this.#tippy = dom.tippy(elem, {
            allowHTML: true,
            zIndex: 99999,
            appendTo: "parent",
            // trigger: "click"
        });
        this.elem = elem;
        if (content) this.set_content(content);
        elem.__tooltip = this;
    }
    set_content(content) {
        if (this.#content === content) return;
        this.#content = content;
        this.#tippy.setContent(content);
    }
    destroy() {
        if (!this.#tippy) return;
        this.#tippy.destroy();
        this.#tippy = null;
        this.elem.__tooltip = null;
    }
};