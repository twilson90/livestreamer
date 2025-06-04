/** create a promise that can be toggled between true and false, and resolve the promise when the state is false, true is like a pause */
export class DeferredReady {
    #state = false;
    #current_resolve = null;
    /** @type {Promise<void>} */
    #current_promise = null;
    
    get state() { return this.#state; }

    /** @param {boolean} new_state */
    set state(new_state) {
        if (new_state === this.#state) return;
        this.#state = new_state;
        if (new_state) {
            if (this.#current_resolve) {
                this.#current_resolve();
                this.#current_resolve = null;
                this.#current_promise = null;
            }
        } else {
            this.#current_promise = new Promise((resolve) => {
                this.#current_resolve = resolve;
            });
        }
    }
  
    get ready() {
        if (!this.#state && this.#current_promise) return this.#current_promise;
        return Promise.resolve();
    }
  }