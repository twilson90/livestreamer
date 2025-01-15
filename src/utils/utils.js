import { md5 } from "./md5.js";
export { md5 } from "./md5.js";

const FLT_EPSILON = 1.19209290e-7;
export const path_separator_regex = /[\\\/]+/g;
export const emoji_regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;

var DIVIDERS = {
	d: 24 * 60 * 60 * 1000,
	h: 60 * 60 * 1000,
	m: 60 * 1000,
	s: 1000,
};

export class RefException extends Error {
	constructor(str) {
		super(`Invalid reference : ${str}`)
	}
}

export class PromisePool {
	get full() { return this.executing.size >= this.limit; }
	constructor(limit=Infinity) {
		this.executing = new Set();
		this.queue = [];
		this.limit = limit;
	}
	_next() {
		if (this.queue.length == 0 || this.executing.size >= this.limit) return;
		const [cb, resolve] = this.queue.shift();
		const p = Promise.resolve(cb());
		this.executing.add(p);
		p.then(resolve);
		p.finally(()=>{
			this.executing.delete(p);
			this._next();
		});
	}
	enqueue(cb) {
		return new Promise((resolve)=>{
			this.queue.push([cb, resolve]);
			this._next();
		});
	}
}

export class EventEmitter {
	_events = {};
	constructor(){
		this.addEventListener = this.on;
		this.addListener = this.on;
		this.removeEventListener = this.off;
		this.removeListener = this.off;
	}
	
	on(event, listener) {
		if (typeof this._events[event] !== 'object') this._events[event] = [];
		this._events[event].push(listener);
	};
	
	removeAllListeners() {
		clear(this._events);
	};

	off(event, listener) {
		if (!event) {
			this.removeAllListeners();
			return;
		}
		if (typeof this._events[event] !== 'object') return;
		if (listener) array_remove(this._events[event], listener);
		else clear(this._events[event]);
	}
	
	emit(event, ...args) {
		if (typeof this._events[event] !== 'object') return;
		for (var l of [...this._events[event]]) l.apply(this, args);
	};
	
	once(event, listener) {
		var listener_wrapped = (...args)=>{
			this.removeListener(event, listener_wrapped);
			listener.apply(this, args);
		}
		this.on(event, listener_wrapped);
	};
}

export class Timer extends EventEmitter {
	get time_left() { return Math.max(0, this._total_time - this._stopwatch.time); }
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
Timer.TICK_INTERVAL = 1000/60;
	
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

export class Diff {
	constructor(old_value, new_value) {
		if (old_value === new_value) this.type = 0;
		if (old_value === undefined) this.type = Diff.CREATED;
		else if (new_value === undefined) this.type = Diff.DELETED;
		else this.type = Diff.CHANGED;
		this.old_value = old_value;
		this.new_value = new_value;
		Object.freeze(this);
	}
}

Diff.CREATED = 1;
Diff.DELETED = 2;
Diff.CHANGED = 3;

/* class History {
	get current() { return this.get(this.i); }
	get prev() { return this.get(this.i-1); }
	get next() { return this.get(this.i+1); }
	get can_go_back() { return this.has(this.i-1); }
	get can_go_forward() { return this.has(this.i+1); }
	constructor(length=512, json_encode=false, compress=false) {
		this.length = length;
		this.reset();
		if (compress && !!window.LZUTF8) this.compress = true;
		this.json_encode = json_encode;
	}
	push(state) {
		this.i++;
		var s = typeof state === "string";
		if (this.json_encode) state = JSON.stringify(state);
		if (this.compress) state = LZUTF8.compress(state);
		this.states[this.i%this.length] = {states:state,i:this.i};
		for (var i = this.i; i < this.i + this.length; i++) {
			var o = this.states[i%this.length];
			if (!o || o.i <= this.i) break;
			this.states[i%this.length] = null;
		}
	}
	has(i) {
		var s = this.states[i%this.length];
		return (s && s.i == i);
	}
	get(i) {
		if (!this.has(i)) return;
		var state = s.state;
		if (this.compress) state = LZUTF8.decompress(state);
		if (this.json_encode) state = JSON.parse(state);
		else return state;
	}
	goto(i) {
		if (!this.has(i)) return;
		this.i = i;
		return this.current;
	}
	go_back() { return this.goto(this.i-1); }
	go_forward() { return this.goto(this.i+1); }
	reset() {
		this.i = -1;
		this.states = new Array(this.length);
	}
} */
export class URLParams {
	constructor(params_str) {
		this._params = [];
		if (!params_str) return;
		if (params_str.substr(0,1) == "?") params_str = params_str.slice(1);
		for (var p of params_str.split("&")) {
			this.append(...p.split("="));
		}
	}
	append(param, value = undefined) {
		var p = {name: param};
		if (value !== undefined) p.value = String(value);
		Object.freeze(p);
		this._params.push(p);
	}
	remove(param) {
		if (typeof param === "object") {
			this._params.filter(p=>p !== param);
		} else {
			this._params = this._params.filter(p=>p.name != param);
		}
	}
	*[Symbol.iterator]() {
		for (var p of this._params) yield p;
	}
	toString() {
		return this._params.map(p=>{
			if (p.value === undefined) return p.name;
			return `${p.name}=${p.value}`
		}).join("&");
	}
}

export class Point {
	constructor(x,y) {
		this.x = x;
		this.y = y;
	}
}
Point.distance = function(x1,y1,x2,y2) {
	return Math.sqrt(Math.pow(x2-x1,2),Math.pow(y2-y1,2));
}

export class Rectangle {
	get left() { return this.x; }
	set left(value) { var d = value - this.x; this.x += d; this.width -= d; }
	get top() { return this.y; }
	set top(value) { var d = value - this.y; this.y += d; this.height -= d; }
	get right() { return this.x + this.width; }
	set right(value) { this.width += value - this.right; }
	get bottom() { return this.y + this.height; }
	set bottom(value) { this.height += value - this.bottom; }

	get center() { return {x:this.x + this.width/2, y:this.y + this.height/2}; }
	
	constructor(...args) {
		args = (()=>{
			if (args.length == 4) return args;
			if (args.length == 2) return [0,0,...args];
			if (args.length == 1) {
				if (Array.isArray(args[0])) return args[0];
				if (typeof args[0] === "object") {
					var {x,y,width,height,left,right,bottom,top} = args[0];
					if (x == undefined) x = left;
					if (y == undefined) y = top;
					if (width == undefined) width = right-left;
					if (height == undefined) height = bottom-top;
					return [x,y,width,height];
				}
			}
			if (args.length == 0) return [0,0,0,0];
		})();
		this.x = +args[0] || 0;
		this.y = +args[1] || 0;
		this.width = +args[2] || 0;
		this.height = +args[3] || 0;
	}
	update(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}
	contains(obj) {
		if (!obj.width && !obj.height) return obj.x > this.left && obj.x < this.right && obj.y > this.top && obj.y < this.bottom;
		return obj.x > this.left && (obj.x + obj.width) < this.right && obj.y > this.top && (obj.y + obj.height) < this.bottom;
	}
	intersects(obj) {
		return (obj.x + obj.width) > this.left && obj.x < this.right && (obj.y + obj.height) > this.top && obj.y < this.bottom;
	}
	union(obj) {
		var x = Math.min(obj.x, this.x);
		var y  = Math.min(obj.y, this.y);
		var right = Math.max(obj.x + (obj.width || 0), this.right);
		var bottom = Math.max(obj.y + (obj.height || 0), this.bottom);
		return new Rectangle(x, y, right-x, bottom-y);
	}
	intersection(obj) {
		var x = Math.max(obj.x, this.x);
		var y = Math.max(obj.y, this.y);
		var right = Math.min(obj.x + obj.width, this.right);
		var bottom = Math.min(obj.y + obj.height, this.bottom);
		return new Rectangle(x, y, right-x, bottom-y);
	}
	scale(x,y) {
		if (y === undefined) y = x;
		this.x *= x;
		this.y *= y;
		this.width *= x;
		this.height *= y;
		return this;
	}
	expand(x,y) {
		if (y === undefined) y = x;
		this.x -= x/2;
		this.y -= y/2;
		this.width += x;
		this.height += y;
		return this;
	}
	fix() {
		if (this.width < 0) {
			this.x += this.width;
			this.width *= -1;
		}
		if (this.height < 0) {
			this.y += this.height;
			this.height *= -1;
		}
		return this;
	}
	clone() {
		return new Rectangle(this.x, this.y, this.width, this.height);
	}
	equals(obj) {
		try { return this.x === obj.x && this.y === obj.y && this.width === obj.width && this.height === obj.height; } catch { return false; }
	}
	toString() {
		return `[Rectangle x:${this.x} y:${this.y} width:${this.width} height:${this.height}]`;
	}
	toJSON() {
		return {x:this.x, y:this.y, width:this.width, height:this.height};
	}
}

Rectangle.union = function(...rects) {
	var x = Math.min(...rects.map(r=>r.x));
	var y = Math.min(...rects.map(r=>r.y));
	var right = Math.max(...rects.map(r=>r.x+r.width));
	var bottom = Math.max(...rects.map(r=>r.y+r.height));
	return new Rectangle(x, y, right - x, bottom - y);
}

Rectangle.intersection = function(...rects) {
	var x = Math.max(...rects.map(r=>r.x));
	var y = Math.max(...rects.map(r=>r.y));
	var right = Math.min(...rects.map(r=>r.x+r.width));
	var bottom = Math.min(...rects.map(r=>r.y+r.height));
	return new Rectangle(x, y, right - x, bottom - y);
}
export class TimeoutError extends Error {
	constructor(message) {
		super(message);
		this.name = "TimeoutError";
	}
}
export class Color {
	get r() { return this._r; }
	get g() { return this._g; }
	get b() { return this._b; }
	get h() { return this._h; }
	get s() { return this._s; }
	get l() { return this._l; }
	get a() { return this._a; }

