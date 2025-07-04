import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import showdown from "showdown";
import chokidar from "chokidar";
import compression from "compression";
import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import checkDiskSpace from "check-disk-space";
import {globals, Stream, Target, API, MainClient, ExternalSession, InternalSession, InternalSessionProps, Upload, Download, downloaders } from "./exports.js";
import {utils, WebServer, ClientUpdater, ClientServer, Cache, CoreFork, LogCollector} from "../core/exports.js";

/** @import {StreamTarget, Session, Session$, MainClient$, Log$, Target$, Upload$, Download$, Stream$} from "./exports.js" */

/** @typedef {"video"|"audio"|"subtitle"} MediaInfoStreamType */
/** @typedef {{index:number, start:number, end:number, title:string}} MediaInfoChapter */
/** @typedef {{type:MediaInfoStreamType, codec:string, bitrate:number, default:boolean, forced:boolean, title:string, language:string, width:number, height:number, albumart:boolean, channels:number, duration:number, fps:number, avg_fps:number}} MediaInfoStream */
/** @typedef {{filename:string, type:MediaInfoStreamType, streams:MediaInfoStream[]}} MediaInfoExternalFile */
/** @typedef {{name:string, filename:string, streams:MediaInfoStream[], external_files:MediaInfoExternalFile[], exists:boolean, duration:number, size:number, mtime:number, format:string, bitrate:number, chapters:MediaInfoChapter[], avg_fps:number, fps:number, interlaced:boolean, direct:boolean, ytdl:boolean, virtual_filename:string}} MediaInfo */
/** @typedef {{cache:boolean, force:boolean, silent:boolean}} ProbeMediaOpts */

const dirname = import.meta.dirname;
const TICK_INTERVAL = 1 * 1000;
export const MEDIA_INFO_VERSION = 2;
export const MAX_CONCURRENT_MEDIA_INFO_PROMISES = 8;
export const DEFAULT_PROBE_MEDIA_OPTS = {
    force: false, // forces rescan despite still valid in cache
    silent: false, // if true doesn't set processing flag
    cache: true, // if true uses cache
}
export const MPV_LUA_ARGS = ["--no-config", '--frames=0', '--vo=null', '--ao=null'];

const ALBUMART_FILENAMES = Object.fromEntries([
    "albumart", "album", "cover", "front", "albumartsmall", "folder", ".folder", "thumb",
].map((ext)=>[ext, 1]));

const SUBTITLE_EXTS = Object.fromEntries([
    ".utf", ".utf8", ".utf-8", ".idx", ".sub", ".srt", ".rt", ".ssa", ".ass", ".mks", ".vtt", ".sup", ".scc", ".smi", ".lrc", ".pgs"
].map((ext)=>[ext, 1]));

const AUDIO_EXTS = Object.fromEntries([
    ".mp3", ".aac", ".mka", ".dts", ".flac", ".ogg", ".m4a", ".ac3", ".opus", ".wav", ".wv", ".eac3"
].map((ext)=>[ext, 1]));

const IMAGE_EXTS = Object.fromEntries([
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
].map((ext)=>[ext, 1]));

var ext_format_map = {
    ".mkv": "matroska",
    ".flv": "flv",
    ".mp4": "mp4",
};
var format_ext_map = Object.fromEntries(utils.reverse_map(ext_format_map));

/** @typedef {string} Domain */
/** @typedef {Record<PropertyKey,{access:string, password:string, suspended:boolean}>} AccessControl */

export class MainApp$ {
    /** @type {Record<PropertyKey,Session$>} */
    sessions = {};
    /** @type {Record<PropertyKey,Stream$>} */
    streams = {};
    /** @type {Record<PropertyKey,MainClient$>} */
    clients = {};
    /** @type {Record<PropertyKey,Log$>} */
    logs = {};
    /** @type {Record<PropertyKey,Target$>} */
    targets = {};
    /** @type {Record<PropertyKey,Upload$>} */
    uploads = {};
    /** @type {Record<PropertyKey,Download$>} */
    downloads = {};
    nms_sessions = {};
    processes = {};
    detected_crops = {};
    // properties = utils.json_copy(InternalSessionProps);
    sysinfo = {
        platform: process.platform,
        processes: {},
    };
}

/** @extends {CoreFork<MainApp$>} */
export class MainApp extends CoreFork {
    /** @type {Record<PropertyKey,Download>} */
    downloads = {};
    /** @type {Record<PropertyKey,Session>} */
    sessions = {};
    /** @type {Record<PropertyKey,Target>} */
    targets = {};
    /** @type {Record<PropertyKey,Upload>} */
    uploads = {};
    /** @type {Record<PropertyKey,Stream>} */
    streams = {};
    /** @type {Cache} */
    #media_info_cache;
    #media_refs = {};
    /** @type {Record<PropertyKey,Promise<MediaInfo>>} */
    #media_info_promise_map = {};
    /** @type {utils.PromisePool} */
    #media_info_promise_pool;
    // /** @type {utils.PromisePool} */
    // #prepare_promise_pool;
    #virtual_files = {};
    #ticks = 0;

