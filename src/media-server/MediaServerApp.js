import os from "node:os";
import path from "node:path";
import express, { Router } from "express";
import events from "node:events";
import fs from "fs-extra";
import bodyParser from "body-parser";
import compression from "compression";
import {glob} from "glob";
import NodeMediaServer from "node-media-server";
import readline from "node:readline";
import nms_core_logger from "node-media-server/src/node_core_logger.js";
import nms_ctx from "node-media-server/src/node_core_ctx.js";
import NodeFlvSession from "node-media-server/src/node_flv_session.js";
import NodeRtmpSession from "node-media-server/src/node_rtmp_session.js";
import stream from "node:stream";

import {globals} from "./exports.js";
import {utils, Blocklist, FFMPEGWrapper, WebServer, CoreFork, Logger, StopStartStateMachine, StopStartStateMachine$, constants} from "../core/exports.js";

/** @import {Request, Response} from "express" */

/** @typedef {(NodeRtmpSession | NodeFlvSession) & {live: Live}} Session */

const dirname = import.meta.dirname;

const THUMBNAIL_INTERVAL = 60 * 1000;
const AUTO_END_LIVE_TIMEOUT = 5 * 60 * 1000;
const FETCH_TIMEOUT = 60 * 1000;
const THUMBNAIL_FORMAT = "webp";
const THUMBNAIL_QUALITY = 70;
const THUMBNAIL_HEIGHT = 360;
// const DETECT_CROP = true;
// const LEVEL_CACHE_LIMIT = 60;

const SESSION_VARS = [
    "config",
    // "socket",
    // "res",
    "id",
    "ip",
    "TAG",
    // "handshakePayload",
    // "handshakeState",
    // "handshakeBytes",
    // "parserBuffer",
    // "parserState",
    // "parserBytes",
    // "parserBasicBytes",
    // "parserPacket",
    // "inPackets",
    // "inChunkSize",
    // "outChunkSize",
    "pingTime",
    // "pingTimeout",
    // "pingInterval",
    "isLocal",
    "isStarting",
    "isPublishing",
    "isPlaying",
    "isIdling",
    "isPause",
    "isReceiveAudio",
    "isReceiveVideo",
    // "metaData",
    // "aacSequenceHeader",
    // "avcSequenceHeader",
    "audioCodec",
    "audioCodecName",
    "audioProfileName",
    "audioSamplerate",
    "audioChannels",
    "videoCodec",
    "videoCodecName",
    "videoProfileName",
    "videoWidth",
    "videoHeight",
    "videoFps",
    "videoLevel",

    // "gopCacheEnable",
    // "rtmpGopCacheQueue",
    // "flvGopCacheQueue",

    // "ackSize",
    // "inAckSize",
    // "inLastAck",

    "appname",
    "streams",

    "playStreamId",
    "playStreamPath",
    "playArgs",

    "publishStreamId",
    "publishStreamPath",
    "publishArgs",

    "players",
    "numPlayCache",
    "startTimestamp",
];

const APPNAMES = new Set([
    "live", // local encoding server
    "external", "livestream", // external
    "private", "session", // session playlist items
    "internal", // internal session
]);

export class MediaServerApp extends CoreFork {
    /** @type {Record<PropertyKey,Live>} */
    lives = {};

    constructor() {
        super("media-server", {});
        globals.app = this;
    }

