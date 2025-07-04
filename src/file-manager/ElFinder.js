import express, { Router } from "express";
import path from "node:path";
import multer from "multer";
import fs from "fs-extra";
import crypto from "node:crypto";
import bodyParser from "body-parser";
import {errors, globals, Volume, drivers} from "./exports.js";
import {utils, constants} from "../core/exports.js";
/** @import { Driver } from './exports.js' */

const dirname = import.meta.dirname;

export class ElFinder {
	/** @type {Object.<string,express.Request>} */
	requests = {};
	/** @type {Object.<string,Volume>} */
	volumes = {};
	config;
	/** @type {Object.<string,string[]>} */
	uploads = {}
	#ready;
	get ready() { return this.#ready; }

	/** @param {Express} express @param {object} config */
	constructor(express, config) {
		this.commands = new Set(['abort','archive','callback','chmod','dim','duplicate','editor','extract','file','get','info','ls','mkdir','mkfile','netmount','open','parents','paste','put','rename','resize','rm','search','size','subdirs','tmb','tree','upload','url','zipdl']);
		this.elfinder_dir = path.join(globals.app.appdata_dir, "elfinder");
		this.netmounts_dir = path.join(this.elfinder_dir, "netmounts");
		this.uploads_dir = path.join(this.elfinder_dir, 'uploads');
		this.thumbnails_dir = path.join(this.elfinder_dir, 'tmb');
		this.tmp_dir = path.join(this.elfinder_dir, 'tmp');
		this.callback_template = fs.readFileSync(globals.app.resources.get_path("callback-template.html"), "utf-8");

		config = {
			...config,	
		}
		
		if (!config.volumes) config.volumes = [];
		this.config = config;

		var router = Router();
		
		express.use(`/api`, router);
		
		router.use(bodyParser.json({
			limit: '50mb'
		}))
		router.use(bodyParser.urlencoded({
			extended: true,
			limit: '50mb',
		}))
		
		var upload = multer({ dest: this.uploads_dir }).array("upload[]");
		router.post('/', upload, (req, res, next)=>{
			this.exec(req, res);
		});
		router.get('/', (req, res, next)=>{
			this.exec(req, res);
		});
		var check_volume = (req)=>{
			var volumeid = req.params.volume
			var volume = this.volumes[volumeid];
			if (!volume) res.status(404).send("Volume does not exist.");
			return volume;
		}
		router.get('/tmb/:volume/:tmb', async (req, res, next)=>{
			var volume = check_volume(req, res);
			if (volume) {
				if (req.params.tmb == "0") {
					res.status(404).send("Thumbnail not generatable.");
				} else {
					var tmbpath = path.join(this.thumbnails_dir, req.params.volume, req.params.tmb);
					res.sendFile(tmbpath);
				}
			}
		});
		router.get('/file/:volume/*', async (req, res, next)=>{
			var volume = check_volume(req, res);
			if (volume) {
				await volume.driver(null, async (driver)=>{
					var target = req.params[0];
					var stat = await driver.stat(target);
					if (!stat) {
						res.status(404).send("File not found.");
						return;
					}
					res.status(200);
					await driver.fetch(target, req, res);
				});
			}
		});
		this.#ready = this.#init();
	}

	async #init() {
		await fs.mkdir(this.thumbnails_dir, {recursive:true});
		await fs.mkdir(this.uploads_dir, {recursive:true});
		await fs.emptyDir(this.uploads_dir);
		await fs.mkdir(this.tmp_dir, {recursive:true});
		await fs.emptyDir(this.tmp_dir);
		await fs.mkdir(this.netmounts_dir, {recursive:true});

		for (var v of this.config.volumes) {
			new Volume(this, v).register();
		}

		for (var netkey of await fs.readdir(this.netmounts_dir)) {
			var config = JSON.parse(await fs.readFile(path.join(this.netmounts_dir, netkey), "utf8"));
			new Volume(this, config).register();
		}

		this.tmpvolume = new Volume(this, {
			driver: "LocalFileSystem",
			root: this.tmp_dir
		});

		await this.init();
	}

	async init(){}