	constructor(...components) {
		this._r = 0;
		this._g = 0;
		this._b = 0;
		this._h = 0;
		this._s = 0;
		this._l = 0;
		this._a = 1.0;

		if (components.length == 1) {
			var c = components[0];
			if (Array.isArray(c)) {s
				components = [...c];
			} else if (typeof c === "object") {
				components = [c.r || c.red || 0, c.g || c.green || 0, c.b || c.blue || 0, c.a || c.alpha || 1];
			} else if (typeof c === "string") {
				if (c.charAt(0) === "#") c = c.slice(1);
				else if (c.substring(0,2) === "0x") c = c.slice(2);
				if (c.length < 6) components = c.split("").map(a=>a+a);
				else components = c.match(/.{1,2}/g);
			}
		}
		components = components.map(c=>{
			if (typeof c === "string" && c.match(/^[0-9a-f]{2}$/)) return parseInt(c,16);
			return +c;
		})
		this.from_rgba(...components);
	}

	from_hsl(h=0, s=0, l=0) { return this.from_hsla(h,s,l,1); }
	from_hsla(h=0, s=0, l=0, a=1) {
		this._h = h = clamp(h, 0, 1);
		this._s = s = clamp(s, 0, 1);
		this._l = l = clamp(l, 0, 1);
		this._a = a = clamp(a, 0, 1);
		var r, g, b;
		if (s == 0) {
			r = g = b = l;
		} else {
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = Color.hue2rgb(p, q, h + 1/3);
			g = Color.hue2rgb(p, q, h);
			b = Color.hue2rgb(p, q, h - 1/3);
		}
		this._r = Math.round(r * 255);
		this._g = Math.round(g * 255);
		this._b = Math.round(b * 255);
		return this;
	}

	from_rgb(r=0, g=0, b=0) { return this.from_rgba(r,g,b,1); }
	from_rgba(r=0, g=0, b=0, a=1) {
		this._r = r = Math.round(clamp(r, 0, 255));
		this._g = g = Math.round(clamp(g, 0, 255));
		this._b = b = Math.round(clamp(b, 0, 255));
		this._a = a = Math.round(clamp(a, 0, 1));
		r /= 255;
		g /= 255;
		b /= 255;
		var cMax = Math.max(r, g, b);
		var cMin = Math.min(r, g, b);
		var delta = cMax - cMin;
		var l = (cMax + cMin) / 2;
		var h = 0;
		var s = 0;
		if (delta == 0) h = 0;
		else if (cMax == r) h = 60 * (((g - b) / delta) % 6);
		else if (cMax == g) h = 60 * (((b - r) / delta) + 2);
		else h = 60 * (((r - g) / delta) + 4);
		s = (delta == 0) ? 0 : (delta / (1-Math.abs(2 * l - 1)));
		this._h = h;
		this._s = s;
		this._l = l;
		return this;
	}

	rgb_mix(c,m=0.5) { return this.rgba_mix(c, m); }
	rgba_mix(c, m=0.5) {
		c = Color.from(c);
		return new Color(lerp(this._r, c.r, m), lerp(this._g, c.g, m), lerp(this._b, c.b, m), lerp(this._a, c.a, m));
	}
	
	hsl_mix(c,m=0.5) { return this.hsla_mix(c, m); }
	hsla_mix(c, m=0.5) {
		c = Color.from(c);
		return new Color(lerp(this._h, c.h, m), lerp(this._s, c.s, m), lerp(this._l, c.l, m), lerp(this._a, c.a, m));
	}

	to_hsl_array() { return [this._h, this._s, this._l]; }
	to_rgb_array() { return [this._r, this._g, this._b]; }
	to_hsla_array() { return [this._h, this._s, this._l, this._a]; }
	to_rgba_array() { return [this._r, this._g, this._b, this._a]; }
	to_hsl_string() { return `hsl(${this._h}, ${this._s}, ${this._l})`; }
	to_rgb_string() { return `rgb(${this._r}, ${this._g}, ${this._b})`; }
	to_hsla_string() { return `hsla(${this._h}, ${this._s}, ${this._l}, ${this._a})`; }
	to_rgba_string() { return `rgba(${this._r}, ${this._g}, ${this._b}, ${this._a})`; }
	to_rgb_hex() { return `#${this._r.toString(16)}${this._g.toString(16)}${this._b.toString(16)}` }
	to_rgba_hex() { return `#${this._r.toString(16)}${this._g.toString(16)}${this._b.toString(16)}${this._a.toString(16)}` }

	toString() {
		return this.to_rgba_string();
	}