    async init() {
        this.blocklist_path = path.join(this.appdata_dir, "media-server-blocklist");
        this.media_dir = path.join(this.appdata_dir, "media");
        this.live_dir = path.join(this.media_dir, "live");

        await fs.mkdir(this.media_dir, {recursive:true});
        await fs.mkdir(this.live_dir, {recursive:true});

        for (var [from, to] of Object.entries({"log":"info","error":"error","debug":"debug","ffdebug":"debug"})) {
            nms_core_logger[from]  = (...args)=>{
                this.logger[to](...args);
            }
        }
        
        this.blocklist = new Blocklist(this.blocklist_path);

        // this.set_priority(process.pid, os.constants.priority.PRIORITY_ABOVE_NORMAL);
        
        /** @param {NodeRtmpSession | NodeFlvSession} session */
        const session_json = (session)=>{
            var s = {};
            for (var k of SESSION_VARS) s[k] = session[k];
            s.rejected = !nms_ctx.sessions.has(session.id);
            return s;
        };

        /** @param {NodeRtmpSession | NodeFlvSession} session */
        const session_reject = (session, reason)=>{
            this.logger.warn(reason);
            session.reject();
        };

        /** @param {NodeRtmpSession} session */
        const session_ready = (session, timeout=20*1000)=>{
            let give_up_timeout, check_interval;
            return new Promise((resolve, reject)=>{
                let check = ()=>{
                    if (!session.isPublishing) reject();
                    if (session.videoCodec && session.audioCodec) resolve();
                };
                check_interval = setInterval(check, 100);
                check();
                if (timeout) give_up_timeout = setTimeout(reject, timeout);
            }).finally(()=>{
                clearTimeout(give_up_timeout);
                clearInterval(check_interval);
            })
        }

        const log_event = (event, d)=>{
            for (var k of Object.keys(d)) {
                if (!d[k]) delete d[k];
            }
            this.logger.debug(`[${event}] ${JSON.stringify(d)}`);
        }

        this.ipc.respond("get_session", (id)=>{
            return session_json(this.get_session(id));
        });
        this.ipc.respond("published_sessions", ()=>{
            return [...nms_ctx.sessions.values()].filter(s=>s.isPublishing).map(s=>session_json(s));
        });
        this.ipc.respond("lives", ()=>{
            return Object.values(this.lives).map(l=>l.$);
        });
        this.ipc.respond("live", (id)=>{
            return this.lives[id]?.$;
        });
        this.ipc.respond("destroy_live", async (id)=>{
            var live = this.lives[id];
            if (live) await live.destroy();
        });
        
        this.aspect_ratio_cache = {};
        this.ipc.on("main.session-player.predicted_aspect_ratio", ({session_id, aspect_ratio, pts})=>{
            this.aspect_ratio_cache[session_id] = {aspect_ratio, pts};
        })

        /* this.ipc.on("main.stream-target.stopped", async ({id, reason})=>{
            var live = this.get_session(id)?.live;
            if (live && reason !== "restart") {
                await live.end();
            }
        }); */

        /* this.ipc.on("main.session.destroyed", (id)=>{
            var session = this.get_session(id);
            if (session) {
                session.stop();
            }
        }); */

        var live_dirs = await glob("*/", {cwd: this.live_dir});
        for (let id of live_dirs) {
            let live = new Live(id);
            if (!await live.load()) {
                await live.destroy();
            }
        }

        this.nms = new NodeMediaServer({
            rtmp: {
                port: this.conf["media-server.rtmp_port"],
                chunk_size: 60000,
                gop_cache: true,
                ping_timeout: 2147483647/1000,
                // ssl: {
                //     ...this.get_ssl_certs(),
                //     port: this.conf["media-server.rtmps_port"],
                // },
            },
        });

        let exp = express();
        this.web = new WebServer(exp, {
            auth: false,
            allow_unauthorised: false,
        });
        
        exp.use(bodyParser.urlencoded({ extended: true }));

        /* app.all('*', (req, res, next)=>{
            res.header('Access-Control-Allow-Origin', "*");
            res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With');
            res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Credentials', true);
            req.method === 'OPTIONS' ? res.sendStatus(200) : next();
        }); */

        exp.get('*.flv', (req, res, next)=>{
            req.nmsConnectionType = 'http';
            new NodeFlvSession({}, req, res).run();
        });

        this.web.wss.on("connection", (ws,req)=>{
            req.nmsConnectionType = 'ws';
            new NodeFlvSession({}, req, ws).run();
        });
        nms_ctx.nodeEvent.on('postPlay', (id, args)=>{
            nms_ctx.stat.accepted++;
        });
        nms_ctx.nodeEvent.on('postPublish', (id, args)=>{
            nms_ctx.stat.accepted++;
            // let session = nms_ctx.sessions.get(id);
            // session.socket.setTimeout(0);
        });
        nms_ctx.nodeEvent.on('doneConnect', (id, args)=>{
            let session = nms_ctx.sessions.get(id);
            let socket = (session instanceof NodeFlvSession) ? session.req.socket : session.socket;
            nms_ctx.stat.inbytes += socket.bytesRead;
            nms_ctx.stat.outbytes += socket.bytesWritten;
        });

        this.media_router = Router();
        this.media_router.get("/live/:id/:v/stream.m3u8", async (req, res, next)=>{
            var {id} = req.params;
            var live = this.lives[id];
            if (live) {
                if (await live.fetch(req, res)) return;
            }
            next();
        });
        this.media_router.use("/", express.static(this.media_dir, {
            maxAge: "2y",
            etag: false,
            setHeaders: (res, file_path, stat)=>{
                res.removeHeader("connection");
                // var metadata = await fs.readFile(file_path+".metadata.json", "utf8").catch(utils.noop);
                // if (metadata) res.setHeader("segment-metadata", metadata);
            }
        }));
        exp.use(compression({
            threshold: 0,
            filter: (req, res)=>{
                if (req.url.match(/.(mp4|ts)$/)) return false;
                return true;
            }
        }));
        exp.use("/media", this.media_router);
        exp.use('/logo', (req, res, next)=>{
            if (!this.conf["media-server.logo_path"]) return next();
            var fp = path.resolve(this.conf["media-server.logo_path"]);
            express.static(fp)(req, res, next);
        });
        exp.use('/conf', (req, res)=>{
            res.json({
                logo_url: this.conf["media-server.site_url"]
            });
        });
        exp.use("/", await this.serve({
            root: path.join(dirname, "public_html")
        }));

        var precheck_session = (id, StreamPath)=>{
            var session = this.get_session(id);
            var [appname, ...path] = StreamPath.split("/").slice(1);
            if (!appname || ![...path].length || ![...path].every(p=>p)) {
                session_reject(session, `Invalid streamPath: ${StreamPath}`);
                return false;
            }
            if (!APPNAMES.has(appname)) {
                session_reject(session, `app '${appname}' does not exist.`);
                return false;
            }
            return true;
        }

        this.nms.on('preConnect', (id, args)=>{
            log_event('preConnect', {id, args});
            var session = this.get_session(id);
            // if (!precheck_session(id, StreamPath)) return;
            if (!this.blocklist.is_valid(session.ip)) {
                session_reject(session, `blocked '${session.ip}' trying to connect.`);
                return;
            }
            this.ipc.emit("media-server.pre-connect", id);
        });
        this.nms.on('postConnect', (id, args)=>{
            log_event('postConnect', {id, args});
            var session = this.get_session(id);
            this.ipc.emit("media-server.post-connect", id);
        });
        this.nms.on('doneConnect', (id, args)=>{
            log_event('doneConnect', {id, args});
            var session = this.get_session(id);
            this.ipc.emit("media-server.done-connect", id);
        });
        //-------------------------------------------------
        this.nms.on('prePlay', (id, StreamPath, args)=>{
            log_event('prePlay', {id, StreamPath, args});
            if (!precheck_session(id, StreamPath)) return;
            var session = this.get_session(id);
            this.ipc.emit("media-server.pre-play", id);
        });
        this.nms.on('postPlay', (id, StreamPath, args)=>{
            log_event('postPlay', {id, StreamPath, args});
            var session = this.get_session(id);
            this.ipc.emit("media-server.post-play", id);
        });
        this.nms.on('donePlay', (id, StreamPath, args)=>{
            log_event('donePlay', {id, StreamPath, args});
            var session = this.get_session(id);
            this.ipc.emit("media-server.done-play", id);
        });
        //-------------------------------------------------
        this.nms.on('prePublish', async (id, StreamPath, args)=>{
            log_event('prePublish', {id, StreamPath, args});
            if (!precheck_session(id, StreamPath)) return;
            var session = this.get_session(id);
            if (session.appname === "live") {
                let live_id = StreamPath.split("/").pop();
                let live = this.lives[live_id];
                if (live && live.is_started) {
                    session_reject(session, `live is already running: ${StreamPath}`);
                }
            }
            this.ipc.emit("media-server.pre-publish", id);
        });
        this.nms.on('postPublish', async (id, StreamPath, args)=>{
            log_event('postPublish', {id, StreamPath, args});
            var session = this.get_session(id);
            this.ipc.emit("media-server.post-publish", session_json(session));
            await session_ready(session).catch(()=>{
                this.logger.error("No video and audio stream detected.");
                return;
            });
            if (!session.isPublishing || !session.publishStreamPath) {
                console.warn(`Session probably just ended but still sending chunks, ignoring...`, id);
                return;
            }

            // /** @type {string} */
            if (session.appname === "live") {
                let live_id = StreamPath.split("/").pop() || "";
                let data = args.opts ? utils.try_catch(()=>JSON.parse(args.opts)) : undefined;
                let live = this.lives[live_id] || new Live(live_id);
                await live.init(data, session);
                await live.restart();
            }
            this.ipc.emit("media-server.metadata-publish", session_json(session));
        });

        this.nms.on('donePublish', async(id, StreamPath, args)=>{
            log_event('donePublish', {id, StreamPath, args});
            var session = this.get_session(id);
            if (session?.live) await session.live.stop();
            this.ipc.emit("media-server.done-publish", id);
        });

        this.tick_interval = setInterval(()=>{
            for (var live of Object.values(this.lives)) {
                live.tick();
            }
        }, 1000);

        this.nms.run();
    }

