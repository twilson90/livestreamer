export class PromiseSet {
    /** @type {Promise<any>[]} */
    #promises = new Set();
    /** @param {Promise<any>} promise */
    get size() { return this.#promises.size; }
    add(promise) {
        var report = ()=>console.log(`Blocking promises (${this.#promises.size})`);
        this.#promises.add(promise);
        report();
        promise.finally(()=>{
            this.#promises.delete(promise);
            report();
        });
    }
    get ready() {
        return Promise.all(this.#promises);
    }
}