	copy() {
		var c = new Color();
		c._r = this._r;
		c._g = this._g;
		c._b = this._b;
		c._h = this._h;
		c._s = this._s;
		c._l = this._l;
		c._a = this._a;
		return c;
	}
}

Color.from = function(...components) {
	if (components.length === 1 && components[0] instanceof Color) {
		return components[0];
	}
	return new Color(...components);
}

Color.mix = function(c1, c2, m=0.5) {
	return Color.from(c1).mix(c2, m);
}

Color.hue_to_rgb = function(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1/6) return p + (q - p) * 6 * t;
	if (t < 1/2) return q;
	if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
	return p;
}

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
		if (this.#options.await) await this._current_promise;
		if (!this.#destroyed && ticks == this.#ticks) {
			this.#last_tick = Date.now();
			this._current_promise = Promise.resolve(this.callback.apply(this.options.context, callback_args));
			this.next();
		}
		return this._current_promise;
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

export function options_proxy(opts) {
	return new Proxy(opts, {
		get(target, prop, receiver) {
			if (prop in target) {
				if (typeof target[prop] === "function") return target[prop]();
				return target[prop];
			}
		}
	});
}

export class OrderedSet {
	constructor(items) {
		this.set = new Set();
		this.array = [];
		if (Symbol.iterator in Object(items)) {
			for (var i of items) this.add(i);
		}
	}
	add(item) {
		if (this.set.has(item)) return false;
		this.set.add(item);
		this.array.push(item);
		return true;
	}
	delete(item) {
		if (!this.set.has(item)) return false;
		this.set.delete(item);
		this.array.splice(this.array.indexOf(item), 1);
		return true;
	}
	clear() {
		this.set.clear();
		this.array = [];
	}
	has(item) {
		return this.set.has(item);
	}
	indexOf(item) {
		return this.array.indexOf(item);
	}
	get size() {
		return this.set.size;
	}
	[Symbol.iterator]() {
		return this.array[Symbol.iterator]();
	}
}

/** @typedef {{path:string, type:string, old_value:any new_value:any, nested:boolean}} ObserverChange */
/** @callback ObserverListenerCallback @param {ObserverChange} change */

export const Observer = (()=>{
	const Observer_core = Symbol("Observer_core");
	const Observer_target = Symbol("Observer_target");

	function try_is_instance(target, type) {
		try { return target instanceof type; } catch { return false; }
	}

	const CHANGE = Object.freeze({
		set: "set",
		update: "update",
		delete: "delete",
	});

	// var force_emit = false;
	/** @return {Proxy} */
	function Observer(target) {
		var _this = this;
		/** @type {ObserverListenerCallback[]} */
		var listeners = [];
		var parents = new Map();

		function listen(cb) {
			listeners.push(cb);
		}
		function unlisten(cb) {
			array_remove(listeners, cb);
		}
		function destroy() {
			listeners.splice(0, listeners.length);
			/* for (var [key, parent] of Array.from(parents)) {
				delete parent.proxy[key];
			} */
		}
		function emit(path, type, old_value, new_value, nested=false) {
			// technically accurate - to track changes objects must be deep copied here... but unnecessary for my purposes.
			// if (Observer.is_proxy(old_value)) old_value = deep_copy(old_value);
			// if (Observer.is_proxy(new_value)) new_value = deep_copy(new_value);
			if (listeners.length) {
				for (var listener of listeners) {
					listener.apply(_this, [{
						path,
						type,
						old_value,
						new_value,
						nested
					}]);
				}
			}

			for (var [key, parent] of parents) {
				parent.emit([key, ...path], type, old_value, new_value, nested);
			}
		}

		Object.assign(this, {
			parents,
			listen,
			unlisten,
			destroy,
			emit,
		});

		// -----------------

		function walk(o, delegate, path=[]) {
			if (typeof o !== "object" || o === null) return;
			for (var k in o) {
				var sub_path = [...path, k];
				delegate.apply(o, [sub_path, o[k]]);
				walk(o[k], delegate,  sub_path);
			}
		}

		function klaw(o, delegate, path=[]) {
			if (typeof o !== "object" || o === null) return;
			for (var k in o) {
				var sub_path = [...path, k];
				klaw(o[k], delegate, sub_path);
				delegate.apply(o, [sub_path, o[k]]);
			}
		}
		
		function try_unregister_child(child, prop) {
			var child_observer = Observer.get_observer(child);
			if (child_observer && child_observer instanceof Observer) {
				klaw(child, (path,val)=>{
					emit([prop, ...path], CHANGE.delete, val, undefined, true);
				});
				child_observer.parents.delete(prop);
			}
		}
		function try_register_child(child, prop) {
			var child_observer = Observer.get_observer(child);
			if (child_observer && child_observer instanceof Observer) {
				walk(child, (path,val)=>{
					emit([prop, ...path], CHANGE.set, undefined, val, true);
				});
				child_observer.parents.set(prop, _this);
			}
		}

		// -----------------

		// !! Arrays (shift(), splice(), etc.) produce TONS of events... consider replacing arrays with special object that doesnt emit so many changes.

		var validator = {
			get(target, prop) {
				if (prop === Observer_core) return _this;
				if (prop === Observer_target) return target;
				return target[prop];
			},
			set(target, prop, new_value) {
				var old_value = target[prop];
				new_value = Observer.resolve(new_value);
				var changed = old_value !== new_value;
				if (changed) {
					var type = (target[prop] === undefined) ? CHANGE.set : CHANGE.update;
					try_unregister_child(old_value, prop);
					target[prop] = new_value;
					emit([prop], type, old_value, new_value);
					try_register_child(new_value, prop);
				}
				return true;
			},
			deleteProperty(target, prop) {
				if (prop in target) {
					var old_value = target[prop];
					try_unregister_child(old_value, prop);
					delete target[prop];
					emit([prop], CHANGE.delete, old_value, undefined);
				}
				return true;
			},
			// defineProperty(target, prop, descriptor) {
			// },
			// enumerate(target, prop) {
			// },
			// ownKeys(target, prop) {
			// },
			// has(target, prop) {
			// },
			// getOwnPropertyDescriptor(target, prop) {
			// },
			// construct(target, prop) {
			// },
			// apply(target, thisArg, argumentsList) {
			// }
		};
		var proxy = new Proxy(Array.isArray(target) ? [] : {}, validator);
		Object.assign(proxy, target);
		_this.proxy = proxy;
		return proxy;
	}
	var RESET_KEY = "__RESET_0f726b__";
	Observer.RESET_KEY = RESET_KEY;
	Observer.get_observer = function(proxy) {
		if (proxy == null) return null;
		return proxy[Observer_core];
	};
	Observer.get_target = function(proxy) {
		if (proxy == null) return null;
		return proxy[Observer_target];
	};
	Observer.is_proxy = function(proxy) {
		return !!Observer.get_observer(proxy);
	};
	/** @param {ObserverListenerCallback} cb */
	Observer.listen = function(proxy, cb) {
		var observer = Observer.get_observer(proxy);
		if (observer) observer.listen(cb);
		return cb;
	};
	/** @param {ObserverListenerCallback} cb */
	Observer.unlisten = function(proxy, cb) {
		var observer = Observer.get_observer(proxy);
		if (observer) observer.unlisten(cb);
	};
	Observer.resolve = function(object) {
		if (Observer.is_proxy(object) || object === null || typeof object !== "object") return object;
		return new Observer(object);
	};
	Observer.destroy = function(proxy) {
		var observer = Observer.get_observer(proxy);
		if (observer) observer.destroy();
	};
	Observer.flatten_changes = function(changes) {
		let result = {};
		for (let c of changes) {
			let key = c.path[c.path.length-1];
			let r = result;
			for (let i = 0; i < c.path.length-1; i++) {
				let p = c.path[i];
				if (r[p] === undefined) r[p] = {};
				r = r[p];
			}
			let new_value = c.new_value;
			if (Observer.is_proxy(new_value)) {
				let target = Observer.get_target(new_value);
				new_value = {};
				if (c.old_value !== null) {
					new_value[RESET_KEY] = target.constructor.name;
				}
			}
			r[key] = new_value;
		}
		return result;
	};

	// root must be object, not array.
	Observer.apply_changes = function(target, changes) {
		if (Array.isArray(changes)) {
			changes = Observer.flatten_changes(changes);
		}
		var apply = (target, changes) =>{
			for (var k in changes)  {
				if (k === RESET_KEY) continue;
				if (typeof changes[k] === 'object' && changes[k] !== null) {
					if (RESET_KEY in changes[k]) {
						// if (!target[k]) {
						// 	target[k] = new (eval(changes[k][RESET_KEY]))();
						// } else {
						// 	clear(target[k]); // VERY IMPORTANT - this keeps any prototype stuff.
						// }
						if (target[k]) {
							// target[k] = new (target[k].constructor)();
							if (target[k][Observer.RESET_KEY]) {
								target[k][Observer.RESET_KEY]();
							} else {
								clear(target[k]);
							}
						} else {
							target[k] = new (eval(changes[k][RESET_KEY]))();
						}
					}
					if (typeof target[k] !== "object" || target[k] === null) {
						target[k] = (Array.isArray(changes[k])) ? [] : {};
					}
					apply(target[k], changes[k]);
					if (Array.isArray(changes[k])) target[k].length = changes[k].length;
					
				} else if (changes[k] === null) {
					delete target[k];
				} else {
					target[k] = changes[k];
				}
			}
		};
		apply(target, changes);
	}
	return Observer;
})();

/** @typedef {{[0]:number, [1]:number, next:RangeTreeNode}} RangeTreeNode */
export class RangeTree {
	constructor(values) {
		/** @type {RangeTreeNode} */
		this._first = null;
		if (values) {
			for (var v of values) this.add(v[0], v[1]);
		}
	}
	get values () { return [...this]; }
	get total () {
		var a = 0;
		for (var p of this) a += p[1]-p[0];
		return a;
	}
	add(start, end) {
		if (start < 0) throw new Error(`start must be >= 0: ${start}`);
		if (start > end) throw new Error(`start must be smaller than end: ${start} > ${end}`);
		if (start == end) return;
		/** @type {RangeTreeNode} */
		let new_node = [start, end];
		if (!this._first || new_node[0] < this._first[0]) {
			new_node.next = this._first;
			this._first = new_node;
		}
		let curr = this._first;
		while (curr) {
			if (!curr.next || curr.next[0] > new_node[0]) {
				let n = curr.next;
				curr.next = new_node;
				new_node.next = n;
				if (new_node[0] <= curr[1] && new_node[0] >= curr[0]) {
					curr[1] = Math.max(new_node[1], curr[1]);
					curr.next = new_node.next;
				}
				if (new_node[1] <= curr[0] && new_node[1] >= curr[1]) {
					curr[0] = Math.min(new_node[0], curr[0]);
					curr.next = new_node.next;
				}
				while (curr.next && curr[1] >= curr.next[0]) {
					curr[1] = Math.max(curr[1], curr.next[1]);
					curr.next = curr.next.next;
				}
				break;
			}
			curr = curr.next;
		}
	}
	includes(low, high) {
		if (!high) high = low;
		for (let r of this) {
			if (low>=r[0] && high<=r[1]) return true;
		}
		return false;
	}
	*[Symbol.iterator]() {
		var next = this._first;
		while(next) {
			if (next) yield [...next];
			next = next.next;
		}
	}
}
export const regex = {
	urls: /(https?:\/\/[^\s]+)/gi
}
export function is_valid_url(str) {
	return /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/i.test(str);
}
export function is_valid_rtmp_url(str) {
	return /^rtmps?\:\/\//i.test(str)
}
export function is_valid_ip(str) {
	return /((^((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$)|(^((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?$))/.test(str);
}
export function is_uri(s) {
	return /^[a-z]{2,}\:\/\//.test(String(s));
}
export function is_absolute_path(s) {
	return /^(?:[a-zA-Z]\:[\\/]|\/)/.test(String(s));
}
// includes subdomains
export function domain_match(uri, domain) {
	try { uri = new URL(uri).hostname || uri; } catch {}
	return !!uri.match(`^(?:[^:]+:\\/\\/)?(?:.+?\.)?(${escape_regex(domain)})(?:\/|$)`)
}
export function capitalize(str) {
	return String(str).replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}
export function kebabcase(str) {
	return String(str).replace(/([a-z])([A-Z])/g, "$1-$2")
	.replace(/[\s_]+/g, '-')
	.toLowerCase();
}
export function escape_regex(str) {
	return String(str).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
export function split_after_first_line(str) {
	var m = str.match(/(.+?)[\n\r]+/);
	return m ? [m[1], str.slice(m[0].length)] : [str, undefined];
}
/* str_to_js(str) {
	try { return JSON.parse(str); } catch (e) { }
	return str;
}, */
export function is_numeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
export function zip(...its) {
	its = its.map(it=>Array.isArray(it)?it:[...it]);
	return its[0].map((_,i)=>its.map(a=>a[i]));
}
/* export function zip(keys, values) {
	return keys.reduce(
		(obj, key, i)=>{
			obj[key] = values[i];
			return obj;
		}, {}
	);
} */
/** @template T @param {Iterable<T>} a @param {Iterable<T>} b @return {Set<T>} */
export function set_union(a,b) {
	return new Set([...a, ...b]);
}
/** @template T @param {Iterable<T>} a @param {Iterable<T>} b @return {Set<T>} */
export function set_difference(a,b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x=>!b.has(x)));
}
/** @template T @param {Iterable<T>} a @param {Iterable<T>} b @return {Set<T>} */
export function set_intersection(a,b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x=>b.has(x)));
}
export function sets_equal(...sets) {
	var seta = sets[0];
	if (!(seta instanceof Set)) seta = new Set(seta);
	for (var setb of sets.slice(1)) {
		if (!(setb instanceof Set)) setb = new Set(setb);
		if (seta.size !== setb.size) return false;
		for (var a of seta) {
			if (!setb.has(a)) return false;
		}
	}
	return true;
}
/** @template T @param {function():T} func @return {Promise<T>} */
export function debounce(func, t=0) {
    var timeout_id, args, context, promise, resolve;
    var later = ()=>{
		resolve(func.apply(context, args));
		promise = null;
	}
    var debounced = function(...p) {
        context = this;
        args = p;
		return promise = promise || new Promise(r=>{
            resolve = r;
            timeout_id = setTimeout(later, t);
        });
    };
    debounced.cancel = ()=>{
		clearTimeout(timeout_id);
		promise = null;
	}
    return debounced;
}
export function throttle(func, wait, options) {
	var timeout, context, args, result;
	var previous = 0;
	if (!options) options = {};
	var later = function() {
		previous = options.leading === false ? 0 : now();
		timeout = null;
		result = func.apply(context, args);
		if (!timeout) context = args = null;
	};
	var throttled = function() {
		var _now = now();
		if (!previous && options.leading === false) previous = _now;
		var remaining = wait - (_now - previous);
		context = this;
		args = arguments;
		if (remaining <= 0 || remaining > wait) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			previous = _now;
			result = func.apply(context, args);
			if (!timeout) context = args = null;
		} else if (!timeout && options.trailing !== false) {
			timeout = setTimeout(later, remaining);
		}
		return result;
	};
	throttled.cancel = function() {
		clearTimeout(timeout);
		previous = 0;
		timeout = context = args = null;
	};
	return throttled;
}
export function almost_equal(a,b,epsilon=FLT_EPSILON) {
	var d = Math.abs(a-b);
	return d <= epsilon;
}
/* sync_objects(src, dst) {
	var dst_keys = new Set(Object.keys(dst));
	for (var k in src) {
		dst_keys.delete(k);
		if (dst[k] !== src[k]) dst[k] = src[k];
	}
	for (var k of dst_keys) {
		delete dst[k];
	}
}, */
export function sanitize_filename(name) {
	return String(name).toLowerCase().replace(/^\W+/,"").replace(/\W+$/,"").replace(/\W+/g,"-").trim().slice(0,128);
}
export function remove_nulls(obj) {
	if (Array.isArray(obj)) {
		var i = obj.length;
		while (i--) {
			if (obj[i] == null) obj.splice(i, 1);
		}
	} else {
		for (var k of Object.keys(obj)) {
			if (obj[k] == null) delete obj[k];
		}
	}
}
/** @template T @param {Iterable<T>} values @param {function(T):string} cb @return {Record<PropertyKey,T[]>} */
export function group_by(values, cb) {
	var groups = {};
	for (var value of values) {
		var key = cb(value);
		if (!groups[key]) groups[key] = [];
		groups[key].push(value);
	}
	return groups;
}
/** @template T, K @param {Iterable<T>} values @param {function(T):K} cb @return {Map<K,T[]>} */
export function map_group_by(values, cb) {
	/** @type {Map<T,K[]>} */
	var groups = new Map(); 
	for (var value of values) {
		var key = cb(value);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(value);
	}
	return groups;
}
export function is_path_remote(path_str) {
	return path_str.includes("://");
}
export function transpose(array) {
	return array[0].map((_, c) => array.map(row => row[c]));
}
export function format_bytes(bytes, decimals = 2, min=1) {
	decimals = Math.max(decimals, 0);
	var k = 1024;
	var sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
	var i = clamp(Math.floor(Math.log(bytes) / Math.log(k)), min, sizes.length-1);
	if (!isFinite(i)) i = 0;
	return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}
export function format_bytes_short(value, unit="k") {
	unit = unit.toLowerCase();
    if (unit.startsWith("b")) return String(Math.floor(value*8))+"bps"
    if (unit.startsWith("k")) return String(Math.floor(value/1000*8))+"kb"
    if (unit.startsWith("m")) return String(Math.floor(value/1000/1000*8))+"mb"
    if (unit.startsWith("g")) return String(Math.floor(value/1000/1000/1000*8))+"gb"
}
/** @param {string} s */
export function string_to_bytes(s) {
	var m = s.match(/[a-z]+/i);
	var num = parseFloat(s);
	var e = 1;
	var unit = m[0] || "";
	if (m = unit.match(/^ki(bi)?/i)) e = 1024;
	else if (m = unit.match(/^k(ilo)?/i)) e = 1000;
	else if (m = unit.match(/^mi(bi)?/i)) e = Math.pow(1024,2);
	else if (m = unit.match(/^m(ega)?/i)) e = Math.pow(1000,2);
	else if (m = unit.match(/^gi(bi)?/i)) e = Math.pow(1024,3);
	else if (m = unit.match(/^g(iga)?/i)) e = Math.pow(1000,3);
	else if (m = unit.match(/^ti(bi)?/i)) e = Math.pow(1024,4);
	else if (m = unit.match(/^t(era)?/i)) e = Math.pow(1000,4);
	else if (m = unit.match(/^pi(bi)?/i)) e = Math.pow(1024,5);
	else if (m = unit.match(/^p(eta)?/i)) e = Math.pow(1000,5);
	unit = unit.slice(m ? m[0].length : 0);
	if (unit.match(/^b(?!yte)/)) num /= 8; // important lower case, uppercase B means byte usually;
	return num * e;
}
export function is_ip_local(ip) {
	return ip === "127.0.0.1" || ip === "::1" || ip == "::ffff:127.0.0.1"
}
export function date_to_string(date, options) {
	if (date === undefined) date = Date.now();
	options = Object.assign({
		date: true,
		time: true,
		delimiter: "-",
	}, options)
	date = new Date(date);
	var parts = date.toISOString().slice(0,-1).split("T");
	if (!options.time) parts.splice(1,1);
	if (!options.date) parts.splice(0,1);
	var str = parts.join("-").replace(/[^\d]+/g, options.delimiter);
	return str;
}
export function uniquify(arr, resolver) {
	if (!resolver) resolver = (s,i,n)=>n>1?`${s} [${i+1}]`:`${s}`;
	var map = new Map();
	for (var e of arr) {
		if (map.has(e)) map.set(map.get(e)+1);
		else map.set(e, 1);
	}
	return arr.map((e,i)=>{
		var n = map.get(e);
		return resolver.apply(null, [e,i,n]);
	})
}
export function time_delta_readable(delta) {
	var time_formats = [
		[1, '1 second ago', '1 second from now'],
		[60, 'seconds', 1],
		[60*2, '1 minute ago', '1 minute from now'],
		[60*60, 'minutes', 60],
		[60*60*2, '1 hour ago', '1 hour from now'],
		[60*60*24, 'hours', 60*60],
		[60*60*24*2, 'Yesterday', 'Tomorrow'],
		[60*60*24*7, 'days', 60*60*24],
		[60*60*24*7*2, 'Last week', 'Next week'],
		[60*60*24*7*4, 'weeks', 60*60*24*7],
		[60*60*24*7*4*2, 'Last month', 'Next month'],
		[60*60*24*7*4*12, 'months', 60*60*24*30],
		[60*60*24*7*4*12*2, 'Last year', 'Next year'],
		[60*60*24*7*4*12*100, 'years', 60*60*24*365],
		[60*60*24*7*4*12*100*2, 'Last century', 'Next century'],
		[60*60*24*7*4*12*100*20, 'centuries', 60*60*24*365*100]
	];
	var seconds = Math.floor(delta / 1000);
	if (seconds == 0) return 'Just now'
	var [token, i] = (seconds < 0) ? ["ago", 1] : ['from now', 2];
	seconds = Math.abs(seconds);
	for (var format of time_formats) {
		if (seconds >= format[0]) continue;
		return (typeof format[2] === 'string') ? format[i] : `${Math.floor(seconds / format[2])} ${format[1]} ${token}`;
	}
	return time;
}
export function time_diff_readable(from, to) {
	if (from && !to) [from,to] = [new Date(),from];
	if (!from) from = new Date();
	if (!to) to = new Date();
	return time_delta_readable(to-from);
}
export function split_path(path) {
	return path.split(path_separator_regex).filter(p=>p);
}
/* register_change(obj, name) {
	return (key,value) => {
		// if key is int, value an array element.
		if (typeof key === "number") {
			if (!obj[name]) obj[name] = [];
			obj[name].push(value);
		} else {
			if (!obj[name]) obj[name] = {};
			obj[name][key] = value;
		}
	}
}, */
export function is_plain_object(obj) {
	return	typeof obj === 'object' && obj !== null && obj.constructor === Object && Object.prototype.toString.call(obj) === '[object Object]';
}
export function websocket_ready(ws){
	var is_open = ws ? ws.readyState === 1 : false
	if (is_open) return Promise.resolve();
	return new Promise(resolve=>{
		ws.on("open", ()=>resolve());
	});
}
/* once(event_emitter, event){
	return new Promise(resolve=>{
		event_emitter.once(event, (...args)=>{
			resolve(...args);
		})
	})
}, */
/** @template T @param {Object.<string,T|PromiseLike<T>>} obj @returns {Object.<string,Promise<Awaited<T>[]>>}; */
export async function promise_all_object(obj) {
	var new_obj = {};
	await Promise.all(Object.entries(obj).map(([k,p])=>Promise.resolve(p).then(data=>new_obj[k]=data)));
	return new_obj;
}
export function replace_all(str, search, replace) {
	return str.split(search).join(replace);
}
export function shuffle(arra1) {
	var ctr = arra1.length, temp, index;
	while (ctr > 0) {
		index = Math.floor(Math.random() * ctr);
		ctr--;
		temp = arra1[ctr];
		arra1[ctr] = arra1[index];
		arra1[index] = temp;
	}
	return arra1;
}
export function matchAll(s, re) {
	var matches = [], m = null;
	while (m = re.exec(s)) {
		matches.push(m);
	}
	return matches;
}
export function promise_timeout(promise, ms=10000) {
	if (typeof promise === "function") promise = new Promise(promise);
	if (!ms || ms <= 0) return promise;
	return new Promise((resolve, reject)=>{
		setTimeout(()=>{
			reject(new TimeoutError(`Timed out in ${ms}ms.`));
		}, ms);
		promise
			.then(resolve)
			.catch(reject);
	});
	
}
export function promise_wait_atleast(promise, ms=10000) {
	return Promise.all([promise, timeout(ms)]).then((d)=>{
		return d[0];
	});
}
export function promise_pool(array, iteratorFn, poolLimit=Infinity) {
	let i = 0;
	const ret = [];
	const executing = new Set();
	array = [...array];
	const enqueue = ()=>{
		if (i === array.length) {
			return Promise.resolve();
		}
		const item = array[i];
		const p = Promise.resolve().then(()=>iteratorFn(item, i, array));
		ret.push(p);
		const e = p.then(()=>executing.delete(e));
		executing.add(e);
		let r = executing.size >= poolLimit ? Promise.race(executing) : Promise.resolve()
		i++;
		return r.then(()=>enqueue());
	};
	return enqueue().then(()=>Promise.all(ret));
}
export function timeout(ms) {
	if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
	return new Promise(resolve=>setTimeout(resolve, ms));
}
export function retry_until(cb, attempts, delay, msg) {
	return new Promise(async(resolve,reject)=>{
		while (attempts--) {
			let t = Date.now();
			try {
				return resolve(await cb());
			} catch (err) {
				console.warn(`${msg} failed, trying again [${attempts} attempts remaining]...`);
			}
			await timeout(delay-(Date.now()-t));
		}
		reject();
	});
}
export function split_string(str, partLength) {
	var list = [];
	if (str !== "" && partLength > 0) {
		for (var i = 0; i < str.length; i += partLength) {
			list.push(str.substr(i, Math.min(partLength, str.length)));
		}
	}
	return list;
}
export function remove_emojis(str) {
	return str.replace(emoji_regex, '');
}
export function array_move_before(arr, from, to) {
	if (to > from) to--;
	if (from === to) return arr;
	return array_move(arr, from, to);
}
export function array_move(arr, from, to) {
	from = clamp(from, 0, arr.length-1);
	to = clamp(to, 0, arr.length-1);
	arr.splice(to, 0, ...arr.splice(from, 1));
	return arr;
}
export function remove_duplicates(arr) {
	let s = new Set();
	let new_arr = [];
	for (var i of arr) {
		if (s.has(i)) continue;
		s.add(i);
		new_arr.push(i);
	}
	return new_arr;
}
export function timespan_str_to_seconds(str, format="hh:mm:ss") {
	return timespan_str_to_ms(str, format) / 1000;
}
// will also handle decimal points (milliseconds)
export function timespan_str_to_ms(str, format="hh:mm:ss") {
	var multiply = 1;
	if (str.startsWith("-")) {
		multiply = -1;
		str = str.slice(1);
	}
	var parts = String(str).split(/:/);
	var format_parts = format.split(/:/);
	if (format_parts.length > parts.length) format_parts = format_parts.slice(-parts.length); // so if str = "10:00" and format = "hh:mm:ss", the assumed format will be "mm:ss"
	else parts = parts.slice(-format_parts.length);
	var ms = 0;
	for (var i = 0; i < parts.length; i++) {
		var v = parseFloat(parts[i]);
		var f = format_parts[i][0];
		if (!Number.isFinite(v)) v = 0; // handles NaN & Infinity
		if (f == "d") ms += v * 24 * 60 * 60 * 1000;
		else if (f == "h") ms += v * 60 * 60 * 1000;
		else if (f == "m") ms += v * 60 * 1000;
		else if (f == "s") ms += v * 1000;
	}
	return ms * multiply;
}
// ms
export function ms_to_timespan_str(num, format="hh:mm:ss") {
	var negative = num < 0;
	num = Math.abs(+num) || 0;
	var format_parts = format.split(/([^a-z])/i).filter(m=>m);
	var parts = [];
	for (var i = 0; i < format_parts.length; i++) {
		var p = format_parts[i];
		var divider = null;
		if (p.startsWith("d")) divider = 24 * 60 * 60 * 1000;
		else if (p.startsWith("h")) divider = 60 * 60 * 1000;
		else if (p.startsWith("m")) divider = 60 * 1000;
		else if (p.startsWith("s")) divider = 1000;
		else if (p.startsWith("S")) divider = 1;
		else if (parts.length == 0) continue;
		if (p == "?") {
			if (parts[parts.length-1] == 0) parts.pop();
			continue;
		}
		if (divider) {
			var v = Math.floor(num / divider);
			p = v.toString().padStart(p.length, "0");
			num -= v * divider;
		}
		parts.push(p);
	}
	return (negative?"-":"")+parts.join("");
}
export function seconds_to_timespan_str(num, format="hh:mm:ss") {
	return ms_to_timespan_str(num*1000, format);
}
// ms
export function ms_to_shorthand_str(num, show_ms=0) {
	var negative = num < 0;
	num = Math.abs(+num) || 0;
	var parts = [];
	for (var k in DIVIDERS) {
		var divider = DIVIDERS[k];
		var d = Math.floor(num / divider);
		num -= d * divider;
		if (k == "s" && show_ms) {
			d = (d+num/1000).toFixed(+show_ms);
		}
		if (d) parts.push(`${d}${k}`);
	}
	return (negative?"-":"")+parts.join(" ");
}
export function seconds_to_human_readable_str (t, days=true, hours=true, minutes=true, seconds=true) {
	return ms_to_human_readable_str(t*1000);
}
export function ms_to_human_readable_str(t, days=true, hours=true, minutes=true, seconds=true) {
	var o = {};
	if (days) o["Day"] = 1000 * 60 * 60 * 24;
	if (hours) o["Hour"] = 1000 * 60 * 60;
	if (minutes) o["Minute"] = 1000 * 60;
	if (seconds) o["Second"] = 1000;
	var parts = [];
	for (var k in o) {
		var v = Math.floor(t / o[k]);
		if (v) parts.push(`${v.toLocaleString()} ${k}${v>1?"s":""}`);
		t -= v * o[k];
	}
	return parts.join(" ") || "0 Seconds";
}
export function array_remove(arr, item) {
	var index = arr.indexOf(item);
	if (index === -1) return false;
	arr.splice(index, 1);
	return true;
}
export function array_unique(arr) {
	return Array.from(iterate_unique(arr));
}
export function *iterate_unique(arr) {
	var seen = new Set();
	for (var a of arr) {
		if (seen.has(a)) continue;
		seen.add(a);
		yield a;
	}
}
export function random(min, max) { // min and max included
	return Math.random() * (max - min) + min;
}
export function random_int(min, max) { // min and max included
	min = ~~min;
	max = ~~max;
	return Math.floor(Math.random() * (max - min + 1) + min)
}
export function array_repeat(d, n) { // min and max included
	var arr = [];
	while (n-- > 0) arr.push(d);
	return arr;
}
export function random_string(length, chars="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
	var result = new Array(length), num_chars = chars.length;
	for (var i = length; i > 0; --i) result[i] = chars[Math.floor(Math.random() * num_chars)];
	return result.join("");
}
export function random_hex_string(length) {
	return random_string(length, "0123456789abcdef");
}
/* random_string(length) {
	[...Array(length)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
}, */
export function is_empty(obj) {
	if (!obj) return true;
	if (typeof obj !== "object") return false;
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) return false;
	}
	return true;
}
export function filter_object(obj, filter_callback, in_place=false) {
	if (in_place) {
		for (var k of Object.keys(obj)) {
			if (!filter_callback(k, obj[k])) delete obj[k];
		}
		return obj;
	} else {
		var new_obj = {};
		for (var k of Object.keys(obj)) {
			if (filter_callback(k, obj[k])) new_obj[k] = obj[k];
		}
		return new_obj;
	}
}
export function array_equals(arr1, arr2) {
	var length = arr1.length;
	if (length !== arr2.length) return false;
	for (var i = 0; i < length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}
export function all_equal(array) {
	if (array.length <= 1) return true;
	for (var i = 1; i < array.length; i++) {
		if (array[0] !== array[i]) return false;
	}
	return true;
}
/** @template T1 @param {function():T1} cb @param {*} [default_value] @returns {T1} */
function _try(cb, default_value=undefined) {
	try { return cb(); } catch { return default_value; }
}
export { _try as try };
export function clear(obj) {
	if (Array.isArray(obj)) {
		obj.splice(0,obj.length);
	} else if (typeof obj === "object") {
		for (var k of Object.keys(obj)){
			delete obj[k];
		}
	}
}
export function round_to_factor(num, f=1.0) {
	return Math.round(num / f) * f;
}
export function ceil_to_factor(num, f=1.0) {
	return Math.ceil(num / f) * f;
}
export function floor_to_factor(num, f=1.0) {
	return Math.floor(num / f) * f;
}
export function round_precise(num, precision=0) {
  var m = Math.pow(10, precision);
  return Math.round(num * m) / m;
}
export function clamp(a, min = 0, max = 1) {
	return Math.min(max, Math.max(min, a));
}
export function lerp (x, y, a) {
	return x * (1 - a) + y * a;
}
export function invlerp (x, y, a) {
	return clamp((a - x) / (y - x));
}
export function range (x1, y1, x2, y2, a) {
	return lerp(x2, y2, invlerp(x1, y1, a));
}
export function loop(num, min, max) {
	var len = max-min
	num = min + (len != 0 ? (num-min) % len : 0);
	if (num < min) num += len;
	return num;
}
export function log(n,base) {
	return Math.log(n)/(base?Math.log(base):1);
}
/** @param {Iterable<number>} iterable */
export function sum(iterable) {
	var total = 0.0;
	for (var num of iterable) {
		total += num;
	}
	return total;
}
/** @param {Iterable<number>} iterable */
export function average(...iterable) {
	var total = 0, n=0;
	for (var num of iterable) {
		total += num;
		n++;
	}
	return total / n;
}
/** @param {Iterable<number>} iterable */
export function get_best(iterable, cb) {
	var best_item = undefined, best_value = undefined, i = 0;
	for (var item of iterable) {
		var curr_value = cb(item);
		if (i == 0 || curr_value > best_item) {
			best_item = item;
			best_value = curr_value;
		}
		i++;
	}
	return best_item;
}
export function key_count(ob) {
	var i = 0;
	for (var k in ob) i++
	return i;
}
/** @template T @param {Record<PropertyKey,T>} ob @param {number} max_size  @returns {T[]} */
export function trim_object(ob, max_size) {
	var result = [];
	var num_keys = key_count(ob);
	for (var k in ob) {
		if (num_keys <= max_size) break;
		result.push(ob[k]);
		delete ob[k];
		num_keys--;
	}
	return result;
}
/**
 * @template T
 * @param {T[]} arr
 * @param {...(function(T):number)} cbs
*/
export function sort(arr, ...cbs) {
	if (!cbs.length) cbs = [v=>v];
	return arr.sort((a,b)=>{
		for (var cb of cbs) {
			var av = cb(a), bv = cb(b);
			if (!Array.isArray(av)) av = [av, "ASCENDING"];
			if (!Array.isArray(bv)) bv = [bv, "ASCENDING"];
			var m = 1;
			if (av[1] === "ASCENDING") m = 1;
			else if (av[1] === "DESCENDING") m = -1;
			else throw new Error();
			if (av[0] < bv[0]) return -1 * m;
			if (av[0] > bv[0]) return 1 * m;
		}
		return 0;
	});
}
export function set_add(set, vals) {
	for (var v of vals) set.add(v);
}
/* best(values, getter, comparator) {
	var max, best;
	for (var v of values) {
		var a = getter(v);
		if (comparator(a, max)) {
			best = v;
			max = a
		}
	}
	return best;
},
min(values, cb) {
	var min=Number.MAX_VALUE, best;
	for (var v of values) {
		var a = cb(v);
		if (a < min) {
			best = v;
			min = a
		}
	}
	return best;
},
max(values, cb) {
	var max=Number.MIN_VALUE, best;
	for (var v of values) {
		var a = cb(v);
		if (a > max) {
			best = v;
			max = a
		}
	}
	return best;
}, */
export function num_to_str(num, decimals=2) {
	return num.toLocaleString(undefined, {minimumFractionDigits: decimals,maximumFractionDigits: decimals});
}
export const Ease = {
	// no easing, no acceleration
	linear: t => t,
	// accelerating from zero velocity
	inQuad: t => t*t,
	// decelerating to zero velocity
	outQuad: t => t*(2-t),
	// acceleration until halfway, then deceleration
	inOutQuad: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
	// accelerating from zero velocity 
	inCubic: t => t*t*t,
	// decelerating to zero velocity 
	outCubic: t => (--t)*t*t+1,
	// acceleration until halfway, then deceleration 
	inOutCubic: t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
	// accelerating from zero velocity 
	inQuart: t => t*t*t*t,
	// decelerating to zero velocity 
	outQuart: t => 1-(--t)*t*t*t,
	// acceleration until halfway, then deceleration
	inOutQuart: t => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t,
	// accelerating from zero velocity
	inQuint: t => t*t*t*t*t,
	// decelerating to zero velocity
	outQuint: t => 1+(--t)*t*t*t*t,
	// acceleration until halfway, then deceleration 
	inOutQuint: t => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t
}
export function remove_trailing_slash(filename){
	return String(filename).replace(/[\/\\]+$/, "");
}
export function dirname(filename){
	filename = String(filename);
	filename = remove_trailing_slash(filename);
	return filename.substring(0, filename.length - basename(filename).length - 1);
}
export function basename(filename){
	filename = String(filename);
	return remove_trailing_slash(filename).split(path_separator_regex).pop();
}
export function split_ext(filename){
	filename = String(filename);
	var i = filename.lastIndexOf(".");
	if (i == -1) return [filename, ""];
	return [filename.substr(0, i), filename.slice(i)];
}
export function join_paths(...paths){
	var last = paths.pop();
	return [...paths.map(f=>remove_trailing_slash(f)), last].join("/");
}
export function relative_path(source, target) {
	var target_parts = String(target).split(path_separator_regex);
	var source_parts = String(source).split(path_separator_regex);
	if (array_equals(target_parts, source_parts)) {
		return ".";
	}
	var filename = target_parts.pop();
	var target_path = target_parts.join("/");
	var relative_parts = [];
	while (target_path.indexOf(source_parts.join("/")) === -1) {
		relative_parts.push("..");
		source_parts.pop();
	}
	relative_parts.push(...target_parts.slice(source_parts.length), filename);
	return relative_parts.join("/");
}
export function split_datetime(date, apply_timezone=false) {
	if (isNaN(date)) return ["", ""];
	date = +new Date(date);
	if (apply_timezone) date += - (+new Date(date).getTimezoneOffset()*60*1000);
	var parts = new Date(date).toISOString().slice(0,-1).split("T");
	if (parts[0][0]=="+") parts[0] = parts[0].slice(1);
	return parts;
}
export function join_datetime(parts, apply_timezone=false) {
	var date = +new Date(`${parts.join(" ")}Z`);
	if (apply_timezone) date += +new Date(date).getTimezoneOffset()*60*1000;
	return new Date(date);
}
export function get_property_descriptor(obj, property) {
	while(obj) {
		var d = Object.getOwnPropertyDescriptor(obj, property);
		if (d) return d;
		obj = Object.getPrototypeOf(obj);
	}
	return null;
}
/** @return {string[]} */
export function get_property_keys(obj) {
	const proto = Object.getPrototypeOf(obj);
	const inherited = (proto) ? get_property_keys(proto) : [];
	var seen = new Set(inherited);
	return [...inherited, ...Object.getOwnPropertyNames(obj).filter(k=>!seen.has(k))];
}
/* *walk(o, children_delegate) {
	for (var c of children_delegate.apply(o, [o])) {
		yield c;
		var children = walk(c,children_delegate)
		if (children && Symbol.iterator in children) {
			for (var sc of children) {
				yield sc;
			}
		}
	}
}, */
/** @template T @param {T} o @param {function(T):Iterable<T>} children_cb */
export function flatten_tree(o, children_cb) {
	/** @type {T[]} */
	var result = [];
	var next = (o)=>{
		result.push(o);
		var children = children_cb.apply(o, [o]);
		if (!children || !(Symbol.iterator in children)) return;
		for (var c of children) {
			next(c);
		}
	}
	next(o);
	return result;
}
/** @template T @param {T} obj @param {Function(any):any} replacer @return {T} */
export function deep_copy(obj, replacer) {
	if (typeof(obj) !== 'object' || obj === null) return obj;
	return JSON.parse(replacer ? JSON.stringify(obj, replacer) : JSON.stringify(obj));
}
export function deep_filter(obj, cb) {
	var new_obj = Array.isArray(obj) ? [] : {};
	for (var k of Object.keys(obj)) {
		if (typeof obj[k] === "object" && obj[k] !== null) new_obj[k] = deep_filter(obj[k], cb)
		else if (cb.apply(obj, [k, obj[k]])) new_obj[k] = obj[k];
	}
	return new_obj;
}
export function deep_merge(dst, src, delete_nulls = false) {
	var info = {
		changes: 0,
	}
	var deep_merge = (dst, src)=>{
		var is_array = Array.isArray(src);
		for (var k in src) {
			if (typeof src[k] === 'object' && src[k] !== null) {
				if (typeof dst[k] !== "object" || dst[k] === null) {
					dst[k] = (Array.isArray(src[k])) ? [] : {};
					info.changes++;
				}
				deep_merge(dst[k], src[k]);
			} else {
				if (dst[k] !== src[k]) info.changes++;
				if (!is_array && delete_nulls && src[k] === null) delete dst[k];
				else dst[k] = src[k];
			}
		}
		if (is_array) dst.length = src.length;
	};
	deep_merge(dst, src);
	return info;
}
export function deep_assign(o1, ...objects) {
	if (typeof o1 !== "object") throw new Error(`deep_assign requires Object as first argument`);
	for (var o2 of objects) {
		deep_merge(o1, o2);
	}
	return o1;
}
// syncs 2 objects to become identical, everything besides key order.
export function deep_sync(dst, src) {
	var dst_keys = Object.keys(dst);
	for (var k in src) {
		if (src[k] === dst[k]) continue;
		if (src[k] !== null && dst[k] !== null && typeof src[k] === 'object' && typeof dst[k] === 'object' && Array.isArray(src[k]) == Array.isArray(dst[k])) {
			deep_sync(dst[k], src[k]);
		} else {
			dst[k] = deep_copy(src[k]);
		}
	}
	if (Array.isArray(src)) dst.length = src.length;
	for (var k of dst_keys) {
		if (!(k in src)) delete dst[k];
	}
}
/* deep_diff(o1, o2) {
	var changes = [];
	function _deep_diff(o1,o2,path) {
		if (typeof o1 !== "object" || typeof o2 !== "object") {
			var type;
			if (o1 === o2) return;
			else if (o1 === undefined) type = "created";
			else if (o2 === undefined) type = "deleted";
			else type = "changed";
			changes.push({
				path,
				type,
				old_value: o1,
				new_value: o2,
			});
		} else {
			for (var key in o1) {
				_deep_diff(o1[key], o2[key], [...path, key]);
			}
			for (var key in o2) {
				if (o1[key] === undefined) _deep_diff(undefined, o2[key], [...path, key]);
			}
		}
	}
	_deep_diff(o1,o2,[]);
	return changes;
}, */
export function deep_equals(o1,o2) {
	var t1 = typeof o1;
	var t2 = typeof o2;
	if (t1 === "object" && t2 === "object" && o1 !== null && o2 !== null) {
		for (var k in o1) {
			if (!deep_equals(o1[k], o2[k])) return false;
		}
		for (var k in o2) {
			if (!(k in o1)) return false;
		}
		return true;
	} else {
		if (t1 == "number" && t2 == "number" && isNaN(o1) && isNaN(o2)) return true;
		if (o1 === o2) return true;
		return false;
	}
}
/* deep_equals(a, b) {
	if (a === b) return true;
	var [a_type,b_type] = [typeof a, typeof b];
	if (a_type !== b_type) return false;
	if (a_type === 'number' && isNaN(a) && isNaN(b)) return true;
	if (a_type !== "object") return a === b;
	var [a_keys,b_keys] = [Object.keys(a),Object.keys(b)];
	if (a_keys.length !== b_keys.length) return false;
	if (!a_keys.every((key)=>b.hasOwnProperty(key))) return false;
	return a_keys.every((key)=>deep_equals(a[key], b[key]));
}, */
export function deep_diff(o1, o2) {
	function _deep_diff(o1,o2) {
		if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
			var diff = {}, diffs = 0;
			for (var k in o1) {
				var d = _deep_diff(o1[k], o2[k]);
				if (d) {
					diff[k] = d;
					diffs++;
				}
			}
			for (var k in o2) {
				if (k in o1) continue;
				var d = _deep_diff(undefined, o2[k]);
				if (d) {
					diff[k] = d;
					diffs++;
				}
			}
			if (diffs) {
				return diff;
			}
		} else {
			if (deep_equals(o1,o2)) return;
			return new Diff(o1, o2);
		}
	}
	return _deep_diff(o1,o2) || {};
}
/** @param {Iterable<{id,parent}>} nodes */
export function is_circular(nodes) {
	return detect_circular_structure(nodes).length > 0;
}
export function detect_circular_structure(nodes) {
	var links = {};
	for (var {id, parent} of nodes) {
		links[parent] = links[parent] || {};
		links[parent][id] = 1;
	}
	let is_circular = (id, visited={})=>{
		if (visited[id]) return true;
		visited[id] = 1;
		if (links[id]) {
			for (var cid in links[id]) {
				if (is_circular(cid, visited)) return true;
			}
		}
		return false;
	}
	return nodes.filter(({id})=>is_circular(id)).map(({id})=>id);
}

