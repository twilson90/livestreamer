import tippy from 'tippy.js';
import "tippy.js/dist/tippy.css";
import Cookie from 'js-cookie';
import 'resize-observer-polyfill';
import { OverlayScrollbars,  ScrollbarsHidingPlugin,  SizeObserverPlugin,  ClickScrollPlugin } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
import * as utils from './utils.js';
import "./style.scss";

var _temp_div = document.createElement('div');
var _div2 = document.createElement('div');
const $ = render_html;
const textarea_input_events = ["input", "propertychange", "paste"];
const { debounce } = utils;

const entity_table = {
    34 : 'quot', 
    38 : 'amp', 
    39 : 'apos', 
    60 : 'lt', 
    62 : 'gt', 
    160 : 'nbsp', 
    161 : 'iexcl', 
    162 : 'cent', 
    163 : 'pound', 
    164 : 'curren', 
    165 : 'yen', 
    166 : 'brvbar', 
    167 : 'sect', 
    168 : 'uml', 
    169 : 'copy', 
    170 : 'ordf', 
    171 : 'laquo', 
    172 : 'not', 
    173 : 'shy', 
    174 : 'reg', 
    175 : 'macr', 
    176 : 'deg', 
    177 : 'plusmn', 
    178 : 'sup2', 
    179 : 'sup3', 
    180 : 'acute', 
    181 : 'micro', 
    182 : 'para', 
    183 : 'middot', 
    184 : 'cedil', 
    185 : 'sup1', 
    186 : 'ordm', 
    187 : 'raquo', 
    188 : 'frac14', 
    189 : 'frac12', 
    190 : 'frac34', 
    191 : 'iquest', 
    192 : 'Agrave', 
    193 : 'Aacute', 
    194 : 'Acirc', 
    195 : 'Atilde', 
    196 : 'Auml', 
    197 : 'Aring', 
    198 : 'AElig', 
    199 : 'Ccedil', 
    200 : 'Egrave', 
    201 : 'Eacute', 
    202 : 'Ecirc', 
    203 : 'Euml', 
    204 : 'Igrave', 
    205 : 'Iacute', 
    206 : 'Icirc', 
    207 : 'Iuml', 
    208 : 'ETH', 
    209 : 'Ntilde', 
    210 : 'Ograve', 
    211 : 'Oacute', 
    212 : 'Ocirc', 
    213 : 'Otilde', 
    214 : 'Ouml', 
    215 : 'times', 
    216 : 'Oslash', 
    217 : 'Ugrave', 
    218 : 'Uacute', 
    219 : 'Ucirc', 
    220 : 'Uuml', 
    221 : 'Yacute', 
    222 : 'THORN', 
    223 : 'szlig', 
    224 : 'agrave', 
    225 : 'aacute', 
    226 : 'acirc', 
    227 : 'atilde', 
    228 : 'auml', 
    229 : 'aring', 
    230 : 'aelig', 
    231 : 'ccedil', 
    232 : 'egrave', 
    233 : 'eacute', 
    234 : 'ecirc', 
    235 : 'euml', 
    236 : 'igrave', 
    237 : 'iacute', 
    238 : 'icirc', 
    239 : 'iuml', 
    240 : 'eth', 
    241 : 'ntilde', 
    242 : 'ograve', 
    243 : 'oacute', 
    244 : 'ocirc', 
    245 : 'otilde', 
    246 : 'ouml', 
    247 : 'divide', 
    248 : 'oslash', 
    249 : 'ugrave', 
    250 : 'uacute', 
    251 : 'ucirc', 
    252 : 'uuml', 
    253 : 'yacute', 
    254 : 'thorn', 
    255 : 'yuml', 
    402 : 'fnof', 
    913 : 'Alpha', 
    914 : 'Beta', 
    915 : 'Gamma', 
    916 : 'Delta', 
    917 : 'Epsilon', 
    918 : 'Zeta', 
    919 : 'Eta', 
    920 : 'Theta', 
    921 : 'Iota', 
    922 : 'Kappa', 
    923 : 'Lambda', 
    924 : 'Mu', 
    925 : 'Nu', 
    926 : 'Xi', 
    927 : 'Omicron', 
    928 : 'Pi', 
    929 : 'Rho', 
    931 : 'Sigma', 
    932 : 'Tau', 
    933 : 'Upsilon', 
    934 : 'Phi', 
    935 : 'Chi', 
    936 : 'Psi', 
    937 : 'Omega', 
    945 : 'alpha', 
    946 : 'beta', 
    947 : 'gamma', 
    948 : 'delta', 
    949 : 'epsilon', 
    950 : 'zeta', 
    951 : 'eta', 
    952 : 'theta', 
    953 : 'iota', 
    954 : 'kappa', 
    955 : 'lambda', 
    956 : 'mu', 
    957 : 'nu', 
    958 : 'xi', 
    959 : 'omicron', 
    960 : 'pi', 
    961 : 'rho', 
    962 : 'sigmaf', 
    963 : 'sigma', 
    964 : 'tau', 
    965 : 'upsilon', 
    966 : 'phi', 
    967 : 'chi', 
    968 : 'psi', 
    969 : 'omega', 
    977 : 'thetasym', 
    978 : 'upsih', 
    982 : 'piv', 
    8226 : 'bull', 
    8230 : 'hellip', 
    8242 : 'prime', 
    8243 : 'Prime', 
    8254 : 'oline', 
    8260 : 'frasl', 
    8472 : 'weierp', 
    8465 : 'image', 
    8476 : 'real', 
    8482 : 'trade', 
    8501 : 'alefsym', 
    8592 : 'larr', 
    8593 : 'uarr', 
    8594 : 'rarr', 
    8595 : 'darr', 
    8596 : 'harr', 
    8629 : 'crarr', 
    8656 : 'lArr', 
    8657 : 'uArr', 
    8658 : 'rArr', 
    8659 : 'dArr', 
    8660 : 'hArr', 
    8704 : 'forall', 
    8706 : 'part', 
    8707 : 'exist', 
    8709 : 'empty', 
    8711 : 'nabla', 
    8712 : 'isin', 
    8713 : 'notin', 
    8715 : 'ni', 
    8719 : 'prod', 
    8721 : 'sum', 
    8722 : 'minus', 
    8727 : 'lowast', 
    8730 : 'radic', 
    8733 : 'prop', 
    8734 : 'infin', 
    8736 : 'ang', 
    8743 : 'and', 
    8744 : 'or', 
    8745 : 'cap', 
    8746 : 'cup', 
    8747 : 'int', 
    8756 : 'there4', 
    8764 : 'sim', 
    8773 : 'cong', 
    8776 : 'asymp', 
    8800 : 'ne', 
    8801 : 'equiv', 
    8804 : 'le', 
    8805 : 'ge', 
    8834 : 'sub', 
    8835 : 'sup', 
    8836 : 'nsub', 
    8838 : 'sube', 
    8839 : 'supe', 
    8853 : 'oplus', 
    8855 : 'otimes', 
    8869 : 'perp', 
    8901 : 'sdot', 
    8968 : 'lceil', 
    8969 : 'rceil', 
    8970 : 'lfloor', 
    8971 : 'rfloor', 
    9001 : 'lang', 
    9002 : 'rang', 
    9674 : 'loz', 
    9824 : 'spades', 
    9827 : 'clubs', 
    9829 : 'hearts', 
    9830 : 'diams', 
    338 : 'OElig', 
    339 : 'oelig', 
    352 : 'Scaron', 
    353 : 'scaron', 
    376 : 'Yuml', 
    710 : 'circ', 
    732 : 'tilde', 
    8194 : 'ensp', 
    8195 : 'emsp', 
    8201 : 'thinsp', 
    8204 : 'zwnj', 
    8205 : 'zwj', 
    8206 : 'lrm', 
    8207 : 'rlm', 
    8211 : 'ndash', 
    8212 : 'mdash', 
    8216 : 'lsquo', 
    8217 : 'rsquo', 
    8218 : 'sbquo', 
    8220 : 'ldquo', 
    8221 : 'rdquo', 
    8222 : 'bdquo', 
    8224 : 'dagger', 
    8225 : 'Dagger', 
    8240 : 'permil', 
    8249 : 'lsaquo', 
    8250 : 'rsaquo', 
    8364 : 'euro'
};

/* new MutationObserver(mutations => {
    Array.from(mutations).forEach(mutation => {
        Array.from(mutation.addedNodes).forEach(node => {
            if (node.matches("textarea[autosize]")) new AutoSizeController(node);
        });
        Array.from(mutation.removedNodes).forEach(node => {
            if (node.matches("textarea[autosize]")) node.__autosize__.destroy()
        });
    });
}).observe(document.body, { childList: true }); */

class TouchListener extends utils.EventEmitter {
    constructor(elem, user_settings) {
        super();
        var settings = {
            mode: "normal",
            start: (e)=>{},
            move: (e)=>{},
            end: (e)=>{},
        }
        elem.style["touch-actions"] = "none";
        Object.assign(settings, user_settings);
        this.elem = elem;
        var end_target = window.document;
        var start_events = ["pointerdown"];
        var move_events = ["pointermove"];
        var end_events = ["pointerup"];
        if (settings.mode == "hover") {
            start_events = ["pointerover"];
            end_events = ["pointerout"];
            end_target = this.elem;
        }
        var _on_touch_start = (e)=>{
            // VERY NECESSARY!
            e.preventDefault();
        }
        var _on_start = (e)=>{
            if (e.pointerId && settings.mode != "hover") {
                if (e.button != 0) return
                this.elem.setPointerCapture(e.pointerId);
                this.elem.addEventListener("lostpointercapture", _on_end);
            }
            e.stopPropagation();
            e.preventDefault();

            settings.start(e);
            move_events.forEach(et=>window.addEventListener(et, _on_move));
            end_events.forEach(et=>end_target.addEventListener(et, _on_end));
        };
        var _on_move = (e)=>{
            // console.log(e.type, e);
            settings.move(e);
        };
        var _on_end = (e)=>{
            // console.log(e.type, e);
            settings.end(e);
            cleanup();
        };
        var cleanup = ()=>{
            this.elem.removeEventListener("lostpointercapture", _on_end);
            move_events.forEach(et=>window.removeEventListener(et, _on_move));
            end_events.forEach(et=>end_target.removeEventListener(et, _on_end));
        };
        this._destroy = ()=>{
            this.elem.removeEventListener("touchstart", _on_touch_start);
            start_events.forEach(et=>this.elem.removeEventListener(et, _on_start));
            cleanup();
        }
        start_events.forEach(et=>this.elem.addEventListener(et, _on_start));
        this.elem.addEventListener("touchstart", _on_touch_start);
    }
    
