import {EventEmitter} from "./EventEmitter.js";
export class StopWatch extends EventEmitter {
	get elapsed() {
		var now = Date.now();
		return (this.#pause_ts || now) - (this.#start_ts || now);
	}
	get paused() { return !!this.#pause_ts || !this.#start_ts; }
	#start_ts = 0;
	#pause_ts = 0;
	
	start() {
		var now = Date.now();
		if (this.paused) {
			this.#start_ts += now - this.#pause_ts;
			this.#pause_ts = 0;
			this.emit("start");
		}
	}
	
	resume() {
		this.start();
	}
	
	pause() {
		if (this.paused) return;
		this.#pause_ts = Date.now();
		this.emit("pause");
	}

	reset() {
		this.#start_ts = Date.now();
		if (this.paused) this.#pause_ts = this.#start_ts;
		this.emit("reset");
	}

	destroy() {
		this.removeAllListeners();
	}
}
export default StopWatch;