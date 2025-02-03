import Cookies from 'js-cookie';
import 'resize-observer-polyfill';
import { OverlayScrollbars,  ScrollbarsHidingPlugin,  SizeObserverPlugin,  ClickScrollPlugin } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
import tippy from 'tippy.js';
import "tippy.js/dist/tippy.css";
import * as utils from './utils.js';
import "./dom.scss";

var _temp_div = document.createElement('div');
var _div2 = document.createElement('div');

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

export class TouchListener extends utils.EventEmitter {
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
export class AutoSizeController extends utils.EventEmitter {
    constructor(elem, min_rows, auto_update=true) {
        super();
        this.elem = elem;
        this.min_rows = min_rows || 1;
        this.on_change = (e)=>{
            this.update();
        };
        this.debounced_update = utils.debounce(()=>this.update(), 50);
        ["input", "propertychange", "paste"].forEach(ev=>this.elem.addEventListener(ev, this.on_change));
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
        this.emit("pre_update");
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
export class LocalStorageBucket extends utils.EventEmitter
{   
    get data() { return { ...this.#defaults, ...this.#data } }
    get keys() { return Object.keys(this.data); }
    get defaults() { return this.#defaults; }

    #name;
    #data = {};
    #hashes = {};
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
        this.#save();
    }
    get(k) {
        return (k in this.#data) ? this.#data[k] : this.#defaults[k];
    }
    set(k, new_value) {
        var new_hash = JSON.stringify(new_value);
        var old_value = this.#data[k];
        var default_hash = JSON.stringify(this.#defaults[k]);
        if (new_hash === this.#hashes[k]) return;
        if (new_hash === default_hash) delete this.#data[k];
        else this.#data[k] = new_value;
        this.#hashes[k] = new_hash;
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

class _WebSocket extends utils.EventEmitter
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
            if (timeout) {
                setTimeout(()=>reject(`WebSocket2 request ${rid} timed out`), timeout)
            }
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
export {_WebSocket as WebSocket}

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
/** @return {ChildNode[]} */
export function render_html(htmlString) {
    if (typeof htmlString !== "string") return null;
    _temp_div.innerHTML = htmlString.trim();
    return Array.from(_temp_div.childNodes);
}
export const $ = render_html;
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
export function set_value(elem, new_value, opts) {
    opts = {
        trigger: false,
        ...opts
    };
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
    if (opts.trigger) elem.dispatchEvent(new Event("change"));
    return true;
}
export function get_index(element) {
    if (!element.parentNode) return -1;
    return Array.from(element.parentNode.children).indexOf(element);
}
/** @template T @param {HTMLElement} container @param {{selector:string, auto_insert:boolean, remove:function(Element):void, add:function(T,Element,Number):Element }} opts @param {T[]} items */
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
            if (elem.parentElement != container || get_index(elem) != i) {
                insert_at(container, elem, i);
            }
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

/** @return {HTMLTableElement} */
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
export function cycle_select(elem, trigger = false) {
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
    if (trigger) elem.dispatchEvent(new Event("change"));
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

/** @param {HTMLElement} el */
export function has_focus(el, ancestors=false, descendents=false) {
    /** @type {Document|ShadowRoot} */
    var root = el.getRootNode();
    var active_el = root.activeElement;
    if (active_el === el) return true;
    if (root.body !== active_el) {
        if (ancestors && closest(el, (e)=>e===active_el)) return true;
        if (descendents && walk(el, (e)=>e===active_el)) return true;
    }
    return false;
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

/** @param {HTMLElement} elem @param {function(Element):any} delegate */
export function closest(elem, delegate) {
    var p = elem;
    while (p) {
        var r = delegate.apply(p, [p]);
        if (r) return p;
        p = p.parentElement;
    }
}

/** @param {HTMLElement} elem @param {function(Element):any} delegate */
export function walk(elem, delegate) {
    var r,c;
    var _walk = (elem)=>{
        r = delegate.apply(elem, [elem]);
        if (r) return r;
        for (c of elem.children) {
            r = _walk(c);
            if (r) return r;
        }
    }
    for (c of elem.children) {
        r = _walk(c);
        if (r) return r;
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
        promise = null;
        resolve(func.apply(context, args));
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
        promise = null;
        cancelAnimationFrame(timeout_id);
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
export { ScrollOverlay };

export { OverlayScrollbars,  ScrollbarsHidingPlugin,  SizeObserverPlugin,  ClickScrollPlugin };

export { tippy, Cookies };

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

export function get_url(uri, sub, ws=false) {
	let url = new URL(uri || window.location.origin);
    var parts = url.host.split(".")
    if (!uri) parts.shift();
    parts.unshift(sub);
    url.host = parts.filter(a=>a).join(".");
    if (ws) url.protocol = window.location.protocol === "https:"?"wss:":"ws:";
    return url;
}

/** @param {HTMLElement} elem */
export function convert_to_camel_case(key) {
    return key.replace(/-([a-z])/g, (_, char)=>char.toUpperCase());
}

/** @param {HTMLElement} elem */
export function get_dataset(elem, key) {
    if (key) {
        return elem.dataset[convert_to_camel_case(key)];
    }
    return Object.fromEntries(Array.from(elem.attributes).filter(attr=>attr.nodeName.match(/^data-/)).map(attr=>attr.nodeName.slice(5)).map(k=>[k, get_dataset(elem, k)]));
}

/** @param {HTMLElement} elem */
export function set_dataset_value(elem, key, value) {
    return elem.dataset[convert_to_camel_case(key)] = value;
}

export * as ui from './ui.js';