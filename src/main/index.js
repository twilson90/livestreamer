import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import showdown from "showdown";
import chokidar from "chokidar";
import upath from "upath";
import compression from "compression";
import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import pidusage from "pidusage";
import checkDiskSpace from "check-disk-space";
import readline from "node:readline";
import child_process from "node:child_process";
import core from "../core/index.js";
import * as utils from "../core/utils.js";
import Cache from "../core/Cache.js";
import ClientServer from "../core/ClientServer.js";
import WebServer from "../core/WebServer.js";
import Download from './Download.js';
import Upload from './Upload.js';
import InternalSessionProps from './InternalSessionProps.js';
import InternalSession from './InternalSession.js';
import ExternalSession from './ExternalSession.js';
import Client from './Client.js';
import Plugin from './Plugin.js';
import Target from './Target.js';
import Stream from './Stream.js';
import globals from './globals.js';

const dirname = import.meta.dirname;
const MAX_CONCURRENT_MEDIA_INFO_PROMISES = 8;
const TICK_INTERVAL = 1 * 1000;

/** @typedef {string} Domain */
/** @typedef {Record<PropertyKey,{access:string, password:string, suspended:boolean}>} AccessControl */

export class MainApp {
    /** @type {Object.<string,Download>} */
    downloads = {};
    /** @type {Object.<string,import("./SessionBase.js")>} */
    sessions = {};
    /** @type {Object.<string,Target>} */
    targets = {};
    /** @type {Object.<string,Plugin>} */
    plugins = {};
    /** @type {Object.<string,Upload>} */
    uploads = {};
    // #media_info = {};
    #media_refs = {};
    #dirty_media_refs = new Set();
    /** @type {Cache} */
    #media_info_cache;
    /** @type {utils.PromisePool} */
    #media_info_promise_pool;
    // /** @type {utils.PromisePool} */
    // #prepare_promise_pool;
    null_stream_duration = 60
    netstats = [];

    /** @type {Stream[]} */
    get streams() { return Object.values(this.sessions).map(s=>s.stream).filter(s=>s).flat(); }

    get sessions_ordered() { return utils.sort(Object.values(this.sessions), s=>s.index); }
    
    /** @type {Record<PropertyKey,Client>} */
    get clients() { return this.wss.clients; }

