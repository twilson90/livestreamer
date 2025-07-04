/** @template T */
export class Deferred {
    /** @type {Promise<T>} */
    #promise;
    /** @type {(value: any) => void} */
    #resolve;
    /** @type {(reason?: any) => void} */
    #reject;

    get promise() { return this.#promise; }

    /** @param {T} value */
    resolve(value) {
        this.#resolve(value);
    }
    
    /** @param {any} reason */
    reject(reason) {
        this.#reject(reason);
    }

    constructor() {
        this.reset();
    }

    reset() {
        this.#promise = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }
}