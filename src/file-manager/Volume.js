import fs from "node:fs";
import path from "node:path";
import upath from "upath";
import * as uuid from "uuid";
import express from "express";
import encoding from "encoding-japanese";
import sanitize from "sanitize-filename";
import dataUriToBuffer from "data-uri-to-buffer";
import sharp from "sharp";
import mime from "mime";
import https from "node:https";
import {utils, errors, drivers, globals} from "./exports.js";
import {constants, AccessControl} from "../core/exports.js";

/** @import { ElFinder, Driver } from './exports.js' */

const API_VERSION = "2.161";
// const API_VERSION = "2.1";
var VOLUME_ID = 0;

export class Volume {
	/** @type {string} */
	get root() { return this.config.root; }
	/** @type {string} */
	get driver_name() { return this.config.driver; }
	/** @type {string} */
	get id() { return this.config.id; }
	/** @type {string} */
	get name() { return this.config.name; }
	/** @type {boolean} */
	get isPathBased() { return this.config.isPathBased; }
	/** @type {typeof Driver} */
	get driver_class() { return drivers[this.driver_name]; }
	get elf_id() { return this.config.elf_id; }

	/** @callback driverCallback @param {Driver} driver */
	/** @param {driverCallback} cb */
	async driver(taskid, cb) {
		
		var driver = new (this.driver_class)(this, taskid);
		var initialized = await driver.init();
		driver.initialized = initialized;
		if (!initialized) console.error("Driver could not initialize");
		return Promise.resolve(cb.apply(this, [driver])).finally(()=>{
			driver.destroy();
		});
	}

	/** @param {ElFinder} elfinder @param {*} config */
	constructor(elfinder, config) {
		if (typeof config === "string") config = {root:config};
		config = {
			driver: `LocalFileSystem`,
			permissions: { read:1, write:1, locked:0 },
			separator: null,
			isPathBased: undefined,
			locked: false,
			access_control: new AccessControl().$,
			...config,
		}
		// if (!config.uid) config.uid = globals.app.generate_uid("volume");
		if (!config.id) config.id = `${globals.app.generate_uid("volume")}`;
		if (config.root) config.root = config.root.replace(/[\\/]+$/, "");
		if (!config.name) config.name = config.root ? config.root.split(/[\\/]/).pop() : `Volume ${config.id}`;
		if (elfinder.volumes.has(config.id)) throw new Error(`Volume with ID '${config.id}' already exists.`);

		/** @type {ElFinder} */
		this.elfinder = elfinder;
		this.config = config;
		this.config.elf_id = `v${VOLUME_ID++}_`;
		
		var temp_driver = new this.driver_class(this);
		var isPathBased = !!this.driver_class.separator;
		this.config.separator = this.driver_class.separator || "";
		if (isPathBased) this.config.root = temp_driver.__abspath("/");
		this.config.uri = temp_driver.__uri("/");
		this.config.isPathBased = isPathBased;
		this.not_implemented_commands = [...this.elfinder.commands].filter(p=>!this.__proto__[p]);
	}

	async save() {
		if (this.config.locked) throw new Error("Volume is locked");
		await utils.safe_write_file(path.join(this.elfinder.volumes_dir, this.id), JSON.stringify(this.config));
	}

	async destroy() {
		await fs.promises.rm(path.join(this.elfinder.volumes_dir, this.id)).catch(utils.noop);
	}

	// -------------------------------------------------------------