	/** @param {express.Request} req @param {express.Response} res */
	async exec(req, res) {
		var d0 = Date.now();
		var opts = Object.assign({}, req.body, req.query);
		var cmd = opts.cmd;
		
		var allvolumes = Object.values(this.volumes);
		if (allvolumes.length == 0) {
			res.end(`No volumes configured.`);
			return;
		}
		
		var taskid = opts.reqid;
		this.requests[taskid] = res.req;

		var hash = opts.target ?? (opts.targets && opts.targets[0]) ?? opts.dst;
		var info = hash ? this.unhash(hash) : null;
		var volume = (info && info.volume) || allvolumes[0];
		var task;
		if (cmd) {
			if (this.commands.has(cmd)) {
				if (this.api[cmd]) {
					task = Promise.resolve(this.api[cmd].apply(this, [opts, req, res]));
				} else if (volume) {
					if (volume.api[cmd]) {
						task = Promise.resolve(volume.api[cmd].apply(volume, [opts, req, res]));
					} else {
						console.error(`'${cmd}' is not implemented by volume driver`);
					}
				} else if (hash) {
					console.error(`Cannot find volume with '${hash}'`);
				}
			} else {
				console.error(`'${cmd}' is not a recognized command`);
			}
		} else {
			res.end(`No cmd.`);
			return;
		}

		if (task) {
			var result = await task.catch((e)=>{
				var error;
				if (e instanceof errors.AbortException) {
					error = "Aborted";
				} else if (e instanceof errors.NotImplementedException) {
					error = "Not implemented";
				} else if (e instanceof Error) {
					console.error(e.stack);
					if (e.message.includes("dest already exists") || e.message.includes("file already exists")) error = "File already exists in destination.";
					else error = e.code || "Error";
				} else {
					console.error(e);
					error = e;
				}
				return { error };
			});
			if (result !== undefined) {
				if (result.callback) this.callback(result.callback);
				if (!res.writableEnded) res.json(result);
			}
			console.log(`Command '${cmd}' took ${Date.now()-d0}ms to execute.`);
		}
		
		delete this.requests[taskid];
	}

