import { EventEmitter } from '../EventEmitter.js';
import { closest } from './closest.js';
import { create_menu } from './create_menu.js';
import tippy from 'tippy.js';
/** @import {Instance as TippyInstance, Props as TippyProps} from "tippy.js"  */

const default_opts = {
    target: null,
    trigger: "click",
    parent: document.body,
    params: [],
    /** @type {TippyProps} */
    tippy_opts: {},
    position: null,
    items: [],
}

export class DropdownMenu extends EventEmitter {
    showing = false;
    /** @type {HTMLElement} */
    el;
    /** @type {TippyInstance} */
    tippy;
    #onclick;
    #triggers = [];
    // #blocking_timeout;
    // #blocking = false;
    /** @param {typeof default_opts} opts */
    constructor(opts) {
        super();
        this.opts = {
            ...default_opts,
            ...opts,
        };

        if (this.opts.target && this.opts.trigger) {
            this.#triggers = this.opts.trigger.split(/\s+/).map(t=>t.trim());
            for (let trigger of this.#triggers) {
                this.opts.target.addEventListener(trigger, (e)=>{
                    // if (this.#blocking) return;
                    this.toggle(e);
                    e.preventDefault();
                }, {capture: true});
            }
        }
    }


    /** @param {boolean | Event} e @param {typeof default_opts} opts */
    toggle(e, opts) {
        let trigger_event;
        var old_showing = this.showing;
        if (e instanceof Event) {
            trigger_event = e;
            this.showing = !this.showing;
        } else if (e === undefined) this.showing = !this.showing;
        else this.showing = !!e;
        if (old_showing === this.showing) return;

        opts = {
            ...this.opts,
            ...opts,
        };

        if (!this.showing) {
            if (this.tippy) this.tippy.hide();
            return;
        }
        if (opts.items) {
            var items = typeof opts.items === "function" ? opts.items(trigger_event) : opts.items;
            this.el = create_menu(items, {
                click: ()=>this.toggle(false),
                params: opts.params,
            });
        } else if (opts.content) {
            var content = typeof opts.content === "function" ? opts.content(trigger_event) : opts.content;
            if (typeof content === "string") content = $(content)[0];
            this.el = content;
        }
        /** @type {TippyProps} */
        var tippy_opts = {
            trigger: "manual",
            placement: "top-start",
            interactive: true,
            hideOnClick: false,
            arrow: false,
            appendTo: opts.parent,
            theme: "list",
            offset: [0, 5],
            content: this.el,
            ...opts.tippy_opts,
        };
        var position;
        if (opts.position) {
            if (opts.position === "trigger") {
                if (trigger_event) {
                    position = {
                        x: trigger_event.clientX,
                        y: trigger_event.clientY,
                    };
                }
            } else if (typeof opts.position === "function") {
                position = opts.position(trigger_event);
            } else {
                position = opts.position;
            }
        }
        if (position) {
            var {x, y} = position;
            Object.assign(tippy_opts, {
                offset: [0, 0],
                getReferenceClientRect: ()=>({
                    width: 0,
                    height: 0,
                    top: y,
                    bottom: y,
                    left: x,
                    right: x,
                }),
            });
        }
        
        if (this.tippy) {
            this.tippy.destroy();
            this.tippy = null;
        }

        if (this.showing) {
            document.body.addEventListener("mousedown", this.#onclick = (e)=>{
                if (this.el.contains(e.target)) return;
                if (opts.target && opts.target.contains(e.target)) return;
                this.toggle(false);
                /* this.#blocking = true;
                clearTimeout(this.#blocking_timeout);
                document.body.addEventListener("mouseup", (e)=>{
                    this.#blocking_timeout = setTimeout(()=>{
                        this.#blocking = false;
                    }, 50);
                }, {capture: true, once: true}); */
            }, {capture: true});
        }

        this.tippy = tippy(opts.target || document.body, {
            ...tippy_opts,
            onShow: ()=>{
                this.emit("show");
                this.toggle(true);
            },
            onHide: ()=>{
                this.emit("hide");
                this.toggle(false);
            },
        });
        this.tippy.show();
    }

    destroy() {
        document.body.removeEventListener("click", this.#onclick);
        this.tippy.destroy();
        this.tippy = null;
    }
}
export default DropdownMenu;