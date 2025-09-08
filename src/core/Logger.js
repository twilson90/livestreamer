import events from "node:events";
import fs from "node:fs";
import path from "node:path";
import {globals, utils} from "./exports.js";

/** @typedef {{file:boolean, stdout:boolean, prefix:string}} Settings */

export const info = console.info.bind(console);
export const warn = console.warn.bind(console);
export const error = console.error.bind(console);
export const debug = console.debug.bind(console);

export class Log {
	level = Logger.INFO;
	message = "";
	prefix = [];
	ts = 0;

	constructor(...args) {
		if (args.length == 1 && typeof args[0] === "object") {
			/** @type {Log} */
			let log = args.pop();
			if (log instanceof Error) {
				if (globals.app.debug) this.message = log.stack;
				else this.message = log.message;
				this.level = Logger.ERROR;
			} else {
				this.level = log.level;
				this.message = log.message;
				this.prefix = Array.isArray(log.prefix) ? [...log.prefix] : [`${log.prefix}`];
				this.ts = log.ts;
			}
		} else {
			this.level = (args[0] in levels_map) ? args.shift() : Logger.INFO;
			this.message = args.map(m=>{
				if (m instanceof Error) {
					if (this.level === Logger.ERROR && m.stack && globals.app.debug) m = m.stack;
					else m = m.message;
				}
				if (typeof m === "object") {
					try { m = JSON.stringify(m) } catch {};
				}
				if (typeof m !== "string") m = String(m);
				var max_msg_length = globals.app.conf["core.logs_max_msg_length"] || 0;
				if (max_msg_length && m.length > max_msg_length) m = m.substr(0, max_msg_length);
				return m;
			}).join(" ");
		}
		this.message = this.message.trim();
		this.prefix = this.prefix || [];
		this.ts = this.ts || Date.now();
		this.level = this.level || Logger.INFO;
	}

	toString() {
		var now = new Date();
		let t = `${now.toLocaleTimeString(undefined, {hour12:false})}.${now.getMilliseconds().toString().padStart(3,"0")}`;
		return `${format_prefix([t, this.level[0], ...this.prefix])} ${this.message}`;
	}

	toJSON() {
		var {level, message, prefix, ts} = this;
		return {level, message, prefix, ts};
	}
}

/** @extends {events.EventEmitter<{log:[Log]}>} */
export class Logger extends events.EventEmitter {
	static ERROR = "error";
	static WARN = "warn";
	static INFO = "info";
	static DEBUG = "debug";
	static TRACE = "trace";
	
	/** @type {import("stream").Writable} */
	#stream;
	#filename;
	#settings;

