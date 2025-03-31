import { debounce } from "../debounce.js";
import EventEmitter from "../EventEmitter.js";
import { autosize } from './autosize.js';


export class AutoSizeController extends EventEmitter {
    constructor(elem, min_rows, auto_update = true) {
        super();
        this.elem = elem;
        this.min_rows = min_rows || 1;
        this.on_change = (e) => {
            this.update();
        };
        this.debounced_update = debounce(() => this.update(), 50);
        ["input", "propertychange", "paste"].forEach(ev => this.elem.addEventListener(ev, this.on_change));
        if (auto_update) {
            window.addEventListener("resize", this.debounced_update);
            var fs;
            this.check_interval = setInterval(() => {
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
        this.input_events.forEach(ev => this.elem.removeEventListener(ev, this.on_change));
        window.removeEventListener("resize", this.debounced_update);
    }
}

export default AutoSizeController;