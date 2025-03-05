import EventEmitter from "./EventEmitter.js";
export class StopWatch extends EventEmitter {
	get time() { return (this._paused ? this._pause_time : Date.now()) - this._start_time; }
	get paused() { return this._paused; }

	constructor(){
		super();
		this._start_time = 0;
		this._pause_time = 0;
		this._paused = true;
	}
	
	start() {
		var now = Date.now();
		if (!this._start_time) this._start_time = now;
		if (this._paused) {
			this._paused = false;
			this._start_time += now - this._pause_time;
			this._pause_time = 0;
			this.emit("start");
		}
	}
	
	resume() {
		this.start();
	}
	
	pause() {
		if (this._paused) return;
		this._paused = true;
		this._pause_time = Date.now();
		this.emit("pause");
	}

	reset() {
		this._start_time = Date.now();
		if (this._paused) this._pause_time = this._start_time;
		this.emit("reset");
	}

	destroy() {
		this.removeAllListeners();
	}
}