// flattens tree like object structure to list of paths and values
export function deep_entries(o, only_values=true, filter=null) {
	if (o == null) throw new Error("Cannot convert undefined or null to object");
	var entries = [];
	var walk = (o, path)=>{
		if (typeof o === "object" && o !== null) {
			if (!only_values && path.length) entries.push([path, o]);
			for (var k in o) {
				var new_path = [...path,k];
				if (filter && !filter.apply(o, [k, o[k], new_path])) {
					entries.push([new_path, o[k]]);
					continue;
				}
				walk(o[k], new_path);
			}
		} else {
			entries.push([path, o]);
		}
	};
	walk(o, []);
	return entries;
}
export function deep_keys(o, only_values=true, filter=null) {
	return deep_entries(o, only_values, filter).map(([k,v])=>k);
}
export function deep_values(o, only_values=true, filter=null) {
	return deep_entries(o, only_values, filter).map(([k,v])=>v);
}
export function pathed_key_to_lookup(key, value, target={}) {
	let path = typeof key === "string" ? key.split("/") : [...key];
	let curr = target;
	for (var i = 0; i < path.length-1; i++) {
		var p = path[i];
			if (typeof curr[p] !== "object" || curr[p] === null) curr[p] = {};
			curr = curr[p];
	}
	curr[path[path.length-1]] = value;
	return target;
}
export function tree_from_entries(entries) {
	var root = {};
	if (!Array.isArray(entries)) entries = [entries];
	for (var c of entries) {
		if (Array.isArray(c)) {
			deep_merge(root, pathed_key_to_lookup(c[0], c[1]));
		} else {
			for (var k in c) {
				deep_merge(root, pathed_key_to_lookup(k, c[k]));
			}
		}
	}
	return root;
}
/** @typedef {[id:any,pid:any]} TreeCallbackResult */
/** @template T @typedef {{value:T,children:TreeNode<T>[]}} TreeNode<T> */
/** @template T @param {T[]} list @param {function(T):TreeCallbackResult} cb */
export function tree(list, cb) {
	var nodes = {},/** @type {TreeCallbackResult[]} */ infos = [], /** @type {TreeNode<T>[]} */root_nodes = [];
	var i;
	for (i=0; i<list.length; i++) {
		var info = infos[i] = cb(list[i]);
		nodes[info[0]] = {
			value: list[i],
			children: []
		}
	}
	for (i=0; i<list.length; i++) {
		var info = infos[i];
		var node = nodes[info[0]];
		var parent_node = nodes[info[1]];
		if (parent_node) {
			parent_node.children.push(node);
		} else {
			root_nodes.push(node);
		}
	}
	return root_nodes;
}
export function deep_map(o, cb) {
	if (typeof o !== "object" || o === null) return;
	var new_o = {};
	for (var k in o) {
		if (typeof o[k] === "object" && o[k] !== null) {
			new_o[k] = deep_map(o[k], cb);
		} else {
			new_o[k] = cb.apply(o, [k, o[k]]);
		}
	}
	return new_o;
}
export function deep_walk(o, delegate_filter) {
	var deep_walk = (o, delegate_filter, path) => {
		if (typeof o !== "object" || o === null) return;
		for (var k in o) {
			if (delegate_filter && delegate_filter.apply(o, [k, o[k], [...path, k]]) === false) continue;
			deep_walk(o[k], delegate_filter, [...path, k]);
		}
	}
	deep_walk(o, delegate_filter, []);
}
export async function replace_async(str, re, callback) {
	str = String(str);
	var parts = [], i = 0;
	if (re instanceof RegExp) {
		if (re.global)
			re.lastIndex = i;
		var m;
		while (m = re.exec(str)) {
			var args = m.concat([m.index, m.input]);
			parts.push(str.slice(i, m.index), callback.apply(null, args));
			i = re.lastIndex;
			if (!re.global)
				break; // for non-global regexes only take the first match
			if (m[0].length == 0)
				re.lastIndex++;
		}
	} else {
		re = String(re);
		i = str.indexOf(re);
		parts.push(str.slice(0, i), callback.apply(null, [re, i, str]));
		i += re.length;
	}
	parts.push(str.slice(i));
	var strings = await Promise.all(parts);
	return strings.join("");
}
export function get(fn_this, fn_path) {
	// if (typeof fn_path === "string") fn_path = fn_path.split(/\./);
	if (!Array.isArray(fn_path)) fn_path = [fn_path];
	var fn_ref = fn_this;
	try {
		for (var fn_part of fn_path) {
			fn_this = fn_ref;
			var descriptor = get_property_descriptor(fn_ref, fn_part);
			if (descriptor && descriptor.get) fn_ref = descriptor.get.call(fn_this);
			else fn_ref = fn_ref[fn_part];
			// fn_ref = descriptor ? (descriptor.get ? descriptor.get.call(fn_this) : descriptor.value) : undefined;
		}
	} catch {
		throw new RefException(`${fn_this} -> ${fn_path}`);
	}
	return fn_ref
}
export function set(fn_this, fn_path, fn_value){
	// if (typeof fn_path === "string") fn_path = fn_path.split(/\./);
	if (!Array.isArray(fn_path)) fn_path = [fn_path];
	var fn_ref = get(fn_this, fn_path.slice(0,-1))
	var prop = fn_path.slice(-1)[0];
	var descriptor = get_property_descriptor(fn_ref, prop);
	if (descriptor && descriptor.set) descriptor.set.call(fn_this, [fn_value]);
	else fn_ref[prop] = fn_value;
	return true;
}
function _delete(fn_this, fn_path){
	// if (typeof fn_path === "string") fn_path = fn_path.split(/\./);
	if (!Array.isArray(fn_path)) fn_path = [fn_path];
	try {
		var fn_ref = get(fn_this, fn_path.slice(0,-1))
		var prop = fn_path.slice(-1)[0];
		delete fn_ref[prop];
	} catch { }
}
export { _delete as delete }

