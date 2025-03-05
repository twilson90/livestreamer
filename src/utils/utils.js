export * from "./Color.js";
export * from "./EventEmitter.js";
export * from "./md5.js";
export * from "./Observer.js";
export * from "./History.js";
export * from "./Interval.js";
export * from "./PromisePool.js";
export * from "./Rectangle.js";
export * from "./RangeTree.js";
export * from "./StopWatch.js";
export * from "./Timer.js";
export * as ref from "./Reflect.js";

export const path_separator_regex = /[\\\/]+/g;
export const emoji_regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;

const TIME_DIVIDERS = {
	d: 24 * 60 * 60 * 1000,
	h: 60 * 60 * 1000,
	m: 60 * 1000,
	s: 1000,
};

export class Diff {
	static CREATED = 1;
	static DELETED = 2;
	static CHANGED = 3;
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

export class TimeoutError extends Error {
	constructor(message) {
		super(message);
		this.name = "TimeoutError";
	}
}

/** @template T @param {T} opts @return {T} */
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

export const regex = {
	urls: /(https?:\/\/[^\s]+)/gi
}
/** @param {string} str */
export function is_valid_url(str) {
	return /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/i.test(str);
}
/** @param {string} str */
export function is_valid_rtmp_url(str) {
	return /^rtmps?\:\/\//i.test(str)
}
/** @param {string} str */
export function is_valid_ip(str) {
	return /((^((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$)|(^((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?$))/.test(str);
}
/** @param {any} s */
export function is_uri(s) {
	return /^[a-z]{2,}\:\/\//.test(String(s));
}
/** @param {string} s */
export function is_absolute_path(s) {
	return /^(?:[a-zA-Z]\:[\\/]|\/)/.test(String(s));
}
/** @param {string} uri @param {string} domain @description includes subdomains */
export function domain_match(uri, domain) {
	try { uri = new URL(uri).hostname || uri; } catch {}
	return !!uri.match(`^(?:[^:]+:\\/\\/)?(?:.+?\.)?(${escape_regex(domain)})(?:\/|$)`)
}
/** @param {string} str */
export function capitalize(str) {
	return String(str).replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}
/** @param {string} str */
export function kebabcase(str) {
	return String(str).replace(/([a-z])([A-Z])/g, "$1-$2")
	.replace(/[\s_]+/g, '-')
	.toLowerCase();
}

/** @param {string} str */
export function escape_regex(str) {
	return String(str).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
/** @param {string} str */
export function split_after_first_line(str) {
	var m = str.match(/(.+?)[\n\r]+/);
	return m ? [m[1], str.slice(m[0].length)] : [str, undefined];
}
/** @param {any} n */
export function is_numeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
/** @template T @param {Iterable<T,T>[]} iterables */
export function *zip(...iterables) {
    const iterators = iterables.map(iterable=>iterable[Symbol.iterator]());
    while (true) {
        const nextValues = iterators.map(iterator=>iterator.next());
        if (nextValues.some(next=>next.done)) break;
        const tuple = nextValues.map(next=>next.value);
        yield tuple;
    }
}


/** @template T @param {Iterable<T>} a @param {Iterable<T>} b */
export function set_union(a, b) {
	return new Set([...a, ...b]);
}
/** @template T @param {Iterable<T>} a @param {Set<T>|Iterable<T>} b */
export function set_difference(a, b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x=>!b.has(x)));
}
/** @template T @param {Iterable<T>} a @param {Set<T>|Iterable<T>} b */
export function set_intersection(a, b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x=>b.has(x)));
}
/** @template T @param {Iterable<T>} a @param {Set<T>|Iterable<T>} b */
export function set_symmetric_difference(a, b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x=>!b.has(x)).concat([...b].filter(x=>!a.has(x))));
}
/** @template T @param {Iterable<T>} sets */
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
/** @param {number} a @param {number} b @param {number} epsilon */
export function almost_equal(a, b, epsilon=Number.EPSILON) {
	return Math.abs(a-b) <= epsilon;
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
/** @template T, K @param {Iterable<T>} values @param {function(T):K} cb @return {Map<K,T[]>} */
export function group_by(values, cb) {
	/** @type {Map<T,K[]>} */
	var groups = new Map(); 
	for (var value of values) {
		var key = cb(value);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(value);
	}
	return groups;
}
/** @template T @param {T[][]} array */
export function transpose(array) {
	return array[0].map((_, c)=>array.map(row=>row[c]));
}
/** @template T,K @param {Record<T,K>|Map<T,K>} obj @return {Map<K,T>} */
export function reverse_map(obj) {
	return new Map(((obj instanceof Map) ? [...obj.entries()] : Object.entries(obj)).map(([k,v])=>[v,k]));
}
export function format_bytes(bytes, decimals = 2, min=1) {
	decimals = Math.max(decimals, 0);
	var k = 1024;
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
	var i = clamp(Math.floor(Math.log(bytes) / Math.log(k)), min, sizes.length-1);
	if (!isFinite(i)) i = 0;
	return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}
export function format_bytes_short(value, unit="k") {
	unit = unit.toLowerCase();
    if (unit.startsWith("b")) return String(Math.floor(value*8))+"b"
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
	return ip === "127.0.0.1" || ip === "::1" || ip == "::ffff:127.0.0.1";
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
// todo: weird name
/** @param {Iterable<any>} iterable @param {function(any,number,number):string} resolver @return {any[]} */
export function *uniquify(iterable, resolver) {
	if (!resolver) resolver = (s,i,n)=>n>1?`${s} [${i+1}]`:`${s}`;
	var map = new Map();
	for (var e of iterable) {
		map.set(map.has(e) ? map.get(e)+1 : 1);
	}
	var i = 0;
	for (var e of iterable){
		yield resolver(e, i++, map.get(e));
	}
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
export function is_plain_object(obj) {
	return	typeof obj === 'object' && obj !== null && obj.constructor === Object && Object.prototype.toString.call(obj) === '[object Object]';
}
/** @template T @param {Object.<string,T|PromiseLike<T>>} obj @returns {Object.<string,Promise<Awaited<T>[]>>}; */
export async function promise_all_object(obj) {
	var new_obj = {};
	await Promise.all(Object.entries(obj).map(([k,p])=>Promise.resolve(p).then(data=>new_obj[k]=data)));
	return new_obj;
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
export function timeout(ms) {
	if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
	return new Promise(resolve=>setTimeout(resolve, ms));
}
/** @param {function():Promise<any>} cb @param {number} attempts @param {number} delay @param {string} msg @return {Promise<any>} */
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
export function array_move_element(arr, from_index, to_index) {
	from_index = clamp(from_index, 0, arr.length-1);
	to_index = clamp(to_index, 0, arr.length-1);
	arr.splice(to_index, 0, ...arr.splice(from_index, 1));
	return arr;
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
	for (var k in TIME_DIVIDERS) {
		var divider = TIME_DIVIDERS[k];
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
/** @param {number} length @param {string} [chars] @return {string} */
export function random_string(length, chars="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
	var result = new Array(length), num_chars = chars.length;
	for (var i = length; i > 0; --i) result[i] = chars[Math.floor(Math.random() * num_chars)];
	return result.join("");
}
export function random_hex_string(length) {
	return random_string(length, "0123456789abcdef");
}
export function is_empty(obj) {
	if (obj && typeof obj === "object") {
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) return false;
		}
	}
	return true;
}
/** @template T @param {T} obj @param {function(PropertyKey,T[PropertyKey]):boolean} filter_callback @param {boolean} [in_place] @returns {T} */
export function filter_object(obj, filter_callback, in_place=false) {
	if (!in_place) obj = {...obj};
	for (var k of Object.keys(obj)) {
		if (!filter_callback(k, obj[k])) delete obj[k];
	}
	return obj;
}
/** @param {any[]} arr1 @param {any[]} arr2 @return {boolean} */
export function array_equals(arr1, arr2) {
	var length = arr1.length;
	if (length !== arr2.length) return false;
	for (var i = 0; i < length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}

/** @param {any[]} mainArray @param {any[]} subArray @return {boolean} */
export function array_starts_with(mainArray, subArray) {
	if (subArray.length > mainArray.length) return false;
	return subArray.every((element, index) => element === mainArray[index]);
}

/** @param {Iterable<any>} it1 @param {Iterable<any>} it2 @return {boolean} */
export function iterable_equals(it1, it2) {
	while(true) {
		var a = it1.next();
		var b = it2.next();
		if (a.done !== b.done) return false;
		if (a.done) break;
		if (a.value !== b.value) return false;
	}
	return true;
}
/** @param {Iterable<any>} iterable @return {boolean} */
export function all_equal(iterable) {
	var first = undefined;
	for (var o of iterable) {
		if (first === undefined) first = o;
		else if (first !== o) return false;
	}
	return true;
}
/** @template T1 @param {function():T1} cb @param {any} [default_value] @returns {T1} */
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
	return obj;
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
	return (total / n) || 0;
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
export function first_key(ob) {
	for (var k in ob) return k;
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
/** @template T @param {T[]} arr @param {...(function(T):number)} cbs */
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
/** @param {Date} date */
export function split_datetime(date, apply_timezone=false) {
	date = new Date(date);
	if (isNaN(date)) return ["", ""];
	if (apply_timezone) date = new Date(+date-(+date.getTimezoneOffset()*60*1000));
	var parts = date.toISOString().slice(0,-1).split("T");
	if (parts[0][0]=="+") parts[0] = parts[0].slice(1);
	return parts;
}
/** @param {string} date @param {string} time */
export function join_datetime(date, time, apply_timezone=false) {
	var time_parts = time.split(":");
	while (time_parts.length<3) time_parts.push("00");
	for (var i = 0; i < 2; i++) {
		if (!time_parts[i].match(/^\d{2}$/)) {
			time_parts[i] = (+time_parts[i]).toFixed(0)
		}
	}
	if (!time_parts[2].match(/^\d{2}\.\d{3}$/)) {
		time_parts[2] = parseFloat(time_parts[2]).toFixed(3).padStart(6, "0");
	}
	time = time_parts.join(":");
	var date = +new Date(`${date} ${time}Z`);
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
/** @template T @param {T} obj @param {Function(any,any):any} replacer @return {T} */
export function json_copy(obj, replacer) {
	if (typeof(obj) !== 'object' || obj === null) return obj;
	return JSON.parse(replacer ? JSON.stringify(obj, replacer) : JSON.stringify(obj));
}

/** @param {any|any[]} obj @param {(function(PropertyKey,any):boolean)|string[][]} filter_callback @returns {T} */
export function deep_filter(obj, filter_callback) {
	if (Array.isArray(filter_callback)) {
		var paths = filter_callback;
		filter_callback = (k, v, path)=>paths.some(p=>array_starts_with(p, path));
	}
	/** @param {any} obj @param {string[]} path */
	var walk = (obj, path)=>{
		if (typeof obj !== "object" || obj === null) return obj;
		let new_obj = Array.isArray(obj) ? [] : {};
		for (var k of Object.keys(obj)) {
			var new_path = [...path, k];
			if (filter_callback.apply(obj, [k, obj[k], new_path])) {
				new_obj[k] = walk(obj[k], new_path);
			}
		}
		return new_obj;
	}
	return walk(obj, []);
}
  

export function deep_merge(dst, src, delete_nulls = false) {
	var is_array = Array.isArray(src);
	for (var k in src) {
		if (typeof src[k] === 'object' && src[k] !== null) {
			if (typeof dst[k] !== "object" || dst[k] === null) {
				dst[k] = Array.isArray(src[k]) ? [] : {};
			}
			deep_merge(dst[k], src[k], delete_nulls);
		} else {
			if (!is_array && delete_nulls && src[k] == null) delete dst[k];
			else dst[k] = src[k];
		}
	}
	if (is_array) dst.length = src.length;
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
	var old_keys = Object.keys(dst);
	for (var k in src) {
		if (src[k] === dst[k]) continue;
		if (src[k] !== null && dst[k] !== null && typeof src[k] === 'object' && typeof dst[k] === 'object' && Array.isArray(src[k]) == Array.isArray(dst[k])) {
			deep_sync(dst[k], src[k]);
		} else {
			dst[k] = json_copy(src[k]);
		}
	}
	if (Array.isArray(src)) dst.length = src.length;
	for (var k of old_keys) {
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
	var _deep_diff = (o1,o2)=>{
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
	};
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
	var next = (o, path)=>{
		if (typeof o === "object" && o !== null) {
			if (!only_values && path.length) entries.push([path, o]);
			for (var k in o) {
				var new_path = [...path,k];
				if (filter && !filter.apply(o, [k, o[k], new_path])) {
					entries.push([new_path, o[k]]);
					continue;
				}
				next(o[k], new_path);
			}
		} else {
			entries.push([path, o]);
		}
	};
	next(o, []);
	return entries;
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

export function tree_from_pathed_entries(entries) {
	var root = {};
	if (!Array.isArray(entries)) entries = [entries];
	for (var c of entries) {
		if (Array.isArray(c)) {
			deep_merge(root, pathed_key_to_lookup(c[0], c[1]));
		} else if (typeof c === "object") {
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
/* export function deep_map(o, cb) {
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
} */
export function walk(o, delegate_filter) {
	var next = (o, delegate_filter, path) => {
		if (typeof o !== "object" || o === null) return;
		for (var k in o) {
			if (delegate_filter && delegate_filter.apply(o, [k, o[k], [...path, k]]) === false) continue;
			next(o[k], delegate_filter, [...path, k]);
		}
	}
	next(o, delegate_filter, []);
}

/* export async function replace_async(str, re, callback) {
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
} */

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

/* export class Cache {
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
} */

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

// /** @returns {Promise & {resolve:function(any):void, reject:function(any):void}} */
// export function deferred() {
// 	var resolve, reject;
// 	var prom = new Promise((_resolve,_reject)=>{
// 		resolve = _resolve;
// 		reject = _reject;
// 	});
// 	prom.resolve = resolve;
// 	prom.reject = reject;
// 	return prom;
// }

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

export const safe_eval = (x)=>{
	return globalThis["ev"+"al"](x);
};

export function rename_property(object, from, to) {
	if (from in object) {
		var val = object[from];
		delete object[from];
		object[to] = val;
	}
}

export function repeat(a, num) {
	return new Array(num).fill().map(()=>a);
}

export function* reverse_iterator(array) {
	let index = array.length - 1;
	while (index >= 0) {
		yield array[index];
		index--;
	}
}

export function is_iterable(obj) {
	return obj != null && typeof obj[Symbol.iterator] === 'function';
}

export function merge_non_null(...obs) {
    var ob = obs.shift();
    for (var o of obs) {
        for (var k in o) {
            if (o[k] != null)  ob[k] = o[k];
        }
    }
    return ob;
}

export function get_defaults(def) {
    if (def.__default__ !== undefined) {
        return json_copy(def.__default__);
    }
    var defaults = {};
    for (var k in def) {
        if (k.startsWith("__")) continue;
        defaults[k] = get_defaults(def[k]);
    }
    if (Object.keys(defaults).length) return defaults;
}

/** @param {function(string[], any, any):boolean} delete_criteria */
export function cleanup_prop($, props, recursive, warn, delete_criteria) {
	if (!warn) warn = noop;
	if (!delete_criteria) {
		delete_criteria = (path, value, prop)=>{
			return !prop; // || deep_equals(value, prop.__default__);
		}
	}
	const cleanup_prop = ($, prop, path) => {
		if (!$) return;
		if (!prop) prop = {};
		if (!path) path = [];
		if (prop.__custom__) return;
		if (typeof prop !== "object") return;
		for (let k of Object.keys($)) {
			var value = $[k];
			let new_path = [...path, k];
			let p = new_path.join(".");
			if (!(k in prop) && !prop.__enumerable__) {
				warn(`Unrecognized property '${p}'`);
			}
			let child_prop = prop.__enumerable__ ?? prop[k];
			if (delete_criteria(new_path, value, child_prop)) {
				warn(`Deleting property '${p}'...`);
				delete $[k];
			}
			if (recursive && typeof value === "object" && value !== null && child_prop) {
				cleanup_prop(value, child_prop, new_path);
			}
		}
	}
	return cleanup_prop($, props, []);
}

/** @template T @param {AsyncGenerator<T>} gen @return {Promise<T[]>} */
export async function array_from_async_generator(gen) {
    const out = [];
    for await(const x of gen) out.push(x)
    return out;
}

export function first(o) {
	if (is_iterable(o)) {
		for (var k of o) return k;
	} else {
		for (var k in o) return o[k];
	}
}