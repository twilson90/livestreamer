import * as utils from './utils.js';
import * as dom from "./dom.js";
import "./ui.scss";

export const editable_input_types = {
    "text":1,
    "number":1,
    "password":1,
    "email":1,
    "search":1,
    "tel":1,
    "url":1,
}

/** @template T @extends {utils.EventEmitter<T>} */
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
    get root() { 
        for (var p of this.iterate_parents());
        return p;
    }
    get visible() { return dom.is_visible(this.elem); } // not the opposite of hidden
    get descendents() { return [...this.iterate_descendents()]; }
    get parents() { return [...this.iterate_parents()]; }
    get parent() { return closest(this.elem.parentElement); }
    get children() { return [...this.iterate_children()]; }

    get id() { return this.__UID__; }
    get style() { return this.elem.style; }
    get index() { return dom.get_index(this.elem); }

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

        this.settings = {...settings};

        if ("class" in this.settings) {
            var classes = this.get_setting("class");
            if (typeof classes === "string") classes = classes.split(/\s+/);
            this.elem.classList.add(...classes)
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
        
        this.init();
        this.get_setting("init");

        if (is_connected) {
            // this.update(true);
            this.update();
        }
    }
    
    #update() {
        var resolve;
        this.#updating = new Promise((r)=>resolve=r);
        this.__update();
        this.__render();
        this.#updating = null;
        resolve();
    }
    #update_next_frame = dom.debounce_next_frame(()=>this.#update());

    update(immediate=false) {
        if (this.#updating) return this.#updating;
        if (immediate) return this.#update();
        else return this.#update_next_frame();
    }

    init(){}

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
                        var r = new FlexRow({"hidden":function(){ return this.children.every(c=>c.hidden); }});
                        process(r, o);
                        this.append(r);
                    } else if (typeof o === "string" && o.startsWith("-")) {
                        this.append(new Separator());
                    } else if (o) {
                        parent.append(o);
                    }
                }
            }
            process(this, layout);
            this.update();
        }
    }

    emit(event, e, opts) {
        opts = {
            bubbles: false,
            ...opts,
        }
        var res = super.emit(event, e);
        if (res === false) return;
        if (opts.bubbles) {
            if (this.parent) {
                this.parent.emit(event, e, opts);
            }
        }
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
    constructor(settings) {
        super(settings);
        this.elem.classList.add("column");
    }
}

/** @this {UI} */
var flex_basis = function(t) {
    // var num = this.get_setting(`items_per_${t}`) || 0;
    // this.elem.style.setProperty("--ui-num-items-per", num);
    // if (num) this.elem.style.setProperty("--ui-flex-basis", `calc( ( ( 100% - ( var( --ui-num-items-per ) - 1 ) * var( --ui-gap ) ) ) / var( --ui-num-items-per ) )`)
    // else this.elem.style.removeProperty("--ui-flex-basis");
}
export class FlexColumn extends Column {
    constructor(settings) {
        // if (typeof settings === "number") settings = {"items_per_column":settings};
        super(settings);
        this.elem.classList.add("flex");
    }
    __render() {
        super.__render();
        flex_basis.apply(this, ["column"]);
    }
}
export class Row extends UI {
    constructor(settings) {
        super(settings);
        this.elem.classList.add("row");
    }
}
export class FlexRow extends Row {
    constructor(settings) {
        // if (typeof settings === "number") settings = {"items_per_row":settings};
        super(settings);
        this.elem.classList.add("flex");
    }
    __render() {
        super.__render();
        flex_basis.apply(this, ["row"]);
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
    constructor(elem, settings) {
        super(elem || `<a></a>`, {...settings});
        this.on("render", ()=>{
            if ("href" in this.settings) this.elem.href = this.get_setting("href");
            if ("target" in this.settings) this.elem.target = this.get_setting("target");
        });
    }
}
export class Button extends UI {
    constructor(elem, settings) {
        super(elem || `<button></button>`, {
            title: ()=>{
                if (!this.elem.children.length) return this.elem.innerHTML;
            },
            ...settings
        });
        this.elem.classList.add("button");
    }
}

/** @template T @extends {UI<{change:PropertyChangeEvent}>} */
export class PropertyContainer extends UI {
    /** @type {T[]} */
    _items = [null];
    get item() { return this._items[0]; }
    get items() {
        if ("items" in this.settings) return this.get_setting("items");
        return this._items;
    }
    set items(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) items = [null];
        this._items = [...items];
        this.update();
    }

