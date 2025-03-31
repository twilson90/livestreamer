import { EventEmitter } from '../EventEmitter.js';
import { closest } from './closest.js';
import { create_menu } from './create_menu.js';
import tippy from 'tippy.js';
import "tippy.js/dist/tippy.css";
/** @import {Instance as TippyInstance} from "tippy.js"  */
export class DropdownMenu extends EventEmitter {
    showing = false;
    /** @type {HTMLElement} */
    el;
    /** @type {TippyInstance} */
    tippy;
    constructor(opts) {
        super();
        opts = {
            target: null,
            parent: document.body,
            params: [],
            tippy_opts: {},
            contextmenu: false,
            x: undefined,
            y: undefined,
            ...opts,
        };
        if (opts.target) {
            opts.target.addEventListener("click", (e)=>{
                this.toggle();
            });
        }
        this.opts = opts;
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
            var items = typeof this.opts.items === "function" ? this.opts.items() : this.opts.items;
            this.el = create_menu(items, {
                click: ()=>this.hide(),
                params: this.opts.params,
            });
        } else if (this.opts.content) {
            var content = typeof this.opts.content === "function" ? this.opts.content() : this.opts.content;
            if (typeof content === "string") content = $(content)[0];
            this.el = content;
        }
        /** @type {TippyInstance} */
        var tippy_opts = {
            trigger: "manual",
            placement: "top-start",
            interactive: true,
            hideOnClick: true,
            arrow: false,
            appendTo: this.opts.parent,
            theme: "list",
            offset: [0, 5],
            content: this.el,
            ...this.opts.tippy_opts,
        };
        if (this.opts.x !== undefined && this.opts.y !== undefined) {
            tippy_opts = {
                ...tippy_opts,
                getReferenceClientRect: ()=>({
                    width: 0,
                    height: 0,
                    top: this.opts.y,
                    bottom: this.opts.y,
                    left: this.opts.x,
                    right: this.opts.x,
                }),
                offset: [0, 0],
            };
        }
        if (this.tippy) {
            this.tippy.destroy();
            this.tippy = null;
        }
        document.body.addEventListener("click", this.on_click = (e)=>{
            /** @type {HTMLElement} */
            var t = e.target;
            if (closest(t, (el)=>el === this.opts.target || el === this.el)) return;
            this.hide();
        });
        this.tippy = tippy(this.opts.target || document.body, {
            ...tippy_opts,
            onShow: ()=>this.emit("show"),
            onHide: ()=>this.emit("hide"),
        });
        this.tippy.show();
    }
    show() {
        this.toggle(true)
    }
    hide() {
        this.toggle(false);
    }
    destroy() {
        document.body.removeEventListener("click", this.on_click);
        this.tippy.destroy();
        this.tippy = null;
    }
}
export default DropdownMenu;