    async init() {
        
        this.$ = new utils.Observer();
        this.$.sessions = {};
        this.$.nms_sessions = {};
        this.$.clients = {};
        this.$.logs = core.logger.register_observer();
        this.$.plugins = {};
        this.$.targets = {};
        this.$.uploads = {};
        this.$.downloads = {};
        this.$.media_info = {};
        this.$.sysinfo = {};
        this.$.processes = {};
        this.$.process_info = {};
        
        var update_processes = ()=>{
            for (var m in core.modules) {
                var p = core.ipc.get_process(m);
                p = p ? {...p, status: "online"} : {status:"stopped"}
                Object.assign(p, {
                    title: core.conf[`${m}.title`],
                    description: core.conf[`${m}.description`],
                });
                this.$.processes[m] = p;
            }
            this.check_volumes();
        };
        update_processes();

        core.ipc.on("internal:processes", ()=>update_processes());
        core.ipc.respond("stream_targets", ()=>{
            return this.streams.map(s=>Object.values(s.stream_targets)).flat().map(t=>t.$);
        });
        core.ipc.on("main.save-sessions", (data)=>{
            this.save_sessions();
        });
        core.ipc.on("media-server.post-publish", (nms_session)=>{
            if (nms_session.rejected) return;
            this.$.nms_sessions[nms_session.id] = nms_session;
            if (nms_session.appname === "livestream") {
                new ExternalSession(nms_session);
            }
        });
        core.ipc.on("media-server.metadata-publish", (nms_session)=>{
            this.$.nms_sessions[nms_session.id] = nms_session;
        });
        core.ipc.on("media-server.done-publish", (nms_session)=>{
            Object.values(this.sessions).filter(s=>s instanceof ExternalSession && s.nms_session && s.nms_session.id == nms_session.id).forEach(s=>s.destroy());
            delete this.$.nms_sessions[nms_session.id];
        });
        core.ipc.request("media-server", "published_sessions").catch(()=>{}).then((nms_sessions)=>{
            if (!nms_sessions) return;
            Object.assign(this.$.nms_sessions, Object.fromEntries(nms_sessions.map(s=>[s.id,s])));
        })
        core.ipc.on("core:update-conf", ()=>{
            core.logger.info("Config file updated.");
            update_conf();
        });

        this.netstats = []
        let nethogs = child_process.spawn(`nethogs`, ["-t"]);
        let listener = readline.createInterface(nethogs.stdout);
        listener.on("line", line=>{
            if (String(line).match(/^Refreshing:/)) {
                this.netstats = [];
                return;
            }
            var m = String(line).match(/^(.+?)\/(\d+)\/(\d+)\s+([\d.]+)\s+([\d.]+)$/);
            if (!m) return;
            var [_,program,pid,userid,sent,received] = m;
            sent *= 1024;
            received *= 1024;
            this.netstats.push({program,pid,userid,sent,received})
        });
        nethogs.on("error", (e)=>{
            console.error(e.message);
        });

        this.curr_saves_dir = path.resolve(core.saves_dir, "curr");
        this.old_saves_dir = path.resolve(core.saves_dir, "old");
        // this.fonts_dir = path.resolve(core.root_dir, ".fonts");
        this.public_html_dir = path.resolve(dirname, "public_html");
        this.change_log_path = path.resolve(dirname, "assets", "changes.md");
        this.mpv_lua_dir = path.resolve(dirname, "assets", "mpv_lua");
        this.null_video_path = path.resolve(core.tmp_dir, `nv`);
        this.null_audio_path = path.resolve(core.tmp_dir, `na`);
        this.null_audio_video_path = path.resolve(core.tmp_dir, `nav`);
        // this.fixed_media_dir = path.resolve(core.cache_dir, "fixed");

        // setInterval(()=>this.cleanup_tmp_dirs(), 1000 * 60 * 60);
        // this.cleanup_tmp_dirs();
        
        this.#media_info_cache = new Cache("mediainfo");
        this.#media_info_promise_pool = new utils.PromisePool(MAX_CONCURRENT_MEDIA_INFO_PROMISES);
        // this.#prepare_promise_pool = new utils.PromisePool(2);

        this.debounced_update_media_refs = utils.debounce(()=>{
            for (var filename of [...this.#dirty_media_refs]) {
                var refs = this.#media_refs[filename]
                if (!refs) {
                    delete this.#media_refs[filename];
                    delete this.$.media_info[filename];
                } else if (!(filename in this.$.media_info)) {
                    this.probe_media(filename);
                }
            }
            this.#dirty_media_refs.clear();
        }, 0);
        
        setInterval(()=>this.#tick(), TICK_INTERVAL);

        var update_change_log = async ()=>{
            this.$.change_log = {
                "mtime": +(await fs.stat(this.change_log_path)).mtime
            };
        }
        update_change_log();
        var change_log_watcher = chokidar.watch(this.change_log_path, {awaitWriteFinish:true});
        change_log_watcher.on("change", ()=>update_change_log());
        
        this.$.properties = InternalSessionProps;
        
        await fs.mkdir(this.old_saves_dir, { recursive: true });
        await fs.mkdir(this.curr_saves_dir, { recursive: true });
        // await fs.mkdir(this.fonts_dir, { recursive: true });
        // await fs.mkdir(this.fixed_media_dir, { recursive: true });
        
        await this.#generate_null_media_files();
        
        var save_interval_id = new utils.Interval(()=>{
            this.save_sessions();
        }, ()=>core.conf["main.autosave_interval"] * 1000);

        var update_conf = ()=>{
            this.load_targets();
            save_interval_id.next();
        };
        update_conf();

        for (var k in core.conf["main.plugins"]) {
            this.add_plugin(k, ...core.conf["main.plugins"][k]);
        }

        core.on("input", async (c)=>{
            const log = (s)=>process.stdout.write(s+"\n", "utf8");
            let command = c[0];
            if (command.match(/^replace-filenames$/)) {
                let find = c[1] || "";
                let replace = c[2] || "";
                let i = 0;
                let fix = (filename)=>{
                    var new_filename = filename.replace(find, replace);
                    if (new_filename != filename) i++;
                    return new_filename;
                };
                let props = ["subtitle_file", "audio_file", "background_file"];
                for (var session of Object.values(this.sessions)) {
                    if (session.$.background_file) session.$.background_file = fix(session.$.background_file);
                    for (var item of Object.values(session.$.playlist)) {
                        item.filename = fix(item.filename);
                        for (var k of props) {
                            if (item.props[k]) item.props[k] = fix(item.props[k]);
                        }
                    }
                }
                log(`Replaced ${i} filenames.`);
                return;
            }
            if (command.match(/^(replace-symlinks|remove-bad-symlinks|symlinks-to-copies)$/)) {
                let dir = c[1]
                let remove = command == "remove-bad-symlinks";
                let to_copy = command == "symlinks-to-copies";
                let find = c[2]
                let replace = c[3]
                let i = 0;
                let moved = {};
                let scan = async (dir)=>{
                    for (var f of await fs.readdir(dir)) {
                        let abspath = path.resolve(dir, f);
                        let stat = await fs.lstat(abspath).catch(()=>{});
                        if (stat.isSymbolicLink()) {
                            let linkpath = await fs.readlink(abspath);
                            let exists = !!(await fs.stat(linkpath).catch(()=>{}));
                            log(`Found link [${abspath} => ${linkpath}] exists:${exists}`);
                            if (remove) {
                                if (!exists) {
                                    log(`Deleting ${abspath}...`);
                                    await fs.unlink(abspath);
                                    i++;
                                }
                            } else if (to_copy) {
                                if (exists) {
                                    await fs.unlink(abspath);
                                    if (moved[linkpath]) {
                                        log(`Replacing ${abspath} with copy of file [${moved[linkpath]}]`);
                                        await fs.copy(moved[linkpath], abspath);
                                    } else {
                                        log(`Replacing ${abspath} with real file [${linkpath}]`);
                                        await fs.move(linkpath, abspath);
                                    }
                                    moved[linkpath] = abspath;
                                    i++;
                                } else {
                                    log(`Skipping bad symlink ${abspath} [${linkpath}]`);
                                }
                            } else {
                                if (linkpath.includes(find)) {
                                    let new_linkpath = linkpath.replace(find, replace);
                                    log(`Replacing ${abspath} [${linkpath} => ${new_linkpath}]`);
                                    await fs.unlink(abspath);
                                    await fs.symlink(new_linkpath, abspath);
                                    i++;
                                }
                            }
                        } else if (stat.isDirectory()) {
                            log(`Scanning ${abspath}...`);
                            await scan(abspath);
                        }
                    }
                }
                await scan(dir);
                log(`${remove?"Removed":"Replaced"} ${i} symlinks.`);
                return;
            }
        });
        
        await this.load_sessions();

        this.#scan_all_media_info_loop();

        await this.#setup_web();
        
    }

    check_volumes() {
        if (!core.ipc.get_process("file-manager")) return;
        core.ipc.request("file-manager", "volumes").catch(()=>{}).then((data)=>{
            if (!data) return;
            core.logger.info(`update-volumes [${Object.keys(data).length}]`);
            this.$.volumes = data;
        });
    }
    
    async #setup_web() {
        var exp = express();

        this.web = new WebServer(exp, {
            auth: true,
            // username: core.conf["main.http_username"],
            // password: core.conf["main.http_password"],
        });

        this.wss = new ClientServer();
        
        exp.use(bodyParser.urlencoded({
            extended: true,
            limit: '50mb',
        }));
        
        var upload = multer({
            // limits: {
            //     fileSize: 40*1024*1024*1024  // 40 gb limit
            // },
            storage: {
                /** @param {express.Request} req @param {Express.Multer.File} file */
                _handleFile: async (req, file, cb)=>{
                    var c;
                    try { c = JSON.parse(decodeURIComponent(file.originalname)); } catch {}
                    if (!c) {
                        cb("files[] field name incorrect format.");
                        return;
                    }
                    this.id = null;
                    this.path = "";
                    this.last_modified = 0;
                    this.start = 0;
                    this.length = 0;
                    
                    let {filename, start, filesize, mtime, id, session_id} = c;
                    // let hash = get_hash(filesize, mtime);
                    let rel_dir = req.path.slice(1);
                    let dest_dir = core.files_dir;
                    /** @type {InternalSession} */
                    let session = this.sessions[session_id];
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
                        if (req.query.media) {
                            var initial_scan = false;
                            upload.on("chunk", ()=>{
                                if (initial_scan) return;
                                if ((upload.unique_dest_path.match(/\.mp4$/i) && upload.first_and_last_chunks_uploaded) || upload.first_chunk_uploaded) {
                                    initial_scan = true;
                                    if (item) {
                                        item.filename = upload.unique_dest_path;
                                        this.probe_media(item.filename, {force:true});
                                    }
                                }
                            });
                            upload.on("complete", ()=>{
                                delete item.upload;
                                if (upload.chunks > 1) {
                                    if (item) this.probe_media(item.filename, {force:true});
                                }
                            });
                        }
                    }

                    if (item) item.upload = upload.$;
                    // same as "abort" apparently
                    /* req.on('close', () => {
                        if (!req.complete) {
                            core.logger.info(`Upload chunk cancelled by user: ${upload.unique_dest_path}`);
                            upload.cancel();
                        }
                    }); */
                    await upload.ready;
                    file.upload = upload;
                    let err = await upload.add_chunk(file.stream, start).catch((e)=>e);
                    cb(err);
                },
                /** @param {Request} _req @param {Express.Multer.File} file @param {(error: Error | null) => void} cb */
                _removeFile: async (req, file, cb)=>{
                    /** @type {Upload} */
                    let upload = file.upload;
                    await fs.rm(upload.unique_dest_path, {force:true, recursive:true});
                    // await ul.cancel();
                    cb(null);
                }
            }
        }).array("files[]");
        
        exp.put('/*', (req, res, next)=>{
            upload(req, res, (err)=>{
                let d = {};
                if (err) d.error = err;
                core.logger.log(err);
                res.status(err ? 400 : 200).json(d);
            })
        });
        var showdown_converter = new showdown.Converter();
        exp.use(compression({threshold:0}));
        exp.use("/changes.md", async (req, res, next)=>{
            var html = showdown_converter.makeHtml(await fs.readFile(this.change_log_path, "utf8"));
            res.status(200).send(html);
        });
        exp.use("/plugins/:id/", (req, res, next)=>{
            var p = this.plugins[req.params.id];
            if (p) express.static(p.dir)(req, res, next);
            else res.status(404).send("Plugin not found.");
        });

        exp.use("/screenshots", express.static(core.screenshots_dir));
        
        exp.use("/", await core.serve(this.public_html_dir));
        
        await this.wss.init("main", this.web.wss, this.$, Client, true);
    }