    stop_session(id) {
        var session = this.get_session(id);
        if (session) session.stop();
    }

    /** @returns {Session} */
    get_session(id) {
        return this.nms.getSession(id) || [...nms_ctx.sessions.values()].find(s=>s.publishStreamPath == id);
    }

    async destroy() {
        this.nms.stop();
        clearInterval(this.tick_interval);
        for (var live of Object.values(this.lives)) {
            await live.stop();
        }
        await this.web.destroy();
        return super.destroy();
    }
}

export class Live$ extends StopStartStateMachine$ {
    hls_list_size = 0;
    hls_max_duration = 0;
    segment_duration = 0;
    segment = 0;
    use_hevc = false;
    use_hardware = false;
    fps_passthrough = true;
    outputs = [];
    origin = "";
    title = "";
    url = "";
    is_vod = false;
    is_live = false;
    ts = Date.now();
    duration = 0;
    size = 0;
}

/** @extends {StopStartStateMachine<Live$>} */
export class Live extends StopStartStateMachine {
    /** @type {FFMPEGWrapper} */
    ffmpeg;
    /** @type {Record<PropertyKey, LiveLevel>} */
    levels = {};
    metadata = {};
    /** @type {NodeRtmpSession} */
    session;
    #base_url = "";
    
	configs = [
		{
			"name": "240p",
			"resolution": 240,
			"video_bitrate": 400, // recommended 300–500 kbps
			"audio_bitrate": 64,
		},
		/* {
			"name": "360p",
			"resolution": 360,
			"video_bitrate": 750, // recommended 600–900 kbps
			"audio_bitrate": 128,
		}, */
		{
			"name": "480p",
			"resolution": 480,
			"video_bitrate": 1250, // recommended 1000–1500 kbps
			"audio_bitrate": 128,
		},
		{
			"name": "720p",
			"resolution": 720,
			"video_bitrate": 2500, // recommended 2000–3000 kbps
			"audio_bitrate": 160,
		},
		{
			"name": "1080p",
			"resolution": 1080,
			"video_bitrate": 4000, // recommended 3000–5000 kbps
			"audio_bitrate": 160,
		}
	]

