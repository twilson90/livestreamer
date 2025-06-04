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
            this.opts.target.addEventListener(this.opts.trigger, (e)=>{
                // if (this.#blocking) return;
                this.trigger_event = e;
                this.toggle();
                e.preventDefault();
            }, {capture: true});
        }
    }

    toggle(show) {
        if (show === undefined) show = !this.showing;
        if (show === this.showing) return;
        this.showing = show;

        if (!this.showing) {
            this.tippy.hide();
            return;
        }
        if (this.opts.items) {
            var items = typeof this.opts.items === "function" ? this.opts.items(this.trigger_event) : this.opts.items;
            this.el = create_menu(items, {
                click: ()=>this.toggle(false),
                params: this.opts.params,
            });
        } else if (this.opts.content) {
            var content = typeof this.opts.content === "function" ? this.opts.content(this.trigger_event) : this.opts.content;
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
            appendTo: this.opts.parent,
            theme: "list",
            offset: [0, 5],
            content: this.el,
            ...this.opts.tippy_opts,
        };
        var position;
        if (this.opts.position) {
            if (this.opts.position === "trigger") {
                if (this.trigger_event) {
                    position = {
                        x: this.trigger_event.clientX,
                        y: this.trigger_event.clientY,
                    };
                }
            } else if (typeof this.opts.position === "function") {
                position = this.opts.position(this.trigger_event);
            } else {
                position = this.opts.position;
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

        if (show) {
            document.body.addEventListener("mousedown", this.#onclick = (e)=>{
                if (this.el.contains(e.target)) return;
                if (this.opts.target && this.opts.target.contains(e.target)) return;
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

        this.tippy = tippy(this.opts.target || document.body, {
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