/** @template T */
export class EventEmitter {
    /** @type {Record<string, Set<(arg: T[K]) => void>} @template {keyof T} K */
    #events = {};
    
    addEventListener = this.on;
    addListener = this.on;
    removeEventListener = this.off;
    removeListener = this.off;
    
    /** @param {keyof T} event @param {(arg: T[K]) => void} listener @template {keyof T} K */
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
    
    emit(event, e) {
        if (!this.#events[event]) return;
        for (var l of [...this.#events[event]]) {
            var res = l.apply(this, [e]);
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
        var listener_wrapped = (e)=>{
            this.removeListener(event, listener_wrapped);
            listener.apply(this, [e]);
        };
        this.on(event, listener_wrapped);
    }
}
export default EventEmitter;