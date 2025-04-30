import fs from "fs-extra";
import path from "node:path";
import sharp from "sharp";
import stream from "node:stream";
import archiver from "archiver";
import * as uuid from "uuid";
import express from "express";
import unzipper from "unzip-stream";
import events from "node:events";
import upath from "upath";
import { Writable, Readable, Stream } from "node:stream";
import {utils, errors, constants, globals, FileManagerCache, Volume} from "./exports.js";

const THUMBNAIL_SIZE = 48;
const MAX_MEDIA_CHUNK = 1024 * 1000 * 4; // 4 MB

/** @typedef {{name:string, mime:string, ts:number, size:number, parent:string, readable:boolean, writable:boolean, locked:boolean}} Stat */
/** @typedef {string} ID */

export class Driver extends events.EventEmitter {
	initialized = false;

	get elfinder() { return this.volume.elfinder; }

	/** @param {Readable|Writable} stream */
	register_stream(stream) {
		this.on("abort", ()=>stream.destroy("abort"));
	}

	static net_protocol;

	/** @param {Volume} volume */
	constructor(volume, taskid) {
		super();
		this.volume = volume;
		this.taskid = taskid;
		this.cache = new FileManagerCache();
		
		this.thumbnails_dir = path.join(this.elfinder.thumbnails_dir, this.volume.id);
		
		var req = this.volume.elfinder.requests[taskid];
		if (req) {
			req.on("abort", ()=>{
				this.aborted = true;
				this.abort();
			});
		}
		if (this.volume.config.debug) {
			var prototype = Object.getPrototypeOf(this);
			for (let k of Object.getOwnPropertyNames(prototype)) {
				let old = prototype[k];
				prototype[k] = function(...args) {
					let d0 = Date.now();
					let result = old.apply(this, args);
					Promise.resolve(result).then(()=>{
						var d1 = Date.now();
						console.debug(`'${k}' executed in ${d1-d0}ms`);
					});
					return result;
				}
			}
		}
		this.cache.stats["/"] = {
			name: this.volume.name,
			parent: null,
			size: 0,
			mime: constants.DIRECTORY,
			ts: 0,
			exists: true,
		};
	}

	async init() {
		await fs.mkdir(this.thumbnails_dir, {recursive:true});
		return this.__init();
	}

	destroy() {
		return this.__destroy();
	}

	config() {
		return this.__config(this.volume.config);
	}

	options() {
		return this.__options();
	}

	/** @param {ID} id */
	async file(id) {
		var stat = await this.stat(id);
		if (!stat) return;
		var data = {
			name: stat.name,
			size: stat.size,
			mime: stat.mime,
			ts: stat.ts
		};
		if (!this.volume.isPathBased) {
			data.id = id;
		}
		data.hash = this.hash(id);
		data.volumeid = this.volume.id;
		if (!data.mime) {
			data.mime = "application/binary";
		} else if (data.mime.indexOf("image/") == 0) {
			data.tmb = await this.tmb(id, false);
		}
		// if is root
		var isroot = id == "/";
		if (isroot) {
			data.options = await this.options();
			data.phash = "";
		} else {
			data.phash = this.hash(stat.parent);
		}
		var permissions = (typeof this.volume.config.permissions === "function") ? await this.volume.config.permissions(p) : this.volume.config.permissions;
		// this makes no sense!
		// data.read = true
		// data.write = true
		// data.locked = false;
		data.read = !!(permissions.read && stat.readable !== false);
		data.write = !!(permissions.write && stat.writable !== false);
		data.locked = !!(permissions.locked && (stat.parent && (await this.stat(stat.parent)).writable === false));
		if (isroot) {
			data.dirs = 1;
		} else if (data.mime === constants.DIRECTORY) { //  && this.volume.config.subdirs
			// data.dirs = 1;
			var items = await this.readdir(id);
			for (var sid of items) {
				if (((await this.stat(sid))||{}).mime === constants.DIRECTORY) {
					data.dirs = 1;
					break;
				}
			}
		}
		if (this.__uri) data.uri = this.__uri(id);
		return data;
	}

	/** @param {ID} id */
	abspath(id) {
		return this.__abspath(id);
	}