    get sessions_ordered() { return utils.sort(Object.values(this.sessions), s=>s.index); }
    
    /** @type {Record<PropertyKey,MainClient>} */
    get clients() { return this.client_server.clients; }

    constructor() {
        super("main", new MainApp$());
        globals.app = this;
    }

    async init() {
        
        var log_collector = new LogCollector(this.$.logs);
        // this.logger.on("log", (log)=>{
        //     log_collector.register(log);
        // });
        this.ipc.on("internal:log", (log)=>{
            log_collector.register(log);
        });

        this.curr_saves_dir = path.resolve(this.saves_dir, "curr");
        this.old_saves_dir = path.resolve(this.saves_dir, "old");
        this.public_html_dir = path.resolve(dirname, "public_html");
        
        this.detected_crops_cache = new Cache("detected_crops", {
            ttl: 1000 * 60 * 60 * 24 * 7,
        });
        this.detected_crops_cache.on("set", ({key,data})=>{
            this.$.detected_crops[key] = data;
        });
        this.detected_crops_cache.on("delete", ({key,data})=>{
            delete this.$.detected_crops[key];
            fs.rm(path.resolve(this.screenshots_dir, key), {recursive:true}).catch(utils.noop);
        });

        this.#media_info_cache = new Cache("mediainfo", 1000 * 60 * 60 * 24 * 7);

        this.#media_info_promise_pool = new utils.PromisePool(MAX_CONCURRENT_MEDIA_INFO_PROMISES);
        
        var update_processes = ()=>{
            for (var name of [...Object.keys(this.modules)]) {
                var proc = this.ipc.get_process(name);
                var p = {
                    name,
                    status: proc?"online":"stopped",
                    pid: proc?proc.pid:null, 
                    title: this.conf[`${name}.title`],
                    description: this.conf[`${name}.description`]
                };
                this.$.processes[name] = p;
            }
            this.check_volumes();
        };
        update_processes();

        this.ipc.on("internal:processes", ()=>update_processes());
        this.ipc.respond("stream_targets", ()=>{
            return Object.values(this.streams).map(s=>Object.values(s.stream_targets)).flat().map(t=>t.$);
        });
        this.ipc.respond("save-sessions", ()=>{
            this.save_sessions();
        });
        this.ipc.on("media-server.post-publish", async (id)=>{
            var session = await this.ipc.request("media-server", "get_session", id).catch(utils.noop);
            if (!session) return;
            this.$.nms_sessions[id] = session;
            if (session.rejected) return;
            if (session.appname.match(/^(external|livestream)$/)) {
                new ExternalSession(session);
            }
        });
        this.ipc.on("media-server.metadata-publish", async (id)=>{
            var session = await this.ipc.request("media-server", "get_session", id).catch(utils.noop);
            if (!session) return;
            Object.assign(this.$.nms_sessions[id], session);
        });
        this.ipc.on("media-server.done-publish", (id)=>{
            var sessions = Object.values(this.sessions).filter(s=>s instanceof ExternalSession && s.nms_session && s.nms_session.id == id);
            for (var s of sessions) s.destroy();
            delete this.$.nms_sessions[id];
        });
        var nms_sessions = await this.ipc.request("media-server", "published_sessions").catch(utils.noop);
        if (nms_sessions) {
            Object.assign(this.$.nms_sessions, Object.fromEntries(nms_sessions.map(s=>[s.id,s])));
        }
        this.on("update-conf", (conf)=>{
            this.logger.info("Config file updated.");
            on_update_conf();
        });

        this.$.conf = {
            // ["auth"]: this.auth,
            ["debug"]: this.debug,
            ["test_stream_low_settings"]: this.conf["main.test_stream_low_settings"],
            ["rtmp_port"]: this.conf["media-server.rtmp_port"],
            ["session_order_client"]: this.conf["main.session_order_client"],
            ["media_expire_time"]: this.conf["media-server.media_expire_time"],
        };
        this.$.hostname = this.hostname;

        
        var exp = express();
        this.web = new WebServer(exp, {
            auth: (req, res)=>{
                if (req.url.startsWith("/virtual/")) return false;
                return true;
            },
            allow_unauthorised: false,
        });
        
        exp.use(bodyParser.urlencoded({
            extended: true,
            limit: '50mb',
        }));
        
        var upload = multer({
            // limits: {
            //     fileSize: 40*1024*1024*1024  // 40 gb limit
            // },
            storage: {
                /** @param {express.Request} req @param {Express.Multer.File & {upload:Upload}} file */
                _handleFile: async (req, file, cb)=>{
                    var url = new URL(req.url, "http://localhost");
                    var params = url.searchParams;
                    var filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
                    var start = +params.get("start");
                    var filesize = +params.get("filesize");
                    var mtime = +params.get("mtime");
                    var id = params.get("id") ?? "";
                    var is_media = params.get("media") == "1";
                    var session_id = params.get("session_id") ?? "";
                    let rel_dir = req.path.slice(1);
                    let dest_dir = this.files_dir;
                    /** @type {InternalSession} */
                    let session = this.sessions[session_id];
                    if (!(session instanceof InternalSession)) session = null;
                    if (session) dest_dir = session.files_dir;
                    let dest_path = path.resolve(dest_dir, rel_dir, filename);
                    let item = session ? session.$.playlist[id] : null;

                    if (path.relative(dest_dir, dest_path).startsWith("..")) {
                        cb(`dest_path is not descendent of ${dest_dir}.`);
                        return;
                    }
                    /** @type {Upload} */
                    let upload = this.uploads[id];
                    if (!upload) {
                        upload = new Upload(id, dest_path, filesize, mtime);
                        if (is_media) {
                            var initial_scan = false;
                            upload.on("chunk", ()=>{
                                if (!item) return;
                                if (initial_scan) return;
                                if ((upload.unique_dest_path.match(/\.mp4$/i) && upload.first_and_last_chunks_uploaded) || upload.first_chunk_uploaded) {
                                    initial_scan = true;
                                    session.update_media_info(item.filename);
                                }
                            });
                        }
                    }
                    req.upload = upload;
                    
                    if (item) {
                        item.filename = upload.unique_dest_path;
                    }

                    await upload.ready;
                    
                    let err = await upload.add_chunk(req, file.stream, start).catch((e)=>e);
                    cb(err);
                },
                _removeFile: async (req, file, cb)=>{
                    /** @type {Upload} */
                    let upload = req.upload;
                    await fs.rm(upload.unique_dest_path, {force:true, recursive:true});
                    // await ul.cancel();
                    cb(null);
                }
            }
        }).array("files[]");
        
        exp.put('/*', (req, res, next)=>{
            upload(req, res, (error)=>{
                /** @type {Upload} */
                let upload = req.upload;
                let d = upload ? upload.$ : {};
                if (error) {
                    d.error = error;
                    this.logger.warn(error);
                }
                res.status(error ? 400 : 200).json(d);
            })
        });

        var showdown_converter = new showdown.Converter();
        exp.use(compression({threshold:0}));
        exp.use("/changes.md", async (req, res, next)=>{
            var html = showdown_converter.makeHtml(await fs.readFile(this.change_log_path, "utf8").catch(utils.noop).then(s=>s?s:""));
            res.status(200).send(html);
        });

        exp.use("/virtual/*", async (req, res, next)=>{
            var url = decodeURI(req.params[0]);
            for (var downloader of Object.values(downloaders)) {
                var result = await downloader(url, req, res).catch((e)=>{
                    this.logger.warn(`Failed to download '${url}': ${e}`);
                });
                if (result) {
                    this.#virtual_files[url] = result;
                    return;
                }
            }
            next();
        });

        exp.use("/screenshots", express.static(this.screenshots_dir));
        
        exp.use("/", await this.serve({
            root: this.public_html_dir
        }));
        this.client_server = new ClientServer("main", this.web.wss, MainClient);

        this.api = new API();

        await fs.mkdir(this.old_saves_dir, { recursive: true });
        await fs.mkdir(this.curr_saves_dir, { recursive: true });
        await this.detected_crops_cache.ready;
        await this.#media_info_cache.ready;

        await this.load_sessions();

        var save_interval_id;
        var setup_save_interval = ()=>{
            clearInterval(save_interval_id);
            save_interval_id = setInterval(()=>{
                this.save_sessions();
            }, this.conf["main.autosave_interval"] * 1000);
        }
        
        setInterval(()=>this.#tick(), TICK_INTERVAL);
        var update_change_log = async ()=>{
            this.$.change_log = {
                "mtime": +(await fs.stat(this.change_log_path).catch(utils.noop).then(s=>s?s.mtime:0))
            };
        }

        this.#setup_client_updaters();

        update_change_log();
        var change_log_watcher = chokidar.watch(this.change_log_path, {awaitWriteFinish:true});
        change_log_watcher.on("change", ()=>update_change_log());

        var on_update_conf = ()=>{
            this.load_targets();
            setup_save_interval();
        };
        on_update_conf();

        this.on("input", async (c)=>{
            this.api.parse(...c);
        });
        
        await this.client_server.ready;
    }

    #setup_client_updaters() {
        var check_prop = (path, props)=>{
            if (!path.length || props.some(p=>utils.array_starts_with(path, p))) return true;
            return false;
        }
        
        const SESSION_PUBLIC_PROPS = [
            ["id"],
            ["index"],
            ["name"],
            ["create_ts"],
            ["type"],
            ["version"],
            ["schedule_start_time"],
            ["access_control"],
            ["stream_id"]
        ];

        const STREAM_PUBLIC_PROPS = [
            ["id"],
            ["session_id"],
            ["state"],
        ];

        this.client_updater = new ClientUpdater(this.observer, [], {
            filter: (c)=>{
                if (c.path[0] === "sessions") return check_prop(c.path.slice(2), SESSION_PUBLIC_PROPS);
                if (c.path[0] === "streams") return check_prop(c.path.slice(2), STREAM_PUBLIC_PROPS);
                if (c.path[0] === "logs") return false;
                if (c.path[0] === "sysinfo") return false;
                return true;
            }
        });
        
        this.admin_updater = new ClientUpdater(this.observer, [], {
            filter: (c)=>(c.path[0] === "logs")
        });

        this.sysinfo_client_updater = new ClientUpdater(this.observer, [], {
            filter: (c)=>(c.path[0] === "sysinfo")
        });
        this.sysinfo_client_updater.on("subscribe", (client)=>{
            this.#update_sysinfo();
        });
        
        this.client_server.on("connect", (client)=>{
            this.client_updater.subscribe(client);
            if (client.is_admin) this.admin_updater.subscribe(client);
        });
    }

