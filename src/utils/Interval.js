import {noop} from "./noop.js";
import {options_proxy} from "./options_proxy.js";

/** @typedef {{interval:number, immediate:bool, await:bool, context:any}} IntervalOptions  */
export class Interval {
	get time_since_last_tick() {
		return Math.max(0, Date.now() - this.#last_tick);
	}
	get time_until_next_tick() {
		return Math.max(0, this.options.interval - this.time_since_last_tick);
	}

	/** @type {IntervalOptions} */
	#options;
	#ticks = 0;
	#destroyed = false;
	#last_tick = 0;
	/** @type {Promise<any>} */
	#current_promise;
	#timeout;

	/** @param {function():void} callback @param {IntervalOptions} opts */
	constructor(callback, opts) {
		if (typeof opts !== "object") opts = { interval: opts };
		this.#options = Object.assign({
			interval: 10000,
			immediate: false,
			await: true,
			context: null
		}, opts);
		/** @type {IntervalOptions} */
		this.options = options_proxy(this.#options);
		if (!this.options.immediate) this.#last_tick = Date.now();
		this.callback = callback;
		
		if (this.options.immediate) this.tick();
		else this.next();
	}

	update(opts) {
		Object.assign(this.#options, opts);
	}

	async tick(callback_args=null) {
		var ticks = ++this.#ticks;
		if (this.#options.await) await Promise.resolve(this.#current_promise).catch(noop);
		if (!this.#destroyed && ticks == this.#ticks) {
			this.#last_tick = Date.now();
			this.#current_promise = Promise.resolve(this.callback.apply(this.options.context, callback_args));
			this.next();
		}
		return this.#current_promise;
	}

	async next() {
		clearTimeout(this.#timeout);
		this.#timeout = setTimeout(()=>this.tick(), this.options.interval);
	}

	destroy() {
		this.#destroyed = true;
		clearTimeout(this.#timeout);
	}
}
export default Interval;