    destroy() {
        this._destroy();
    }
}
class AutoSizeController extends utils.EventEmitter {
    constructor(elem, min_rows, auto_update=true) {
        super();
        this.elem = elem;
        this.min_rows = min_rows || 1;
        this.on_change = (e)=>{
            this.update();
        };
        this.debounced_update = utils.debounce(()=>this.update(), 50);
        textarea_input_events.forEach(ev=>this.elem.addEventListener(ev, this.on_change));
        if (auto_update) {
            window.addEventListener("resize", this.debounced_update);
            var fs;
            this.check_interval = setInterval(()=>{
                var new_fs = getComputedStyle(elem).getPropertyValue("font-size");
                if (new_fs !== fs) this.update();
                fs = new_fs;
            }, 200);
        }
        elem.__autosize__ = this;
        this.update();
    }
    update() {
        this.emit("pre-update");
        autosize(this.elem, this.min_rows);
        this.emit("post_update");
    }
    destroy() {
        delete elem.__autosize__;
        clearInterval(this.check_interval);
        this.input_events.forEach(ev=>this.elem.removeEventListener(ev, this.on_change));
        window.removeEventListener("resize", this.debounced_update);
    }
}
// var LocalStorageDeleted = Symbol("LocalStorageDeleted");
class LocalStorageBucket extends utils.EventEmitter
{   
    get data() { return { ...this.#defaults, ...this.#data } }
    get keys() { return Object.keys(this.data); }
    get defaults() { return this.#defaults; }

    #name;
    #data = {};
    #defaults;
    #last_data_hash;
    #interval;
    
    constructor(name, defaults) {
        super();
        this.save = utils.debounce(this.#save, 0);
        this.#name = name;
        this.#defaults = defaults ? utils.deep_copy(defaults) : {};
        // in case it is altered in another window.
        this.#interval = setInterval(()=>this.load(), 5000);
        this.load();
    }
    get(k) {
        return (k in this.#data) ? this.#data[k] : this.#defaults[k];
    }
    set(k, new_value) {
        var new_hash = JSON.stringify(new_value);
        var old_value = this.#data[k];
        var old_hash = JSON.stringify(old_value);
        var default_hash = JSON.stringify(this.#defaults[k]);
        if (new_hash === old_hash) return;
        if (new_hash === default_hash) delete this.#data[k];
        else this.#data[k] = new_value;
        this.emit("change", {name:k, old_value, new_value});
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
        var new_values;
        try {
            new_values = JSON.parse(localStorage.getItem(this.#name));
        } catch {
            return;
        }
        for (var k in new_values) {
            this.set(k, new_values[k]);
            // if (!(k in this.#defaults)) {
            //     console.warn(`LocalStorageBucket '${this.#name}' key '${k}' not defined in defaults.`);
            // }
        }
    }
    #save() {
        this.#last_data_hash = JSON.stringify(this.#data);
        localStorage.setItem(this.#name, this.#last_data_hash);
    }
    destroy() {
        clearInterval(this.#interval);
    }
}

class WebSocket2 extends utils.EventEmitter
{
    get requests() { return this._requests; }

    constructor(url, options={}) {
        super();
        this.url = url;
        this.options = Object.assign({
            auto_reconnect: true,
            auto_reconnect_interval: 1000,
        }, options);
        this._init_websocket();
    }

    get ready_state() { return this.ws.readyState; }
    get ready_promise() {
        return (this.ws.readyState === WebSocket.OPEN) ? Promise.resolve(true) : new Promise(resolve=>this.once("open", resolve));
    }

    request(data, timeout){
        return new Promise((resolve,reject) => {
            var rid = ++this._requests;
            this._request_ids[rid] = (response) => {
                if (response.error) reject(response.error.message);
                else resolve(response.result);
            };
            this.send(Object.assign({
                __id__: rid,
            }, data));
            setTimeout(()=>reject(`WebSocket2 request ${rid} timed out`), timeout)
        }).catch((e)=>console.error(e));
    }

    async send(data) {
        await this.ready_promise;
        if (data instanceof ArrayBuffer || data instanceof Blob) {
            this.ws.send(data);
        } else {
            this.ws.send(JSON.stringify(data));
        }
    }

    _init_websocket(){
        this._request_ids = {};
        this._requests = 0;

        var url = this.url;
        var protocols = this.protocols;
        if (typeof url === "function") url = url();
        if (typeof protocols === "function") protocols = protocols();
        this.ws = new WebSocket(url, protocols);
        var open = false;
        this.emit("connecting");
        var try_reconnect = ()=>{
            if (!this.options.auto_reconnect) return;
            clearTimeout(this._reconnect_timeout);
            this._reconnect_timeout = setTimeout(()=>{
                this._init_websocket();
            }, this.options.auto_reconnect_interval);
        }
        this.ws.addEventListener("open", (e)=>{
            open = true;
            clearTimeout(this._reconnect_timeout);
            this.emit("open", e);
        });
        this.ws.addEventListener("message", (e)=>{
            this.emit("message", e);
            if (e.data === "ping") {
                this.ws.send("pong");
                return;
            }
            var data;
            try {
                data = JSON.parse(e.data);
            } catch(ex) {
                console.error(ex);
                return;
            }
            if (data && data.__id__ !== undefined) {
                var cb = this._request_ids[data.__id__];
                delete this._request_ids[data.__id__];
                cb(data);
            }
            this.emit("data", data)
            // this event always runs before cb() promise as promises resolve later in another (pseudo) thread.
            // setTimeout(()=>this.emit("data", data), 0);
        });
        this.ws.addEventListener("close", (e)=>{
            open = false;
            this.emit("close", e);
            if (e.code == 1014) {
                // bad gateway, don't bother.
                console.error("Connection refused: Bad gateway.")
            } else {
                try_reconnect();
            }
        });
        this.ws.addEventListener("error", (e)=>{
            this.emit("error", e);
        });
    }
}

// depends on tippy js
class UI extends utils.EventEmitter {
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
    get root() { return this.get_closest(UI.Root); }
    get visible() { return is_visible(this.elem); } // not the opposite of hidden
    get children() { return [...this.get_children()]; }
    get descendents() { return [...this.get_descendents()]; }
    get parents() { return [...this.get_parents()]; }
    get parent() { return this._parent; }
    get id() { return this.__UID__; }
    get style() { return this.elem.style; }

    /** @type {Set<UI>} */
    _children = new Set();
    /** @type {UI} */
    _parent;
    *get_children() {
        for (var c of this._children) {
            yield c;
        }
    }
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
        return UI.closest(this.elem, type);
    }

    // get_children() { return UI.find(this.elem, UI, false); }
    // get_descendents() { return UI.find(this.elem, UI, true); }
    // get_parents() { return UI.parents(this.elem); }

    constructor(elem, settings) {
        super();
        this.__UID__ = ++UI.id;
        if (typeof elem === "string") elem = $(elem)[0];
        if (elem instanceof Document) elem = elem.body;
        if (!(elem instanceof Element) && !settings) {
            settings = elem;
            elem = null;
        }
        if (!elem) elem = document.createElement('div');
        /** @type {HTMLElement} */
        this.elem = elem;
        this.elem[UI.expando] = this;
        this.elem.classList.add(UI.pre);

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

        this.update = debounce_next_frame(()=>{
            this.__update();
            this.__render();
        });
        // this.render = debounce_next_frame(()=>this.__render());
        
        if (this.elem.isConnected) {
            this.root.register(this);
        }
        
        this.init();
        this.get_setting("init");
    }

    init(){}

    __update() {
        this.emit("pre_update");

        this.get_setting("update");
        this.emit("update");

        for (var c of this._children) {
            c.__update();
        }

        this.get_setting("post_update");
        this.emit("post_update");

        // this.render(); // necessary to use a delayed render because certain settings' values (e.g. disabled) may depend on other siblings.
    }

    update_settings(settings) {
        Object.assign(this.settings, settings);
        return this.update();
    }
    
    __render() {
        var hidden = this.hidden;
        if (hidden !== undefined) toggle_class(this.elem, "d-none", hidden);
        toggle_attribute(this.elem, "disabled", this.disabled || this.disabled_parent);

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
        
        if ("click" in this.settings) this.elem.onclick = (e)=>{ var r = this.get_setting("click", e); this.emit("click"); return r; }
        if ("mousedown" in this.settings) this.elem.onmousedown = (e)=>{ var r = this.get_setting("mousedown", e); this.emit("mousedown"); return r; }
        if ("mouseup" in this.settings) this.elem.onmouseup = (e)=>{ var r = this.get_setting("mouseup", e); this.emit("mouseup"); return r; }
        if ("dblclick" in this.settings) this.elem.ondblclick = (e)=>{ var r = this.get_setting("dblclick", e); this.emit("dblclick"); return r; }

        this.emit("render");
        
        for (var c of this._children) {
            c.__render();
        }
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
        empty(this.elem);
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
                        var r = this.append(new UI.FlexRow({"hidden":function(){ return this.children.every(c=>c.hidden); }}));
                        process(r, o);
                    } else if (typeof o === "string" && o.startsWith("-")) {
                        this.append(new UI.Separator());
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

UI.id = 0;
UI.pre = "uis";
UI.expando = `${UI.pre}-${Date.now()}`;
var old_append = Element.prototype.append;
var old_prepend = Element.prototype.prepend;

// UI.creating = 0;
/* UI.create = function(...args) {
    var oc = ++UI.creating;
    var ui = new this();
    if (UI.creating != oc) {
        throw new Error("Cannot initialize new UI in constructor function");
    }
    --UI.creating;
    ui.init(...args);
    return ui;
} */

/** @template [T=UI] @param {Element} elem @param {new() => T} type @param {function(UI):boolean|boolean} cb @param {boolean} include_self @returns {Generator<T>} */
UI.find = function*(elem, type=UI, cb=false, include_self=false) {
    if (!type) type = UI;
    if (include_self && elem[UI.expando] && elem[UI.expando] instanceof type) yield elem[UI.expando];
    if (!elem.children) return;
    for (var c of elem.children) {
        var found = c[UI.expando] && c[UI.expando] instanceof type;
        if (found) yield c[UI.expando];
        var check = typeof cb === "function" ? cb(c[UI.expando]) : !!cb;
        if (!found || check) {
            for (var sc of UI.find(c, type, cb)) {
                yield sc;
            }
        }
    }
}

// /** @template [T=UI] @param {Element} elem @param {function(UI):boolean} cb @param {boolean} recursive @param {boolean} include_self @returns {Generator<T>} */
// UI.walk = function(elem, type=UI, cb=null, include_self=false) {
//     var r;
//     if (include_self && elem[UI.expando]) {
//         r = cb(elem[UI.expando]);
//         if (r==true) yield elem[UI.expando];
//         if (r==false) return;
//     }
//     if (!elem.children) return;
//     for (var c of elem.children) {
//         if (c[UI.expando]) {
//             r = cb(c[UI.expando]);
//             if (r==true) yield c[UI.expando];
//             if (r==false) continue;
//         }
//         for (var ui of UI.walk(c, cb)) yield ui;
//     }
// }
/** @returns {Generator<UI>} */
UI.parents = function*(elem, include_self=false) {
    if (!include_self) elem = elem.parentElement;
    while(elem) {
        if (elem[UI.expando]) yield elem[UI.expando];
        elem = elem.parentElement;
    }
}
/** @template [T=UI] @param {Element} elem @param {new() => T} type @returns {T}
 * @description Returns the closest UI element (including if the element itself matches) */
UI.closest = function(elem, type=UI) {
    for (var ui of UI.parents(elem, true)) {
        if (ui instanceof type) return ui;
    }
}

/* UI.merge_settings = function(...settings) {
    var o = {};
    for (var s of settings) {
        if (!s || typeof s !== "object") continue;
        for (var k in s) {
            let value = s[k];
            if (k === "class") {
                if (typeof value === "string") {
                    value = value.split(/\s+/).filter(s=>s);
                }
            } else if (k === "style") {
                if (typeof value === "string") {
                    value = parse_style(value);
                }
            }
            if (k in o) {
                if (utils.is_plain_object(o[k])) {
                    Object.assign(o[k], value);
                    continue;
                } else if (Array.isArray(o[k])) {
                    o[k].push(...value);
                    continue;
                }
            }
            o[k] = value;
        }
    }
    return o;
} */

/** @return {Iterable<HTMLElement>} */
var handle_els = function*(o) {
    if (Array.isArray(o)) for (var c of o) for (var c2 of handle_els(c)) yield c2;
    else if (o instanceof UI) yield o.elem;
    else if (typeof o === "string") for (var c of $(o)) yield c;
    else if (o) yield o;
}

Element.prototype.append = function(...children) {
    old_append.apply(this, [...handle_els(children)]);
}
Element.prototype.prepend = function(...children) {
    old_prepend.apply(this, [...handle_els(children)]);
}
UI.Column = class Column extends UI {
    init() {
        super.init();
        this.elem.classList.add("column");
    }
}
UI.FlexColumn = class FlexColumn extends UI {
    init() {
        super.init();
        this.elem.classList.add("flex", "column");
    }
}
UI.Row = class Row extends UI {
    init() {
        super.init();
        this.elem.classList.add("row");
    }
}
UI.FlexRow = class FlexRow extends UI {
    init() {
        super.init();
        this.elem.classList.add("flex", "row");
    }
}
UI.Separator = class Separator extends UI {
    constructor(settings) { super("<hr>", settings) }
}
UI.Label = class Label extends UI {
    constructor(content, settings) {
        super("<label></label>", {
            content,
            ...settings,
        });
    }
}

UI.Link = class Link extends UI {
    constructor(content, settings) {
        var el = $(`<a>`)[0];
        el.innerHTML = content;
        super(el, {...settings});
        this.on("update", ()=>{
            if ("href" in this.settings) this.elem.href = this.get_setting("href");
            if ("target" in this.settings) this.elem.target = this.get_setting("target");
        });
    }
}
UI.Button = class Button extends UI {
    constructor(label, settings) {
        var el = $(`<button>`)[0];
        el.innerHTML = label;
        super(el, { ...settings });
    }
    init() {
        super.init();
        this.elem.classList.add("button");
    }
}
UI.Root = class Root extends UI {
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
                    for (var ui of UI.find(node, UI, true, true)) { // [...UI.find(node, UI, true, true)]].reverse()
                        this.register(ui);
                    }
                }
                for (var node of mutation.removedNodes) {
                    for (var ui of UI.find(node, UI, true, true)) {
                        this.unregister(ui);
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
    register(ui) {
        this.unregister(ui);
        ui._parent = UI.closest(ui.elem.parentElement);
        if (ui instanceof UI.Property) {
            ui._container = UI.closest(ui.elem, UI.PropertyContainer);
            if (ui._container) ui._container._properties.add(ui);
        }
        if (ui._parent) ui._parent._children.add(ui);
        ui.__update();
        ui.__render();
        ui.emit("register");
    }
    /** @param {UI} ui */
    unregister(ui) {
        if (ui._parent) {
            ui._parent._children.delete(ui);
            ui._parent = null;
        }
        if (ui._container) {
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

UI.PropertyContainer = class PropertyContainer extends UI {
    get data() { return this.get_setting("data", this._datas[0]); }
    set data(value) {
        this._datas = [value];
    }
    get datas() { return this._datas.map(data=>this.get_setting("data", data)); }
    /** @type {object[]} */
    set datas(values) {
        if (!Array.isArray(values)) values = [values];
        this._datas = [...values];
        if (this._datas.length == 0) this._datas = [null];
    }
    get valid() { return this.properties.filter(p=>!p.hidden).every(p=>p.valid); }
    /** @type {object} */
    get property_lookup() { return Object.fromEntries(this.properties.map(p=>[p.id, p._value])); }
    /** @type {object} */
    get named_property_lookup() { return Object.fromEntries(this.properties.filter(p=>!p.is_indeterminate && p.name).map(p=>[p.name, p._value])); }
    /** @type {object} */
    get named_property_lookup_not_null() { return Object.fromEntries(Object.entries(this.named_property_lookup).filter(([k,v])=>v!==null)); }
    get properties() { return [...this.get_properties()]; }
    *get_properties() {
        if (!this._properties) return;
        for (var p of this._properties) {
            yield p;
        }
        //return UI.find(this.elem, UI.Property, (ui)=>!(ui instanceof UI.PropertyContainer));
    }
    get_properties_by_name(name) { return this.properties.filter(p=>p.name===name); }
    get_property_by_name(name) {return this.get_properties_by_name(name)[0]; }
    
    /** @type {Set<UI.Property>} */
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
        })
        this.addEventListener("property-change", ()=>{
            this.update();
        })
    }

    reset() {
        for (var p of this.get_properties()) p.reset(true);
    }

    __update() {
        for (var p of this.get_properties()) {
            if (p.settings["data"] !== undefined) {
                var values = this.datas.map(d=>p.get_setting("data", d));
                p.set_values(values);
            } else if (p.name) {
                var path = p.name.split("/").filter(p=>p);
                var values = this.datas.map(d=>{
                    if (!d) return null;
                    return utils.try(()=>utils.get(d, path));
                });
                var hash = JSON.stringify(values);
                if (p._last_values_on_property_update !== hash) {
                    p._last_values_on_property_update = hash
                    p.set_values(values);
                }
            }
        }
        super.__update();
    }
}

/** @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} Input */

UI.Property = class Property extends UI {
    get content() { return this.contents[0]; }
    get input() { return this.inputs[0]; }
    get _value() { return this._values[0]; }
    get value() { return this.iterate_values().next().value; } // this.indeterminate ? UI.Indeterminate : 
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
        var container = this.container;
        if ("data" in this.settings) return [this.get_setting("data")];
        return container ? container._datas : [null];
    }
    /** @type {UI.PropertyContainer} */
    get container() {
        return this._container;
        // return this.get_closest(UI.PropertyContainer);
    }
    get hidden() {
        return this.datas.some(item=>this.get_setting("hidden", item)); // (this.parent||{}).hidden || 
    }
    get disabled() {
        return this.datas.some(item=>this.get_setting("disabled", item)) || this.disabled_parent || !this.options_consistant;
    }
    get valid() {
        return this.inputs_valid === true;
    }
    
    /** @param {string} name @param {string} label @param {string|Element[]} contents @param {object} settings */
    constructor(name, label, contents, settings) {
        settings = {
            "setup": ()=>{
                var inputs_selector = `input,select,textarea`;
                var inputs = this.contents.map(e=>{
                    if (e.matches(inputs_selector)) return [e];
                    return Array.from(e.querySelectorAll(inputs_selector));
                }).flat();
                inputs.forEach(i=>this.setup_generic_input(i));
                return inputs;
            },
            "label": label,
            // "event":(e)=>e.type === "change",
            "placeholder": "",
            "invalid_class": "invalid",
            "default": null,
            "readonly": undefined,
            "spinner": undefined,
            "min": undefined,
            "max": undefined,
            "step": undefined,
            "round": undefined,
            "precision": undefined,
            "disabled": false,
            "reset": true,
            "hidden": false,
            "info": undefined,
            "options": undefined,
            "copy":false,
            "reset_on_dblclick": false,
            "nullify_defaults": ()=>{
                var container = this.container;
                return container ? container.get_setting("nullify_defaults") : false;
            },
            ...settings
        };

        super(null, settings);

        this.elem.classList.add("property");
        
        this._values = [null];
        /** @type {Element[]} */
        this.contents = [];
        /** @type {Input[]} */
        this.inputs = [];
        /** @type {Function(any,Input):string[]} */
        this.input_modifiers = [];
        /** @type {Function(any,Input):any[]} */
        this.output_modifiers = []; //(v,input)=>input.value=v
        /** @type {Function(any,Input):any[]} */
        this.validators = [];
        this.options_consistant = true;
        // this.values_valid = true;
        this.inputs_valid = true;
        this.name = name;
        this.name_id = `${this.name}-${this.id}`;

        this.inner = new UI();
        this.inner.elem.classList.add("property-inner");
        this.append(this.inner);
        
        contents = (typeof contents === "string") ? $(contents) : contents;
        if (!Array.isArray(contents)) contents = [contents];
        contents.forEach(e=>this.inner.append(e));
        this.contents = contents;

        var inputs = this.get_setting("setup") || [];
        if (!Array.isArray(inputs)) inputs = [inputs];
        this.inputs = inputs;

        if (this.input) {
            if (this.settings["placeholder"] === undefined) this.settings["placeholder"] = this.input.placeholder;
            if (this.settings["readonly"] ===undefined) this.settings["readonly"] = this.input.readOnly;
            if (this.settings["default"] === undefined) this.settings["default"] = this.input.value;
            if (this.settings["min"] === undefined && this.input.min) this.settings["min"] = ()=>this.apply_input_modifiers(+this.input.min);
            if (this.settings["max"] === undefined && this.input.max) this.settings["max"] = ()=>this.apply_input_modifiers(+this.input.max);
            if (this.settings["step"] === undefined && this.input.step) this.settings["step"] = ()=>this.apply_input_modifiers(+this.input.step);
        }
        if ((this.input && this.input.type === "number") || this.settings["step"] !== undefined || this.settings["precision"] !== undefined || this.settings["round"] !== undefined || this.settings["min"] !== undefined || this.settings["max"] !== undefined || this.settings["spinner"] !== undefined) {
            this.is_numeric = true;
            this.settings["step"] = this.settings["step"] || 1;
            
            if (this.settings["spinner"] !== false && this.input.type !== "range") {
                this.spinner_elem = new UI().elem;
                this.spinner_elem.classList.add("spinner");
                this.up_button = new UI.Button(`<i class="fas fa-caret-up"></i>`, {
                    "click":(e)=>this.set_values(this.value + this.get_setting("step"), {trigger_if_changed:true}),
                    "disabled":()=>this.value>=this.get_setting("max"),
                });
                this.down_button = new UI.Button(`<i class="fas fa-caret-down"></i>`, {
                    "click":(e)=>this.set_values(this.value - this.get_setting("step"), {trigger_if_changed:true}),
                    "disabled":()=>this.value<=this.get_setting("min"),
                });
                this.spinner_elem.append(this.up_button, this.down_button);
                this.inner.append(this.spinner_elem);
            }
        }
        
        var label_elem = this.elem.querySelector("label");
        if (!label_elem) {
            label_elem = $(`<label><span></span></label>`)[0];
            this.label = new UI(label_elem, {
                hidden: ()=>!this.get_setting("label", this.data),
                update: ()=>{
                    set_inner_html(this.label.elem.firstChild, this.get_setting("label", this.data));
                    var info = this.get_setting("info", this.data);
                    if (info) {
                        if (!this.info_elem) {
                            this.info_elem = $(`<span><i class="fas fa-question-circle info"></i></span>`)[0];
                            this.label.append(this.info_elem);
                            this.tooltip = new UI.Tooltip(this.info_elem);
                        }
                        this.tooltip.set_content(info);
                    }
                    if (this.info_elem) toggle_class(this.info_elem, "d-none", !info);
                }
            });
            this.prepend(this.label);
        }
        set_attribute(label_elem, "for", this.name_id);

        if (this.get_setting("copy")) {
            var copy_hide_timeout;
            var copy_tippy;
            this.copy_button = new UI.Button(`<i class="fas fa-copy"></i>`, {
                "click":(e)=>{
                    e.preventDefault();
                    this.input.select();
                    window.navigator.clipboard.writeText(this.input.value);
                    if (!copy_tippy) {
                        copy_tippy = tippy(this.input, {
                            content:"Copied!",
                            distance:0,
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
            this.inner.append(this.copy_button);

            for (let input of this.inputs) {
                input.addEventListener("mousedown",e=>{
                    input.select();
                    if (e.button == 0) e.preventDefault();
                });
            }
        }
        
        this.reset_button = new UI.Button(`<i class="fas fa-undo"></i>`, {
            "click":()=>this.reset(true),
            "title": "Reset",
            "hidden": ()=>!this.get_setting("reset"),
        });
        this.inner.append(this.reset_button);
        
        /* requestAnimationFrame(()=>{
            this.update_inputs(true);
        }); */
    }

    setup_generic_input(input) {
        set_attribute(input, "id", this.name_id);
        // set_attribute(input, "name", this.name);
        var input_events = ["change", "input"];
        input_events.forEach(ev_type=>{
            input.addEventListener(ev_type, (e,i)=>{
                if (ev_type == "input") this.emit("input", e);
                var value = get_value(input);
                value = this.apply_input_modifiers(value, input);
                this.set_value(value, {trigger_if_changed: e.type == "change"});
            });
        });
        input.addEventListener("blur", (e)=>{
            this.root.update();
        });
        input.addEventListener("focus", (e)=>{
            this.root.update();
        });

        if (input.nodeName === "INPUT") {
            input.addEventListener("keydown", (e)=>{
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.target.blur();
                }
                if (input.type !== "number" && this.is_numeric) {
                    var new_value;
                    if (e.key == "ArrowUp") new_value = this.value + this.get_setting("step");
                    else if (e.key == "ArrowDown") new_value = this.value - this.get_setting("step");
                    if (new_value !== undefined) {
                        e.stopPropagation();
                        e.preventDefault();
                        // input._force_update_value = true;
                        this.set_values(new_value, {trigger_if_changed:true});
                    }
                }
            });
        }
        input.addEventListener("dblclick", (e)=>{
            if (this.get_setting("reset_on_dblclick")) {
                this.set_values(null, {trigger_if_changed:true});
            }
        });
        
        /* Object.defineProperty(input, 'value', {
            get () { return this.get_value(); },
            set (value) { this.set_value(value, false); }
        }); */
    }

    reset(trigger=false) {
        this.set_values(null, {trigger_if_changed:trigger});
    }

    fix_value(value) {
        if (typeof(value) == "number") {
            var min = this.get_setting("min");
            var max = this.get_setting("max");
            var round = this.get_setting("round");
            var precision = this.get_setting("precision");
            if (max !== undefined) value = Math.min(value, +max);
            if (min !== undefined) value = Math.max(value, +min);
            if (round !== undefined) value = utils.round_to_factor(value, round);
            if (precision !== undefined) value = +value.toFixed(precision)
            /* if (isNaN(value)) {
                debugger;
                value = 0
            } */
        }
        return value;
    }

    /** @typedef {{trigger:boolean, trigger_if_changed:boolean}} SetValueOptions */
    /** @param {SetValueOptions} options */
    set_value(value, options) {
        return this.set_values(this.datas.map(_=>value), options);
    }

    /** @param {SetValueOptions} options */
    set_values(values, options) {
        options = Object.assign({
            trigger: false,
            trigger_if_changed: false,
        }, options);
        // console.trace(this.name, values, trigger);
        // if (!Array.isArray(values)) throw new Error("Values must be array...");
        if (!Array.isArray(values)) values = this.datas.map(item=>values);
        if (values.length != this.datas.length) {
            throw new Error(`Values length (${values.length}) mismatch datas length (${this.datas.length})...`);
        }
        values = values.map((v)=>this.fix_value(v));
        
        this._values = this.datas.map((data,i)=>{
            var default_value = this.fix_value(this.get_setting("default", data));
            if (this.nullify_defaults) return JSON.stringify(values[i]) === JSON.stringify(default_value) ? null : values[i];
            return (values[i] == null) ? default_value : values[i];
        });

        // --------------- DO NOT TOUCH ---------------
        // -------- THIS IS A DELICATE MACHINE --------

        var values_hash = JSON.stringify([this.values, this._values, options.trigger_if_changed, options.trigger]);
        var changed = values_hash !== this._last_changed_values_hash;
        if (changed) this._last_changed_values_hash = values_hash;
        var trigger = options.trigger || (options.trigger_if_changed && changed)
        if (trigger) {
            this.inputs.forEach(input=>input._force_update_value = true);
        }

        // --------------------------------------------

        this.update();

        var e = {
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
            if (container) container.emit("property-change", e);
        }
        return changed;
    }

    __update() {
        super.__update();

        var is_default = this.is_default;
        var is_indeterminate = this.is_indeterminate;
        var default_value = this.get_setting("default", this.data);
        var readonly = this.get_setting("readonly");
        var disabled = this.disabled;
        var style_not_default = !!this.get_setting("reset");

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

            options = fix_options(options);
            if (style_not_default) {
                options.forEach((o)=>{
                    if (String(o.value) === String(default_value)) o.text += " *";
                });
            }
            this.inputs.filter(e=>e.nodeName==="SELECT").forEach(e=>set_select_options(e, options));
        }
        
        var valids = [];

        this.inputs.forEach((/**@type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement}*/ input,i)=>{
            // input.disabled = disabled;
            toggle_attribute(input, "disabled", disabled===true);
            if (readonly !== undefined) {
                input.readOnly = readonly;
                // set_attribute(input, "readonly", readonly);
            }
            var is_focused = has_focus(input);
            var is_checkbox = input.nodeName === "INPUT" && input.type === "checkbox";
            
            toggle_class(input, "not-default", !is_default && style_not_default); // !is_focused && 
            
            if (is_checkbox) {
                input.indeterminate = is_indeterminate;
            }

            var value = this.value;
            if (is_indeterminate) {
                if (input.type == "color") value = "#000000";
                else value = "";
            } else {
                value = this.apply_output_modifiers(value, input);
                if (typeof value === "number" && this.settings["precision"] !== undefined) {
                    value = value.toFixed(this.get_setting("precision"));
                    if (value.includes(".")) value = value.replace(/\.?0+$/,"");
                }
            }
            // if ((input.nodeName === "INPUT" || input.nodeName === "TEXTAREA") && is_focused && !input.hasAttribute("readonly") && !input._force_update_value) {
            /* if ((input.nodeName === "INPUT" && (input.type == "date" || input.type == "time")) && is_focused) {
            } else {
            } */
            if (!is_focused || input.nodeName === "SELECT" || input._force_update_value) {
                set_value(input, value, false);
            }
            input._force_update_value = false;
            
            // set_value(input, value, false);
            
            /* if (blur) {
                input.blur();
            } */
            
            // set_attribute(input, "placeholder", placeholder);
            input.placeholder = is_indeterminate ? "Multiple values" : this.get_setting("placeholder");

            var title = is_indeterminate ? "Multiple values" : this.get_setting("title") || "";
            if (title) set_attribute(input, "title", title);
            else remove_attribute(input, "title");
            
            var valid = disabled || is_indeterminate || (()=>{
                for (var validator of this.validators) {
                    valid = validator.apply(this, [this.value, input])
                    if (valid !== true) return valid;
                }
                return true;
            })();
            valids.push(valid);
            
            var invalid_class = this.get_setting("invalid_class");
            if (invalid_class) toggle_class(input, invalid_class, valid !== true);

            if (valid === false) valid = "Invalid input";
            if (input._last_valid !== valid) {
                if (typeof valid === "string") {
                    if (!input._tooltip) new UI.Tooltip(input);
                    input._tooltip.set_content(valid);
                } else {
                    if (input._tooltip) input._tooltip.destroy();
                }
                input._last_valid = valid;
            }
        });
        
        this.inputs_valid = valids.every(v=>v===true);
    }

    add_validator(...cb) {
        this.validators.push(...cb);
    }

    apply_input_modifiers(v, input) {
        for (var m of this.input_modifiers) {
            v = m.apply(this,[v,input]);
        }
        return v;
    }

    apply_output_modifiers(v, input) {
        var v;
        for (var m of this.output_modifiers) {
            v = m.apply(this,[v,input]);
            if (v === undefined) return;
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
UI.MultiProperty = class MultiProperty extends UI.Property {
    constructor(name, label, contents, settings) {
        super(name, label, contents, settings);
        this.input_modifiers.push((value,input)=>{
            if (Array.isArray(this.value)) {
                var i = this.inputs.indexOf(input);
                var v = [...this.value];
                v[i] = value;
            }
            return v;
        });
        this.output_modifiers.push((value,input)=>{
            if (Array.isArray(this.value)) {
                var i = this.inputs.indexOf(input);
                value = value[i];
            }
            return value;
        });
    }
}
UI.DateTimeProperty = class DateTimeProperty extends UI.Property {
    get today_str() { return new Date().toISOString().split("T")[0]; }

    constructor(name, label, settings = {}) {
        var inputs = $(`<input type="date"><input type="time">`);
        
        var get_value = ()=>{
            var values = inputs.map(i=>i.value);
            if (values.every(v=>v==="")) return NaN;
            if (!values[0]) values[0] = this.today_str
            if (!values[1]) values[1] = "00:00";
            return utils.join_datetime(values, this.get_setting("datetime.apply_timezone"));
        }

        super(name, label, inputs, Object.assign({
            "datetime.apply_timezone": true,
            "default": null,
            "setup": ()=>{
                inputs.forEach(input=>{
                    input.addEventListener("blur",(e)=>{
                        var value = get_value();
                        if (!isNaN(value)) {
                            this.set_value(value, {trigger_if_changed:true});
                        }
                    });
                    input.addEventListener("keydown",(e)=>{
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.target.blur();
                            if (e.target === inputs[0]) inputs[1].focus();
                        }
                    });
                });
                return inputs;
            },
        }, settings));
        
        this.add_validator((_,input)=>{
            if (this.get_setting("datetime.after_now")) {
                // inputs[0].min = utils.split_datetime(new Date())[0];
                if (!input.value) return true;
                var before_now = get_value() < Math.floor(new Date()/1000)*1000;
                var before_today = new Date(inputs[0].value) < new Date(this.today_str);
                if (before_today && input === inputs[0]) return "Scheduled date is in the past.";
                else if (!before_today && before_now && input === inputs[1]) return "Scheduled time is in the past.";
                return true;
            }
        });

        this.output_modifiers.push((value,input)=>{
            // if (isNaN(get_value()) && !v) return;
            var parts = ["",""];
            if (value) {
                parts = utils.split_datetime(value, this.get_setting("datetime.apply_timezone"));
            }
            if (input === inputs[0]) {
                return parts[0];
            } else {
                return parts[1].slice(0,5);
            }
        });
    }
}
UI.TimeSpanProperty = class TimeSpanProperty extends UI.Property {
    constructor(name, label, settings = {}) {
        var input = $(`<input type="text">`)[0];
        super(name, label, input, Object.assign({
            "timespan.format": "hh:mm:ss",
            "timespan.zero_infinity": false,
            "step": 1.0,
            "min-step": 0.001,
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
UI.TextArea = class TextArea extends UI.Property {
    constructor(name, label, settings = {}) {
        var input = $(`<textarea style="resize:none"></textarea>`)[0];
        super(name, label, input, Object.assign({
            "default": "",
            "textarea.rows": 4,
            "textarea.min_rows": null,
            "textarea.return_blur": false,
        }, settings));
        /** @type {AutoSizeController} */
        var asc;
        var rows = this.get_setting("textarea.rows");
        var min_rows = this.get_setting("textarea.min_rows");
        if (min_rows) {
            asc = new AutoSizeController(input, min_rows, false);
        } else if (rows) {
            this.input.rows = rows;
        }
        var max_length = this.get_setting("textarea.max_length");
        if (max_length) input.maxLength = max_length;
        if (this.get_setting("textarea.show_count")) {
            textarea_input_events.forEach(ev=>input.addEventListener(ev, ()=>this.update_char_count()));
            this.char_count = $(`<div style="text-align:right"></div>`)[0];
            this.append(this.char_count);
            this.update_char_count();
        }
        input.addEventListener("keydown", (e)=>{
            if (e.key == "Enter") {
                if (this.get_setting("textarea.return_blur")) {
                    e.preventDefault();
                    input.blur();
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

UI.Tooltip = class {
    constructor(elem, content){
        this._tippy = tippy(elem, {
            allowHTML:true,
            zIndex:99999,
            // appendTo: root,
        });
        this.elem = elem;
        if (content) this.set_content(content);
        elem._tooltip = this;
    }
    set_content(content) {
        if (this._content === content) return;
        this._content = content;
        this._tippy.setContent(content);
    }
    destroy() {
        if (!this._tippy) return;
        this._tippy.destroy();
        this._tippy = null;
        this.elem._tooltip = null;
    }
};

UI.VALIDATORS = {
    not_empty: (v)=>!!v||"Field cannot be empty",
    rtmp: (v)=>utils.is_valid_rtmp_url(v)||"Invalid RTMP URL",
    url: (v)=>utils.is_valid_url(v)||"Invalid URL",
    json: (v)=>{
        try { JSON.parse(v); return true; } catch { return false; }
    },
};

export {
    WebSocket2 as WebSocket,
    LocalStorageBucket,
    UI,
    AutoSizeController,
    TouchListener,
}

export function is_visible(elem) {
    if (!elem.isConnected) return false;
    if (elem.offsetHeight === 0 && elem.offsetWidth === 0) return false;
    return true;
    /* if (!elem.ownerDocument) return false;
    while(elem) {
        if (getComputedStyle(elem).display === "none") return false;
        elem = elem.parentElement;
    }
    return true; */
}
export function select_text(elem) {
    elem.focus();
    var range = elem.ownerDocument.createRange();
    range.selectNodeContents(elem);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}
export function fetch(url) {
    return new Promise((resolve)=>{
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                resolve(xhr.responseText);
            }
        };
        xhr.open("GET", url, true);
        xhr.send();
    });
}
export function parse_style(s) {
    set_attribute(_div2, "style", s);
    var d = {};
    for (var i = 0; i < _div2.style.length; i++) {
        var k = _div2.style[i];
        d[k] = _div2.style.getPropertyValue(k);
    }
    return d;
}
export function clone_document_head(from, to, opts) {
    opts = Object.assign({
        style:true,
        script:false,
        other:true,
        remove_media_rules: true,
    }, opts);
    var promises = [];
    if (from instanceof Document) from = from.head;
    for (let c of from.children) {
        var is_stylesheet = (c.nodeName === "LINK" && c.rel === "stylesheet");
        if (c.nodeName === "SCRIPT") {
            if (!opts.script) continue;
        } else if (is_stylesheet || c.nodeName === "STYLE") {
            if (!opts.style) continue;
        } else {
            if (!opts.other) continue;
        }

        let clone = c.cloneNode(true);
        to.append(clone);

        if (is_stylesheet && opts.remove_media_rules) {
            var promise = on_stylesheet_load(clone);
            promise.then((ss)=>{
                // order.push([new Date()-t, clone, ss]);
                var rules = [];
                try { rules = ss.cssRules; } catch { }
                if (!rules) return;
                for (var j = rules.length-1; j >= 0; j--) {
                    if (rules[j].cssText.indexOf('@media') === 0) {
                        ss.deleteRule(j);
                    }
                }
            });
            promises.push(promise);
        }
    }
    return Promise.all(promises)
}
/* copy_stylesheets: async function(from, to, remove_media_queries = false) {
    if (from.ownerDocument === to.ownerDocument) {
        console.log(`copy_stylesheets: both ownerDocuments identical.`);
        return;
    }
    var style_nodes = new Set();
    function add_style(elem) {
        if (typeof elem === "string") elem = $(elem)[0];
        style_nodes.add(elem);
        to.append(elem);
    }
    var remote_stylesheets = 0;
    // var promises = [];
    for (let e of from.querySelectorAll("*")) {
        if (e instanceof HTMLStyleElement || (e instanceof HTMLLinkElement && e.rel === "stylesheet")) {
            // var cloneable = true;
            // try { var test_access = (e.sheet && e.sheet.cssRules) } catch { cloneable = false; }
            // if (cloneable) {
            //     add_style(e.cloneNode(true));
            // } else {
            //     var p = fetch(e.href).then((css)=>{
            //         add_style(`<style type=${e.type} media=${e.media}>${css}</style>`);
            //     });
            //     promises.push(p);
            // }
            if (e.href) {
                var href = e.href;
                if (href.startsWith("//")) href = "https:"+href
                else if (href.startsWith("/")) href = location.origin+href;
                try {
                    var url = new URL(href);
                    if (url.host !== location.host) remote_stylesheets++;
                } catch {}
            }
            add_style(e.cloneNode(true));
        }
    }
    var num_stylesheets = style_nodes.size - remote_stylesheets;
    // await Promise.all(promises);
    
    return new Promise((resolve)=>{
        var check_interval = setInterval(()=>{
            for (var ss of to.ownerDocument.styleSheets) {
                if (!style_nodes.has(ss.ownerNode)) continue;
                style_nodes.delete(ss.ownerNode);
                try {
                    if (!ss.cssRules) continue;
                } catch {
                    continue;
                }
                if (remove_media_queries) {
                    for (var j = ss.cssRules.length-1; j >= 0; j--) {
                        if (ss.cssRules[j].cssText.indexOf('@media') === 0) {
                            ss.deleteRule(j);
                        }
                    }
                }
            }
            if (style_nodes.size === 0 || to.ownerDocument.styleSheets.length >= num_stylesheets) {
                clearInterval(check_interval);
                resolve();
            }
        }, 1000/20);
    });
}, */
// get_all_css(from, ignore_media_queries = false) {
//     var document = from instanceof Document ? from : from.ownerDocument;
//     var rules = [];
//     for (ss of document.styleSheets) {
//         rules.push(`/* ------------- ${ss.href||"Local StyleSheet"} ------------- */`)
//         try {
//             var test = ss.cssRules;
//         } catch {
//             continue;
//         }
//         for (var i = 0; i < ss.cssRules.length; i++) {
//             var css = ss.cssRules[i].cssText;
//             if (ignore_media_queries && css.indexOf('@media') === 0) continue;
//             css.replace(/url\(\"(.+?)\"\)/g, (...m)=>{
//                 if (m[1].match(/^(?:data\:|#|https?\:\/\/|\/)/)) return m[0];
//                 var url = utils.join_paths(utils.dirname(ss.href), m[1]);
//                 return `url("${url}")`
//             })
//             rules.push(css);
//         }
//         rules.push(`/* ------------- END ------------- */`)
//     }
//     return rules.join("\n");
// },
export function insert_at(container, element, index) {
    if (container.children[index] === element) return;
    index = Math.max(index, 0)
    if (index === 0) {
        container.prepend(element);
    } else {
        var after = container.children[index];
        if (after) container.insertBefore(element, after);
        else container.append(element);
    }
}
export function insert_after(target, elem) {
    var parent = target.parentNode;
    if (parent.lastChild === target) {
        parent.appendChild(elem);
    } else {
        parent.insertBefore(elem, target.nextSibling);
    }
}
export function move(elem, i=1) {
    if (i == 0) return;
    var children = [...elem.parentElement.children];
    var index = children.indexOf(elem);
    if (i > 0) index+=1;
    insert_at(elem.parentElement, elem, index + i);
}
export function upload(contentType, multiple=false) {
    return new Promise(resolve=>{
        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        input.accept = contentType;
        input.onchange = () => {
            let files = [...input.files];
            if (multiple) resolve(files);
            else resolve(files[0]);
        };
        input.click();
    });
}
export function download(filename, text) {
    var element = document.createElement('a');
    element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    element.download = filename;
    element.click();
}
/** @typedef {{multiple:boolean, accept:string, directories:boolean}} FileDialogOptions */
/** @return {File[]} @param {FileDialogOptions} opts */
export function open_file_dialog(opts) {
    opts = Object.assign({}, opts);
    return new Promise((resolve)=>{
        var element = document.createElement("input");
        element.style.display = 'none';
        element.type = "file";
        if (opts.accept) element.accept = opts.accept;
        if (opts.multiple) element.multiple = true;
        if (opts.directories) element.webkitdirectory = true;
        document.body.appendChild(element);
        element.addEventListener("change", function(){
            resolve([...this.files]);
        })
        element.dispatchEvent(new MouseEvent("click")); 
        document.body.removeChild(element);
    });
}
/** @param {Element} elem */
export function empty(elem) {
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}
/** @param {HTMLSelectElement} select */
export function set_select_options(select, options) {
    // if (!Array.isArray(settings)) Object.entries(settings);
    options = fix_options(options)
    var hash = JSON.stringify(options);
    if (hash === select._options_hash) return;
    select._options_hash = hash;
    select.innerHTML = "";
    
    return options.map(o=>{
        /** @type {HTMLOptionElement} */
        var e = $(`<option></option>`)[0];
        e.innerHTML = o.text;
        if (o.disabled) e.disabled = true;
        if (o.selected) e.selected = true;
        if (o.hidden) e.hidden = true;
        if (o.class) o.class.forEach(c=>e.classList.add(c))
        if (o.style) Object.assign(e.style, o.style);
        if (o.value !== undefined) {
            e.value = o.value;
            e.dataset.value = JSON.stringify(o.value);
        }
        select.append(e);
        return e;
    });
}
export function fix_options(options) {
    return options.map(o=>{
        if (Array.isArray(o)) {
            var i = 0, new_o = {};
            for (var i = 0; i < o.length; i++) {
                if (typeof o[i] === "object" && o[i] !== null) Object.assign(new_o, o[i]);
                else if (new_o.value === undefined) [new_o.value, new_o.text] = [o[i],o[i]];
                else new_o.text = String(o[i]);
            }
            return new_o;
        } else if (typeof o === "object" && o !== null) {
            if (o.name && !o.text) {
                o.text = o.name;
                delete o.name;
            }
            return o;
        } else return {value:o, text:String(o)};
    });
}
export function read_file(file, options) {
    options = Object.assign({
        encoding:"utf-8",
    }, options)
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.addEventListener('load', (e)=>{
            resolve(e.target.result);
        });
        reader.readAsText(file, options.encoding);
    });
}
export function render_html(htmlString) {
    if (typeof htmlString !== "string") return null;
    _temp_div.innerHTML = htmlString.trim();
    return Array.from(_temp_div.childNodes);
}
export function get_value(elem) {
    if (elem.type === "checkbox") {
        return elem.checked;
    } else if (elem.nodeName === "SELECT") {
        var option = [...elem.children].find(e=>e.value == elem.value)
        if (option && option.dataset.value !== undefined) return JSON.parse(option.dataset.value);
        else return elem.value;
    } else if (["number","range"].includes(elem.type)) {
        return parseFloat(elem.value) || 0;
    } else {
        return elem.value;
    }
}
// sets value and triggers change (only if value is different to previous value)
export function set_value(elem, new_value, trigger_change = false) {
    // var curr_val = get_value(elem);
    // if (curr_val === val) return;
    if (elem.type === "checkbox") {
        new_value = !!new_value;
        if (elem.checked === new_value) return false;
        elem.checked = !!new_value;
    } else {
        if (elem.nodeName === "SELECT") {
            var json = JSON.stringify(new_value);
            var option = [...elem.children].find(e=>e.dataset.value == json);
            if (option) new_value = option.value;
            else new_value = "";
        }
        if (new_value === null || new_value === undefined) {
            new_value = "";
        } else {
            new_value = String(new_value)
        }
        var old_value = elem.value;
        if (old_value === new_value) return false;
        var position = elem.selectionStart;
        elem.value = new_value;
        if (position !== undefined && elem.selectionEnd != null) elem.selectionEnd = position;
    }
    if (trigger_change) elem.dispatchEvent(new Event("change"));
    return true;
}
export function get_index(element) {
    if (!element.parentNode) return -1;
    return Array.from(element.parentNode.children).indexOf(element);
}
/** @template T @param {{selector:string, auto_insert:boolean, remove:function(Element):void, add:function(T,Element,Number):Element }} opts @param {T[]} items */
export function rebuild(container, items, opts) {
    if (!opts) opts = {};
    opts = Object.assign({
        selector: ":scope>*",
        auto_insert: true,
        remove:(elem)=>elem.remove(),
        add:(elem)=>{},
        id_callback: null
    }, opts);
    var orig_elems = Array.from(container.querySelectorAll(opts.selector));
    var leftovers = new Set(orig_elems);
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var id = opts.id_callback ? opts.id_callback.apply(item, [item]) : item.id;
        var elem = orig_elems.find(e=>e.dataset.id == id);
        elem = opts.add(item, elem, i) || elem;
        elem.dataset.id = id;
        if (opts.auto_insert) {
            insert_at(container, elem, i);
        }
        leftovers.delete(elem);
    }
    for (var elem of leftovers) {
        if (opts.remove) opts.remove(elem);
        else elem.remove();
    }
}

export function is_html(str) {
    _temp_div.innerHTML = str;
    for (var c = _temp_div.childNodes, i = c.length; i--;) {
        if (c[i].nodeType == 1) return true; 
    }
    return false;
}

export function restart_animation(elem) {
    var parent = elem.parentElement;
    var i = get_index(elem);
    if (parent) {
        elem.remove();
        insert_at(parent, elem, i);
    }
}

export function build_table(datas, opts) {
    opts = Object.assign({
        header: true,
        empty: "No Data"
    }, opts);
    var thead = "";
    var header = opts.header;
    if (typeof header == "boolean") {
        if (datas.length) header = Object.fromEntries(Object.keys(datas[0]).map(k=>[k,k]));
        else header = {};
    }
    header = Object.fromEntries(Object.entries(header).map(([k,h])=>[k,(typeof h === "string")?{name:h}:h]));
    thead = `<thead><tr>${Object.values(header).map((h)=>`<th style="${h.style||""}">${h.name}</th>`).join("")}</tr></thead>`;
    var tbody = `<tbody>${datas.length?datas.map(d=>`<tr>${Object.keys(header).map((k)=>`<td style="${header[k].style||""}">${d[k]}</td>`).join("")}</tr>`).join(""):`<td colspan="${Object.keys(header).length}" style="text-align:center">${opts.empty}</td>`}</tbody>`;
    var html = `<table>${thead}${tbody}</table>`;
    return $(html)[0];
}

export function scroll_y_percent(e, v) {
    if (v === undefined) {
        var y = e.scrollTop / (e.scrollHeight - e.clientHeight);
        return isNaN(y)?1:y;
    } else {
        e.scrollTop = (e.scrollHeight - e.clientHeight) * v;
    }
}
export function scroll_pos_from_bottom(e, v) {
    if (v === undefined) {
        return e.scrollHeight - e.clientHeight - e.scrollTop;
    } else {
        e.scrollTop = e.scrollHeight - e.clientHeight - v;
    }
}
/* scroll_into_view(e) {
    var p = e.parentElement;
    if ((e.offsetTop + e.offsetHeight) < p.scrollTop) p.scrollTop = e.offsetTop;
    else if (e.offsetTop > (p.scrollTop + p.offsetHeight)) p.scrollTop = e.offsetTop + e.offsetHeight - p.offsetHeight;
}, */
/** @param {Element} el @param {{block_offset:number, inline_offset:number, block:ScrollLogicalPosition, inline:ScrollLogicalPosition, behavior:ScrollBehavior }} options */
export function scroll_to(container, el, options) {
    var {block_offset,inline_offset,block,inline,behavior} = options;
    var rect = el.getBoundingClientRect();
    if (!block && !inline) block = "start";
    if (block && rect.height == 0) return;
    if (inline && rect.width == 0) return;
    var scroll_opts = {
        block,
        inline,
        behavior
    };
    if (block) {
        let offset = rect.top - (block_offset || 0);
        if (block == "nearest" && utils.nearest(0,rect.top, rect.bottom) == rect.bottom) block = "end";
        if (block == 'center') {
            let space = window.innerHeight - offset;
            if (rect.height < space) offset -= (space - rect.height) / 2;
        } else if (block == "end") {
            offset -= rect.height;
        }
        scroll_opts.top = offset;
    }
    if (inline) {
        let offset = rect.left - (inline_offset || 0);
        if (block == "nearest" && utils.nearest(0,rect.left, rect.right) == rect.right) block = "end";
        if (block == 'center') {
            let space = window.innerWidth - offset;
            if (rect.width < space) offset -= (space - rect.width) / 2;
        } else if (block == "end") {
            offset -= rect.width;
        }
        scroll_opts.left = offset;
    }
    container.scrollBy(scroll_opts);
}
/** @param {Element} elem */
export function set_text(elem, text) {
    text = String(text);
    if (elem.textContent != text) elem.textContent = text;
}
// const inner_html_prop = "__inner_html_"+utils.random_string(8);
/** @param {Element} elem */
export function set_inner_html(elem, html) {
    if (Array.isArray(html)) {
        set_children(elem, html);
    } else if (html instanceof Element) {
        if (elem.children[0] !== html) elem.prepend(html);
        for (var i = 1; i<elem.children.length; i++) elem.children[i].remove();
    } else {
        if (elem.innerHTML !== html) {
            elem.innerHTML = html
        }
        // if (elem[inner_html_prop] !== html) {
        //     elem[inner_html_prop] = elem.innerHTML = html;
        // }
        // _temp_div.innerHTML = html; // ugh. Needed for entities like & and whatnot
        // if (elem.innerHTML !== _temp_div.innerHTML) {
        //     elem.innerHTML = html;
        // }
    }
}
/** @param {Element} elem */
export function set_children(elem, new_children) {
    var children = [...elem.children];
    if (children.length && children.every((e,i)=>e === new_children[i])) return;
    elem.replaceChildren(...new_children);
}
export function encode_html_entities(str) {
    return String(str).replace(/[\u00A0-\u9999<>\&]/gim, (i)=>{
        return `&#${i.charCodeAt(0)};`;
    });
}
export function decode_html_entities(str) {
    return String(str).replace(/&#\d+;/gm, (s)=>{
        return String.fromCharCode(s.match(/\d+/)[0]);
    })
}
/** @param {Element} elem */
export function toggle_class(elem, clazz, value) {
    if (elem.classList.contains(clazz) != value) {
        elem.classList.toggle(clazz, value);
    }
}
/** @param {Element} elem */
export function add_class(elem, clazz) {
    if (!elem.classList.contains(clazz)) elem.classList.add(clazz)
}
/** @param {Element} elem */
export function remove_class(elem, clazz) {
    if (elem.classList.contains(clazz)) elem.classList.remove(clazz)
}
/** @param {Element} elem */
export function set_attribute(elem, attr, value) {
    if (elem.getAttribute(attr) != value) {
        elem.setAttribute(attr, value);
    }
}
/** @param {Element} elem */
export function remove_attribute(elem, attr) {
    if (elem.hasAttribute(attr)) elem.removeAttribute(attr);
}
/** @param {Element} elem */
export function toggle_attribute(elem, attr, value) {
    if (elem.hasAttribute(attr) != value) {
        elem.toggleAttribute(attr, value);
    }
}
/** @param {Element} elem */
export function toggle_display(elem, value) {
    if (elem.style.display === "none" && value) elem.style.display = "";
    else if (!value) elem.style.display = "none";
    else elem.style.display = value;
}
/** @param {HTMLElement} elem */
export function set_style_property(elem, prop, value) {
    if (elem.style.getPropertyValue(prop) != value) {
        elem.style.setProperty(prop, value);
    }
}
/** @param {HTMLElement} elem */
export function remove_style_property(elem, prop, value) {
    if (elem.style.getPropertyValue(prop) !== "") {
        elem.style.removeProperty(prop);
    }
}
/** @param {HTMLElement} elem */
export function update_style_properties(elem, props) {
    for (var k in props) {
        if (props[k]) set_style_property(elem, k, props[k]);
        else remove_style_property(elem, k);
    }
}
export function escape_html_entities(text) {
    return text.replace(/[\u00A0-\u2666<>\&]/g, (c)=>{
        return '&' + (entity_table[c.charCodeAt(0)] || '#'+c.charCodeAt(0)) + ';';
    });
}
export function on_click_and_hold(elem, callback) {
    var delay = 0;
    var next_time = 0;
    var is_down = false;
    elem.addEventListener("mousedown", function(e){
        next_time = 0;
        delay = 250;
        handleMouseDown(e);
    });
    document.addEventListener("mouseup", function(e){
        handleMouseUp(e);
    });
    function handleMouseDown(e){
        e.preventDefault();
        e.stopPropagation();
        is_down = true;
        requestAnimationFrame(watcher);
    }
    function handleMouseUp(e){
        e.preventDefault();
        e.stopPropagation();
        is_down = false;
    }
    function watcher(time) {
        if (!is_down) return;
        if (time > next_time) {
            next_time = time + delay;
            delay = Math.max(50, delay-50);
            callback.apply(elem);
        }
        requestAnimationFrame(watcher);
    }
}
/** @param {HTMLSelectElement} elem */
export function cycle_select(elem, trigger_change = false) {
    var value = elem.value;
    var options = Array.from(elem.options);
    var i = 0;
    for (; i < options.length; i++) {
        if (options[i].value == value) {
            i++;
            break;
        }
    }
    elem.value = options[i % options.length].value;
    if (trigger_change) elem.dispatchEvent(new Event("change"));
}
/** @return {Window} */
export function get_owner_window(node) {
    var doc = node.ownerDocument;
    return (doc.defaultView) ? doc.defaultView : doc.parentWindow;
}

// for textareas only
export function autosize(elem, min_rows = 3) {
    // var nearest_scrollable = closest(elem, (e)=>is_scrollbar_visible(e));
    // var scroll = [];
    // if (nearest_scrollable) {
    //     scroll = [nearest_scrollable.scrollLeft, nearest_scrollable.scrollTop];
    // }
    set_attribute(elem, "rows", min_rows);
    elem.style.resize = "none";
    var style = getComputedStyle(elem, null);
    var heightOffset;
    if (style.boxSizing === 'content-box') {
        heightOffset = -(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
    } else {
        heightOffset = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }
    // Fix when a textarea is not on document body and heightOffset is Not a Number
    if (isNaN(heightOffset)) {
        heightOffset = 0;
    }
    elem.style.overflow = "hidden";
    elem.style.height = "auto";
    var h = Math.max(18 * min_rows, elem.scrollHeight) + heightOffset;
    if (h) elem.style.height = `${h}px`;

    // if (nearest_scrollable) {
    //     nearest_scrollable.scrollTo(...scroll);
    // }
}

export function has_focus(el, ancestors=false) {
    var active = el.getRootNode().activeElement;
    if (!ancestors) return active === el;
    return closest(el, (e)=>e===active);
}

export function has_touch_screen() {
    if ("maxTouchPoints" in window.navigator) {
        return window.navigator.maxTouchPoints > 0;
    } else if ("msMaxTouchPoints" in window.navigator) {
        return window.navigator.msMaxTouchPoints > 0;
    } else {
        var mQ = window.matchMedia && window.matchMedia("(pointer:coarse)");
        if (mQ && mQ.media === "(pointer:coarse)") {
            return !!mQ.matches;
        } else if ('orientation' in window) {
            return true; // deprecated, but good fallback
        } else {
            // Only as a last resort, fall back to user agent sniffing
            var UA = window.navigator.userAgent;
            return /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) || /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
        }
    }
}

export function get_top_position(el) {
    const { top } = el.getBoundingClientRect();
    const { marginTop } = window.getComputedStyle(el);
    return top - parseInt(marginTop, 10);
}

export function detect_wrapped_elements(parent, opts) {
    opts = Object.assign({
        isChildrenWrappedClassName:"is-wrapped",
        isSiblingWrappedClassName:"sibling-is-wrapped",
        isSelfWrappedClassName:"self-is-wrapped",
        nextIsWrappedClassName:"next-is-wrapped",
    }, opts);
    var any_wrapping = false;
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        const prev = parent.children[i-1];
        const top = get_top_position(child);
        const prevTop = prev ? get_top_position(prev) : top;
        var is_wrapped = top > prevTop;
        toggle_class(child, opts.isSelfWrappedClassName, is_wrapped);
        if (prev) toggle_class(prev, opts.nextIsWrappedClassName, is_wrapped);
        if (is_wrapped) any_wrapping = true;
    }
    toggle_class(parent, opts.isChildrenWrappedClassName, any_wrapping);
    [...parent.children].forEach(e=>{
        toggle_class(e, opts.isSiblingWrappedClassName, !e.classList.contains(opts.isSelfWrappedClassName) && any_wrapping)
    });
}

export function load_image(src) {
    var on_resolve, on_reject, img = new Image();
    return new Promise((resolve,reject)=>{
        img.src = src;
        img.addEventListener("load",on_resolve=()=>resolve(img));
        img.addEventListener("error",on_reject=()=>reject());
    }).finally(()=>{
        img.removeEventListener("load",on_resolve);
        img.removeEventListener("error",on_reject);
    })
}

export async function on_stylesheet_load(elem) {
    var href = elem.href;
    if (href.startsWith("//")) href = location.protocol+href;
    else if (href.startsWith("/")) href = location.origin+href;
    if (elem.nodeName === "LINK" && elem.sheet) return true;
    var check_interval, resolve, i=0;
    function check() {
        if (elem.sheet || ++i >= 100) return resolve(elem.sheet);
        for (var ss of elem.ownerDocument.styleSheets) {
            if (ss.href === href) return resolve(ss);
        }
    }
    return new Promise((_resolve)=>{
        resolve = ()=>_resolve(elem.sheet);
        elem.addEventListener("load", resolve);
        check_interval = setInterval(check, 100);
        // setTimeout(check, 1);
    }).then((ss)=>{
        clearInterval(check_interval);
        elem.removeEventListener("load", resolve);
        return ss;
    });
}

export function closest(elem, delegate) {
    var p = elem;
    while (p) {
        var r = delegate.apply(p, [p]);
        if (r) return p;
        p = p.parentElement;
    }
}

export function is_scrollbar_visible(elem) {
    var doc = elem.ownerDocument
    var win = doc.defaultView || doc.parentWindow;
    var scroll_lookup = {auto:true, scroll:true, visible:false, hidden:false};
    var styles = win.getComputedStyle(elem, null);
    var overflow_x = scroll_lookup[styles.overflowX.toLowerCase()] || false;
    var overflow_y = scroll_lookup[styles.overflowY.toLowerCase()] || false;
    return overflow_x || overflow_y;
}

/** @template T @param {function():T} func @return {Promise<T>} */
export function debounce_next_frame(func) {
    var timeout_id, args, context, promise, resolve;
    var later = ()=>{
        resolve(func.apply(context, args));
        promise = null;
    };
    var debounced = function(...p) {
        context = this;
        args = p;
		return promise = promise || new Promise(r=>{
            resolve = r;
            timeout_id = requestAnimationFrame(later);
        });
    };
    debounced.cancel = ()=>{
        cancelAnimationFrame(timeout_id);
        promise = null;
    };
    return debounced;
}
export function uuid4() {
    return `${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`.replace(/[018]/g, c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
}

export function uuidb64() {
    return btoa(uuid4());
}
// ignores text elements and whitespace
/** @param {Element} dst @param {Element} src */
export function sync_attributes(dst,src) {
    for (var attr of src.attributes) {
        if (src.getAttribute(attr.name) !== dst.getAttribute(attr.name)) set_attribute(dst, attr.name, attr.value);
    }
    for (var attr of dst.attributes) {
        if (!src.hasAttribute(attr.name)) remove_attribute(dst, attr.name);
    }
}
// ignores text elements and whitespace
/** @param {Element} dst @param {Element} src */
export function sync_dom(dst,src, opts) {
    opts = Object.assign({
        attrs: true
    }, opts);
    if (!(src && dst && src.nodeName === dst.nodeName)) throw new Error("src and dst must match nodeName to sync");
    if (opts.attrs) {
        sync_attributes(dst, src);
    }
    if (src.children.length == 0 && dst.children.length == 0) {
        set_inner_html(dst, src.innerHTML);
        return;
    }
    var get_id = (el)=>opts.get_id ? opts.get_id(el) : el.getAttribute("data-id") || el.id;
    var dst_children = [...dst.children];
    var i;
    for (i = 0; i < src.children.length; i++) {
        var src_c = src.children[i];
        var src_id = get_id(src_c);
        if (src_id) {
            var dst_c_index = dst_children.findIndex(c=>get_id(c) === src_id);
            if (dst_c_index != -1 && dst_c_index != i) {
                dst_children.splice(i, 0, dst_children.splice(dst_c_index, 1));
            }
        }
        var dst_c = dst_children[i];
        var same = src_c && dst_c && src_c.nodeName === dst_c.nodeName;
        if (!same) {
            if (dst_c) {
                dst_c.remove();
                dst_c = null;
            }
            if (src_c) dst_c = src_c.cloneNode(true);
        }
        if (dst_c) {
            if (!dst.children[i]) dst.append(dst_c);
            else if (dst.children[i] !== dst_c) dst.children[i].before(dst_c);
        }
        if (same) {
            sync_dom(dst_c, src_c);
        }
    }
    var leftovers = [...dst.children].slice(i);
    for (var dst_c of leftovers) {
        dst_c.remove();
    }
}
/* sync_contents(dst, src_children_or_inner_html) {
    if (typeof src_children_or_inner_html === "string") {
        set_inner_html(dst, src_children_or_inner_html);
        return;
    }
    var src_children = src_children_or_inner_html;
    if (!Array.isArray(src_children)) src_children = [src_children];
    for (var i=0; i<src_children.length; i++) {
        var dst_c = dst.children[i];
        var src_c = src_children[i];
        if (dst_c && src_c && dst_c.nodeName === src_c.nodeName) {
            sync_dom(dst_c, src_c);
        } else {
            if (dst_c) {
                dst_c.before(src_c);
                dst_c.remove();
            } else {
                dst.append(src_c);
            }
        }
    }
    var leftovers = [...dst.children].slice(i);
    for (var e of leftovers) {
        e.remove();
    }
} */

/** @param {Element} el */
export function get_anchor_same_origin_hash(el) {
    var url = get_anchor_url(el);
    if (url && (url.origin+url.pathname) === (window.location.origin+window.location.pathname) && url.hash) return url.hash;
}

/** @param {Element} el */
export function get_anchor_url(el) {
    if (!el.matches("a")) return;
    /** @type {HTMLAnchorElement} */
    var anchor = el;
    return utils.try(()=>new URL(anchor.href))
}

/** @param {Element} el */
export function reset_style(el) {
    var props = [];
    for (var i = 0; i < el.style.length; i++) props[i] = el.style[i];
    for (var k of props) {
        el.style[k] = "";
    }
}

export class WindowCommunicator {
    id = 0;
    requests = {};
    handlers = {};
    #on_message;
    /** @param {Window} _window */
    constructor(_window) {
        this.window = _window = _window || window;
        _window.addEventListener("message", this.#on_message = async(e)=>{
            if (e.data.event === "request") {
                var {request, data, id} = e.data;
                var response;
                if (this.handlers[request]) {
                    await Promise.resolve(this.handlers[request](data, e.source)).then(r=>response=r);
                    if (response !== undefined) {
                        var payload = {event:"response", response, id};
                        e.source.postMessage(payload, "*");
                    }
                }
            } else if (e.data.event === "response") {
                // console.log(e.data)
                var {id, response} = e.data;
                if (id in this.requests) {
                    this.requests[id](response);
                    delete this.requests[id];
                }
            }
        });
    }
    /** @param {string} request @param {function(any,Window):any} handler */
    on(request, handler) {
        this.handlers[request] = handler;
    }
    /** @param {Window} window */
    request(window, request, data, timeout = 10000) {
        var id = ++this.id;
        var payload = {event:"request", request, data, id};
        return new Promise((resolve, reject)=>{
            this.requests[id] = (response)=>{
                resolve(response);
            };
            window.postMessage(payload, "*");
            setTimeout(()=>reject(`WindowCommunicator request ${id} timed out`), timeout);
        }).catch((e)=>console.error(e));
    }

    destroy() {
        this.window.removeEventListener("message", this.#on_message);
    }
}

class ScrollOverlay {
    constructor(el, opts) {
        /** @type {import("overlayscrollbars").Options} */
        var os_opts = {};
        if (opts.hide) {
            os_opts.scrollbars = {};
            os_opts.scrollbars.autoHide = "move";
        }
        if (opts.x || opts.y) {
            os_opts.overflow = {}
            os_opts.overflow.x = opts.x ? "scroll" : "hidden";
            os_opts.overflow.y = opts.y ? "scroll" : "hidden";
        }
        this.overlayScrollbars = OverlayScrollbars(el, os_opts);
        this.viewport = this.overlayScrollbars.elements().viewport;
        if (opts.flex) this.viewport.style.display = "flex";
    }
}
export {ScrollOverlay};

export { OverlayScrollbars,  ScrollbarsHidingPlugin,  SizeObserverPlugin,  ClickScrollPlugin };

export { tippy, Cookie };

/** @param {HTMLIFrameElement} el */
export function iframe_ready(el) {
    return new Promise(resolve=>{
        var check = ()=>{
            var doc = el.contentDocument || el.contentWindow.document;
            if (doc.readyState == 'complete') resolve();
            else setTimeout(check, 100);
        }
        check();
    });
}

/** @template T @param {Node} el @param {string} selector @param {new()=>T} type @returns {Iterable<T>} */
export function *find(el, selector, type) {
    if (!(el instanceof HTMLElement)) return;
    if (el.matches(selector)) yield el;
    else {
        for (var c of el.querySelectorAll(selector)) yield c;
    }
}