    async check_volumes() {
        var data = await this.ipc.request("file-manager", "volumes").catch(utils.noop);
        if (!data) return;
        this.logger.info(`update-volumes [${Object.keys(data).length}]`);
        this.$.volumes = data;
    }
    
    async load_targets() {
        var leftovers = new Set(Object.values(this.targets));
        
        /** @type {{config:function(any,StreamTarget):any}[]} */
        var targets = [
			{
                "id": "local",
				"name": "Local Media Server",
				"description": "Default streaming target",
				"limit": 0,
                "opts": {
                    "use_hardware": true,
                    "use_hevc": false,
                    "outputs": this.conf["media-server.outputs"]
                },
                "config": (data, st)=>{
                    return {
                        "output_url": `rtmp://127.0.0.1:${this.conf["media-server.rtmp_port"]}/live/${st.id}`,
                        "url": `${this.get_urls("media-server").url}/player/index.html?id=${st.id}`,
                    }
                },
			},
			{
                "id": "file",
				"name": "File",
				"description": "Generates a video file",
				"limit": 0,
                "opts": {
                    "filename": "%session%-%date%",
                    "format": "flv",
                    "re": false,
                },
                "config": (data, st)=>{
                    let format = data.opts.format;
                    let filename = st.stream.session.evaluate_and_sanitize_filename(path.resolve(this.files_dir, data.opts.filename));
                    let ext = path.extname(filename);
                    if (!ext) {
                        ext = format_ext_map[format] || ".flv";
                        filename += ext;
                    }
                    filename = filename.split(path.sep).join("/");
                    if (filename.slice(0,1) !== "/") filename = "/"+filename;
                    return {
                        "output_format": format,
                        "output_url": `file://${filename}`,
                    }
                },
			},
			{
                "id": "gui",
				"name": "GUI",
				"description": "Opens a video window",
				"limit": 0,
                "opts": {
                    "osc": false
                },
                "config": (data, st)=>{
                    return {}
                },
			}
        ];
        for (var t of targets) t.builtin = true;

        for (var t of this.conf["main.targets"]) {
            if (!t.id) this.logger.error(`Cannot load conf defined target without 'id'.`);
            targets.push(t);
        }
        for (var t of targets) t.locked = true;

        var user_targets = [];
        for (var id of await fs.readdir(this.targets_dir)) {
            /** @type {Target} */
            var t;
            try {
                t = JSON.parse(await fs.readFile(path.resolve(this.targets_dir, id)));
            } catch (e) {
                this.logger.error(`Couldn't read or parse target '${id}'`);
            }
            t.id = id;
            user_targets.push(t);
        }
        for (var t of [...targets, ...user_targets]) {
            if (t.id in this.targets) {
                leftovers.delete(this.targets[t.id]);
                await this.targets[t.id].update(t);
            } else {
                new Target(t);
            }
        }
        for (var target of leftovers) {
            target.destroy();
        }
    }

