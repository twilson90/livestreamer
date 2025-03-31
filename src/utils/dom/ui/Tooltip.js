import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";

/** @import {Instance as TippyInstance} from "tippy.js" */

export class Tooltip {
    #content;
    /** @type {TippyInstance} */
    #tippy;
    constructor(elem, content){
        this.#tippy = tippy(elem, {
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
export default Tooltip;