    async #scan_all_media_info_loop() {
        for (var k in this.$.media_info) {
            await Promise.all([
                utils.timeout(5 * 1000),
                this.probe_media(k, {silent:true})
            ])
        }
        setTimeout(()=>this.#scan_all_media_info_loop(), 1000);
    }
    
    async load_targets() {
        var leftovers = new Set(Object.values(this.targets));
        var target_defs = [
			{
                "id": "local",
				"name": "Local Media Server",
				"description": "Default streaming target",
				// "title": "{{title}}", // not necessary
				"rtmp_host": `rtmp://${core.conf["core.hostname"]}:${core.conf["media-server.rtmp_port"]}`,
				"limit": 0,
                /** @param {Stream} ctx */
                "config": (ctx, config)=>{
                    return {
                        config,
                        "rtmp_key": `live/${ctx.id}`,
                        "url": `${core.url}/media-server/player/index.html?id=${ctx.id}`,
                    }
                },
				"locked": true
			}
        ];
        for (var t of core.conf["main.targets"]) {
            if (!t.id) core.logger.error(`Cannot load conf defined target without 'id'.`);
            t.locked = true;
            target_defs.push(t);
        }
        for (var id of await fs.readdir(core.targets_dir)) {
            /** @type {Target} */
            var t;
            try {
                t = JSON.parse(await fs.readFile(path.resolve(core.targets_dir, id)));
            } catch (e) {
                core.logger.error(`Couldn't read or parse target '${id}'`);
            }
            t.id = id;
            target_defs.push(t);
        }
        for (var t of target_defs) {
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
        new Target(data).update();
    }

    update_target(id, data) {
        delete data.locked;
        var target = this.targets[id];
        if (!target.locked) target.update(data);
    }

    delete_target(id) {
        var target = this.targets[id];
        if (!target.locked) target.destroy();
    }

    #tick() {
        Object.values(this.sessions).forEach(s=>s.tick());
    }

