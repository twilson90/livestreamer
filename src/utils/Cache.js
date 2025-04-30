/** @template K @template V */
export class Cache {
	/** @type {Map<K, {value:V, timeout:NodeJS.Timeout}>} */
	#cache = new Map();
	#expires = 0;
    constructor(expires=0) {
        this.#expires = expires;
	}
	/** @param {K} key */
	get(key) {
		if (this.#cache.has(key)) {
			return this.#cache.get(key).value;
		}
	}
	/** @param {K} key */
	has(key) {
		return this.#cache.has(key);
	}
	/** @param {K} key @param {V} value */
	set(key, value) {
		var timeout;
		if (this.#expires) {
			timeout = setTimeout(()=>{
				this.#cache.delete(key);
			}, this.#expires);
		}
		this.#cache.set(key, {value, timeout});
	}
	clear() {
		for (var [key, {timeout}] of [...this.#cache]) {
			clearTimeout(timeout);
			this.#cache.delete(key);
		}
	}
}
