import EventEmitter from "../EventEmitter.js";
import { debounce_next_frame } from "./debounce_next_frame.js";
import { get_top_position } from "./get_top_position.js";
import { toggle_class } from "./toggle_class.js";

export class WrapDetector extends EventEmitter {
    /** @param {HTMLElement} elem */
    constructor(elem, opts) {
        super();
        opts = {
            isChildrenWrappedClassName: "is-wrapped",
            isSiblingWrappedClassName: "sibling-is-wrapped",
            isSelfWrappedClassName: "self-is-wrapped",
            nextIsWrappedClassName: "next-is-wrapped",
            ...opts,
        };
        this.elem = elem;
        this.opts = opts;
        var detect_wrap = debounce_next_frame(() => this.detect_wrap());
        this.resize_observer = new ResizeObserver(() => detect_wrap());
        this.resize_observer.observe(elem);
    }
    detect_wrap() {
        var old_wrapped = this.is_wrapped;
        this.is_wrapped = false;
        for (let i = 0; i < this.elem.children.length; i++) {
            const child = this.elem.children[i];
            const prev = this.elem.children[i - 1];
            const top = get_top_position(child);
            const prevTop = prev ? get_top_position(prev) : top;
            var is_wrapped = top > prevTop;
            toggle_class(child, this.opts.isSelfWrappedClassName, is_wrapped);
            if (prev) toggle_class(prev, this.opts.nextIsWrappedClassName, is_wrapped);
            if (is_wrapped) this.is_wrapped = true;
        }
        toggle_class(this.elem, this.opts.isChildrenWrappedClassName, this.is_wrapped);
        [...this.elem.children].forEach(e => {
            toggle_class(e, this.opts.isSiblingWrappedClassName, !e.classList.contains(this.opts.isSelfWrappedClassName) && this.is_wrapped);
        });
        if (this.is_wrapped !== old_wrapped) {
            this.emit("change");
        }
    }
    destroy() {
        this.resize_observer.disconnect();
    }
}

export default WrapDetector;