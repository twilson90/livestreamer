import fs from "fs-extra";
import path from "node:path";
import upath from "upath";
import { Jimp } from "jimp";
import * as uuid from "uuid";
import express from "express";
import encoding from "encoding-japanese";
import axios from "axios";
import sanitize from "sanitize-filename";
import dataUriToBuffer from "data-uri-to-buffer";
import mime from "mime";
import https from "node:https";
import * as utils from "./utils.js";
import * as errors from "./errors.js";
import * as constants from "../core/constants.js";
/** @import { ElFinder, Driver } from './types.d.ts' */

const API_VERSION = "2.161";
// const API_VERSION = "2.1";

export class Volume {
	get root() { return this.config.root; }
	get driver_name() { return this.config.driver; }
	get id() { return this.config.id; }
	get name() { return this.config.name; }
	get isPathBased() { return this.config.isPathBased; }
	get driver_class() { return this.elfinder.drivers[this.config.driver]; }

	/** @callback driverCallback @param {Driver} driver */
	/** @param {driverCallback} cb */
	async driver(taskid, cb) {
		
		var driver = new this.driver_class(this, taskid);
		var initialized = await driver.init();
		driver.initialized = initialized;
		if (!initialized) console.error("Driver could not initialize");
		return Promise.resolve(cb.apply(this, [driver])).finally(()=>{
			driver.destroy();
		});
	}

	/** @param {ElFinder} elfinder @param {*} config */
	constructor(elfinder, config) {
		/** @type {ElFinder} */
		this.elfinder = elfinder;
		this.config = {
			id: null,
			name: null,
			driver: null,
			permissions: { read:1, write:1, locked:0 },
			tmbdir: null,
			separator: null,
		}
		Object.assign(this.config, config);
		
		var driver = new this.driver_class(this);
		driver.config();

		this.config.uri = driver.__uri("/");

		if (this.config.isPathBased === undefined) {
			this.config.isPathBased = !!this.config.separator;
		}
		if (!this.config.tmbdir) {
			this.config.tmbdir = this.elfinder.config.tmbdir;
		}
		if (this.config.tmbdir) {
			fs.mkdirSync(this.config.tmbdir, {recursive:true});
		}
		if (!this.config.name) {
			this.config.name = `${this.config.driver} ${utils.md5(uuid.v4())}`;
		}
		this.not_implemented_commands = [...this.elfinder.commands].filter(p=>!this.__proto__[p]);
	}