    add_plugin(id, dir, options) {
        new Plugin(id, dir, options);
    }

    // async cleanup_tmp_dirs() {
    //     // stupid
    //     var files = await glob("*", {cwd:this.fixed_media_dir, withFileTypes:true});
    //     for (var f of files) {
    //         if (f.mtimeMs + (1000 * 60 * 60 * 24) > Date.now()) {
    //             await fs.rm(path.join(this.fixed_media_dir, f.name)).catch(()=>{});
    //         }
    //     }
    // }

    async #generate_null_media_files() {
        var [w,h] = [1280,720];
        var t0 = Date.now();
        if (!(await fs.exists(this.null_video_path))) {
            core.logger.info(`Generating null video stream...`);
            await utils.execa(core.conf["core.ffmpeg_executable"], ["-f", "lavfi", "-i", `color=c=black:s=${w}x${h}:r=30`, "-c:v", "libx264", "-b:v", "10m", `-force_key_frames`, `expr:gte(t,n_forced*1)`, "-r", "30", "-pix_fmt", "yuv420p", "-f", "matroska", "-t", String(this.null_stream_duration), this.null_video_path]);
        }
        if (!(await fs.exists(this.null_audio_path))) {
            core.logger.info(`Generating null audio stream...`);
            await utils.execa(core.conf["core.ffmpeg_executable"], ["-f", "lavfi", "-i", "anullsrc,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo", "-c:a", "flac", "-f", "flac", "-t", String(this.null_stream_duration), this.null_audio_path]);
        }
        if (!(await fs.exists(this.null_audio_video_path))) {
            core.logger.info(`Generating null audio/video stream...`);
            await utils.execa(core.conf["core.ffmpeg_executable"], ["-i", this.null_audio_path, "-i", this.null_video_path, "-map", "0:a:0", "-map", "1:v:0", "-c", "copy", "-f", "matroska", this.null_audio_video_path]);
        }
        var t1 = Date.now();
        core.logger.info(`Finished generating null [${t1-t0}ms]`);
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
                core.logger.info(`Loading '${filename}'...`);
                var session = null;
                try {
                    session = JSON.parse(await fs.readFile(fullpath, "utf8"));
                } catch {
                    core.logger.error(`Failed to load '${filename}'`);
                }
                if (session) {
                    session.id = uid;
                    // if (!session.uid) session.uid = uid;
                    sessions.push(session);
                    break;
                }
            }
        }
        /* if (!sessions.length) {
            // old format...
            let filenames = (await fs.readdir(core.saves_dir)).filter(filename=>filename.match(/^\d{4}-\d{2}-\d{2}-/));
            filenames = await utils.order_files_by_mtime_descending(filenames, core.saves_dir);
            for (let filename of filenames) {
                let fullpath = path.resolve(core.saves_dir, filename);
                try {
                    core.logger.info(`Loading '${filename}'...`);
                    sessions = JSON.parse(await fs.readFile(fullpath, "utf8")).sessions;
                    break;
                } catch {
                    core.logger.error(`Failed to load '${filename}'`);
                }
            }
        } */
        for (var session of sessions) {
            var id = session.id;
            delete session.id;
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

    register_media_ref(filename) {
        if (!filename) return;
        this.#media_refs[filename] = (this.#media_refs[filename] ?? 0) + 1;
        this.#dirty_media_refs.add(filename);
        this.debounced_update_media_refs();
    }

    unregister_media_ref(filename) {
        if (!filename) return;
        this.#media_refs[filename]--;
        this.#dirty_media_refs.add(filename);
        this.debounced_update_media_refs();
    }

    #proxy_files = {};
    proxy_files = {};

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

    mediainfo_version = 1.2;
    probe_media(filename, opts) {
        opts = Object.assign({
            force: false, // forces rescan despite still valid in cache
            silent: false, // if true doesn't set processing flag
        }, opts)

        if (!filename) return { exists: false };

        // var upload = Object.values(this.uploads).find(u=>u.unique_dest_path == filename);
        // if (upload) return { uploading: true };

        filename = String(filename);
        
        // if (!ignore_cache && this.#media_info[filename]) return this.#media_info[filename];
        // this.#media_info[filename] = 

        if (!(filename in this.$.media_info)) this.$.media_info[filename] = {};
        let old_data = this.$.media_info[filename];
        if (!opts.silent) old_data.processing = 1;

        return this.#media_info_promise_pool.enqueue(async ()=>{
            let ttl = null;
            let protocol = utils.is_uri(filename) && utils.try(()=>new URL(filename).protocol) || "file:";

            let stat, abspath;
            if (protocol === "file:") {
                abspath = utils.try_file_uri_to_path(filename);
                if (await fs.exists(abspath)) {
                    stat = (await fs.stat(abspath).catch(()=>{}));
                }
            }
            let size = stat ? stat.size : null;
            let mtime = stat ? stat.mtimeMs : null;
            let v = this.mediainfo_version;
            let cache_key = utils.md5(JSON.stringify({size, mtime, filename, v}));
            let data = (opts.force) ? null : await this.#media_info_cache.get(cache_key);

            if (!data) {
                let add_to_cache = true;
                let rmi, is_edl_file;
                let t0 = Date.now();
                data = {};
                // let basename = decodeURI(path.basename(filename));
                check: {
                    if (protocol === "livestreamer:") {
                        // data.name = filename;
                        add_to_cache = false;
                        break check;
                    }
                    if (protocol === "file:") {
                        data.exists = !!stat;
                        if (stat) {
                            data.size = stat.size;
                            data.mtime = stat.mtimeMs;
                            // data.atime = stat.atimeMs;
                            // data.ctime = stat.ctimeMs;
                            // data.btime = stat.birthtimeMs;
                            let header = await read_file(abspath, 0, 32).then((buffer)=>buffer.toString("utf-8")).catch(()=>"");
                            is_edl_file = header.startsWith("# mpv EDL v0\n");
                            if (!is_edl_file) {
                                let is_playlist_file = header.startsWith("// livestreamer playlist");
                                if (is_playlist_file) {
                                    let header_and_json = utils.split_after_first_line(await fs.readFile(abspath, "utf8"));
                                    data.playlist = JSON.parse(header_and_json[1]);
                                } else {
                                    rmi = await ffprobe(abspath).catch(()=>null);
                                    if (rmi) {
                                        data.probe_method = "ffprobe";
                                        data.duration = parseFloat(rmi.format.duration) || 0;
                                        // let orig_duration = info.duration;
                                        data.chapters = rmi.chapters.map((c,i)=>({ index: i, start: +c.start_time, end: +c.end_time, title: (c.tags) ? c.tags.title : null }));
                                        data.format = rmi.format.format_name;
                                        data.bitrate = +rmi.format.bit_rate || 0;
                                        data.streams = rmi.streams.map(s=>{
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
                                                stream.albumart = s.disposition.attached_pic;
                                            } else if (s.codec_type === "audio") {
                                                stream.channels = +s.channels;
                                            }
                                            return stream;
                                        });
                                        let default_video = rmi.streams.find(s=>s.codec_type === "video" && !s.disposition.attached_pic);
                                        if (default_video) {
                                            try { data.fps = eval(default_video.r_frame_rate); } catch { }
                                            try { data.avg_fps = eval(default_video.avg_frame_rate); } catch { }
                                            data.interlaced = !!(default_video.field_order && default_video.field_order !== "progressive");
                                        }
                                        // expires = 1000 * 60 * 60 * 24; // 1 day
                                        break check;
                                    }
                                }
                            }
                        } else {
                            ttl = 1000 * 60 * 60; // 1 hour
                        }
                    }
                    if (protocol === "http:" || protocol === "https:") {
                        rmi = await youtubedl_probe(filename).catch(()=>null);
                        data.probe_method = "youtube-dl";
                        data.exists = !!rmi;
                        if (rmi) {
                            data.size = +rmi.filesize_approx;
                            // data.atime = data.mtime = data.ctime = data.btime = +rmi.epoch;
                            data.name = rmi.is_playlist ? rmi.items[0].playlist_title : rmi.fulltitle;
                            data.filename = rmi._filename;
                            data.downloadable = true;
                            data.direct = !!rmi.direct;
                            if (rmi.is_playlist) {
                                data.playlist = rmi.items.map(i=>i.url || i.webpage_url);
                            } else {
                                data.duration = rmi.duration;
                                data.streams = [
                                    {
                                        type: "video",
                                        bitrate: rmi.vbr,
                                        codec: rmi.vcodec,
                                        width: rmi.width,
                                        height: rmi.height,
                                    },
                                    {
                                        type: "audio",
                                        bitrate: rmi.abr,
                                        codec: rmi.acodec,
                                        channels: 2,
                                    }
                                ];
                            }
                        }
                        break check;
                    }
                    if (protocol === "edl:" || is_edl_file) {
                        rmi = await edl_probe(filename).catch(e=>core.logger.warn(e));
                        if (rmi) {
                            // mi.name = filename;
                            data.duration = rmi.duration;
                            data.streams = rmi["track-list"].map(t=>{
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
                            // expires = 1000*60*60*24;
                        }
                        break check;
                    }
                    //ruh roh...
                }
                if (data && protocol) data.protocol = protocol;
            
                if (add_to_cache) {
                    let t1 = Date.now();
                    core.logger.info(`Probing '${filename}' took ${((t1-t0)/1000).toFixed(2)} secs`);
                }
            }

            utils.deep_sync(old_data, data);
            this.#media_info_cache.set(cache_key, data, ttl);

            return data;
        });
    }

    async evaluate_filename(dir,file) {
        file = file.replace(/%(.+)%/g, function(...m) {
            if (m[1].match(/^(date|now)$/)) return utils.date_to_string();
            if (m[1].match(/^(unix|timestamp)$/)) return (Date.now()).toString();
            return "_";
        });
        var fullpath, i = 0;
        while(true) {
            fullpath = path.resolve(path.resolve(dir,file+(i?`_${i}`:"")));
            var stat = await fs.stat(fullpath).catch(e=>null);
            if (!stat) break;
            ++i
        }
        if (path.relative(dir, fullpath).startsWith(".."+path.sep)) {
            throw new Error(`Bad file path: '${fullpath}'`)
        }
        return fullpath;
    }

    fix_filename(filename) {
        if (filename != null) {
            if (filename.startsWith("file://")) filename = utils.file_uri_to_path(filename);
            if (filename.match(/^[a-z]\:\\/i)) filename = upath.resolve(filename);
            filename = filename.replace(/^cabtv\:/, "livestreamer:");
        }
        return filename;
    }

    fix_access_control(ac) {
        for (var id of Object.keys(ac)) {
            var user = ac[id]
            if (user.username) {
                delete ac[id];
                id = user.username
                delete user.username;
                ac[id] = user;
            }
            if (id != "*" && user.password) delete user.password;
        }
        if (!ac["*"]) ac["*"] = {"access":"allow"};
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
                var s = await fs.lstat(filename).catch(()=>{});
                node[1] = s ? s.size : 0;
            }
            return node;
        }
        var v = this.$.volumes[id];
        return await process(path.dirname(v.root), path.basename(v.root), (await fs.stat(v.root)).isDirectory());
    }

    update_system_info() {
        if (!this.updating_system_info) {
            this.updating_system_info = (async()=>{
                var [disk, cpu_avg] = await Promise.all([
                    checkDiskSpace(utils.is_windows() ? 'c:' : '/'),
                    utils.getCPULoadAVG()
                ]);
                var sysinfo = this.$.sysinfo;
                sysinfo.disk_total = disk.size;
                sysinfo.disk_free = disk.free;
                var freemem = utils.is_windows() ? os.freemem() : (1024 * Number(/MemAvailable:[ ]+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]));
                sysinfo.memory_total = os.totalmem();
                sysinfo.memory_free = freemem;
                sysinfo.uptime = os.uptime();
                sysinfo.cpu_avg = cpu_avg;
                sysinfo.received = sysinfo.sent = 0;
                for (var d of this.netstats) {
                    sysinfo.received += d.received;
                    sysinfo.sent += d.sent;
                }
                await this.update_process_infos();
                this.updating_system_info = null;
            })();
        }
        return this.updating_system_info;
    }

    async update_process_infos() {
        var results = await utils.pidtree(core.ppid, {root:true, advanced:true});
        var all_pids = [...Object.values(results).map(r=>r.pid).flat()];
        var tree = utils.tree(results, (p)=>[p.pid, p.ppid])[0];
        var stats_lookup = all_pids.length ? await pidusage(all_pids) : {};
        for (let p of tree.children) {
            let pids = utils.flatten_tree(p, o=>o.children).map(o=>o.value.pid);
            let cpu = 0;
            let memory = 0;
            let received = 0;
            let sent = 0;
            let elapsed = (stats_lookup[p.value.pid]) ? stats_lookup[p.value.pid].elapsed : 0;
            for (var pid of pids) {
                var stat = stats_lookup[pid];
                for (var d of this.netstats) {
                    if (d.pid == pid) {
                        received += d.received;
                        sent += d.sent;
                    }
                }
                if (stat) {
                    cpu += stat.cpu/100;
                    memory += stat.memory;
                }
            }
            this.$.process_info[p.value.pid] = {sent,received,elapsed,cpu,memory};
        }
    }

    async destroy() {
        core.logger.info("Saving all sessions before exit...");
        await this.save_sessions();
        core.logger.info("Sessions saved.");
        this.web.destroy();
    }
}

