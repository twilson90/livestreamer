import {EventEmitter} from "./EventEmitter.js";
export class StopWatchBase extends EventEmitter {
	__get_now() { throw new Error("Not implemented"); }
	get elapsed() {
		var now = this.__get_now();
		return (this.#pause_ts || now) - (this.#start_ts || now);
	}
	get paused() { return !!this.#pause_ts || !this.#start_ts; }
	#start_ts = 0;
	#pause_ts = 0;
	
	start() {
		if (!this.paused) return;
		var now = this.__get_now();
		this.#start_ts += now - this.#pause_ts;
		this.#pause_ts = 0;
		this.emit("start");
	}
	
	resume() {
		this.start();
	}
	
	pause() {
		if (this.paused) return;
		this.#pause_ts = this.__get_now();
		this.emit("pause");
	}

	reset() {
		this.#start_ts = this.__get_now();
		if (this.paused) this.#pause_ts = this.#start_ts;
		this.emit("reset");
	}

	destroy() {
		this.removeAllListeners();
	}
}

export class StopWatch extends StopWatchBase {
	__get_now() { return Date.now(); }
}

export default StopWatch;