    constructor(id) {

        super(id, new Live$());
        globals.app.lives[this.id] = this;

        /** @type {{ts:Number, duration:Number, start_ts:Number, ended:boolean, segment:Number, hls_list_size:Number, hls_max_duration:Number, segment_duration:Number}} */ this.$;

        this.dir = path.join(globals.app.live_dir, this.id);
        this.thumbnails_dir = path.join(this.dir, "thumbnails");
        this.data_filename = path.join(this.dir, "data.json");

        fs.mkdirSync(this.dir, {recursive:true});
        fs.mkdirSync(this.thumbnails_dir, {recursive:true});

        var base = `${globals.app.get_urls("media-server").url}`;
        this.#base_url = `${base}/media/live/${this.id}`;
        var player_url = `${base}/player/index.html?id=${this.id}`;
        var manifest_url = `${this.#base_url}/master.m3u8`;

        Object.assign(this.$, {
            url: player_url,
            manifest_url,
        });
        
        this.logger = new Logger(`live-${this.id}`);
        this.logger.on("log", (log)=>globals.app.logger.log(log));

        this.observer.on("change", (e)=>{
            if (e.subtree) return;
            this.debounced_save();
        });
    }

    async load() {
        var d;
        try { d = JSON.parse(await fs.readFile(this.data_filename, "utf-8").catch(()=>{})); } catch {};
        if (d) {
            await this.init(d);
            await this.end();
            await this.stop();
            return true;
        }
    }

    async save() {
        await globals.app.safe_write_file(this.data_filename, JSON.stringify(this.$), "utf-8");
    }

    debounced_save = utils.debounce(async ()=>{
        await this.save();
    }, 10);

    async tick() {
        var now = Date.now();
        if (this.is_started) {
            this.$.ts = now;
            this.$.duration = now - this.$.start_ts;
        } else {
            if (!this.$.ended && now > (this.$.ts + AUTO_END_LIVE_TIMEOUT)) {
                this.logger.warn(`LIVE [${this.id}] was not ended manually, ending automatically...`);
                await this.end();
            }
            if (now > (this.$.ts + (globals.app.conf["media-server.media_expire_time"] * 1000))) {
                this.logger.warn(`LIVE [${this.id}] has expired, destroying...`);
                await this.destroy();
            }
        }
    }
    
    /** @param {any} opts */
    /** @param {Session} session */
    async init(data, session) {
        data = {
            ...data
        }
        Object.assign(this.$, utils.json_copy({
            segment: 0,
            use_hardware: false,
            use_hevc: false,
            fps_passthrough: true,
            outputs: [],
            ...data,
            is_live: false,
        }));
        
        if (session) {
            this.session = session;
            this.$.origin = session.publishArgs.origin;
            this.$.title = session.publishArgs.title;
            session.live = this;
        }
        
        if (!globals.app.conf["media-server.allow_hardware"]) this.$.use_hardware = false;
        if (!globals.app.conf["media-server.allow_hevc"]) this.$.use_hevc = false;
        
        
        if (session) {
            this.configs = this.configs.filter(c=>c.resolution <= session.videoHeight);
        }
        
        this.$.hls_list_size = globals.app.conf["media-server.hls_list_size"];
        this.$.hls_max_duration = globals.app.conf["media-server.hls_max_duration"];
        this.$.segment_duration = +globals.app.conf["media-server.hls_segment_duration"];
        
        for (var l of Object.values(this.levels)) {
            await l.stop();
        }
        for (var c of this.configs) {
            new LiveLevel(this, c.name);
        }
    }
    