async function read_file(filename, start, length) {
    const chunks = [];
    for await (let chunk of fs.createReadStream(filename, { start: 0, end: start+length })) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function youtubedl_probe(uri) {
    var proc = await utils.execa(core.conf["main.youtube_dl"] || "yt-dlp", [
        uri,
        "--dump-json",
        "--no-warnings",
        "--no-call-home",
        "--no-check-certificate",
        // "--prefer-free-formats",
        // "--extractor-args", `youtube:skip=hls,dash,translated_subs`,
        "--flat-playlist",
        "--format", core.conf["main.youtube_dl_format"]
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

async function ffprobe(uri) {
    var proc = await utils.execa("ffprobe", [
        '-show_streams',
        '-show_chapters',
        '-show_format',
        '-print_format', 'json',
        uri
    ]);
    return JSON.parse(proc.stdout);
}

async function edl_probe(uri) {
    var output = await utils.execa(core.conf["core.mpv_executable"], ['--frames=0', '--vo=null', '--ao=null', `--script=${path.resolve(app.mpv_lua_dir, 'get_media_info.lua')}`, uri]);
    var m = output.stdout.match(/^\[get_media_info\] (.+)/);
    if (m) return JSON.parse(m[1].trim());
    return null;
}

export const app = globals.app = new MainApp();
core.init("main", app);
export default app;