export function call(fn_this, fn_path, fn_args){
	var args = [...arguments];
	// if (typeof fn_path === "string") fn_path = fn_path.split(/\./);
	if (!Array.isArray(fn_path)) fn_path = [fn_path];
	if (!Array.isArray(fn_args)) fn_args = [fn_args];
	var fn_this = get(fn_this, fn_path.slice(0,-1));
	var fn_ref = get(fn_this, fn_path.slice(-1));
	if (fn_ref) {
		return fn_ref.apply(fn_this, fn_args);
	} else {
		throw new RefException(`Bad call ref: ${args.join(", ")}`);
	}
}

export function path_to_file_uri(path) {
	if (!path.startsWith("/")) path = "/"+path;
	return new URL("file://"+path).toString();
}
export function file_uri_to_path(uri) {
	if (typeof uri !== 'string' || uri.substring(0, 7) !== 'file://') {
		throw new TypeError('Must pass in a file:// URI to convert to a file path');
	}
	const rest = decodeURI(uri.substring(7));
	const firstSlash = rest.indexOf('/');
	let host = rest.substring(0, firstSlash);
	let path = rest.substring(firstSlash + 1);
	if (host === 'localhost') host = '';
	if (host) host = "//" + host;
	path = path.replace(/^(.+)\|/, '$1:');
	// path = path.replace(/\//g, '\\');
	// if not windows path...
	if (!/^.+:/.test(path)) {
		path = "/" + path;
	}
	return host + path;
}
export function try_file_uri_to_path(uri) {
	try {
		return file_uri_to_path(uri);
	} catch (e) {
		return uri;
	}
}
/* get_random_values(array) {
	for (let i = 0, l = array.length; i < l; i++) {
			array[i] = Math.floor(Math.random() * 256);
	}
	return array;
}, */
export function convert_links_to_html(str) {
		return str.replace(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim, '<a href="$1" target="_blank">$1</a>');
}