    async _start() {
        this.$.is_live = true;

        this.ffmpeg = new FFMPEGWrapper({log_filename: path.join(globals.app.logs_dir, `ffmpeg-live-${this.id}-${utils.date_to_string()}.log`)});
        
        var last_s;
        this.last_level.on("new_segment", ()=>{
            var s = Math.floor(this.$.segment * this.$.segment_duration * 1000 / THUMBNAIL_INTERVAL);
            if (s != last_s) this.create_thumbnail();
            last_s = s;
            this.$.segment++;
        });

        console.info(`Starting LIVE [${this.id}]...`);

        let ffmpeg_args = [
            "-strict", "experimental"
        ];
        
        let hwaccel = this.$.use_hardware ? globals.app.conf["core.ffmpeg_hwaccel"] : null;
        let hwenc = this.$.use_hardware ? globals.app.conf["core.ffmpeg_hwenc"] : null;

        // hwaccel = null;
        // hwenc = null;

        if (hwaccel) {
            ffmpeg_args.push(
                "-hwaccel", hwaccel,
                "-hwaccel_output_format", hwaccel,
                // `-extra_hw_frames`, `10` // fucks up
            );
        }
        
        var fps = this.$.fps_passthrough ? 0 : this.session?.videoFps ?? 0;
        if (hwenc) fps = 60; // VERY ANNOYING, but a builtin limitation of nvenc (and it looks like VAAPI too) is rate control with variable frame rate is not possible. it will take the container fps and that's that. If it varies, so will the bitrate... potentially massively, so we must fix it.
        var keyint = globals.app.conf["media-server.keyframe_interval"] || globals.app.conf["media-server.hls_segment_duration"] || 2;
        var use_hevc = this.$.use_hevc;
        var encoder = use_hevc ? `libx265` : `libx264`;
        if (hwenc) {
            encoder = `${use_hevc?"hevc":"h264"}_${hwenc}`;
        }
        
        ffmpeg_args.push(
            // `-use_wallclock_as_timestamps`, `1`,
            // `-re`, // if enabled, whenever there is speedup live stream will be way behind.
            // `-noautoscale`,
            // `-ignore_unknown`,
            "-fflags", "+genpts+igndts", // +discardcorrupt +autobsf
            // `-copyts`, // necessary to read the overall pts of the stream...
            `-avoid_negative_ts`, `make_zero`,
            // `-flush_packets`, `1`,
            // ...(fps ? [`-r`, `${fps || constants.DEFAULT_FPS}`] : []), // this is fucked with passthrough.
            "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${this.session.publishStreamPath}`,
            `-ar`, `44100`,
            `-ac`, `2`,
            `-bsf:v`, use_hevc ? `hevc_mp4toannexb` : `h264_mp4toannexb`,
            `-bsf:a`, `aac_adtstoasc`,
            "-fps_mode", fps ? "cfr" : "vfr",
            "-r", `${fps || constants.DEFAULT_FPS}`,
            `-g`, `${(fps || constants.DEFAULT_FPS) * keyint}`,
            `-force_key_frames`, `expr:gte(t,n_forced*${keyint})`, // keyframe every 2 seconds, this takes precedence over -g but apparently isn not working for some reason (vfr related)
            ...(fps ? [] : [`-enc_time_base`, `1/90000`]),
        );

        if (encoder == "h264_vaapi") {
            ffmpeg_args.push(
                `-compression_level`, "5", // 1-7 (1 = fastest, 7 = slowest)
                `-rc_mode`, `CBR`,
                `-profile`, `main`,
                `-level`, `4.1`,
            );
        } else if (hwenc == "h264_qsv") {
            ffmpeg_args.push(
                `-preset`, `slow`,
                `-level`, `4.1`,
                `-forced_idr`, `1`,
                `-profile`, `main`,
            );
        } else if (hwenc == "h264_vulkan") {
            ffmpeg_args.push(
                `-rc_mode`, `cbr`,
                `-profile`, `main`,
                `-level`, `4.1`,
                `-tune`, `ll`
            );
        } else if (hwenc == "h264_amf") {
            ffmpeg_args.push(
                `-rc`, `cbr`,
                `-profile`, `main`,
                `-preset`, `quality`,
                `-quality`, `quality`,
                `-level`, `4.1`,
            );
        } else if (hwenc == "h264_nvenc") {
            ffmpeg_args.push(
                `-preset`, "p5", // p1-p7 (1 = fastest, 7 = slowest)
                `-rc`, `vbr`,
                `-profile`, `main`,
                `-level`, `4.1`,
                `-forced-idr`, `1`,
                `-tune`, `ll`
            );
        } else if (encoder == "libx264") {
            ffmpeg_args.push(
                `-preset`, "medium",
                `-profile`, `main`,
                `-level`, `4.1`,
                `-forced-idr`, `1`,
                `-tune`, `zerolatency`,
            );
        } else if (encoder == "hevc_vaapi") {
            ffmpeg_args.push(
                `-compression_level`, "5", // 1-7 (1 = fastest, 7 = slowest)
                `-rc_mode`, `CBR`,
                `-profile`, `main`,
                `-level`, `3.1`,
            );
        } else if (hwenc == "hevc_qsv") {
            ffmpeg_args.push(
                `-preset`, `slow`,
                `-level`, `3.1`,
                `-forced_idr`, `1`,
                `-profile`, `main`,
            );
        } else if (hwenc == "hevc_vulkan") {
            ffmpeg_args.push(
                `-rc_mode`, `cbr`,
                `-profile`, `main`,
                `-level`, `3.1`,
                `-tune`, `ll`
            );
        } else if (hwenc == "hevc_amf") {
            ffmpeg_args.push(
                `-rc`, `cbr`,
                `-profile`, `main`,
                `-preset`, `quality`,
                `-quality`, `quality`,
                `-level`, `3.1`,
            );
        } else if (hwenc == "hevc_nvenc") {
            ffmpeg_args.push(
                `-preset`, "p5", // p1-p7 (1 = fastest, 7 = slowest)
                `-rc`, `vbr`,
                `-profile`, `main`,
                `-level`, `3.1`,
                `-forced-idr`, `1`,
                `-tune`, `ll`
            );
        } else if (encoder == "hevc") {
            ffmpeg_args.push(
                `-preset`, "medium",
                `-profile`, `main`,
                `-level`, `3.1`,
                `-forced-idr`, `1`,
                `-tune`, `zerolatency`,
            );
        }

        let _vi = 0;
        let _ai = 0;
        let genvid = ()=>`v${++_vi}`;
        let genaid = ()=>`a${++_ai}`;

        let filter_complex = [];
        let ar = this.session.videoWidth /this.session.videoHeight;
        ffmpeg_args.push(`-aspect`, `${ar.toFixed(6)}`);
        
        // filter_complex.push(`[${vid}]setpts=PTS-STARTPTS[fixed]`);
        // vid = "fixed";
        let vid = "0:v:0";
        let aid = "0:a:0";
        /* {
            let tmp1 = genvid();
            let tmp2 = genvid();
            filter_complex.push(
                `[${vid}]split[${tmp1}][${tmp2}]`,
                `[${tmp1}]showinfo`,
            )
            vid = tmp2;
        } */
        let vids = this.configs.map(c=>genvid());
        let aids = this.configs.map(c=>genaid());
        filter_complex.push(
            // setpts=PTS-STARTPTS,
            // asetpts=PTS-STARTPTS,
            `[${vid}]split=${vids.length}${vids.map((vid)=>`[${vid}]`).join("")}`,
            `[${aid}]aresample=async=1:min_hard_comp=0.100000:first_pts=0,asplit=${aids.length}${aids.map((aid)=>`[${aid}]`).join("")}`,
        );
        for (let i = 0; i < this.configs.length; i++) {
            let c = this.configs[i];
            let height = c.resolution;
            let width = Math.round(ar * height / 2) * 2;
            let needs_scaling = this.session.videoHeight != height || this.session.videoWidth != width;
            let vid = vids[i];
            let aid = aids[i];
            let graph = [];
            if (needs_scaling) {
                let s = `${width}:${height}`;
                if (hwaccel) graph.push(`scale_${hwaccel}=${s}`);
                else graph.push(`scale=${s}`);
            }
            if (graph.length) {
                let tmp = genvid();
                filter_complex.push(`[${vid}]${graph.join(",")}[${tmp}]`);
                vid = tmp;
            }
            if (hwaccel && !hwenc) {
                let tmp = genvid();
                filter_complex.push(`[${vid}]hwdownload,format=nv12[${tmp}]`);
                vid = tmp;
            }
            ffmpeg_args.push("-map", `[${vid}]`);
            ffmpeg_args.push(
                `-c:v:${i}`, encoder,
                `-b:v:${i}`, `${c.video_bitrate}k`,
                // `-minrate:v:${i}`, `${c.video_bitrate}k`,
                `-maxrate:v:${i}`, `${c.video_bitrate}k`,
                `-bufsize:v:${i}`, `${c.video_bitrate*2}k`,
            );
            ffmpeg_args.push("-map", `[${aid}]`);
            ffmpeg_args.push(`-c:a:${i}`, "aac");
            ffmpeg_args.push(`-b:a:${i}`, `${c.audio_bitrate}k`);
        }
        ffmpeg_args.push("-filter_complex", filter_complex.join(";"));
        // var fix_name = /** @param {string} s */(s)=>s.trim().replace(/\s+/g, "-").toLowerCase();
        ffmpeg_args.push(
            `-var_stream_map`, this.configs.map((c,i)=>`v:${i},a:${i},name:${encodeURIComponent(c.name)}`).join(" "),
            `-hls_list_size`, this.$.hls_list_size,
            `-hls_segment_filename`, `%v/%03d.${use_hevc?"m4s":"ts"}`,
            // `-hls_playlist_type`, `event`,
            `-threads`, `0`,
            `-f`, `hls`,
            `-hls_segment_type`, use_hevc ? `fmp4` : `mpegts`,
            // `-hls_init_time`, `1`,
            `-hls_time`, `${this.$.segment_duration}`,
            `-hls_flags`, `independent_segments+append_list+split_by_time`, // +discont_start
            `-master_pl_name`, `master.m3u8`,
            `-y`, `%v/stream.m3u8`
        );

        this.logger.info(`ffmpeg command:\n ffmpeg ${ffmpeg_args.join(" ")}`);

        for (var l of Object.values(this.levels)) {
            l.start();
        }
        this.ffmpeg.start(ffmpeg_args, {cwd: this.dir})
            .catch((e)=>{
                this.logger.error(new Error(`Live [${this.id}] ffmpeg error: ${e.message}`));
            });
        
        var rl = readline.createInterface(this.ffmpeg.stderr);
        rl.on("line", (line)=>{
            let m;
            if (m = line.match(/pts_time:([\d\.]+)/)) {
                this.pts = +m[1];
                console.log("PTS: ",this.pts);
            }
        });
        
        // this.ffmpeg.logger.on("log", (log)=>{
        //     this.logger.log(log);
        // })

        this.ffmpeg.on("end", ()=>{
            if (!this.destroyed) console.log("FFMPEG ended unexpectedly.");
            this.stop();
        });

        globals.app.ipc.emit("media-server.live.started", this.$);

        return super._start();
    }

