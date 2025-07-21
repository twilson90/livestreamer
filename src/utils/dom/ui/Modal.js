import { UI, Button } from "./ui.js";
import { PropertyGroup } from "./PropertyGroup.js";
import { InputProperty } from "./InputProperty.js";
import { Loader } from "./Loader.js";
import { force_reflow } from "../force_reflow.js";
import { toggle_class } from "../toggle_class.js";
import { set_inner_html } from "../set_inner_html.js";
import { update_style_properties } from "../update_style_properties.js";
import { create_disable_scrollbars_stylesheet_and_class } from "../create_disable_scrollbars_stylesheet_and_class.js";

/** @import {UISettings, UISetting, UIEvents} from './exports.js' */

/**
 * @template ItemType
 * @template {Modal<ItemType>} [ThisType=Modal<ItemType>]
 * @typedef {UISettings<ThisType> & {
*  "modal.title": UISetting<ThisType, string>,
*  "modal.title_overflow": UISetting<ThisType, boolean>,
*  "modal.hide_on_click_outside": UISetting<ThisType, boolean>,
*  "modal.footer": UISetting<ThisType, boolean>,
*  "modal.header": UISetting<ThisType, boolean>,
*  "modal.width": UISetting<ThisType, number|string>,
*  "modal.items": UISetting<ThisType, ItemType[]>,
*  "modal.blocking": UISetting<ThisType, boolean>,
*  "modal.close": UISetting<ThisType, boolean>,
*  "modal.hide": (this: ThisType) => void,
*  "modal.show": (this: ThisType) => void,
* }} ModalSettings
*/

/** 
 * @typedef {UIEvents & {
 *   show: [],
 *   hide: []
 * }} ModalEvents 
 */

/**
* @template ItemType
* @template {ModalSettings<ItemType,Modal>} [Settings=ModalSettings<ItemType,Modal>]
* @template {ModalEvents} [Events=ModalEvents]
* @extends {UI<Settings,Events>}
*/

export class Modal extends UI {
    get showing() { return !!this.fb; }
    get modal_title() { return this.get_setting("modal.title"); }
    get changes() { return this.props.changes; }
    get item() { return this.props.items[0]; }
    /** @type {ItemType[]} */
    get items() { return this.props.items; }
    /** @template T @param {new() => T} type @returns {T[]} */
    static get (type) {
        return [...Modal.showing].filter(m=>m instanceof type);
    }

    /** @type {PropertyGroup<ItemType>} */
    props;

    #showing_promise;
    #showing_resolve;
    #on_key_down;
    /** @type {HTMLElement} */
    #root;
    #disable_scroll_class;

    /** @type {Set<Modal>} */
    static showing = new Set();
    /** @type {Set<Modal>} */
    static instances = new Set();
    static blocking_updates = new Set();

    static defaults = {
        root: document.body,
        hide_on_click_outside: true,
        title: "",
        title_overflow: false,
        header: true,
        footer: true,
        width: undefined,
        items: [undefined],
        return_value: (r)=>r,
        blocking: true,
        close: true,
    };