export function convert_bytes(num, precision=2) {
	num = Math.abs(num);
	var divider = 1;
	for (x of ["bytes", "KB", "MB", "GB", "TB", "PB"]) {
		if ((num / divider) < 1024.0) break
		divider *= 1024.0;
	}
	return `${(num/divider).toFixed(precision)} ${x}`;
}

export function get_default_stream(streams, type) {
	var index_map = new Map();
	streams.forEach((s,i)=>index_map.set(s,i))
	if (type === "subtitle") streams = streams.filter(s=>s.default || s.forced);
	return sort([...streams], s=>+s.forced, s=>+s.default, s=>-index_map.get(s)).pop();
}

/* fmod(a,b) {
	return Number((a - (Math.floor(a / b) * b)));
} */

// the following junk prevents node 16.13.0 + vs code crashing when I start the debugger (weird but true)
// a:1,
// b:1,
// c:1,

export class Cache {
	#cache = {};
	#limit = 0;
	#n = 0;
	constructor(limit=0) {
		this.#limit = limit;
	}
	has(key){
		return key in this.#cache;
	}
	get(key) {
		return this.#cache[key];
	}
	set(key, value) {
		if (key in this.#cache) {
			delete this.#cache[key];
			this.#n--;
		}
		this.#cache[key] = value;
		this.#n++;
		if (this.#limit>0) {
			for (var k in this.#cache) {
				if (this.#n <= this.#limit) break;
				delete this.#cache[k];
				this.#n--;
			}
		}
	}
}

export function nearest(num, ...values) {
	var min_diff = Number.MAX_VALUE;
	var curr = num;
	for (var val of values) {
		var m = Math.abs(num - val);
		if (m < min_diff) {
			min_diff = m;
			curr = val;
		}
	}
	return curr;
}

export function truncate(str, len, suffix="") {
	str = String(str);
	if (str.length > len) str = str.slice(0,len) + suffix;
	return str;
}

/** @returns {Promise & {resolve:function(any):void, reject:function(any):void}} */
export function deferred() {
	var resolve, reject;
	var prom = new Promise((_resolve,_reject)=>{
		resolve = _resolve;
		reject = _reject;
	});
	prom.resolve = resolve;
	prom.reject = reject;
	return prom;
}

export function fix_url(_url) {
	_url = String(_url).trim();
		let url;
	try {
		url = new URL(url);
		if (!url.hostname) url = new URL("https://"+_url)
	} catch {
		try {
			url = new URL("https://"+_url);
		} catch {
			return;
		}
	}
	return url.toString();
}

export const noop = ()=>{};