	/** @param {Volume} volume */
	hash(volume, id="") {
		var idhash = Buffer.from(id).toString('base64')
			.replace(/=+$/g, '')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '.');
		return `${volume.id}${idhash}`;
	}

	unhash(hash) {
		var i = hash.indexOf("_");
		var volumeid = hash.slice(0,i+1);
		var idhash = hash.slice(i+1).replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=')+'==';
		var id = Buffer.from(idhash, 'base64').toString("utf8");
		var volume = this.volumes[volumeid];
		return {
			volume,
			id
		};
	}

	/** @typedef {{id:string, name:string, isdir:boolean, children:Node[]}} Node */
	/** @param {Driver} srcdriver @param {Driver} dstdriver @returns {Node} */
	async copytree(srcdriver, srcid, dstdriver, dstid) {
		var copytree = async(srcid, dstid)=>{
			var stat = await srcdriver.stat(srcid);
			var newfileid, children;

			if (stat.mime === constants.DIRECTORY) {
				newfileid = await dstdriver.mkdir(dstid, stat.name);
				children = await srcdriver.readdir(srcid);
			} else {
				var src_data = await await srcdriver.read(srcid);
				newfileid = await dstdriver.write(dstid, stat.name, src_data);
			}
			var node = {
				id: newfileid,
				name:stat.name, 
				isdir: stat.mime === constants.DIRECTORY,
				children: [],
			}
			if (children) {
				for (var srcchild of children) {
					node.children.push(await copytree(srcchild, newfileid));
				}
			}
			return node;
		}
		return await copytree(srcid, dstid);
	}

	api = {
		/**
		 * @param {object} opts
		 * @param {*} opts.id Required
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		abort: (opts, req, res)=>{
			var req = this.requests[opts.id];
			if (req) {
				req.emit("abort");
				req.destroy();
			}
			return {error: 0};
		},
	
		/** 
		 * @param {object} opts
		 * @param opts.node {*} Required
		 * @param opts.json {*}
		 * @param opts.bind {*}
		 * @param opts.done {*}
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		callback: (opts, req, res)=>{
			if (!opts.node) throw new errors.ErrCmdParams();
			if (opts.done || !this.config.callbackWindowURL) {
				var html = this.callback_template
					.replace("[[node]]", JSON.stringify(opts.node))
					.replace("[[bind]]", JSON.stringify(opts.bind))
					.replace("[[json]]", JSON.stringify(opts.json));
				res.header('Content-Type', 'text/html; charset=utf-8');
				res.header('Content-Length', html.length);
				res.header('Cache-Control', 'private');
				res.header('Pragma', 'no-cache');
				res.end(html);
			} else {
				var url = new URL(this.config.callbackWindowURL);
				url.searchParams.append("node", node);
				url.searchParams.append("json", json);
				url.searchParams.append("bind", bind);
				url.searchParams.append("done", 1);
				res.header('Location', url.toString());
				res.end();
			}
		},
	
		/** 
		 * @param {object} opts
		 * @param {*} opts.name Required 
		 * @param {*} opts.method Required 
		 * @param {*} opts.args
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		editor: async (opts, req, res)=>{
			if (!opts.name) throw new errors.ErrCmdParams();
			if (!opts.method) throw new errors.ErrCmdParams();
			var names = opts.name;
			if (!Array.isArray(names)) names = [names];
			var res = {};
			for (var c of names) {
				var clazz;
				try {
					clazz = (await import(`./editors/${c}.js`)).default;
				} catch (e) {}
				if (clazz) {
					var editor = new clazz(this, opts.args);
					res[c] = editor.enabled();
					if (editor.isAllowedMethod(opts.method) && typeof editor[opts.method] === "function") {
						return editor.apply(editor[opts.method], [])();
					}
				} else {
					res[c] = 0;
				}
			}
			return res;
		},
	
		/** 
		 * @param {object} opts 
		 * @param {string} opts.protocol Required 
		 * @param {string} opts.host Required 
		 * @param {string} opts.path 
		 * @param {string} opts.port 
		 * @param {string} opts.user 
		 * @param {string} opts.pass
		 * @param {string} opts.alias
		 * @param {*} opts.options
		 * @param {express.Request} req
		 * @param {express.Response} res
		 */
		netmount: async (opts, req, res) => {
			if (!opts.protocol) throw new errors.ErrCmdParams();
			if (!opts.host) throw new errors.ErrCmdParams();
			var protocol = opts.protocol;
			var config = opts.options || {};
			if (protocol === 'netunmount') {
				let netkey = opts.user;
				if (netkey.match(/^v.+\_.+$/)) netkey = netkey.slice(1, -1);
				let id = `v${netkey}_`
				let volume = this.volumes[id];
				if (volume) {
					await fs.rm(path.join(this.netmounts_dir, netkey));
					volume.unregister();
					return volume.driver(null, async (driver)=>{
						return { removed: [{ 'hash': driver.hash("/") }] };
					});
				} else {
					throw ["errNetMount", opts.host, "Not NetMount driver."]
				}
			}
			if (opts.path) {
				config.root = opts.path
			}
			
			var c = {...opts};
			delete c.reqid;
			delete c.options;
			delete c.protocol;
			delete c.path;
			config = Object.assign(config, c);

			var driver = Object.entries(drivers).filter(([name, driver])=>driver.net_protocol === protocol).map(([name, driver])=>name)[0];
			config.driver = driver;
			config.name = `${opts.user}@${opts.host}`;
	
			if (!driver) {
				throw ["errNetMount", opts.host, "Not NetMount driver."]
			}
			var netkey = utils.md5(JSON.stringify(config));
			var id = `v${netkey}_`;
			if (this.volumes[id]) {
				throw ["errNetMount", opts.host, "Already mounted."]
			}
			config.id = id;
			config.netkey = netkey;
			await fs.writeFile(path.join(this.netmounts_dir, netkey), JSON.stringify(config), "utf8");
			var netvolume = new Volume(this, config);
			netvolume.register();
	
			return netvolume.driver(null, async (driver)=>{
				return { added: [await driver.file("/")] };
			});
		}
	}
}

export default ElFinder;