    async _stop() {
        console.info(`LIVE [${this.id}] has stopped.`);
        this.$.is_live = false;
        globals.app.ipc.emit("media-server.live.stopped", this.id);
        for (var k in this.levels) {
            await this.levels[k].stop();
        }
        if (this.ffmpeg) await this.ffmpeg.destroy();
        await this.end();
        return super._stop();
    }
    
    async create_thumbnail() {
        if (!this.is_started) return;

        var level = this.last_level;
        var last_segment_name = level.last_segment_filename;
        if (!last_segment_name) return;
        var last_segment_filename = last_segment_name;
        
        var thumbnail_name = `${last_segment_name}.${THUMBNAIL_FORMAT}`;
        var thumbnail_path = path.join(this.thumbnails_dir, thumbnail_name);
        var ffmpeg_args = [];
        if (level.init_uri) {
            var init_filename = path.join(this.dir, level.init_uri);
            ffmpeg_args.push("-i", `concat:${init_filename}|${last_segment_filename}`); 
        } else {
            ffmpeg_args.push("-i", last_segment_filename);
        }
        ffmpeg_args.push(
            "-quality", THUMBNAIL_QUALITY,
            "-vf", `scale=-1:${THUMBNAIL_HEIGHT}`,
            "-vframes", "1",
            "-y",
            thumbnail_path
        );
        new FFMPEGWrapper().start(ffmpeg_args, {cwd: level.dir})
            .then(()=>{
                this.$.thumbnail_url = `${this.#base_url}/thumbnails/${thumbnail_name}`;
            })
            .catch((e)=>{
                // 1 bad thumbnail, whatever.
            });
    };

