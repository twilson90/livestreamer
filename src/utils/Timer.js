import { EventEmitter } from "events";
import { StopWatch } from "./StopWatch.js";
export class Timer extends EventEmitter {
	static TICK_INTERVAL = 1000/60;

	get time_left() { return Math.max(0, this._total_time - this._stopwatch.elapsed); }
	get seconds_left() { return Math.ceil(this.time_left/1000); }
	get finished() { return this.time_left <= 0; }
	get paused() { return this._stopwatch.paused; }

	constructor(time=0, autostart=false) {
		super();
		this._total_time = time;
		this._interval_id;
		this._last_seconds_left;
		this._stopwatch = new StopWatch();
		this._stopwatch.on("pause", ()=>{
			clearInterval(this._interval_id);
			this.emit("pause");
		});
		this._stopwatch.on("start", ()=>{
			this._interval_id = setInterval(()=>this.tick(), Timer.TICK_INTERVAL);
			this.emit("start");
		})
		this._stopwatch.on("reset", ()=>{
			this._last_seconds_left = this.seconds_left;
			this.emit("reset");
			this.emit("second", this._last_seconds_left);
		})
		if (autostart) this.restart();
	}

	restart(time) {
		if (time !== undefined) this._total_time = time;
		this._stopwatch.reset();
		this.resume();
	}

	tick() {
		var seconds_left = this.seconds_left;
		for (var i = this._last_seconds_left-1; i >= seconds_left; i--) {
			this.emit("second", i);
		}
		this._last_seconds_left = seconds_left;
		this.emit("tick");
		if (this.finished) {
			this.pause();
			this.emit("finish");
		}
	}

	pause() {
		this._stopwatch.pause();
	}

	resume() {
		this._stopwatch.resume();
	}

	reset() {
		this._stopwatch.reset();
	}

	destroy() {
		this._stopwatch.destroy();
		this.removeAllListeners();
	}
}

export default Timer;