    get is_showing() { return !!this.#showing_promise; }

    /** @param {Settings} settings */
    constructor(settings) {
        
        var elem = $(`<div class="modal-container"></div>`)[0];
        settings = {
            ...Object.fromEntries(Object.entries(Modal.defaults).map(([k,v])=>[`modal.${k}`, v])),
            ...settings,
        };

        super(elem, settings);
        
        this.#root = this.get_setting("modal.root") || document.body;
        
        this.#disable_scroll_class = create_disable_scrollbars_stylesheet_and_class();

        // Modal.instances.add(this);
        
        this.header = new UI(null, {
            class: "modal-header",
            hidden: ()=>!this.get_setting("modal.header") || !this.get_setting("modal.title"),
        });
        this.content = new UI(null, {
            class: "modal-content",
        });
        this.footer = new UI({
            class: "modal-footer",
            hidden: !this.get_setting("modal.footer"),
        });

        this.close_button = new Button(`<button class="modal-close"><i class="fas fa-times"></i></button>`, {
            click: ()=>this.hide(),
            hidden: !this.get_setting("modal.close"),
        });

        this.modal_elem = $(`<div class="modal"></div>`)[0];
        this.modal_elem.append(this.header, this.content, this.footer, this.close_button);

        this.props = new PropertyGroup({
            "items": ()=>this.get_setting("modal.items"),
            "show_changed": true,
            "show_not_default": true,
        });
        this.content.append(this.props);
        
        var prevent_click = false;
        this.modal_elem.addEventListener("mousedown", (e)=>{
            document.addEventListener("mouseup", (e)=>{
                if (!this.modal_elem.contains(e.target)) {
                    prevent_click = true;
                }
            }, {once:true});
        }, {capture:true});
        this.elem.onclick = (e)=>{
            if (!e.target.isConnected) return;
            if (this.modal_elem.contains(e.target)) return;
            if (!this.get_setting("modal.hide_on_click_outside")) return;
            if (prevent_click) {
                prevent_click = false;
                return;
            }
            this.hide();
        }

        /* if (this.get_setting("modal.close")) {
            this.footer.append(new Button(`<button class="close">Close</button>`, {
                "click":()=>this.hide()
            }));
        } */
        
        this.props.on("change", ()=>{
            this.update();
        });
        
        this.on("render", ()=>{
            var width = this.get_setting("modal.width");
            var min_width = this.get_setting("modal.min-width");
            var max_width = this.get_setting("modal.max-width");
            toggle_class(this.elem, "closable", !!this.get_setting("modal.close"));
            set_inner_html(this.header.elem, `<span>${this.get_setting("modal.title")}</span>`);
            toggle_class(this.header.elem, "overflow", this.get_setting("modal.title_overflow"));
            var h = this.header.elem.clientHeight || 0;
            update_style_properties(this.elem, {
                "--modal-width": typeof width === "number" ? `${width}px` : width,
                "--modal-min-width": typeof min_width === "number" ? `${min_width}px` : min_width,
                "--modal-max-width": typeof max_width === "number" ? `${max_width}px` : max_width,
                "--modal-close-size": `${h}px`,
            });
        });

        this.on("destroy", ()=>{
            // Modal.instances.delete(this);
        });

        this.#root.dispatchEvent(new CustomEvent("modal-create", {detail: this, bubbles: true}));
    }

    /** @param {ItemType[]} items */
    async show() {
        if (!this.#showing_promise) {
            this.#root.dispatchEvent(new CustomEvent("modal-show", {detail: this, bubbles: true}));
            this.#root.append(this.elem);
            force_reflow(this.elem);
            this.elem.classList.add("showing");

            this.#showing_promise = new Promise(resolve=>{
                this.#showing_resolve = resolve;
            }).finally(()=>this.#showing_promise = null);

            if (this.get_setting("modal.blocking")) Modal.blocking_updates.add(this.#showing_promise);
            Modal.showing.add(this);

            this.#root.classList.add(this.#disable_scroll_class);
            
            this.emit("before-load");

            if ("modal.load" in this.settings) {

                var loader = new Loader({
                    "loader.background": "transparent",
                });
                loader.elem.onclick = ()=>this.hide();
                this.elem.append(loader.elem);
                await this.get_setting("modal.load");
                loader.elem.remove();
                // await utils.timeout(1000000);
            }
            
            this.emit("before-show");
            
            this.elem.append(this.modal_elem);
            force_reflow(this.elem);
            this.elem.classList.add("modal-showing");

            this.update();
            
            this.emit("show");

            this.#on_key_down = (e)=>{
                if (e.key === "Escape") {
                    var modal = [...Modal.showing].pop();
                    if (modal === this) {
                        modal.escape();
                        return false;
                    }
                }
            };
            window.addEventListener("keydown", this.#on_key_down);
        }

        return this.#showing_promise.then((result)=>{
            return this.get_setting("modal.return_value", result);
        })
    }

    escape() {
        this.hide();
    }

    hide() {
        if (!this.#showing_promise) return;
        Modal.showing.delete(this);
        Modal.blocking_updates.delete(this.#showing_promise);
        if (Modal.showing.size == 0) this.#root.classList.remove(this.#disable_scroll_class);
        window.removeEventListener("keydown", this.#on_key_down);
        this.emit("hide");
        this.elem.classList.remove("showing");
        setTimeout(()=>{
            this.elem.remove();
        }, 300);
        this.#showing_resolve();
    }
}

/**
 * @template ItemType
 * @typedef {ModalSettings<ItemType> & {
*  "modal.auto_apply": UISetting<EditModal, boolean>,
*  "modal.allow_invalid": UISetting<EditModal,boolean>,
*  "modal.apply": function(),
* }} EditModalSettings
*/

/** @template ItemType @extends {Modal<ItemType,EditModalSettings<ItemType>>} */
export class EditModal extends Modal {
    #applied = false;
    #cancelled = false;

    /** @param {EditModalSettings<ItemType>} settings */
    constructor(settings) {
        super({
            "modal.hide_on_click_outside": ()=>this.get_setting("modal.auto_apply"),
            "modal.auto_apply": true,
            "modal.allow_invalid": true,
            "modal.ok": `OK`,
            "modal.cancel": "Cancel",
            ...settings,
        });
        this.on("before-show", ()=>{
            this.#cancelled = false;
            this.#applied = false;
        });
        this.on("hide", ()=>{
            if (this.get_setting("modal.auto_apply") && !this.#cancelled) {
                this.apply();
            }
        });

        var get_button_content = (t, def)=>{
            var res = this.get_setting(t);
            if (typeof res === "boolean") return def;
            return res;
        }
        
        this.ok_button = new Button(`<button>Save</button>`, {
            "content":()=>get_button_content("modal.ok", "OK"),
            "hidden": ()=>!this.get_setting("modal.ok"),
            "disabled":()=>!this.get_setting("modal.allow_invalid") && !this.props.is_valid,
            "click":()=>this.apply(),
        })
        this.cancel_button = new Button(`<button>Cancel</button>`, {
            "content":()=>get_button_content("modal.cancel", "Cancel"),
            "hidden": ()=>!this.get_setting("modal.cancel"),
            "click":()=>this.cancel()
        })
        this.footer.append(this.ok_button, this.cancel_button);
    }
    apply() {
        if (this.#applied) return;
        this.#applied = true;
        this.get_setting("modal.apply");
        this.emit("apply");
        this.hide();
    }
    cancel() {
        if (this.#cancelled) return;
        this.#cancelled = true;
        this.hide();
    }
    async show() {
        var result = await super.show();
        if (this.#cancelled) return;
        return result;
    }
    hide() {
        if (!this.get_setting("modal.allow_invalid") && !this.props.is_valid && !this.#cancelled) return;
        super.hide();
    }

    escape() {
        this.cancel();
    }
}

export class PromptModal extends EditModal {
    constructor(message, defaultValue="") {
        super({
            "modal.title": title,
            "modal.return_value": ()=>input.value,
        });
        this.props.append(`<div>${message}</div>`);
        input = new InputProperty(`<input type="text"></input>`, {
            "reset": false,
            "default": defaultValue,
        });
        this.props.append(input);
    }
}