    create_target(data) {
        delete data.locked;
        return new Target(data);
    }

    update_target(id, data) {
        delete data.locked;
        var target = this.targets[id];
        if (target && !target.locked) target.update(data);
    }

    delete_target(id) {
        var target = this.targets[id];
        if (target && !target.locked) target.destroy();
    }

    async #tick() {
        Object.values(this.sessions).forEach(s=>s.tick());
        if (this.sysinfo_client_updater.has_clients) this.#update_sysinfo();
        if (this.#ticks % 60 === 0) {
            var root = path.parse(process.cwd()).root;
            var usage = await checkDiskSpace(root);
            var disk_percent = (usage.free / usage.size);
            var is_low = disk_percent < this.conf["main.warn_disk_space"];
            this.$.disk = {
                "free": usage.free,
                "size": usage.size,
                "is_low": is_low,
            }
            if (is_low) {
                this.logger.warn(`Disk space is low: ${(disk_percent * 100).toFixed(1)}% free.`);
            }
        }
        this.#ticks++;
    }

    async #update_sysinfo() {
        Object.assign(this.$.sysinfo, await this.ipc.request("core", "sysinfo"));
    }

    async save_sessions() {
        /** @type {InternalSession[]} */
        var sessions = Object.values(this.sessions).filter(s=>s instanceof InternalSession);
        for (var session of sessions) {
            await session.autosave();
        }
    }

    async load_sessions() {
        var sessions = [];
        var session_ids = await fs.readdir(this.curr_saves_dir);
        // new format...
        for (let uid of session_ids) {
            var session_dir = path.resolve(this.curr_saves_dir, uid);
            let filenames = await utils.order_files_by_mtime_descending(await fs.readdir(session_dir), session_dir);
            for (let filename of filenames) {
                let fullpath = path.resolve(session_dir, filename);
                this.logger.info(`Loading '${filename}'...`);
                var session = null;
                try {
                    session = JSON.parse(await fs.readFile(fullpath, "utf8"));
                } catch {
                    this.logger.error(`Failed to load '${filename}'`);
                }
                if (session) {
                    session.id = uid;
                    // if (!session.uid) session.uid = uid;
                    sessions.push(session);
                    break;
                }
            }
        }
        for (var session of sessions) {
            var id = session.id;
            new InternalSession(id, session.name).load(session, true);
        }
    }

    get_new_session_name() {
        var i = 1;
        while (true) {
            var name = `Session ${i}`;
            var session = Object.values(this.sessions).find(s=>s.name == name);
            if (session === undefined) return name;
            i++;
        }
    }

    // #proxy_files = {};
    // proxy_files = {};

    async prepare(filename) {
        return filename;
        // if (filename) {
        //     var mi = await this.probe_media(filename);
        //     if (!this.#proxy_files[filename]) {
        //         if (mi && mi.probe_method == "ffprobe") {
        //             var fix = false;
        //             var ffmpeg_args = [];
        //             var fix_format = !!String(mi.format).match(/^(mpeg|mpegts|avi)$/);
        //             var first_audio_track = mi.streams.filter(s=>s.type === "audio")[0];
        //             var fix_audio = !!(first_audio_track && first_audio_track.codec.match(/^(mp3|mp2)$/)); // is this necessary?
        //             fix_audio = false;
        //             if (fix_format || fix_audio) {
        //                 fix = true;
        //                 // fflags +genpts is necessary for some VOB files.
        //                 ffmpeg_args.push("-fflags", "+genpts", "-i", filename, "-c", "copy");
        //                 if (fix_audio) ffmpeg_args.push("-c:a", "aac", "-b:a", "160k");
        //                 ffmpeg_args.push("-f", "matroska");
        //             }
        //             if (fix) {
        //                 this.#proxy_files[filename] = this.#prepare_promise_pool.enqueue(async ()=>{
        //                     var hash = utils.md5(filename);
        //                     var output_filename = path.join(core.cache_dir, "fixed", hash + ".mkv");
        //                     var proof_filename = output_filename + ".complete";
        //                     var exists = (await Promise.all([fs.exists(output_filename), fs.exists(proof_filename)])).every(s=>s);
        //                     core.logger.info(`Fixing '${filename}' => '${output_filename}'...`);
        //                     if (!exists) {
        //                         await new Promise((resolve)=>{
        //                             var ffmpeg = new FFMPEGWrapper();
        //                             ffmpeg.start([...ffmpeg_args, output_filename, "-y"]);
        //                             ffmpeg.on("info", (info)=>{
        //                                 if (info.time > 5000) resolve();
        //                             });
        //                             ffmpeg.on("end", async()=>{
        //                                 core.logger.info(`Fixed '${filename}' => '${output_filename}'.`);
        //                                 await fs.writeFile(proof_filename, "");
        //                                 resolve();
        //                             });
        //                             utils.timeout(10000).then(resolve);
        //                         });
        //                     }
        //                     this.proxy_files[filename] = output_filename;
        //                     return output_filename;
        //                 });
        //             }
        //         }
        //     }
        // }
        // return this.#proxy_files[filename] || filename;
    }

    /** @param {string[]} filenames */
    register_media_refs(filenames) {
        for (var filename of filenames) {
            if (!this.#media_refs[filename]) this.#media_refs[filename] = 0;
            this.#media_refs[filename]++;
        }
    }

    /** @param {string[]} filenames */
    unregister_media_refs(filenames) {
        for (var filename of filenames) {
            this.#media_refs[filename]--;
            if (this.#media_refs[filename] <= 0) {
                delete this.#media_refs[filename];
                // delete this.$.media_info[filename];
            }
        }
    }

    /** @param {string} filename @param {ProbeMediaOpts} opts */
    get_media_info(filename, opts) {
        if (!this.#media_info_promise_map[filename] || opts.force) {
            var promise = this.#probe_media(filename, opts);
            promise.catch(e=>{
                if (e instanceof ProbeError) {
                    this.logger.warn(e.message);
                } else {
                    throw e;
                }
            });
            promise.finally(()=>{
                if (promise === this.#media_info_promise_map[filename]) {
                    delete this.#media_info_promise_map[filename];
                }
            });
            this.#media_info_promise_map[filename] = promise;
        }
        return this.#media_info_promise_map[filename];
    }

    /** @param {string} filename @param {ProbeMediaOpts} opts @returns {Promise<MediaInfo>} */
    async #probe_media(filename, opts) {
        if (!filename) return {exists:false};
        opts = {
            ...DEFAULT_PROBE_MEDIA_OPTS,
            ...opts
        };
        return this.#media_info_promise_pool.enqueue(async ()=>{
            let t0 = Date.now();
            let url = utils.urlify(filename);
            if (!url) throw new ProbeError(`Invalid filename: ${filename}`);
            let protocol = url.protocol;
            let abspath = utils.pathify(filename) || filename;
            let original_abspath = abspath;
            let stat = (await fs.stat(abspath).catch(utils.noop));

            /** @type {MediaInfo} */
            let mi;
            let cache_key = utils.md5(JSON.stringify([abspath, MEDIA_INFO_VERSION, stat ? stat.size : 0, stat ? stat.mtimeMs : 0]));
            let cached = this.#media_info_cache.get(cache_key);
            let use_cache = !!opts.cache;

            if (!opts.force && use_cache && cached) {
                mi = cached;
            } else {
                mi: {
                    mi = {exists:false, filename};
                    
                    if (stat) {
                        mi.exists = true;
                        mi.size = stat.size;
                        mi.mtime = stat.mtimeMs;
                    }

                    let ffprobe_path = abspath;
                    if (abspath.match(/^https?:\/\/(?:mega\.nz|drive\.google\.com)\/(.+)/i)) {
                        ffprobe_path = new URL(`/virtual/${encodeURIComponent(abspath)}`, this.get_urls().url).toString();
                    }
                    
                    let raw = await this.ffprobe(ffprobe_path).catch(()=>null);
                    if (raw) {
                        var parse_stream = (s)=>{
                            let stream = {};
                            stream.type = s.codec_type;
                            stream.codec = s.codec_name;
                            stream.bitrate = +s.bit_rate || 0;
                            stream.duration = +s.duration || 0;
                            stream.default = !!s.disposition.default;
                            stream.forced = !!s.disposition.forced;
                            if (s.tags && s.tags.title) stream.title = s.tags.title;
                            if (s.tags && s.tags.language) stream.language = s.tags.language;
                            if (s.codec_type === "video") {
                                stream.width = +s.width;
                                stream.height = +s.height;
                                stream.albumart = !!s.disposition.attached_pic;
                                try { stream.fps = utils.safe_eval(s.r_frame_rate); } catch { }
                                try { stream.avg_fps = utils.safe_eval(s.avg_frame_rate); } catch { }
                                stream.interlaced = !!(s.field_order && s.field_order != "progressive");
                            } else if (s.codec_type === "audio") {
                                stream.channels = +s.channels;
                            }
                            return stream;
                        }

                        mi.exists = true;
                        mi.duration = parseFloat(raw.format.duration) || 0;
                        mi.chapters = raw.chapters.map((c,i)=>({ index: i, start: +c.start_time, end: +c.end_time, title: (c.tags) ? c.tags.title : null }));
                        mi.format = raw.format.format_name;
                        mi.bitrate = +raw.format.bit_rate || 0;
                        mi.streams = [];
                        for (let s of raw.streams) mi.streams.push(parse_stream(s));
                        let default_video_stream = mi.streams.find(s=>s.type === "video" && !s.albumart);
                        if (default_video_stream) {
                            mi.fps = default_video_stream.fps;
                            mi.avg_fps = default_video_stream.avg_fps;
                            mi.interlaced = default_video_stream.interlaced;
                        }
                        
                        let dir = path.dirname(abspath);
                        let basename = path.basename(abspath);
                        let files = await fs.readdir(dir).catch(()=>[]);
                        mi.external_files = [];
                        
                        var add_external = async(filename, type)=>{
                            var raw = await this.ffprobe(filename);
                            if (!raw || !raw.streams) return;
                            mi.external_files.push({filename, type, streams:raw.streams.map(s=>parse_stream(s))});
                        }
                        for (let f of files) {
                            if (f == basename) continue;
                            let f_lower = f.toLowerCase();
                            let ext = path.extname(f_lower);
                            let name = path.basename(f_lower, ext);
                            let similar_name = basename.startsWith(name);
                            if (similar_name && ext in SUBTITLE_EXTS) {
                                await add_external(path.join(dir, f), "subtitle");
                            }
                            if (similar_name && ext in AUDIO_EXTS) {
                                await add_external(path.join(dir, f), "audio");
                            }
                            if (ext in IMAGE_EXTS && (similar_name || name in ALBUMART_FILENAMES)) {
                                await add_external(path.join(dir, f), "video");
                            }
                        }

                        if (original_abspath in this.#virtual_files) {
                            let vf = this.#virtual_files[original_abspath];
                            mi.virtual = true;
                            mi.size = vf.size;
                            mi.mtime = vf.mtime;
                            mi.name = vf.name;
                            mi.filename = vf.filename;
                            mi.virtual_filename = ffprobe_path;
                        }

                        break mi;
                    }

                    if (protocol.match(/^https?:/)) {
                        let raw = await this.ytdl_probe(abspath).catch((e)=>{
                            this.logger.warn("YTDL error:", e);
                            mi.ytdl_error = String(e).split("\n").pop();
                        });
                        if (raw) {
                            mi.ytdl = true;
                            mi.size = +raw.filesize_approx || 0;
                            mi.mtime = +raw.timestamp;
                            mi.name = raw.is_playlist ? raw.items[0].playlist_title : raw.fulltitle;
                            mi.filename = raw._filename;
                            mi.direct = !!raw.direct;
                            mi.exists = true;
                            if (raw.is_playlist) {
                                mi.playlist = raw.items.map(i=>i.url || i.webpage_url);
                            } else {
                                mi.duration = raw.duration;
                                mi.streams = [];
                                if (raw.vcodec) {
                                    mi.streams.push({
                                        type: "video",
                                        bitrate: raw.vbr,
                                        codec: raw.vcodec,
                                        width: raw.width,
                                        height: raw.height,
                                    });
                                }
                                if (raw.acodec && raw.acodec != "none") {
                                    mi.streams.push({
                                        type: "audio",
                                        bitrate: raw.abr,
                                        codec: raw.acodec,
                                        channels: 2,
                                    });
                                }
                                for (let lang in raw.subtitles) {
                                    let format = raw.subtitles[lang].find(f=>f.ext === "vtt");
                                    if (format) {
                                        mi.streams.push({
                                            type: "subtitle",
                                            codec: format.ext,
                                            language: lang,
                                            url: format.url,
                                        });
                                    }
                                }
                            }
                            break mi;
                        }
                    }
                    
                    let header = "";
                    if (protocol === "file:") header = await read_file(abspath, 0, 32).then((buffer)=>buffer.toString("utf-8")).catch(()=>"");
                    else if (protocol.match(/^https?:/)) header = await fetch(abspath, {headers:{"Range":"bytes=0-32"}}).then(res=>res.text()).catch(()=>"");

                    if (header) mi.exists = true;

                    let is_edl_file = header.startsWith("# mpv EDL v0\n");
                    let is_playlist_file = header.startsWith("// livestreamer playlist\n");

                    if (is_playlist_file) {
                        let header_and_json = utils.split_after_first_line(await fs.readFile(abspath, "utf8"));
                        try {
                            mi.playlist = JSON.parse(header_and_json[1]);
                        } catch {
                            this.logger.warn("Playlist error:", header_and_json[1]);
                        }
                        break mi;
                    }
                    
                    if (is_edl_file || protocol === "edl:") {
                        raw = await this.edl_probe(abspath).catch(e=>this.logger.warn("EDL error:", e));
                        if (raw) {
                            mi.exists = true;
                            mi.duration = raw.duration;
                            mi.streams = raw["track-list"].map(t=>{
                                let stream = {};
                                stream.type = (t.type === "sub") ? "subtitle" : t.type;
                                stream.codec = t.codec;
                                stream.bitrate = +t["demux-bitrate"];
                                stream.default = t.default;
                                stream.forced = t.forced;
                                stream.title = t.title;
                                stream.language = t.lang;
                                if (t.type === "video") {
                                    stream.width = +t["demux-w"];
                                    stream.height = +t["demux-h"];
                                    stream.albumart = !!t.albumart;
                                } else if (t.type === "audio") {
                                    stream.channels = +t["demux-channel-count"];
                                }
                                return stream;
                            });
                            break mi;
                        }
                    }
                }
                let t1 = Date.now();
                if (!opts.silent) {
                    this.logger.info(`Probing '${filename}' took ${((t1-t0)/1000).toFixed(2)} secs`);
                }
                if (mi.exists && use_cache) this.#media_info_cache.set(cache_key, mi);
            }
            return mi;
        });
    }

    async analyze_local_file_system_volume(id) {
        var process = async(dir, name, is_dir)=>{
            var node = [name];
            var filename = path.join(dir, name);
            if (is_dir) {
                node[1] = [];
                for (var c of await fs.readdir(filename, {withFileTypes:true})) {
                    var n = await process(filename, c.name, c.isDirectory());
                    node[1].push(n);
                }
            } else {
                var s = await fs.lstat(filename).catch(utils.noop);
                node[1] = s ? s.size : 0;
            }
            return node;
        }
        var v = this.$.volumes[id];
        return await process(path.dirname(v.root), path.basename(v.root), (await fs.stat(v.root)).isDirectory());
    }

    async ytdl_probe(uri) {
        var proc = await utils.execa(this.conf["core.ytdl_path"] || "yt-dlp", [
            uri,
            "--dump-json",
            "--no-warnings",
            "--no-call-home",
            "--no-check-certificate",
            // "--prefer-free-formats",
            // "--extractor-args", `youtube:skip=hls,dash,translated_subs`,
            "--flat-playlist",
            "--format", this.conf["core.ytdl_format"]
        ]);
        var lines = proc.stdout.split("\n");
        var arr = lines.map(line=>JSON.parse(line));
        if (arr.length > 1) {
            return {
                is_playlist: true,
                items: arr
            };
        }
        return arr[0];
    }

    /** @param {string} filename */
    async ffprobe(filename) {
        var args = [
            '-show_streams',
            '-show_chapters',
            '-show_format',
            '-print_format', 'json',
            filename
        ];
        var proc = await utils.execa("ffprobe", args);
        return JSON.parse(proc.stdout);
    }

    async edl_probe(uri) {
        var output = await utils.execa(this.mpv_path, [
            ...MPV_LUA_ARGS,
            `--script=${this.resources.get_path("mpv_lua/get_media_info.lua")}`,
            uri
        ]);
        var m = output.stdout.match(/^\[get_media_info\] (.+)/);
        try { return JSON.parse(m[1].trim()); } catch { }
    }

    async youtube_url_to_edl(url) {
        var output = await utils.execa(this.mpv_path, [
            ...MPV_LUA_ARGS,
            `--ytdl-format=${this.conf["core.ytdl_format"]}`,
            `--script-opts-append=ytdl_hook-ytdl_path=${this.conf["core.ytdl_path"]}`,
            `--script-opts-append=ytdl_hook-try_ytdl_first=yes`, // important otherwise on_load_fail hook is used
            `--script=${this.resources.get_path("mpv_lua/get_stream_open_filename.lua")}`,
            url
        ]).catch(()=>null);
        if (!output) return;
        var lines = output.stdout.split(/\r?\n/);
        for (var line of lines) {
            var m = line.match(/^\[get_stream_open_filename\] (.+)$/);
            try { return JSON.parse(m[1].trim()); } catch { }
        }
    }

    get_lives() {
        return this.ipc.request("media-server", "lives");
    }

    async destroy_live(id) {
        await this.ipc.request("media-server", "destroy_live", [id]);
    }

    async destroy() {
        this.client_updater.destroy();
        this.admin_updater.destroy();
        this.logger.info("Saving all sessions before exit...");
        await this.save_sessions();
        this.web.destroy();
        return super.destroy();
    }
}

async function read_file(filename, start, length) {
    const chunks = [];
    for await (let chunk of fs.createReadStream(filename, { start: 0, end: start+length })) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

class ProbeError extends Error {}

export default MainApp;