	api = {
		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {string} opts.type Required
		 * @param {string} opts.name
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		archive: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			if (!opts.type) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				var ext = "."+mime.getExtension(opts.type);
				var name = "Archive";
				if (opts.name) name = utils.replaceExt(opts.name, ext);
				var dir = (await driver.stat(ids[0])).parent;
				var newid = await driver.archive(ids, dir, name);
				var added = [await driver.file(newid)];
				return {
					added
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {string} opts.mode Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		chmod: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			if (!opts.mode) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				var changed = [];
				for (var id of ids) {
					await driver.chmod(id, opts.mode);
					changed.push(await driver.file(id));
				}
				return {
					changed
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {*} opts.substitute
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		dim: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				const buffer = await utils.streamToBuffer(await driver.read(id));
				const { width, height } = await sharp(buffer).metadata();
				var dim = width + "x" + height;
				return {
					dim
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {string} opts.suffix
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		duplicate: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				var added = [];
				for (var id of ids) {
					var stat = await driver.stat(id);
					var name = stat.name;
					var dst = stat.parent;
					name = await driver.unique(dst, name, opts.suffix); //  || " (Copy)"
					var newid = await driver.copy(id, dst, name);
					added.push(await driver.file(newid));
				}
				return {
					added
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {boolean} opts.makedir
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		extract: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var stat = await driver.stat(id);
				var dst = stat.parent;
				var makedir = opts.makedir == 1;
				if (makedir) {
					var name = utils.replaceExt(stat.name, "");
					name = await driver.unique(dst, name)
					dst = await driver.mkdir(dst, name);
				}
				var newids = await driver.extract(id, dst)
				var added = [];
				if (makedir) {
					added.push(await driver.file(dst));
				} else {
					for (var id of newids) {
						added.push(await driver.file(id));
					}
				}
				return {
					added
				};
			});
		},	

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {boolean} opts.download
		 * @param {*} opts.cpath
		 * @param {*} opts.onetime
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		file: 	async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var stat = await driver.stat(id);
				if (opts.download) {
					res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(stat.name)}"`);
				}
				if (opts.cpath && opts.reqid) {
					res.cookie(`elfdl${opts.reqid}`, '1', {
						expires: 0,
						path: opts.cpath,
					});
				}
				await driver.fetch(id, req, res);
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {*} opts.conv
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		get: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var buffer = await utils.streamToBuffer(await driver.read(id));
				var enc = "UTF-8";
				var origenc = enc;
				if (opts.conv == 1 || opts.conv == 0) enc = encoding.detect(buffer);
				else if (opts.conv) enc = opts.conv;
				var decoder = new TextDecoder(enc || origenc, {fatal:true});
				var content;
				try {
					content = decoder.decode(buffer)
				} catch {
					if (opts.conv == 0) return { doconv : "unknown" };
					else if (opts.conv == 1) content = false;
				}
				var result = {
					content
				};
				enc = decoder.encoding.toUpperCase();
				if (enc !== origenc) result.encoding = enc;
				return result;
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		info: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(hash=>driver.unhash(hash).id);
				var files = [];
				for (var id of ids) {
					files.push(await driver.file(id));
				}
				return {
					files,
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string[]} opts.mimes
		 * @param {string[]} opts.intersect
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		ls: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var ids = await driver.readdir(id);
				var list = {};
				for (var id of ids) {
					var stat = await driver.stat(id);
					list[driver.hash(id)] = stat.name;
				}
				if (opts.intersect) {
					var intersect = new Set(opts.intersect);
					list = Object.fromEntries(Object.entries(list).filter(([k,v])=>intersect.has(v)));
				}
				return {
					list
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string} opts.name
		 * @param {string[]} opts.dirs
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		mkdir: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var added = [];
				var changed = [];
				var result = { added, changed };
				if (opts.dirs) {
					var hashes = {};
					var map = {};
					for (var dir of opts.dirs) {
						var parts = dir.split("/");
						var name = parts.pop();
						var parent = parts.join("/");
						var t = (parent) ? map[parent] : id;
						var newid = await driver.mkdir(t, name);
						map[dir] = newid;
						added.push(await driver.file(newid));
						hashes[dir] = driver.hash(newid);
					}
					result.hashes = hashes;
				} else if (opts.name) {
					var newid = await driver.mkdir(id, opts.name);
					added.push(await driver.file(newid));
				}
				changed.push(await driver.file(id));
				return result;
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string} opts.name Required
		 * @param {string[]} opts.mimes
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		mkfile: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			if (!opts.name) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var newid = await driver.write(id, opts.name || "Untitled.txt", Buffer.alloc(0));
				var added = [await driver.file(newid)];
				return {
					added: added
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target
		 * @param {boolean} opts.tree
		 * @param {boolean} opts.init
		 * @param {string[]} opts.mimes
		 * @param {*} opts.compare
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		open: async (opts, req, res)=>{
			return this.driver(opts.reqid, async (driver)=>{
				var data = {};
				var target = opts.target;
				if (opts.init) {
					data.api = API_VERSION;
					data.netDrivers = Object.values(drivers).map(v=>v.net_protocol).filter(k=>k);
					if (!target) target = driver.hash("/");
					data.uplMaxSize = "32M"; // max chunk size
				}
				if (!target) throw new errors.ErrCmdParams();
				var {id} = driver.unhash(target);
				var stat = await driver.stat(id);
				if (stat.mime !== constants.DIRECTORY) id = stat.parent || "/"
				var cwd = await driver.file(id);
				data.cwd = cwd;
				data.options = driver.options();
				var files = [];
				if (opts.tree) {
					for (var v of this.elfinder.volumes.values()) {
						await v.driver(opts.id, async (d)=>{
							if (d.initialized) {
								files.push(await d.file("/"));
							}
						})
					}
				}
				if (driver.initialized) {
					var mimes = new Set(opts.mimes);
					var ids = await driver.readdir(id).catch(()=>[]);
					for (var cid of ids) {
						var f = await driver.file(cid);
						if (mimes.size == 0 || mimes.has(f.mime) || mimes.has(f.mime.split("/")[0])) {
							files.push(f);
						}
					}
				}
				data.files = files;
				return data;
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string} opts.until
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		parents: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var curr = id;
				var last;
				var until = opts.until ? driver.unhash(opts.until).id : "/";
				var tree = [];
				do {
					last = curr;
					curr = (await driver.stat(curr)).parent;
					var ids = await driver.readdir(curr);
					for (var id of ids) {
						var stat = await driver.stat(id);
						if (stat.mime === constants.DIRECTORY) tree.push(await driver.file(id));
					}
				} while (curr && curr !== until && last !== curr);
				return {
					tree: tree
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.dst Required
		 * @param {string[]} opts.targets Required
		 * @param {boolean} opts.cut
		 * @param {string[]} opts.mimes
		 * @param {string[]} opts.renames
		 * @param {string[]} opts.hashes
		 * @param {string} opts.suffix
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		paste: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			if (!opts.dst) throw new errors.ErrCmdParams();
			var dst = this.elfinder.unhash(opts.dst);
			var srcs = opts.targets.map(t=>this.elfinder.unhash(t));
			var removed = [];
			var changed = [];
			var added = [];
			await dst.volume.driver(opts.reqid, async (dstdriver)=>{
				for (var src of srcs) {
					await src.volume.driver(opts.reqid, async (srcdriver)=>{
						var newfile;
						var same_volume = src.volume === dst.volume;
						var both_localfilesystem = src.volume.driver_name === "LocalFileSystem" && dst.volume.driver_name === "LocalFileSystem"
						if (same_volume || both_localfilesystem) {
							var stat = await srcdriver.stat(src.id);
							var name = stat.name;
							if (opts.renames && opts.renames.includes(name)) {
								name = await dstdriver.unique(dst.id, name, opts.suffix);
							}
							if (same_volume) {
								if (opts.cut == 1) {
									newfile = await dstdriver.move(src.id, dst.id, name);
								} else {
									newfile = await dstdriver.copy(src.id, dst.id, name);
								}
							} else if (both_localfilesystem) {
								newfile = upath.join(dst.id, name);
								if (opts.cut == 1) {
									await fs.promises.rename(srcdriver.abspath(src.id), dstdriver.abspath(newfile));
								} else {
									await fs.promises.cp(srcdriver.abspath(src.id), dstdriver.abspath(newfile));
								}
							}
							if (opts.cut == 1) removed.push(srcdriver.hash(src.id));
							
							changed.push(await dstdriver.file(dst.id));
							added.push(await dstdriver.file(newfile));
						} else {
							var tree = await this.elfinder.copytree(srcdriver, src.id, dstdriver, dst.id);
							newfile = tree.id;
							changed.push(await dstdriver.file(dst.id));
							if (opts.cut == 1) {
								await srcdriver.rm(src.id);
								removed.push(srcdriver.hash(src.id));
							}
							added.push(await dstdriver.file(newfile));
						}
					});
				}
			});
			return {
				added,
				removed,
				changed,
			};
		},

		/**
		 * @param {object} opts
		 * @param {*} opts.target Required
		 * @param {*} opts.content
		 * @param {*} opts.encoding
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		put: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var {parent, name} = await driver.stat(id);
				var content = opts.content;
				if (opts.encoding === "scheme") {
					content = dataUriToBuffer(content);
				} else if (opts.encoding === "hash") {
					var hash = content;
					var id = driver.unhash(hash).id;
					content = await utils.streamToBuffer(await driver.read(id));
				} else if (opts.encoding) {
					content = encoding.convert(content, opts.encoding);
				}
				var newid = await driver.write(parent, name, content);
				var changed = [await driver.file(newid)];
				return {
					changed,
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string} opts.name Required
		 * @param {string[]} opts.mimes
		 * @param {string[]} opts.targets
		 * @param {string} opts.q
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		rename: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			if (!opts.name) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var file = await driver.file(id);
				if (file.name === opts.name) return { changed:[] };
				if (file.netkey && file.isroot) {
					return { changed: [file] }
				}
				if (file.name !== opts.name) {
					var added = [];
					var removed = [];
					var dstid = await driver.rename(id, opts.name);
					added.push(await driver.file(dstid));
					removed.push(opts.target);
				}
				return {
					added,
					removed
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {*} opts.width
		 * @param {*} opts.height
		 * @param {*} opts.mode
		 * @param {*} opts.x
		 * @param {*} opts.y
		 * @param {*} opts.degree
		 * @param {*} opts.quality
		 * @param {*} opts.bg
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		resize: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				var stat = await driver.stat(id);
				const buffer = await utils.streamToBuffer(await driver.read(id));
				let img = sharp(buffer);
				if (opts.mode == "resize") {
					img = img.resize(+opts.width, +opts.height);
				} else if (opts.mode == "crop") {
					img = img.extract({ left: +opts.x, top: +opts.y, width: +opts.width, height: +opts.height });
				} else if (opts.mode == "rotate") {
					img = img.rotate(+opts.degree);
					if (opts.bg) img = img.flatten({ background: parseInt(opts.bg.substr(1, 6), 16) });
				}
				await img.webp({ quality: +opts.quality })
					.toFile(`${stat.parent}/${stat.name}`);
				
				var info = await driver.file(id);
				info.tmb = 1;
				return {
					changed: [info]
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		rm: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				for (var target of ids) {
					await driver.rm(target);
				}
				return {
					removed: opts.targets
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.q
		 * @param {string[]} opts.mimes
		 * @param {string} opts.target
		 * @param {*} opts.type
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		search: async (opts, req, res)=>{
			if (!opts.q || opts.q.length < 1) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = opts.target ? driver.unhash(opts.target).id : "/";
				var allids = await driver.walk(id);
				var files = []
				for (var id of allids) {
					var stat = await driver.stat(id);
					if (stat.name.toLowerCase().includes(opts.q.toLowerCase())) {
						files.push(await driver.file(id));
					}
				}
				return {
					files: files
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		size: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				let recursive = false;
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				var size = 0
				var fileCnt = 0;
				var dirCnt = 0;
				var sizes = [];
				var check = async (id, level)=>{
					var stat = await driver.stat(id);
					let s = 0;
					if (stat.mime === constants.DIRECTORY) {
						dirCnt++;
						if (recursive || level == 0) {
							for (var cid of await driver.readdir(id)) {
								s += await check(cid, level+1);
							}
						}
					} else {
						fileCnt++;
						s += stat.size;
					}
					return s;
				}
				for (var id of ids) {
					var s = await check(id, 0);
					sizes.push(s);
					size += s;
				}
				return {
					size,
					fileCnt,
					dirCnt,
					sizes
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		subdirs: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var ids = opts.targets.map(t=>driver.unhash(t).id);
				var subdirs = [];
				for (var id of ids) {
					var cids = await driver.readdir(id);
					var subdir = 0;
					for (var cid of cids) {
						var stat = await driver.stat(cid)
						if (stat.mime === constants.DIRECTORY) {
							subdir = 1
							break;
						}
					}
					return subdir;
				}
				return {
					subdirs
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		tmb: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var images = {};
				for (var hash of opts.targets) {
					var id = driver.unhash(hash).id;
					images[hash] = await driver.tmb(id, true);
				}
				return {
					images
				};
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		tree: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var target = driver.unhash(opts.target).id;
				var ids = await driver.readdir(target);
				var tree = [];
				for (var id of ids) {
					var stat = await driver.stat(id);
					if (stat.mime === constants.DIRECTORY) {
						tree.push(await driver.file(id));
					}
				}
				return {
					tree
				}
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {string[]} opts.mimes
		 * @param {boolean} opts.html
		 * @param {string[]} opts.upload
		 * @param {string} opts.name
		 * @param {string[]} opts.upload_path
		 * @param {string} opts.chunk
		 * @param {string} opts.cid
		 * @param {string} opts.node
		 * @param {string[]} opts.renames
		 * @param {string[]} opts.hashes
		 * @param {string} opts.suffix
		 * @param {*[]} opts.mtime
		 * @param {string} opts.overwrite
		 * @param {*} opts.contentSaveId
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		upload: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var dirid = driver.unhash(opts.target).id;
				var added = [];
				var result = {
					added
				};
				var filename, ci, cn, cm;
				if (cm = opts.chunk && opts.chunk.match(/^(.+)\.(\d+)_(\d+)\.part$/)) {
					filename = cm[1];
					ci = +cm[2];
					cn = +cm[3]+1;
				}
				if (opts.html) {
					res.setHeader("Content-Type", "text/html; charset=utf-8");
				}
				/** @type {{originalname:string, path:string}[]} */
				var files = res.req.files ?? [];
				if (opts.range) {
					var [start, length, total] = opts.range.split(",").map(i=>+i);
					if (files.length > 1) throw new Error("Something unexpected [files.length]...");
					var uploads = this.elfinder.uploads;
					var cid = utils.md5(JSON.stringify([opts.cid, filename, total, opts.mtime, opts.upload_path]));
					var chunkdir = path.join(this.elfinder.uploads_dir, `${cid}_chunks`);
					await fs.promises.mkdir(chunkdir, {recursive:true});
					var tmpchunkpath = path.join(chunkdir, String(ci));
					await fs.promises.rename(files[0].path, tmpchunkpath);
					if (!uploads[cid]) {
						uploads[cid] = Array(cn).fill(false);
						(await fs.promises.readdir(chunkdir)).forEach(c=>uploads[cid][c] = true);
					}
					uploads[cid][ci] = true;
					if (uploads[cid].length == cn && uploads[cid].every(c=>c)) {
						var mergedname = cid;
						var mergedpath = path.join(this.elfinder.uploads_dir, cid);
						var chunks = uploads[cid].map((_,i)=>path.join(chunkdir, String(i)));
						await utils.mergefiles(chunks, mergedpath);
						var stat = await fs.promises.stat(mergedpath);
						if (stat.size != total) {
							result._chunkfailure = true;
							result.error = `Chunked Upload failed. Size mismatch (${stat.size} != ${total})`;
						}
						await fs.promises.rm(chunkdir, {recursive:true}).catch(utils.noop);
						result._chunkmerged = mergedname;
						result._name = filename;
						delete uploads[cid];
					}
				} else {
					if (opts.upload && opts.upload[0] === 'chunkfail' && opts.mimes === 'chunkfail') {
						result.warning = ["errUploadFile", filename, "errUploadTemp"];
					} else if (opts.upload && opts.upload[0].match(/^https?\:\/\//)) {
						var url = opts.upload[0];
						var stream = new utils.Downloader(url).stream();
						var dstid = await driver.write(dirid, sanitize(url), stream);
						added.push(await driver.file(dstid));
					} else if (opts.upload && opts.upload[0].match(/^data?\:/)) {
						var url = opts.upload[0];
						var data = dataUriToBuffer(content);
						var dstid = driver.write(dirid, sanitize(data.type)+"."+mime.getExtension(data.typeFull), data);
						added.push(await driver.file(dstid));
					} else if (opts.chunk) {
						if (opts.upload.length > 1) throw new Error("Something unexpected [upload.length]...");
						files.push(...opts.upload.map(n=>({
							path: path.join(this.elfinder.uploads_dir, opts.chunk),
							originalname: n,
						})));
					}
					var f = 0;
					for (var file of files) {
						var tmpfile = file.path;
						var dstdir = opts.upload_path ? driver.unhash(opts.upload_path[f]).id : dirid;
						var filename = file.originalname;
						if (opts.renames && opts.renames.includes(file.originalname)) {
							filename = await driver.unique(dstdir, file.originalname, opts.suffix);
						}
						var dstid = await driver.upload(tmpfile, dstdir, filename);
						await fs.promises.unlink(tmpfile).catch(utils.noop);
						added.push(await driver.file(dstid));
						f++;
					}
				}
				if (opts.node) {
					result.callback = {
						node: opts.node,
						bind: "upload",
					};
				}
				return result;
			});
		},

		/**
		 * @param {object} opts
		 * @param {string} opts.target Required
		 * @param {*} opts.options
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		url: async (opts, req, res)=>{
			if (!opts.target) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				var id = driver.unhash(opts.target).id;
				return [this.config.URL, id].join("/")
			});
		},

		/**
		 * @param {object} opts
		 * @param {string[]} opts.targets Required
		 * @param {boolean} opts.download
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		zipdl: async (opts, req, res)=>{
			if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
			return this.driver(opts.reqid, async (driver)=>{
				if (opts.download) {
					var [hash, tmp, name, mime] = opts.targets;
					res.setHeader("Content-Type", mime);
					res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
					res.setHeader("Accept-Ranges", "none");
					res.setHeader("Connection", "close");
					tmp = path.join(this.elfinder.tmp_dir, tmp);
					await new Promise((resolve,reject)=>{
						res.sendFile(tmp, async (e)=>{
							await fs.promises.unlink(tmp);
							if (e) reject(e);
							else resolve();
						});
					});
				} else {
					var ids = opts.targets.map(t=>driver.unhash(t).id);
					var tmp = await driver.archivetmp(ids);
					return {
						zipdl: {
							file: path.basename(tmp),
							name: "Archive.zip",
							mime: "application/zip"
						}
					}
				}
			});
		},
		
        /**
         * @param {object} opts
         * @param {string[]} opts.targets
         * @param {boolean} opts.download
         * @param {express.Response} res
         */
		listtree: async (opts, res)=>{
            return this.driver(opts.reqid, async (driver)=>{
                var targets = opts.targets.map(t=>driver.unhash(t).id);
                var ids = [];
                for (var target of targets) {
                    await driver.walk(target, (id, stat, parents=[])=>{
                        ids.push(id)
                    });
                }
                return { ids };
            });
        }
	}
}
export default Volume;