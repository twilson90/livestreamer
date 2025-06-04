/** @template Events @template {keyof Events} K */
export class EventEmitter {
    /** @type {Record<PropertyKey,Set<(...args:Events[K])=>void>>} */
    #events = {};

    
    addEventListener = this.on;
    addListener = this.on;
    removeEventListener = this.off;
    removeListener = this.off;
    
    /** 
     * @template {keyof Events} K 
     * @param {K} event The event name to listen for
     * @param {(this: this, ...args: Events[K]) => void} listener The callback function
     * @returns {void}
     */
    on(event, listener) {
        if (!this.#events[event]) this.#events[event] = new Set();
        this.#events[event].add(listener);
    }
    
    removeAllListeners() {
        this.#events = {};
    }

    off(event, listener) {
        if (!event) {
            this.removeAllListeners();
            return;
        }
        if (!this.#events[event]) return;
        if (listener) this.#events[event].delete(listener);
        else this.#events[event].clear();
    }
    
    emit(event, ...args) {
        if (!this.#events[event]) return;
        for (var listener of [...this.#events[event]]) {
            var res = listener.apply(this, args);
            if (res === false) return false;
        }
    }
    
    /* async emit_async(event, e) {
        if (!this.#events[event]) return;
        for (var l of [...this.#events[event]]) {
            var res = await l.apply(this, [e]);
            if (res === false) return false;
        }
    } */
    
    once(event, listener) {
        var listener_wrapped = (...args)=>{
            this.removeListener(event, listener_wrapped);
            listener.apply(this, args);
        };
        this.on(event, listener_wrapped);
    }
}
export default EventEmitter;