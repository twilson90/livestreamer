import EventEmitter from "../EventEmitter.js";

export class TouchListener extends EventEmitter {
    /** @type {Element} */
    constructor(elem, settings) {
        super();
        settings = {
            mode: "normal",
            start: (e) => { },
            move: (e) => { },
            end: (e) => { },
            ...settings,
        };
        elem.style["touch-actions"] = "none";
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
        var _on_touch_start = (e) => {
            // VERY NECESSARY!
            e.preventDefault();
        };
        var _on_start = (e) => {
            if (e.pointerId && settings.mode != "hover") {
                if (e.button != 0) return;
                this.elem.setPointerCapture(e.pointerId);
                this.elem.addEventListener("lostpointercapture", _on_end);
            }
            e.stopPropagation();
            e.preventDefault();

            settings.start(e);
            move_events.forEach(et => window.addEventListener(et, _on_move));
            end_events.forEach(et => end_target.addEventListener(et, _on_end));
        };
        var _on_move = (e) => {
            // console.log(e.type, e);
            settings.move(e);
        };
        var _on_end = (e) => {
            // console.log(e.type, e);
            settings.end(e);
            cleanup();
        };
        var cleanup = () => {
            this.elem.removeEventListener("lostpointercapture", _on_end);
            move_events.forEach(et => window.removeEventListener(et, _on_move));
            end_events.forEach(et => end_target.removeEventListener(et, _on_end));
        };
        this._destroy = () => {
            this.elem.removeEventListener("touchstart", _on_touch_start);
            start_events.forEach(et => this.elem.removeEventListener(et, _on_start));
            cleanup();
        };
        start_events.forEach(et => this.elem.addEventListener(et, _on_start));
        this.elem.addEventListener("touchstart", _on_touch_start);
    }

    destroy() {
        this._destroy();
    }
}

export default TouchListener;