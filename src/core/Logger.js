import events from "node:events";
import fs from "fs-extra";
import path from "node:path";
import * as utils from "./utils.js";
import globals from "./globals.js";

/** @typedef {{file:boolean, stdout:boolean, prefix:string}} Settings */

const info = console.info;
const warn = console.warn;
const error = console.error;
const debug = console.debug;

export class Log {
	level = Logger.INFO;
	message = "";
	prefix = [];
	ts = 0;

	constructor(...args) {
		if (args.length == 1 && typeof args[0] === "object") {
			/** @type {Log} */
			let log = args.pop();
			this.level = log.level;
			this.message = log.message;
			this.prefix = [...log.prefix];
			this.ts = log.ts;
		} else {
			this.level = args[0];
			this.message = args.slice(1).map(m=>{
				if (m instanceof Error) {
					m = m.stack;
				}
				if (typeof m === "object") {
					try { m = JSON.stringify(m) } catch {};
				}
				if (typeof m !== "string") m = String(m);
				if (m.length > globals.core.conf["core.logs_max_msg_length"]) m = m.substr(0, globals.core.conf["core.logs_max_msg_length"]);
				return m;
			}).join(" ");
		}
		this.message = this.message.trim();
		this.prefix = this.prefix || [];
		this.ts = this.ts || Date.now();
		this.level = this.level || Logger.INFO;
	}

	static format_prefix(prefix) {
		if (!Array.isArray(prefix)) prefix = [prefix];
		return prefix.map(p=>`[${p}]`).join("");
	}

	toString() {
		var now = new Date();
		let t = `${now.toLocaleTimeString(undefined, {hour12:false})}.${now.getMilliseconds().toString().padStart(3,"0")}`;
		return `${Log.format_prefix([t, this.level[0], ...this.prefix])} ${this.message}`;
	}

	toJSON() {
		var {level, message, prefix, ts} = this;
		return {level, message, prefix, ts};
	}
}

/** @extends {utils.EventEmitter<{log:Log}>} */
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

	warn() { return this.log(Logger.WARN, ...arguments); }
	info() { return this.log(Logger.INFO, ...arguments); }
	error() { return this.log(Logger.ERROR, ...arguments); }
	debug() { return this.log(Logger.DEBUG, ...arguments); }
	trace() { return this.log(Logger.TRACE, ...arguments); }

	log() {
		let log = this.#process_log(...arguments);
		this.log_to_file(log);
		this.log_to_stdout(log);
		this.emit("log", log);
		return log;
	}
	log_to_stdout() {
		let log = this.#process_log(...arguments);
		this.log_to_stdout(log);
		return log;
	}
	log_to_file() {
		let log = this.#process_log(...arguments);
		this.log_to_file(log);
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
		if (log.level === Logger.WARN) warn.apply(null, [message_str]);
		else if (log.level === Logger.ERROR) error.apply(null, [message_str]);
		else if (log.level === Logger.DEBUG) debug.apply(null, [message_str]);
		else info.apply(null, [message_str]);
	}
	
	/** @param {Log} log */
	log_to_file(log) {
		if (!globals.core.logs_dir) return;
		if (!this.#settings.file || !log.level) return;
		let filename = path.join(globals.core.logs_dir, `${this.name}-${utils.date_to_string(undefined, {time:false})}.log`);
		if (this.#filename != filename) {
			this.#end();
			this.#filename = filename;
			this.#start();
		}
		this.#stream.write(log.toString()+"\n");
	}

	console_adapter() {
		console.log = (...args)=>this.log(Logger.INFO, ...args);
		console.info = (...args)=>this.log(Logger.INFO, ...args);
		console.warn = (...args)=>this.log(Logger.WARN, ...args);
		console.error = (...args)=>this.log(Logger.ERROR, ...args);
		console.debug = (...args)=>this.log(Logger.DEBUG, ...args);
	}

	destroy() {
		this.#end();
		this.emit("destroy");
		this.removeAllListeners();
	}

	/** @param {function(Log):Log} cb */
	register_changes(cb) {
		let $ = new utils.Observer().$;
		let logs = {};
		let _id = 0;
		this.on("log", (log)=>{
			if (log.level === Logger.TRACE) return;
			log = (cb ? cb(log) : log) || log
			let id = ++_id;
			$[id] = log;
			if (!logs[log.level]) logs[log.level] = [];
			logs[log.level].push(id);
			if (logs[log.level].length > globals.core.conf["core.logs_max_length"]) {
				delete $[logs[log.level].shift()];
			}
		});
		return $;
	}
}

/** @param {import("stream").Writable} stream */
async function write_header_line(stream, str, len=64) {
	var padding = Math.max(0, len - str.length);
	var left = Math.floor(padding/2);
	var right = Math.ceil(padding/2);
	stream.write(`${"-".repeat(left)}${str}${"-".repeat(right)}\n`);
}

export default Logger;