    get last_level() {
        var k = String(Object.keys(this.levels).pop());
        return this.levels[k];
    }

    /** @param {Request} req @param {Response} res */
    async fetch(req, res) {
        var {id, v} = req.params;
        if (this.$.is_vod) {
            var f = path.join(this.dir, v, `vod.m3u8`);
            if (await fs.exists(f)) {
                res.header("content-type", "application/vnd.apple.mpegurl");
                const transform = new stream.Transform({
                    transform(chunk, encoding, callback) {
                        this.push(chunk);
                        callback();
                    },
                    flush(callback) {
                        this.push('#EXT-X-ENDLIST\n');
                        callback();
                    }
                });
                stream.pipeline(fs.createReadStream(f, {encoding:'utf8'}), transform, res, (err)=>{
                    if (err) console.warn(err);
                });
                return true;
            }
        } else {
            res.set('cache-control', 'no-store');
            if (this.levels[v]) {
                await this.levels[v].fetch(req, res);
                return true;
            }
        }
    }

    async end() {
        if (this.$.ended) return;
        this.$.ended = true;
        this.$.is_vod = true;
    }

    async _destroy() {
        delete globals.app.lives[this.id];
        await fs.rm(this.dir, { recursive: true });
        globals.app.logger.info(`LIVE [${this.id}] has been destroyed.`);
        return super._destroy();
    }
}

class Segment {
    title="";
    duration=0;
    uri="";
    data={};
}
export class LiveLevel extends events.EventEmitter {
    /** @type {Segment[]} */
    #segments = [];
    // #bitrates = [];
    /** @type {Live} */
    #live;
    #stopped = false;
    #ended = false;
    #started = false;
    #interval;
    #update_deferred = new utils.Deferred();

    /** @param {Live} live @param {string} name */
    constructor(live, name) {
        super();
        this.#live = live;
        this.#live.levels[name] = this;
        
        this.dir = path.join(this.#live.dir, name);
        fs.mkdirSync(this.dir, {recursive:true}) // just incase...
        this.live_filename = path.join(this.dir, "stream.m3u8");
        this.filename = path.join(this.dir, "vod.m3u8");
    }

    start() {
        if (this.#started) return;
        this.#started = true;
        var last_mtime;
        this.#interval = setInterval(async()=>{
            var stat = await fs.stat(this.live_filename).catch(utils.noop);
            if (stat && stat.mtime != last_mtime) {
                last_mtime = stat.mtime;
                this.#update();
            }
        }, 500);
    }

    get last_segment() {
        return this.#segments[this.#segments.length-1];
    }
    get last_segment_filename() {
        var s = this.last_segment;
        return s ? s.uri : null;
    }
    #uris = new Set();
    