	// -------------------------------------------------------------
	
	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {string} opts.type Required
	 * @param {string} opts.name
	 * @param {express.Response} res
	 */
	async archive(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {string} opts.mode Required
	 * @param {express.Response} res
	 */
	async chmod(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {*} opts.substitute
	 * @param {express.Response} res
	 */
	async dim(opts, res) {
		if (!opts.target) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			var id = driver.unhash(opts.target).id;
			var img = await Jimp.read(await utils.streamToBuffer(await driver.read(id)));
			var dim = img.bitmap.width + "x" + img.bitmap.height;
			return {
				dim
			};
		});
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {string} opts.suffix
	 * @param {express.Response} res
	 */
	async duplicate(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {boolean} opts.makedir
	 * @param {express.Response} res
	 */
	async extract(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {boolean} opts.download
	 * @param {*} opts.cpath
	 * @param {*} opts.onetime
	 * @param {express.Response} res
	 */
	async file(opts, res) {
		if (!opts.target) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			var id = driver.unhash(opts.target).id;
			var stat = await driver.stat(id);
			if (opts.download) {
				res.setHeader("Content-Disposition", `attachment;filename="${stat.name.replace(/"/g,'\\"')}"`);
			}
			if (opts.cpath && opts.reqid) {
				res.cookie(`elfdl${opts.reqid}`, '1', {
					expires: 0,
					path: opts.cpath,
				});
			}
			await driver.fetch(id, res);
		});
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {*} opts.conv
	 * @param {express.Response} res
	 */
	async get(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {express.Response} res
	 */
	async info(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {string[]} opts.mimes
	 * @param {string[]} opts.intersect
	 * @param {express.Response} res
	 */
	async ls(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {string} opts.name
	 * @param {string[]} opts.dirs
	 * @param {express.Response} res
	 */
	async mkdir(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {string} opts.name Required
	 * @param {string[]} opts.mimes
	 * @param {express.Response} res
	 */
	async mkfile(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target
	 * @param {boolean} opts.tree
	 * @param {boolean} opts.init
	 * @param {string[]} opts.mimes
	 * @param {*} opts.compare
	 * @param {express.Response} res
	 */
	async open(opts, res) {
		return this.driver(opts.reqid, async (driver)=>{
			var data = {};
			var target = opts.target;
			if (opts.init) {
				data.api = API_VERSION;
				data.netDrivers = Object.values(this.elfinder.drivers).map(v=>v.net_protocol).filter(k=>k);
				if (!target) target = driver.hash("/");
				data.uplMaxSize = "32M"; // max chunk size
			}
			if (!target) throw new errors.ErrCmdParams();
			var {id} = driver.unhash(target);
			var cwd = await driver.file(id);
			if (!cwd) cwd = await driver.file("/");
			data.cwd = cwd
			data.options = driver.options();
			var files = [];
			if (opts.tree) {
				for (var v of Object.values(this.elfinder.volumes)) {
					await v.driver(opts.id, async (d)=>{
						if (d.initialized) {
							files.push(await d.file("/"));
						}
					});
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {string} opts.until
	 * @param {express.Response} res
	 */
	async parents(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.dst Required
	 * @param {string[]} opts.targets Required
	 * @param {boolean} opts.cut
	 * @param {string[]} opts.mimes
	 * @param {string[]} opts.renames
	 * @param {string[]} opts.hashes
	 * @param {string} opts.suffix
	 * @param {express.Response} res
	 */
	async paste(opts, res) {
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
								await fs.rename(srcdriver.abspath(src.id), dstdriver.abspath(newfile));
							} else {
								await fs.copy(srcdriver.abspath(src.id), dstdriver.abspath(newfile));
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
	}

	/**
	 * @param {object} opts
	 * @param {*} opts.target Required
	 * @param {*} opts.content
	 * @param {*} opts.encoding
	 * @param {express.Response} res
	 */
	async put(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {string} opts.name Required
	 * @param {string[]} opts.mimes
	 * @param {string[]} opts.targets
	 * @param {string} opts.q
	 * @param {express.Response} res
	 */
	async rename(opts, res) {
		if (!opts.target) throw new errors.ErrCmdParams();
		if (!opts.name) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			var id = driver.unhash(opts.target).id;
			var dstid = await driver.rename(id, opts.name);
			var added = [await driver.file(dstid)];
			var removed = [opts.target];
			await driver.destroy();
			return {
				added,
				removed
			}
		});
	}

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
	 * @param {express.Response} res
	 */
	async resize(opts, res) {
		if (!opts.target) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			var id = driver.unhash(opts.target).id;
			var stat = await driver.stat(id);
			var img = await Jimp.read(await utils.streamToBuffer(await driver.read(id)));
			if (opts.mode == "resize") {
				img = img.resize(+opts.width, +opts.height)
			} else if (opts.mode == "crop") {
				img = img.crop(+opts.x, +opts.y, +opts.width, +opts.height);
			} else if (opts.mode == "rotate") {
				img = img.rotate(+opts.degree);
				if (opts.bg) img = img.background(parseInt(opts.bg.substr(1, 6), 16));
			}
			img = img.quality(+opts.quality);
			await driver.write(stat.parent, stat.name, await img.getBuffer('image/webp', { quality: 80 }));
			var info = await driver.file(id);
			info.tmb = 1;
			return {
				changed: [info]
			};
		});
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {express.Response} res
	 */
	async rm(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.q
	 * @param {string[]} opts.mimes
	 * @param {string} opts.target
	 * @param {*} opts.type
	 * @param {express.Response} res
	 */
	async search(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {express.Response} res
	 */
	async size(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {express.Response} res
	 */
	async subdirs(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {express.Response} res
	 */
	async tmb(opts, res) {
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {express.Response} res
	 */
	async tree(opts, res) {
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
	}

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
	 * @param {express.Response} res
	 */
	async upload(opts, res) {
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
				await fs.mkdir(chunkdir, {recursive:true});
				var tmpchunkpath = path.join(chunkdir, String(ci));
				await fs.rename(files[0].path, tmpchunkpath);
				if (!uploads[cid]) {
					uploads[cid] = Array(cn).fill(false);
					(await fs.readdir(chunkdir)).forEach(c=>uploads[cid][c] = true);
				}
				uploads[cid][ci] = true;
				if (uploads[cid].length == cn && uploads[cid].every(c=>c)) {
					var mergedname = cid;
					var mergedpath = path.join(this.elfinder.uploads_dir, cid);
					var chunks = uploads[cid].map((_,i)=>path.join(chunkdir, String(i)));
					await utils.mergefiles(chunks, mergedpath);
					var stat = await fs.stat(mergedpath);
					if (stat.size != total) {
						result._chunkfailure = true;
						result.error = `Chunked Upload failed. Size mismatch (${stat.size} != ${total})`;
					}
					await fs.rm(chunkdir, {recursive:true}).catch(()=>{});
					result._chunkmerged = mergedname;
					result._name = filename;
					delete uploads[cid];
				}
			} else {
				if (opts.upload && opts.upload[0] === 'chunkfail' && opts.mimes === 'chunkfail') {
					result.warning = ["errUploadFile", filename, "errUploadTemp"];
				} else if (opts.upload && opts.upload[0].match(/^https?\:\/\//)) {
					var url = opts.upload[0];
					var r = await axios.get(url, {
						responseType: 'arraybuffer',
						httpsAgent: new https.Agent({ rejectUnauthorized: false })
					});
					var dstid = await driver.write(dirid, sanitize(url), r.data);
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
					await fs.unlink(tmpfile).catch(()=>{});
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
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.target Required
	 * @param {*} opts.options
	 * @param {express.Response} res
	 */
	async url(opts, res) {
		if (!opts.target) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			var id = driver.unhash(opts.target).id;
			return [this.config.URL, id].join("/")
		});
	}

	/**
	 * @param {object} opts
	 * @param {string[]} opts.targets Required
	 * @param {boolean} opts.download
	 * @param {express.Response} res
	 */
	async zipdl(opts, res) {
		if (!opts.targets || opts.targets.length == 0) throw new errors.ErrCmdParams();
		return this.driver(opts.reqid, async (driver)=>{
			if (opts.download) {
				var [hash, tmp, name, mime] = opts.targets;
				res.setHeader("Content-Type", mime);
				res.setHeader("Content-Disposition", `attachment;filename="${name.replace(/"/g,'\\"')}"`);
				res.setHeader("Accept-Ranges", "none");
				res.setHeader("Connection", "close");
				tmp = path.join(this.elfinder.tmp_dir, tmp)
				await new Promise((resolve,reject)=>{
					res.sendFile(tmp, async (e)=>{
						await fs.unlink(tmp);
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
	}

	async mount() {
		return this.driver(opts.reqid, async (driver)=>{
			var result = await driver.mount();
			if (result) {
				this.elfinder.volumes[this.id] = this;
				result.added = [await driver.file("/")];
				if (result.exit === 'callback') {
					this.elfinder.callback(result.out);
				}
				return result;
			} else {
				return { error: ["errNetMount", opts.host, "Failed to mount."] };
			}
		});
	}

	async unmount() {
		return this.driver(opts.reqid, async (driver)=>{
			delete this.elfinder.volumes[this.id];
			if (await driver.unmount()) {
				return {
					removed: [{'hash':driver.hash("/")}]
				};
			} else {
				return { sync: true, error: "errNetUnMount" };
			}
		});
	}
}
export default Volume;