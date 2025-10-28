import {EventEmitter} from "../EventEmitter.js";

export class UserScrollDetect extends EventEmitter {

    get userScrolling() {
        return this.#userScrolling;
    }
    get autoscrollActive() {
        return this.#middleMouseButtonDown;
    }

    #target;
    #userScrolling = false;
    #middleMouseButtonDown = false;
    #timer = null;
    #opts = { timeout:200 };

    #onWheel;
    #onTouch;
    #onKey;
    #onMouseDown;
    #onMouseMove;
    #onMouseUp;
    #onScroll;
    #autoScrollLatched = false;
    #autoScrollByHolding = false;

    constructor(target = window, opts = {}) {
        super();

        this.#target = target;
        this.#opts = {...this.#opts, ...opts};

        this.#onWheel = this.#handleWheel.bind(this);
        this.#onTouch = this.#handleTouch.bind(this);
        this.#onKey = this.#handleKey.bind(this);
        this.#onMouseDown = this.#handleMouseDown.bind(this);
        this.#onMouseMove = this.#handleMouseMove.bind(this);
        this.#onMouseUp = this.#handleMouseUp.bind(this);
        this.#onScroll = this.#handleScroll.bind(this);

        this.#target.addEventListener('wheel', this.#onWheel, { passive: true, capture: true });
        this.#target.addEventListener('touchstart', this.#onTouch, { passive: true, capture: true });
        this.#target.addEventListener('keydown', this.#onKey, { passive: true, capture: true });
        this.#target.addEventListener('mousedown', this.#onMouseDown, { passive: true, capture: true });
        this.#target.addEventListener('mouseup', this.#onMouseUp, { passive: true, capture: true });
        this.#target.addEventListener('mousemove', this.#onMouseMove, { passive: true, capture: true });
        this.#target.addEventListener('scroll', this.#onScroll, { passive: true, capture: true });
    }

    // Detach all listeners (cleanup)
    destroy() {
        this.#target.removeEventListener('wheel', this.#onWheel);
        this.#target.removeEventListener('touchstart', this.#onTouch);
        this.#target.removeEventListener('keydown', this.#onKey);
        this.#target.removeEventListener('mousedown', this.#onMouseDown);
        this.#target.removeEventListener('mouseup', this.#onMouseUp);
        this.#target.removeEventListener('mousemove', this.#onMouseMove);
        this.#target.removeEventListener('scroll', this.#onScroll);
        clearTimeout(this.#timer);
    }

    // Mark short-lived user scroll
    #markUserScroll() {
        this.#userScrolling = true;
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => {
            this.#userScrolling = false;
        }, this.#opts.timeout);
    }

    #handleWheel(e) {
        this.#markUserScroll();
    }

    #handleTouch(e) {
        this.#markUserScroll();
    }

    #handleKey(e) {
        if (e.key === "Escape") this.#handleMouseUp(e);
        this.#markUserScroll();
    }

    // Middle mouse toggle (autoscroll mode)
    #handleMouseDown(e) {
        this.#autoScrollLatched = false;
        if (e.button === 1) {
            this.#middleMouseButtonDown = true;
            this.#markUserScroll();
        }
    }

    // Mouse move keeps autoscroll alive
    #handleMouseMove() {
        if (this.#middleMouseButtonDown) {
            this.#markUserScroll();
        }
        if (this.#autoScrollLatched) {
            this.#markUserScroll();
        }
    }

    // Release middle mouse (in case browser doesn’t toggle)
    #handleMouseUp(e) {
        this.#userScrolling = false;
        this.#autoScrollLatched = e.button === 1 && !this.#autoScrollByHolding;
        this.#middleMouseButtonDown = false;
        this.#autoScrollByHolding = false;
    }

    #handleScroll(e) {
        if (this.#middleMouseButtonDown) {
            this.#autoScrollByHolding = true;
            this.#markUserScroll();
        }
        if (this.#autoScrollLatched) {
            this.#markUserScroll();
        }
    }
}