    /** @param {string} str */
    #parse_segments(str) {
        var lines = str.split(/\n/);
        var segments = [];
        var segment_str;
        for (var line of lines) {
            if (line.match(/^#EXTINF:/)) {
                if (segment_str) segments.push(this.#parse_segment(segment_str));
                segment_str = line+"\n";
            } else if (segment_str) {
                segment_str += line+"\n";
            }
        }
        if (segment_str) segments.push(this.#parse_segment(segment_str));
        return segments;
    }

    /** @param {string} str */
    #parse_segment(str) {
        var segment = new Segment();
        for (var line of str.split(/\n/)) {
            line = line.trim();
            let m;
            if (line.startsWith('#EXTINF:')) {
                let extinfData = line.substring(8).trim();
                const [durationStr, ...titleParts] = extinfData.split(',');
                const title = titleParts.join(',').replace(/"/g, '');
                segment.duration = parseFloat(durationStr);
                segment.title = title || null;
                segment.uri = null;
            } else if (m = line.match(/^#EXT-X-([^:]+):(.+)$/) || line.match(/^#EXT-X-([^:]+)$/)) {
                var [key, value] = m;
                if (value === undefined) value = true;
                else {
                    let dict = {};
                    for (let pair of value.split(",")) {
                        let [k,v] = pair.split("=");
                        try {
                            dict[k] = JSON.parse(v);
                        } catch (e) {
                            dict[k] = v;
                        }
                    }
                    value = dict;
                }
                segment.data[key] = value;
            } else if (line) {
                segment.uri = line;
            }
        }
        return segment;
    }

    /** @param {Segment} segment */
    #render_segment(segment) {
        var str = "";
        str += `#EXTINF:${segment.duration.toFixed(6)},${segment.title || ""}\n`;
        for (var k in segment.data) {
            var v = segment.data[k];
            if (typeof v == "boolean") {
                str += `#EXT-X-${k}\n`;
            } else if (typeof v == "object" && v !== null) {
                str += `#EXT-X-${k}:${Object.entries(v).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(",")}\n`;
            } else {
                str += `#EXT-X-${k}:${v}\n`;
            }
        }
        str += `${segment.uri}\n`;
        return str;
    }

    async #update() {
        var str = await fs.readFile(this.live_filename, "utf-8").catch(()=>"");
        var segments = this.#parse_segments(str);
        if (segments.length && !this.#segments.length) {
            var old = await fs.readFile(this.filename, "utf-8").catch(()=>"");
            if (old) {
                for (let s of this.#parse_segments(old)) {
                    await this.#add_segment(s, false);
                }
            } else {
                var init = str.match(/^#EXT-X-MAP:URI="(.+)"$/m);
                if (init) this.init_uri = init[1];
                await this.#append(this.#render_header());
            }
        }
        for (var s of segments) {
            if (this.#uris.has(s.uri)) continue;
            this.#uris.add(s.uri);
            await this.#add_segment(s, true);
        }
    }

    /** @param {Segment} segment */
    async #add_segment(segment, append_to_vod=false) {
        segment.i = this.#segments.length;
        if (this.#live.session) {
            let ar;
            try {
                let id = this.#live.session.publishArgs.origin.split("/").pop();
                ar = globals.app.aspect_ratio_cache[id].aspect_ratio;
            } catch (e) {}
            if (ar) segment.data["ASPECT"] = ar.toFixed(6);
        }
        this.#segments.push(segment);
        var segment_str = this.#render_segment(segment);
        if (append_to_vod) await this.#append(segment_str);
        fs.stat(path.join(this.dir, segment.uri)).then((s)=>{
            this.#live.$.size += s.size;
        });
        this.emit("new_segment", segment);
    }

    async #append(str) {
        await fs.appendFile(this.filename, str, "utf8");
        this.#live.emit("update");
        this.emit("update");
        this.#update_deferred.resolve();
        this.#update_deferred.reset();

    }
    #render_header(media_sequence) {
        var str = `#EXTM3U\n`;
        str += `#EXT-X-VERSION:9\n`;
        str += `#EXT-X-TARGETDURATION:${this.#live.$.segment_duration.toFixed(6)}\n`;
        str += `#EXT-X-MEDIA-SEQUENCE:${media_sequence||0}\n`;
        if (this.init_uri) {
            str += `#EXT-X-MAP:URI="${this.init_uri}"\n`;
        }
        return str;
    }
    #render(_HLS_msn, _HLS_skip) {
        var min_segments = this.#live.$.hls_list_size;
        var max_segments = Math.max(min_segments, Math.ceil(this.#live.$.hls_max_duration / this.#live.$.segment_duration));
        var end = this.#segments.length;
        var start = Math.max(0, end - max_segments);
        
        var lines = this.#render_header(start);
        
        lines += `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=1.0,CAN-SKIP-UNTIL=${(this.#live.$.segment_duration*6).toFixed(1)}\n`;

        if (_HLS_skip) {
            let skipped_segments = utils.clamp(end - min_segments, 0, (max_segments-min_segments));
            start += skipped_segments;
            lines += `#EXT-X-SKIP:SKIPPED-SEGMENTS=${skipped_segments}\n`;
        }

        // lines += `#EXT-X-DISCONTINUITY\n`;
        for (var s of this.#segments.slice(start, end)) {
            lines += this.#render_segment(s);
        }
        return lines;
    }
    /** @param {Request} req @param {Response} res */
    async fetch(req, res) {
        var _HLS_msn = req.query._HLS_msn || 0;
        var _HLS_skip = req.query._HLS_skip || false;
        var ts = Date.now();
        while (!this.#segments[_HLS_msn] && !this.#stopped) {
            await this.#update_deferred.promise;
            if (Date.now() > ts + FETCH_TIMEOUT) {
                console.warn("This is taking ages, aborting fetch.");
                break;
            }
        }
        res.header("content-type", "application/vnd.apple.mpegurl");
        res.send(this.#render(_HLS_msn, _HLS_skip));
    }

    async stop() {
        if (this.#stopped) return;
        this.#stopped = true;
        clearInterval(this.#interval);
        await this.#update();
    }
}

export default MediaServerApp;