    get valid() { return this.properties.filter(p=>!p.hidden).every(p=>p.valid); }
    /** @type {object} */
    get id_property_lookup() { return Object.fromEntries(this.properties.map(p=>[p.id, p._value])); }
    /** @type {object} */
    get named_property_lookup() { return Object.fromEntries(this.properties.filter(p=>!p.is_indeterminate && p.name).map(p=>[p.name, p._value])); }
    /** @type {object} */
    get named_property_lookup_not_null() { return Object.fromEntries(Object.entries(this.named_property_lookup).filter(([k,v])=>v!=null)); }
    get properties() { return [...this.iterate_properties()]; }
    *iterate_properties() {
        for (var ui of traverse(this.elem, (ui)=>!(ui instanceof Property))) {
            if (ui instanceof Property) yield ui;
        }
    }
    get is_default() {
        return this.properties.every(p=>p.is_default);
    }
    get_properties_by_name(name) { return this.properties.filter(p=>p.name===name); }
    get_property_by_name(name) { return this.get_properties_by_name(name)[0]; }

    constructor(settings) {
        super(null, Object.assign({
            data: (d,p)=>utils.ref.get(d,p),
            nullify_defaults: false,
            disabled: false,
        }, settings));

        this.elem.classList.add("property-container");

        this.elem.addEventListener("keydown", (e)=>{
            if (e.key === "Enter" && e.target.matches("input,select")) {
                e.target.blur();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        this.elem.addEventListener("focusin", (e)=>{
            this.update();
        });
        this.elem.addEventListener("focusout", (e)=>{
            this.update();
        });
        this.on("change", (e)=>{
            if (e.container !== this) return false;
        });
    }

    reset() {
        for (var p of this.iterate_properties()) {
            p.reset();
        }
    }
}

/** @typedef {(HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement)&{_validation_tooltip:Tooltip}} Input */

export class PropertyChangeEvent {
    /** @param {Property} prop */
    constructor(prop, trigger=false) {
        this.property = prop;
        this.datas = [...prop.items];
        this.name = prop.name;
        this._value = prop._value;
        this._values = prop._values;
        this.value = prop.value;
        this.values = prop.values;
        this.container = prop.container;
        this.trigger = trigger;
    }
}

/** @extends {UI<{change:PropertyChangeEvent}>} */
export class Property extends UI {
    get input() { return this.inputs[0]; }
    get _value() { return this._values[0]; }
    set value(v) { return this.set_value(v); }
    get value() { return this.iterate_values().next().value; }
    set values(v) { return this.set_values(v); }
    get values() { return [...this.iterate_values()]; }
    *iterate_values() {
        for (var i = 0; i < this._values.length; i++) {
            var value = (this._values[i] == null) ? this.get_setting("default", this.items[i], i) : this._values[i];
            yield utils.json_copy(value);
        }
    }
    get item() {
        return this.items[0];
    }

    /** @type {boolean} */
    get is_indeterminate() { return !utils.all_equal(this.values); }
    /** @type {boolean} */
    get is_default() {
        if (this.nullify_defaults) return this._values.every((v)=>v==null);
        return this.items.every((d,i)=>JSON.stringify(this.get_setting("default", d, i))===JSON.stringify(this.values[i]));
    }
    /** @type {boolean} */
    get nullify_defaults() {
        var res = this.get_setting("nullify_defaults");
        if (res == undefined) {
            var container = this.container;
            res = container ? container.get_setting("nullify_defaults") : false;
        }
        return res;
    }
    /** @type {PropertyContainer} */
    get container() {
        for (var ui of this.iterate_parents()) {
            if (ui instanceof Property) return;
            if (ui instanceof PropertyContainer) return ui;
        }
    }
    get hidden() {
        return this.items.some(item=>this.get_setting("hidden", item)); // (this.parent||{}).hidden || 
    }
    get disabled() {
        return this.items.some(item=>this.get_setting("disabled", item)) || this.disabled_parent || !this.options_consistant;
    }
    get valid() {
        return this.inputs.every(i=>i._last_valid === true || i._last_valid === undefined);
    }
    
    items = [null];
    _values = [null];
    /** @type {Input[]} */
    inputs = [];
    /** @type {Function(any):string[]} */
    raw_modifiers = [];
    /** @type {Function(any):string[]} */
    input_modifiers = [];
    /** @type {Function(any):any[]} */
    output_modifiers = [];
    /** @type {Function(any,Input):any[]} */
    validators = [];
    get options() {
        return this.items.map((item)=>this.get_setting("options",item)||[]);
    }
    get options_consistant() {
        if (!this.items.length <= 1) return true;
        var last;
        for (var o of this.options) {
            var curr = JSON.stringify(o)
            if (last && curr != last) return false;
            last = curr;
        }
        return true;
    };
    
    /** contents @param {object} settings */
    constructor(contents, settings) {
        var pre_settings = {};
        if (contents != null) pre_settings.contents = contents;
        
        settings = {
            ...pre_settings,
            "setup": ()=>{
                var inputs_selector = `.fake-input,input,select,textarea`;
                var inputs = [...this.inner_el.children].map(e=>{
                    if (e.matches(inputs_selector)) return [e];
                    return [...e.querySelectorAll(inputs_selector)];
                }).flat();
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
            "nullify_defaults": undefined,
            ...settings
        };
        if (!("title" in settings) && ("label" in settings)) settings.title = settings.label;
        /*
            "readonly": undefined,
            "spinner": undefined,
            "min": undefined,
            "max": undefined,
            "step": undefined,
            "precision": undefined,
            "options": undefined,
        */

        super(null, settings);

        this.elem.classList.add("property");
        // this.values_valid = true;
        this.name = this.get_setting("name");
        if (this.name != null) this.name = String(this.name);
        this.name_id = `${this.name}-${this.id}`;
        
        if (this.settings.label) {
            this.header_el = dom.$(`<div class="property-header"></div>`)[0];
            this.label = new UI(`<label>&nbsp;</label>`);
            dom.set_attribute(this.label.elem, "for", this.name_id);
            this.header_el.append(this.label);
            this.append(this.header_el);
        }
        
        if (this.settings.info) {
            this.info_elem = dom.$(`<span><i class="fas fa-question-circle info"></i></span>`)[0];
            this.header_el.append(this.info_elem);
            this.tooltip = new Tooltip(this.info_elem);
        }

        this.outer_el = dom.$(`<div class="property-outer"></div>`)[0];
        this.append(this.outer_el);
        
        /** @type {HTMLElement} */
        this.inner_el = dom.$(`<div class="property-inner"></div>`)[0];
        this.outer_el.append(this.inner_el);

        var add_prefix_suffix = (name)=>{
            if (!this.settings[name]) return;
            let el = this.get_setting(name);
            el = (typeof el === "string") ? dom.$(el) : el;
            let wrapper_el = $(`<div class="property-input-${name}"></div>`)[0];
            wrapper_el.append(el);
            this.inner_el.append(wrapper_el);
        }
        add_prefix_suffix("prefix")
        
        this.input_wrapper_el = dom.$(`<div class="property-input-wrapper"></div>`)[0];
        this.inner_el.append(this.input_wrapper_el);
        
        contents = this.get_setting("contents");
        contents = (typeof contents === "string") ? dom.$(contents) : contents;
        if (!Array.isArray(contents)) contents = [contents];
        for (let c of contents) {
            if (c) this.input_wrapper_el.append(c);
        }

        add_prefix_suffix("suffix")

        var inputs = this.get_setting("setup") || [];
        if (!Array.isArray(inputs)) inputs = [inputs];
        inputs.forEach((input, i)=>{
            if (input.matches(".fake-input")) {
                input.tabIndex = "-1"
            }
            dom.set_attribute(input, "id", this.name_id);
            var update_value = (trigger)=>{
                var value = dom.get_value(input);
                value = this.apply_input_modifiers(value);
                this.set_value(value, {trigger});
            }
            input.addEventListener("change", (e)=>update_value(true));
            input.addEventListener("input", (e)=>update_value(false));
            input.addEventListener("blur", (e)=>this.update());
            input.addEventListener("focus", (e)=>this.update());
            if (input.nodeName === "INPUT" || input.isContentEditable) {
                input.addEventListener("keydown", (e)=>{
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.target.blur();
                    }
                    if (input.type !== "number" && this.is_numeric) {
                        var changed = false;
                        if (e.key == "ArrowUp") changed = this.step(1)
                        else if (e.key == "ArrowDown") changed = this.step(-1)
                        if (changed) {
                            e.stopPropagation();
                            e.preventDefault();
                            this._force_update_inputs = true;
                        }
                    }
                });
            }
            /* Object.defineProperty(input, 'value', {
                get () { return this.get_value(); },
                set (value) { this.set_value(value, false); }
            }); */
        });
        this.inputs = inputs;

        if (this.input) {
            if (this.settings["placeholder"] === undefined) this.settings["placeholder"] = this.input.placeholder;
            if (this.settings["readonly"] ===undefined) this.settings["readonly"] = this.input.readOnly;
            if (this.settings["default"] === undefined) this.settings["default"] = this.apply_input_modifiers(this.input.value, this.input);
            if (this.settings["min"] === undefined && this.input.min) this.settings["min"] = this.apply_input_modifiers(+this.input.min, this.input);
            if (this.settings["max"] === undefined && this.input.max) this.settings["max"] = this.apply_input_modifiers(+this.input.max, this.input);
            if (this.settings["step"] === undefined && this.input.step) this.settings["step"] = this.apply_input_modifiers(+this.input.step, this.input);
        }
        this.is_numeric = ((this.input && this.input.type === "number") || this.settings["step"] !== undefined || this.settings["precision"] !== undefined ||  this.settings["min"] !== undefined || this.settings["max"] !== undefined || this.settings["spinner"] !== undefined);
        if (this.is_numeric) {
            this.settings["step"] = this.settings["step"] || 1;
            
            if (this.settings["spinner"] !== false && this.input.type !== "range") {
                this.spinner_ui = new UI();
                this.spinner_ui.elem.classList.add("spinner");
                this.up_button = new Button(`<button><i class="fas fa-caret-up"></i></button>`, {
                    "click":(e)=>this.step(1),
                    "disabled":()=>this.value>=this.get_setting("max"),
                });
                this.down_button = new Button(`<button><i class="fas fa-caret-down"></i></button>`, {
                    "click":(e)=>this.step(-1),
                    "disabled":()=>this.value<=this.get_setting("min"),
                });
                this.spinner_ui.append(this.up_button, this.down_button);
                this.outer_el.append(this.spinner_ui);
            }
        }

        if (this.get_setting("copy")) {
            var copy_hide_timeout;
            var copy_tippy;
            this.copy_button = new Button(`<button><i class="fas fa-copy"></i></button>`, {
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
            this.reset_button = new Button(`<button><i class="fas fa-undo"></i></button>`, {
                "click":()=>this.reset(),
                "title": "Reset",
                // "hidden": ()=>!this.get_setting("reset"),
            });
            this.reset_button.elem.classList.add("reset");
            this.outer_el.append(this.reset_button);
            
            if (this.get_setting("vertical")) {
                this.outer_el.classList.add("vertical")
            }
        }
        
        // this.elem.addEventListener("focusin", (e)=>{
        //     this.update();
        // });
        // this.elem.addEventListener("focusout", (e)=>{
        //     this.update();
        // });
        
        /* requestAnimationFrame(()=>{
            this.update_inputs(true);
        }); */
    }

    step(dir) {
        var step = this.get_setting("step");
        return this.set_values(Math.round((this.value + (step*dir))/step)*step, {trigger:"change"});
    }

    apply_input_modifiers(value, input) {
        for (var m of this.input_modifiers) {
            value = m.apply(this, [value, input]);
        }
        return value;
    }

    apply_output_modifiers(value, input) {
        for (var m of this.output_modifiers) {
            value = m.apply(this, [value, input]);
        }
        return value;
    }

    reset(trigger=true) {
        this.set_values(this.items.map((d,i)=>this.get_setting("default", d, i)), {trigger:trigger?"change":false});
    }

    /** @typedef {{trigger:boolean|"change"}} SetValueOptions */
    /** @param {SetValueOptions} options */
    set_value(value, options) {
        return this.set_values(this.items.map(_=>value), options);
    }

    /** @param {SetValueOptions} options */
    set_values(values, options) {
        options = {
            trigger: false,
            ...options
        };
        // console.trace(this.name, values, trigger);
        // if (!Array.isArray(values)) throw new Error("Values must be array...");

        var nullify_defaults = this.nullify_defaults;
        if (!Array.isArray(values)) values = this.items.map(item=>values);
        if (values.length != this.items.length) {
            throw new Error(`Values length (${values.length}) mismatch datas length (${this.items.length})...`);
        }

        var fix_value = (value)=>{
            if (typeof(value) == "number") {
                var min = this.get_setting("min");
                var max = this.get_setting("max");
                var precision = this.get_setting("precision");
                if (max !== undefined) value = Math.min(value, +max);
                if (min !== undefined) value = Math.max(value, +min);
                if (precision !== undefined) value = +value.toFixed(precision)
            }
            return value;
        };

        values = values.map((v)=>fix_value(v));
        
        // var old_values = this._values;
        this._values = this.items.map((item,i)=>{
            var default_value = fix_value(this.get_setting("default", item, i));
            var value;
            if (nullify_defaults) value = (JSON.stringify(values[i]) === JSON.stringify(default_value)) ? null : values[i];
            else value = (values[i] == null) ? default_value : values[i];
            value = utils.json_copy(value);
            for (var m of this.raw_modifiers) {
                value = m.apply(this, [value]);
            }
            return value;
        });

        // --------------- DO NOT TOUCH ---------------

        // this._values_hash = JSON.stringify([this.values, this._values]);
        var values_hash = JSON.stringify(this._values);
        var non_null_values_hash = JSON.stringify(this.values);
        var changed = values_hash !== this._last_values_hash;
        var changed_non_null = non_null_values_hash !== this._last_non_null_values_hash;
        var trigger = (options.trigger === "change") ? changed : !!options.trigger;
        
        this._last_non_null_values_hash = non_null_values_hash;
        this._last_values_hash = values_hash;

        // --------------------------------------------

        if (changed || trigger) {
            var ev = new PropertyChangeEvent(this, trigger);
            this.emit("change", ev, {bubbles:true});
        }
        if (trigger) this._force_update_inputs = true;

        if (changed || changed_non_null || trigger) {
            this.update();
        }

        return changed;
    }
    
    data_update() {
        let values;
        if ("data" in this.settings) {
            values = this.items = [this.get_setting("data")];
        } else {
            var container = this.container;
            if (container && typeof this.name === "string") {
                let path = this.name.split("/");
                this.items = [...container.items];
                values = this.items.map(item=>container.get_setting("data", item, path));
            }
        }
        if (!values) return;
        let hash = JSON.stringify(values);
        if (this._last_values_on_property_update !== hash) {
            this._last_values_on_property_update = hash;
            this.set_values(values);
        }
    }

    __update() {
        this.data_update();
        super.__update();
    }

    __render() {

        var is_default = this.is_default;
        var is_indeterminate = this.is_indeterminate;
        var readonly = this.get_setting("readonly");
        var disabled = this.disabled;
        var style_not_default = !!this.get_setting("reset");
        var width = this.get_setting("width");

        if (width != null) {
            this.elem.style.setProperty("--ui-property-min-width", typeof width == "number" ? `${width}px` : width);
        }
        
        /* if (this.reset_button) {
            this.reset_button.disabled = is_default
        } */

        if (this.settings["options"] !== undefined) {
            let items_options = this.options;
            let options = [];
            let options_consistant = this.options_consistant;
            if (!options_consistant) is_indeterminate = true;
            if (!options_consistant || is_indeterminate) options.push({value:"", text:"Multiple values", style:{"display":"none"}});
            if (options_consistant) options.push(...utils.json_copy(items_options[0]));
            var default_value = this.get_setting("default", this.items[0], 0);
            options = dom.fix_options(options);
            if (style_not_default) {
                options.forEach((o)=>{
                    if (o.value === default_value) o.text += " *";
                });
            }
            for (var input of this.inputs) {
                if (input.nodeName === "SELECT") dom.set_select_options(input, options);
            }
        }

        // var is_focused = dom.has_focus(this.inner_el, true, true);
        // var is_focused = this.inputs.some(input=>dom.has_focus(input, false, true));
        // var is_focused = dom.has_focus(this.input_wrapper_el, false, true);
        
        for (var input of this.inputs) {
            var value = this.value;
            var is_focused = dom.has_focus(input, false, true);
            // var is_text_field = !input.readOnly && (input.isContentEditable || input.type in editable_input_types || input.nodeName === "TEXTAREA");
            // !is_text_field || 
            if (!is_focused || this._force_update_inputs) {
                if (is_indeterminate) {
                    if (input.type == "color") value = "#000000";
                    else value = "";
                }
                if (typeof value === "number" && this.settings["precision"] !== undefined) {
                    value = value.toFixed(this.get_setting("precision"));
                    if (value.includes(".")) value = value.replace(/\.?0+$/,"");
                }
                value = this.apply_output_modifiers(value, input);
                if (input.matches(".fake-input")) {
                    dom.set_inner_html(input, value);
                } else if (typeof input.value !== "undefined") {
                    dom.set_value(input, value, {trigger:false});
                }
            }
        }
        this._force_update_inputs = false;
        
        dom.toggle_class(this.elem, "not-default", !is_default && style_not_default); // !is_focused && 

        for (var input of this.inputs) {
            // input.disabled = disabled;
            dom.toggle_attribute(input, "disabled", disabled===true);
            if (readonly !== undefined) {
                input.readOnly = readonly;
                // set_attribute(input, "readonly", readonly);
            }
            if ("step" in this.settings) input.step = this.apply_output_modifiers(this.get_setting("step"), input);
            if ("min" in this.settings) input.min = this.apply_output_modifiers(this.get_setting("min"), input);
            if ("max" in this.settings) input.max = this.apply_output_modifiers(this.get_setting("max"), input);

            var is_checkbox = input.nodeName === "INPUT" && input.type === "checkbox";
            
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
            dom.set_inner_html(this.label.elem, this.get_setting("label", this.item));
        }
        if (this.tooltip) {
            let info = this.get_setting("info");
            dom.toggle_class(this.info_elem, "d-none", !info);
            if (typeof info === "string") info = info.replace(/\n/g, "<br>");
            this.tooltip.set_content(info);
        }
        super.__render();
    }

    /* destroy() {
        if (this.container) this.container.unregister_properties(this);
        super.destroy();
    } */
}

/** @typedef {UI & {props:PropertyContainer}} PropertyListItem */

export class PropertyList extends Property {
    constructor(settings = {}) {
        var wrapper = new UI(`<div class="property-list-wrapper"></div>`);
        super(wrapper.elem, {
            setup: false,
            item_size: "auto",
            allow_empty: true,
            vertical: false,
            ...settings
        });
        var horizontal = !this.get_setting("vertical");
        wrapper.elem.classList.add(horizontal?"horizontal":"vertical");
        var list = new UI({class:`property-list`});
        var add_button = new Button(`<button><i class="fas fa-plus"></i></button>`, {
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
        if (!isNaN(item_size)) item_size = String(item_size)+"px";
        wrapper.elem.style.setProperty("--ui-property-list-item-size", item_size);
        wrapper.append(list);
        this.outer_el.children[0].insertAdjacentElement("afterend", add_button.elem);

        var get_value = ()=>this.value ? [...this.value] : [];

        this.on("update", ()=>{
            var type = this.get_setting("type");
            /** @type {PropertyListItem[]} */
            var items = [...list.children];
            for (var i = 0; i < this.value.length; i++) {
                if (!items[i]) {
                    let ui = new UI({class:"buttons"});
                    var up_button = new Button(`<button><i class="fas fa-arrow-${horizontal?"left":"up"}"></i></button>`, {
                        "click":()=>{
                            this.set_value(utils.array_move_element(get_value(), item.index, item.index-1), {trigger:true})
                        },
                        "hidden":()=>this.value.length < 2,
                        "disabled":()=>item.index == 0,
                        "title": `Move ${horizontal?"Left":"Up"}`,
                    });
                    var down_button = new Button(`<button><i class="fas fa-arrow-${horizontal?"right":"down"}"></i></button>`, {
                        "click":()=>{
                            this.set_value(utils.array_move_element(get_value(), item.index, item.index+1), {trigger:true});
                        },
                        "hidden":()=>this.value.length < 2,
                        "disabled":()=>item.index == this.value.length-1,
                        "title": `Move ${horizontal?"Right":"Down"}`,
                    });
                    var delete_button = new Button(`<button><i class="fas fa-trash"></i></button>`, {
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
                    props.on("change", (e)=>{
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


export class MultiProperty extends Property {
    constructor(settings = {}) {
        super(null, {
            ...settings
        });
        this.elem.classList.add("multiple");
        /** @type {Property[]} */
        var props = this.get_setting("props");
        if (!Array.isArray(props)) props = [props];
        for (var prop of props) {
            this.input_wrapper_el.append(prop);
        }
        this.on("change", /** @param {PropertyChangeEvent} e */ (e)=>{
            if (e.property === this) {
                props.forEach((prop,i)=>{
                    prop.set_value(e.value[prop.name], {trigger:false});
                });
            } else if (props.includes(e.property)) {
                if (e.trigger) {
                    var value = this.value;
                    value[e.name] = e.value;
                    this.set_value(value, {trigger:true});
                }
                return false;
            }
        });
    }
}

/* class DateTimePropertyValue {
    date = "";
    time = "";
    constructor(value) {
        console.log(value);
        if (value instanceof DateTimePropertyValue) {
            this.date = value.date;
            this.time = value.time;
        } else {
            [this.date, this.time] = utils.split_datetime(new Date(value || NaN));
        }
    }
    toJSON() {
        return +utils.join_datetime([this.date || new Date().toISOString().split("T")[0], this.time || "00:00"], true) || null;
    }
    toString() {
        return this.toJSON() || "-";
    }
} */

export class DateTimeProperty extends Property {
    get today_str() { return new Date().toISOString().split("T")[0]; }

    constructor(name, label, settings = {}) {
        var date_input = $(`<input type="date">`)[0];
        var time_input = $(`<input type="time">`)[0];
        var inputs = [date_input, time_input];

        super(name, label, inputs, {
            "datetime.apply_timezone": true,
            "default": NaN,
            "multiple": true,
            ...settings,
            setup: false
        });

        inputs.forEach(input=>{
            input.addEventListener("change", ()=>{
                this.set_value(utils.join_datetime(date_input.value, time_input.value, this.get_setting("datetime.apply_timezone")), {trigger:"change"});
            });
            input.addEventListener("focus", ()=>this.update());
            input.addEventListener("blur", ()=>this.update());
        })

        this.on("render", (e)=>{
            var value = this.value || NaN;
            if (!isNaN(value)) {
                var [date,time] = utils.split_datetime(value, this.get_setting("datetime.apply_timezone"));
                if (!dom.has_focus(date_input)) date_input.value = date;
                if (!dom.has_focus(time_input)) time_input.value = time.slice(0,5);
            }
        })

        /* 
        this.input_modifiers.push((value, input)=>{
            if (value==="") return NaN;
            if (input == inputs[0])
                if (!value) value = this.today_str
            if (input == inputs[1] && !value) value = "00:00";
            return utils.join_datetime(inputs.map(i=>i.value), this.get_setting("datetime.apply_timezone"));
        });
        this.output_modifiers.push((value)=>{
            var parts = ["",""];
            if (value) parts = utils.split_datetime(value, this.get_setting("datetime.apply_timezone"));
            return [parts[0], parts[1].slice(0,5)];
        }); */
        
        this.validators.push((_,input)=>{
            if (!this.get_setting("datetime.after_now")) return true;
            if (!inputs.some(input=>input.value)) return true;
            var before_now = this.value < Math.floor(Date.now()/1000)*1000;
            var before_today = new Date(inputs[0].value) < new Date(this.today_str);
            if (before_today && input == date_input) return "Date is in the past.";
            else if (!before_today && before_now && input == time_input) return "Time is in the past.";
            return true;
        });
    }
}
export class TimeSpanProperty extends Property {
    constructor(settings = {}) {
        var input = dom.$(`<input type="text">`)[0];
        super(input, {
            "timespan.format": "hh:mm:ss",
            "timespan.zero_infinity": false,
            "step": 1.0,
            "default": 0,
            ...settings
        });
        this.input_modifiers.push((v)=>{
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v.toLowerCase() === "infinity") return 0;
            v = utils.timespan_str_to_seconds(v, this.get_setting("timespan.format"));
            // var step = this.get_setting("step");
            // v = Math.round(v / step) * step;
            return v;
        });
        this.output_modifiers.push((v)=>{
            var zero_infinity = this.get_setting("timespan.zero_infinity");
            if (zero_infinity && v == 0) return "Infinity";
            return utils.seconds_to_timespan_str(Math.round(v*1000)/1000, this.get_setting("timespan.format"));
        });
    }
}

export class TextAreaProperty extends Property {
    constructor(settings = {}) {
        var input_el = dom.$(`<textarea style="resize:none"></textarea>`)[0];
        super(input_el, Object.assign({
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