	/** @param {Settings} settings */
	constructor(name, settings) {
		super();
		this.name = name;
		this.#settings = {
			prefix: name,
			file: false,
			stdout: false,
			...settings
		};
		if (!name) this.#settings.file = false;
	}

	#process_log(...args) {
		var log = new Log(...args);
		if (this.#settings.prefix) log.prefix = [this.#settings.prefix, ...log.prefix];
		return log;
	}

	/** @param {Logger} logger @param {(log:Log)=>Log} cb */
	add(logger, cb) {
		var on_log = (log)=>{
			if (cb) log = cb(log);
			this.log(log);
		};
		logger.on("log", on_log);
		logger.once("destroy", ()=>{
			logger.off("log", on_log);
		})
	}

	warn() { return this.log(Logger.WARN, ...arguments); }
	info() { return this.log(Logger.INFO, ...arguments); }
	error() { return this.log(Logger.ERROR, ...arguments); }
	debug() { return this.log(Logger.DEBUG, ...arguments); }
	trace() { return this.log(Logger.TRACE, ...arguments); }

	log() {
		let log = this.#process_log(...arguments);
		this. log_to_file(log);
		this.log_to_stdout(log);
		this.emit("log", log);
		return log;
	}
	#end() {
		if (!this.#stream) return;
		write_header_line(this.#stream, "END OF LOG");
		this.#stream.end();
		this.#stream = null;
	}
	#start() {
		if (this.#stream) return;
		this.#stream = fs.createWriteStream(this.#filename, {flags:"a"});
		write_header_line(this.#stream, "START OF LOG");
	}
	
	/** @param {Log} log */
	log_to_stdout(log) {
		if (!this.#settings.stdout || !log.level) return;
		var message_str = log.toString();
		if (log.level === Logger.WARN) warn(message_str);
		else if (log.level === Logger.ERROR) {
			error(message_str);
		} else if (log.level === Logger.DEBUG) debug(message_str);
		else info(message_str);
	}
	
	/** @param {Log} log */
	log_to_file(log) {
		if (!globals.app.logs_dir) return;
		if (!this.#settings.file || !log.level) return;
		let filename = path.join(globals.app.logs_dir, `${this.name}-${utils.date_to_string(undefined, {time:false})}.log`);
		if (this.#filename != filename) {
			this.#end();
			this.#filename = filename;
			this.#start();
		}
		this.#stream.write(log.toString()+"\n");
	}

	/** @param {function():any} cb @param {function(string, ...any):void} log_cb */
	console_adapter(cb, log_cb) {
		if (!log_cb) log_cb = (level, ...args)=>this.log(level, ...args);
		let {log, info, warn, error, debug} = console;
		console.log = (...args)=>log_cb(Logger.INFO, ...args);
		console.info = (...args)=>log_cb(Logger.INFO, ...args);
		console.warn = (...args)=>log_cb(Logger.WARN, ...args);
		console.error = (...args)=>log_cb(Logger.ERROR, ...args);
		console.debug = (...args)=>log_cb(Logger.DEBUG, ...args);
		if (cb) {
			var res = cb();
			console.log = log;
			console.info = info;
			console.warn = warn;
			console.error = error;
			console.debug = debug;
			return res;
		}
	}

	static console_suppressor(cb) {
		let {log, info, warn, error, debug} = console;
		console.log = utils.noop;
		console.info = utils.noop;
		console.warn = utils.noop;
		console.error = utils.noop;
		console.debug = utils.noop;
		if (cb) {
			var res = cb();
			console.log = log;
			console.info = info;
			console.warn = warn;
			console.error = error;
			console.debug = debug;
			return res;
		}
	}

	destroy() {
		this.#end();
		this.emit("destroy");
		this.removeAllListeners();
	}
}

export class LogCollector {
	/** @type {Observer<Log>} */
	#logs = {};
	#id = 0;
	#$;
	#filter;
	/** @param {Observer<Log>} $ @param {function(Log):Log} filter */
	constructor($, filter) {
		this.#$ = $;
		this.#filter = filter;
	}
	
	/** @param {Log} log */
	register(log) {
		if (log.level === Logger.TRACE) return;
		log = (this.#filter ? this.#filter(log) : null) || log
		let id = ++this.#id;
		this.#$[id] = log;
		if (!this.#logs[log.level]) this.#logs[log.level] = [];
		this.#logs[log.level].push(id);
		var max_logs = globals.app.conf["core.logs_max_length"] || 0;
		if (max_logs && this.#logs[log.level].length > max_logs) {
			let id = this.#logs[log.level].shift();
			delete this.#$[id];
		}
	}
}

/** @param {import("stream").Writable} stream */
async function write_header_line(stream, str, len=64) {
	var padding = Math.max(0, len - str.length);
	var left = Math.floor(padding/2);
	var right = Math.ceil(padding/2);
	stream.write(`${"-".repeat(left)}${str}${"-".repeat(right)}\n`);
}

export const levels = [
	Logger.TRACE,
	Logger.DEBUG,
	Logger.INFO,
	Logger.WARN,
	Logger.ERROR,
]

export const levels_map = {
	[Logger.TRACE]: 0,
	[Logger.DEBUG]: 1,
	[Logger.INFO]: 2,
	[Logger.WARN]: 3,
	[Logger.ERROR]: 4,
}

function format_prefix(prefix) {
	if (!Array.isArray(prefix)) prefix = [prefix];
	return prefix.map(p=>`[${p}]`).join("");
}

export default Logger;