	unhash(hash) {
		return this.elfinder.unhash(hash);
	}

	/** @param {ID} id */
	hash(id) {
		return this.elfinder.hash(this.volume, id);
	}

	/** @param {ID} src @param {express.Response} res @returns {string} ID */
	fetch(src, res) {
		return new Promise(async (resolve,reject)=>{
			var stat = await this.stat(src);
			res.setHeader("Content-Type", stat.mime);
			res.setHeader("Accept-Ranges", "bytes");
			res.setHeader("Connection", "Keep-Alive");
			// res.req.headers["cache-control"]
			var readopts;
			if (res.req.headers.range) {
				const parts = res.req.headers.range.replace(/bytes=/, "").split("-");
				var start = parseInt(parts[0], 10);
				var end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
				var chunk = (end-start) + 1;
				if (stat.mime.match(/^(audio|video)\//)) {
					// limit delivery of stream to chunks because it's probably in a video/audio player interface...
					chunk = Math.min(MAX_MEDIA_CHUNK, chunk);
					end = start + chunk - 1;
				}
				res.status(206);
				res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
				// res.setHeader("Content-Length", chunk); // this results in multiple 'Parse Error: Expected HTTP/' errors, not necessary I guess!
				readopts = {start, end: end+1};
			} else {
				res.setHeader("Content-Length", stat.size);
			}
			var readable = await this.read(src, readopts);
			readable.on('end', ()=>res.end());
			readable.on("error", (err)=>reject(err));
			readable.on("close", ()=>{
				resolve()
			});
			readable.pipe(res);
		});
	}

	/** @param {ID} dirid @param {string} origname @param {string} suffix @returns {string} ID */
	async unique(dirid, origname, suffix) {
		if (!suffix || suffix === "~") suffix = " - Copy"
		var names = (await Promise.all((await this.readdir(dirid)).map(f=>this.stat(f)))).map(s=>s.name);
		var i = 0;
		var name = origname;
		while (names.includes(name)) {
			i++;
			name = utils.suffix(origname, suffix + (i>1?` (${i})`:""));
		}
		return name;
	}
	
	/** @callback WalkCallback @param {string} id @param {Stat} stat @param {string[]} parents */
	/** @param {ID} id @param {WalkCallback} cb @returns {ID[]} */
	async walk(id, cb) {
		var all = [];
		const walk = async (id, cb, parents=[])=>{
			if (this.aborted) throw new errors.AbortException;
			var files = await this.readdir(id);
			var stats = {};
			for (var cid of files) {
				let stat = await this.stat(cid);
				if (stat) stats[cid] = stat;
			}
			files.sort((a,b)=>{
				var adir = stats[a].mime===constants.DIRECTORY?1:0;
				var bdir = stats[b].mime===constants.DIRECTORY?1:0;
				if (adir > bdir) return -1;
				if (adir < bdir) return 1;
				if (stats[a].name < stats[b].name) return -1;
				if (stats[a].name > stats[b].name) return 1;
				return 0;
			});
			for (var cid of files) {
				var stat = stats[cid];
				all.push((cb && cb(cid, stat, [...parents, id])) ?? id);
				if (stat.mime === constants.DIRECTORY) await walk(cid, cb, [...parents, id]);
			}
		}
		await walk(id, cb);
		return all;
	}

	/** @param {ID[]} ids @returns {string} */
	async archivetmp(ids) {
		var tmpdst = path.join(this.elfinder.tmp_dir, uuid.v4()+".zip");
		const writable = fs.createWriteStream(tmpdst);
		this.register_stream(writable);
		await new Promise(async (resolve,reject)=>{
			var archive = archiver("zip", { store: true });
			archive.on("error", (e)=>reject(e));
			writable.on("close", resolve);
			archive.pipe(writable);
			const append = async (id, dir)=>{
				var stat = await this.stat(id);
				if (!stat) return;
				var name = dir ? `${dir}/${stat.name}` : stat.name;
				if (stat.mime === constants.DIRECTORY) {
					archive.append(null, { name: `${name}/` });
					for (var sfile of await this.readdir(id)) {
						await append(sfile, name);
					}
				} else {
					archive.append(await this.read(id), { name });
				}
			};
			for (var id of ids) {
				await append(id);
			}
			archive.finalize();
		});
		return tmpdst;
	}

	/** @param {ID[]} ids @param {ID} dir @param {string} name @returns {string} */
	async archive(ids, dir, name) {
		var tmp = await this.archivetmp(ids);
		var dstid = await this.write(dir, name, this.register_stream(fs.createReadStream(tmp)));
		await fs.rm(tmp);
		return dstid;
	}

	/** @param {ID} dstid @returns {string} */
	async extracttmp(archiveid) {
		var tmpdst = path.join(this.elfinder.tmp_dir, uuid.v4());
		await fs.mkdir(tmpdst)
		var archivestream = await this.read(archiveid);
		await new Promise(resolve=>{
			var unzipperstream = unzipper.Extract({path:tmpdst});
			this.register_stream(unzipperstream);
			archivestream.pipe(unzipperstream).on("close", ()=>resolve());
		});
		return tmpdst
	}

	/** @param {ID} dstid @returns {ID[]} */
	async extract(archiveid, dstid) {
		var tmpdir = await this.extracttmp(archiveid);
		var newids = [];
		for (var tmp of await fs.readdir(tmpdir)) {
			var tmprel = upath.relative(this.elfinder.tmpvolume.root, upath.join(tmpdir, tmp));
			var tree = await this.elfinder.tmpvolume.driver(null, async (d)=>{
				return this.elfinder.copytree(d, tmprel, this, dstid);
			})
			newids.push(tree.id);
		}
		await fs.rm(tmpdir, {recursive:true});
		return newids;
	}

	/** @param {ID} id @returns {string|null} returns null if thumbnail not generatable. */
	async tmb(id, create=false) {
		var stat = await this.stat(id);
		if (stat.parent == this.thumbnails_dir) return id; // I am a thumbnail!
		var tmbname = utils.md5([id, stat.size, stat.ts].join("_")) + ".webp";
		var tmbpath = path.join(this.thumbnails_dir, tmbname);
		if (!await fs.lstat(tmbpath).then((s)=>s.isFile()).catch(()=>null)) {
			if (create) {
				const buffer = await utils.streamToBuffer(await this.read(id)).catch(utils.noop); // catch if cannot read file (e.g. psds)
				if (buffer) {
					await sharp(buffer)
						.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
							fit: sharp.fit.cover,
						})
						.webp({ quality: 80 })
						.toFile(tmbpath)
						.catch(() => null); // catch if cannot save (e.g. path too long)
				} else {
					await fs.writeFile(tmbpath, Buffer.from([]));
				}
			} else {
				return "1";
			}
		}
		return tmbname;
	}
	
	/** @param {string} tmpfile @param {ID} dstdir @param {string} filename */
	async upload(tmpfile, dstdir, filename) {
		return this.__upload(tmpfile, dstdir, filename);
	}

	mount() {
		return true;
	}

	unmount() {
		return true;
	}

	abort() {
		this.emit("abort");
	}

	// -------------------------------------------------------------

	/** @param {ID} id */
	async stat(id) {
		if (this.cache.stats[id]) return this.cache.stats[id];
		return this.cache.stats[id] = this.__stat(id);
	}
	async readdir(id) {
		if (this.cache.dirs[id]) return this.cache.dirs[id];
		return this.cache.dirs[id] = this.__readdir(id);
	}
	/** @param {ID} srcid @param {ID} dirid @param {string} name */
	async move(srcid, dirid, name) {
		return this.__move(srcid, dirid, name)
			.finally(()=>{
				delete this.cache.stats[srcid];
				this.cache.dirs = {};
			});
	}
	/** @param {ID} srcid @param {string} name */
	async rename(srcid, name) {
		return this.__rename(srcid, name)
			.finally(()=>{
				delete this.cache.stats[srcid];
				this.cache.dirs = {};
			});
	}
	/** @param {ID} srcid @param {ID} dirid @param {string} name */
	async copy(srcid, dirid, name) {
		return this.__copy(srcid, dirid, name)
			.then((id)=>{
				this.__fix_permissions(id);
				return id;
			})
			.finally(()=>{
				this.cache.dirs = {};
			});
	}
	/** @param {ID} srcid @param {string} mode */
	async chmod(srcid, mode) {
		return this.__chmod(srcid, mode);
	}

	/** @param {ID} id */
	async rm(id) {
		return this.__rm(id)
			.finally(()=>{
				delete this.cache.stats[id];
				this.cache.dirs = {};
			});
	}
	/** @param {ID} id @param {{start:Number, end:Number}} option */
	async read(id, options) {
		var stream = await this.__read(id, options);
		this.register_stream(stream);
		return stream;
	}

	/** @param {ID} dirid @param {string} name @param {stream.Readable|Buffer|string} data */
	async write(dirid, name, data) {
		if (data instanceof Stream) {
			this.register_stream(data)
		}
		return this.__write(dirid, name, data)
			.then((id)=>{
				this.__fix_permissions(id);
				delete this.cache.stats[id];
				return id;
			}).finally(()=>{
				delete this.cache.dirs[dirid];
			});
	}
	/** @param {ID} dirid @param {string} name */
	async mkdir(dirid, name) {
		return this.__mkdir(dirid, name)
			.then((id)=>{
				this.__fix_permissions(id)
				return id;
			})
			.finally(()=>{
				delete this.cache.dirs[dirid];
			});
	}

	// -------------------------------------------------------------

	/** @returns {Promise<void>} */
	async __init() { throw new errors.NotImplementedException; }

	/** @returns {Promise<void>} */
	async __config() { throw new errors.NotImplementedException; }

	/** @returns {Promise<void>} */
	async __destroy() { throw new errors.NotImplementedException; }

	/** @param {ID} id @returns {Promise<string>} */
	async __uri(id) { throw new errors.NotImplementedException; }

	/** @param {ID} id @returns {Promise<void>} */
	async __fix_permissions(id) { throw new errors.NotImplementedException; }

	/** @param {ID} id @returns {Promise<Stat>} */
	async __stat(id) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @param {ID} dstid @param {string} name @returns {Promise<ID>} */
	async __move(srcid, dstid, name) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @param {string} newname @returns {Promise<ID>} */
	async __rename(srcid, newname) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @param {ID} dstid @param {string} name @returns {Promise<ID>} */
	async __copy(srcid, dstid, name) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @param {string} mode @returns {Promise<ID>} */
	async __chmod(srcid, mode) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @returns {Promise<void>} */
	async __rm(srcid) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @param {any} options @returns {Promise<stream.Readable>} */
	async __read(srcid, options) { throw new errors.NotImplementedException; }

	/** @param {ID} srcid @returns {Promise<ID[]>} */
	async __readdir(srcid) { throw new errors.NotImplementedException; }

	/** @param {ID} dirid @param {string} name @param {stream.Readable|Buffer|string} data @returns {Promise<ID>} */
	async __write(dirid, name, data) { throw new errors.NotImplementedException; }

	/** @param {ID} dirid @param {string} name @returns {Promise<ID>} */
	async __mkdir(dirid, name) { throw new errors.NotImplementedException; }

	/** @param {string} tmpfile @param {ID} dstdir @param {string} filename @returns {Promise<ID>} */
	async __upload(tmpfile, dstdir, filename) { throw new errors.NotImplementedException; }

	/** @param {ID} id @returns {ID} */
	__abspath(id) { return this.id + this.volume.config.separator + id; }
	/** @param {ID} id @returns {Promise<ID>} */
	__options() {
		var base = globals.app.get_urls().url;
		return {
			disabled: [],
			archivers: {
				create: [
					"application/zip"
				],
				extract: [
				  	"application/zip",
				],
				createext: {
					"application/zip": "zip"
				}
			},
			csscls: "elfinder-navbar-root-local",
			uiCmdMap: [],
			url: new URL(`/api/file/${this.volume.id}/`, base).toString(),
			tmbUrl: new URL(`/api/tmb/${this.volume.id}/`, base).toString(),
			// tmbUrl: upath.join("api/tmb")+"/",
		}
	}
}

export default Driver;