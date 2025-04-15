import os from "node:os";
import path from "node:path";
import express, { Router } from "express";
import events from "node:events";
import fs from "fs-extra";
import bodyParser from "body-parser";
import compression from "compression";
import {glob} from "glob";
import NodeMediaServer from "node-media-server";
import nms_core_logger from "node-media-server/src/node_core_logger.js";
import nms_ctx from "node-media-server/src/node_core_ctx.js";
import NodeFlvSession from "node-media-server/src/node_flv_session.js";
import NodeRtmpSession from "node-media-server/src/node_rtmp_session.js";

import {utils, globals, Blocklist, FFMPEGWrapper, WebServer, CoreFork, Logger, StopStartStateMachine, StopStartStateMachine$} from "./exports.js";

/** @import {Request, Response} from "express" */

/** @typedef {{video_bitrate:Number, audio_bitrate:Number, resolution:Number, name:string}} Config */

const dirname = import.meta.dirname;

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

    "live"
];

const APPNAMES = new Set([
    "live", // local encoding server
    "external", "livestream", // external
    "private", "session", // session playlist items
    "internal", // internal
]);
export class MediaServerApp extends CoreFork {
    /** @type {Record<PropertyKey,Live>} */
    lives = {};
    sessions = {};

    constructor() {
        super("media-server");
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

        this.set_priority(process.pid, os.constants.priority.PRIORITY_ABOVE_NORMAL);
        
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

        this.ipc.respond("published_sessions", ()=>{
            return [...nms_ctx.sessions.values()].filter(s=>s.isPublishing).map(s=>session_json(s));
        });
        this.ipc.respond("lives", ()=>{
            return Object.values(this.lives).map(l=>l.$);
        });
        this.ipc.respond("live", (id)=>{
            return this.lives[id] ? this.lives[id].$ : null;
        });

        this.ipc.on("main.stream-target.stopped", async ({id, reason})=>{
            var live = this.get_live(id);
            if (live && reason !== "restart") {
                await live.end();
            }
        });

        var live_dirs = await glob("*", {cwd: this.live_dir});
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
                ping: 60,
                ping_timeout: 30,
                // ssl: {
                //     ...await this.get_ssl_certs(),
                //     port: this.conf["media-server.rtmps_port"],
                // },
            },
        });

        let exp = express();
        this.web = new WebServer(exp);
        
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
            var live = this.get_live(id);
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
            if (!this.conf["media-server.logo"]) return next();
            var fp = path.resolve(this.conf["media-server.logo"]);
            express.static(fp)(req, res, next);
        });
        exp.use('/conf', (req, res)=>{
            res.json({
                logo_url: this.conf["media-server.logo_url"]
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
                let live = this.get_live(id);
                if (live) {
                    session_reject(session, `live session already exists: ${StreamPath}`);
                }
            }
            this.ipc.emit("media-server.pre-publish", id);
        });
        this.nms.on('postPublish', async (id, StreamPath, args)=>{
            log_event('postPublish', {id, StreamPath, args});
            var session = this.get_session(id);
            this.sessions[id] = session_json(session);
            this.ipc.emit("media-server.post-publish", id);
            await session_ready(session).catch(()=>{
                this.logger.error("No video and audio stream detected.");
                return;
            });
            if (!session.isPublishing || !session.publishStreamPath) {
                console.warn(`Session probably just ended but still sending chunks, ignoring...`, id);
                return;
            }
            // /** @type {string} */
            // let live_id = StreamPath.split("/").pop();
            if (session.appname === "live") {
                var opts = args.opts ? utils.try_catch(()=>JSON.parse(args.opts)) : undefined;
                var live_id = StreamPath.split("/").pop();
                let live = this.get_live(live_id) || new Live(live_id);
                await live.stop();
                await live.init(opts, session);
                await live.start();
            }
            this.sessions[id] = session_json(session);
            this.ipc.emit("media-server.metadata-publish", id);
        });

        this.nms.on('donePublish', async(id, StreamPath, args)=>{
            log_event('donePublish', {id, StreamPath, args});
            var live = this.get_live(id);
            if (live) await live.stop();
            delete this.sessions[id];
            this.ipc.emit("media-server.done-publish", id);
        });

        this.tick_interval = setInterval(()=>{
            for (var live of Object.values(this.lives)) {
                live.tick();
            }
        }, 60 * 1000);

        this.nms.run();
    }

    stop_session(id) {
        var session = this.get_session(id);
        if (session) session.stop();
    }

    /** @return {(NodeRtmpSession | NodeFlvSession)} */
    get_session(id) {
        return this.nms.getSession(id);
    }

    /** @return {(NodeRtmpSession | NodeFlvSession)} */
    get_session_from_stream_path(path) {
        for (var session of nms_ctx.sessions.values()) {
            if (session.publishStreamPath === path) {
                return session;
            }
        }
    }

    get_live(id) {
        if (this.lives[id]) return this.lives[id];
        var session = this.get_session(id);
        if (session && session.live) return this.lives[session.live.id];
    }

    async destroy() {
        this.nms.stop();
        clearInterval(this.tick_interval);
        for (var live of Object.values(this.lives)) {
            await live.stop();
        }
        await this.web.destroy();
    }
}

export class Live$ extends StopStartStateMachine$ {
    hls_list_size = 0;
    hls_max_duration = 0;
    segment_duration = 0;
    start_ts = 0;
    is_live = false;
    segment = 0;
    use_hevc = false;
    use_hardware = false;
    outputs = [];
    is_vod = false;
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
    get destroyed() { return !globals.app.lives[this.id]; }

    constructor(id) {

        super(id, new Live$());
        globals.app.lives[this.id] = this;

        /** @type {{ts:Number, duration:Number, start_ts:Number, ended:boolean, segment:Number, hls_list_size:Number, hls_max_duration:Number, segment_duration:Number, outputs:Config[]}} */ this.$;

        this.dir = path.join(globals.app.live_dir, this.id);
        this.thumbnails_dir = path.join(this.dir, "thumbnails");
        this.data_filename = path.join(this.dir, "data.json");

        fs.mkdirSync(this.dir, {recursive:true});
        fs.mkdirSync(this.thumbnails_dir, {recursive:true});

        this.url = `${globals.app.get_urls("media-server").url}/media/live/${this.id}`;
        Object.assign(this.$, {
            url: `${globals.app.get_urls("media-server").url}/player/index.html?id=${this.id}`
        });
        
        this.logger = new Logger(`live-${this.id}`);
        this.logger.on("log", (log)=>globals.app.logger.log(log));
    }

    async load() {
        var d;
        try { d = JSON.parse(await fs.readFile(this.data_filename, "utf-8").catch(()=>{})); } catch {};
        if (d) {
            await this.init(d);
            return true;
        }
    }

    async save() {
        await fs.writeFile(this.data_filename, JSON.stringify(this.$), "utf-8");
    }

    async tick() {
        var now = Date.now();
        if (this.is_started) {
            this.$.ts = now;
            this.$.duration = now - this.$.start_ts;
            await this.create_thumbnail();
            await this.save();
        } else {
            if (!this.$.ended && now > (this.$.ts + AUTO_END_LIVE_TIMEOUT)) {
                await this.end();
            }
            if (now > (this.$.ts + (globals.app.conf["media-server.media_expire_time"] * 1000))) {
                await this.destroy();
            }
        }
    }
    
    /** @param {any} opts */
    /** @param {NodeRtmpSession} session */
    async init(opts, session) {
        opts = utils.json_copy({
            segment: 0,
            use_hardware: false,
            use_hevc: false,
            outputs: [],
            ...(opts||{}),
        });
        
        Object.assign(this.$, opts);
        
        if (session) {
            this.session = session;
            this.$.origin = session.publishArgs.origin;
            this.$.title = session.publishArgs.title;
            session.live = this.$;
        }
        
        if (!globals.app.conf["media-server.allow_hardware"]) this.$.use_hardware = false;
        if (!globals.app.conf["media-server.allow_hevc"]) this.$.use_hevc = false;
        
        /** @param {any[]} outputs */
        var fix_outputs = (outputs)=>{
            if (!outputs || !outputs.length) outputs = utils.json_copy(globals.app.conf["media-server.outputs"]);
            for (var c of outputs) {
                c.resolution = +c.resolution || session.videoHeight;
                if (typeof c.video_bitrate == "number") c.video_bitrate = `${c.video_bitrate}k`;
                if (typeof c.audio_bitrate == "number") c.audio_bitrate = `${c.audio_bitrate}k`;
            }
            if (session) {
                outputs = outputs.filter(c=>c.resolution <= session.videoHeight);
            }
            return outputs;
        }

        this.$.outputs = fix_outputs(this.$.outputs);
        if (!this.$.outputs.length) throw new Error("No outputs found.");
        
        this.$.hls_list_size = globals.app.conf["media-server.hls_list_size"];
        this.$.hls_max_duration = globals.app.conf["media-server.hls_max_duration"];
        this.$.segment_duration = +globals.app.conf["media-server.hls_segment_duration"];
        
        for (var l of Object.values(this.levels)) {
            await l.destroy();
        }
        for (var c of this.$.outputs) {
            new LiveLevel(this, c);
        }
    }
    
    async _start() {
        this.$.start_ts = Date.now();
        this.$.is_live = true;

        this.ffmpeg = new FFMPEGWrapper();
        this.ffmpeg.on("error", (e)=>this.logger.error(e));

        this.last_level.on("new_segment", ()=>{
            if (this.$.segment == 0) this.create_thumbnail();
            this.$.segment++;
        });

        console.info(`Starting LIVE [${this.id}]...`);

        let ffmpeg_args = [
            "-strict", "experimental"
        ];
        
        const hwaccel = this.$.use_hardware ? globals.app.conf["core.ffmpeg_hwaccel"] : null;
        const hwenc = this.$.use_hardware ? globals.app.conf["core.ffmpeg_hwenc"] : null;
        if (hwaccel) {
            ffmpeg_args.push(
                "-hwaccel", hwaccel,
                "-hwaccel_output_format", hwaccel,
                // `-extra_hw_frames`, `10` // fucks up
            );
        }
        ffmpeg_args.push(
            "-fflags", "+igndts+genpts",
            `-dts_delta_threshold`, `0`,
            // `-stream_loop`, `-1`,
        );
        ffmpeg_args.push(
            // `-re`,
            // "-f", "flv",
            // `-noautoscale`,
            "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${this.session.publishStreamPath}`,
            `-ar`, `44100`,
            `-ac`, `2`,
            // `-pix_fmt`, `yuv420p`, // fucks up hw scaler
            `-bsf:v`, this.$.use_hevc ? `hevc_mp4toannexb` : `h264_mp4toannexb`,
            `-bsf:a`, `aac_adtstoasc`,
            // `-vf`, `setpts=PTS-STARTPTS`,
            // `-af`, `asetpts=PTS-STARTPTS`,
            `-async`, `1`,

            // `-vsync`, `2`,
            // `-fpsmax`, `60`, // max fps
            // `-avoid_negative_ts`, `make_zero`,
            // `-vsync`, `cfr`,
            // `-r`, "60",
            
            // `-fps_mode`, `passthrough`,
            // `-vsync`, `0`,

            // `-movflags`,` +faststart`,
            "-force_key_frames", `expr:gte(t,n_forced*${globals.app.conf["media-server.keyframe_interval"]})`, // keyframe every 2 seconds.
        );
        if (this.$.use_hardware) {
            ffmpeg_args.push(
                // "-r", "30",
                `-no-scenecut`, `1`,
                `-rc`, `cbr_hq`,
                // `-rc`, `constqp`,
                // `-bf`, `2`, // 2 is default
                `-forced-idr`, `1`,
                `-rc-lookahead`, `30`,
            );
        } else {
            ffmpeg_args.push(
                `-enc_time_base`, `-1`, //           <-- this
                `-video_track_timescale`, `1000`, // <-- and this seems to fix all dts errors
                `-vsync`, `2`,
            )
        }
        ffmpeg_args.push(
            // `-preset`, `ultrafast`
            `-preset`, hwenc ? `p7` : `medium`
        );

        var vid = `0:v:0`;
        var filter_complex = [];
        var video_height_map = {};
        var video_heights = [...new Set(this.$.outputs.filter(c=>c.resolution).map(c=>c.resolution))];

        if (video_heights.length == 1 && video_heights[0] == this.session.videoHeight) {
            video_height_map[video_heights[0]] = vid;
        } else if (video_heights.length) {
            filter_complex.push(
                `[${vid}]split=${video_heights.length}${video_heights.map((c,i)=>`[v${i}]`).join("")}`
            );
            video_heights.forEach((height,i)=>{
                let needs_scaling = this.session.videoHeight != height;
                let out = `v${i}`;
                let graph = [];
                if (needs_scaling) {
                    let s = `-2:${height}`;
                    if (hwenc) graph.push(`scale_${globals.app.conf["core.ffmpeg_hwaccel"]}=${s}`);
                    else graph.push(`scale=${s}`);
                    out = `vscaled${i}`;
                }
                if (graph.length) filter_complex.push(`[v${i}]${graph.join(",")}[${out}]`);
                video_height_map[height] = `[${out}]`;
            });
        }
        ffmpeg_args.push("-filter_complex", filter_complex.join(";"));

        this.$.outputs.forEach((c,i)=>{
            ffmpeg_args.push("-map", video_height_map[c.resolution]);
            ffmpeg_args.push(
                `-c:v:${i}`, hwenc ? `${this.$.use_hevc?"hevc":"h264"}_${hwenc}` : this.$.use_hevc ? `libx265` : `libx264`
            );
            ffmpeg_args.push(
                `-b:v:${i}`, c.video_bitrate,
                `-maxrate:v:${i}`, c.video_bitrate,
                `-bufsize:v:${i}`, c.video_bitrate,
            );
            // if (hwenc) {
            //     ffmpeg_args.push(
            //         // "-copyts",
            //         // `-crf`, `22`,
            //         // `-cq:v:${i}`, c.cq,
            //         // `-qmin:v:${i}`, c.cq,
            //         // `-qmax:v:${i}`, c.cq,
            //         // `-qp:v:${i}`, c.qp
            //     );
            // }
            ffmpeg_args.push("-map", "0:a:0");
            ffmpeg_args.push(`-c:a:${i}`, "aac");
            ffmpeg_args.push(`-b:a:${i}`, c.audio_bitrate);
            // ffmpeg_args.push(
            //     `-filter:a:${i}`, `asetpts=PTS-STARTPTS`
            // );
        });
        // var fix_name = /** @param {string} s */(s)=>s.trim().replace(/\s+/g, "-").toLowerCase();
        ffmpeg_args.push(
            `-var_stream_map`, this.$.outputs.map((c,i)=>`v:${i},a:${i},name:${encodeURIComponent(c.name)}`).join(" "),
            `-hls_list_size`, this.$.hls_list_size,
            `-hls_segment_filename`, `%v/%03d.${this.$.use_hevc?"m4s":"ts"}`,
            // `-hls_playlist_type`, `event`,
            `-threads`, `0`,
            `-f`, `hls`,
            `-hls_segment_type`, this.$.use_hevc ? `fmp4` : `mpegts`,
            // `-hls_init_time`, `1`,
            `-hls_time`, `${this.$.segment_duration}`,
            `-hls_flags`, `independent_segments+append_list+discont_start`,
            // `-hls_flags`, `+delete_segments`, // at some point I want to keep segments and serve atleast several hours of stream // +independent_segments
            `-master_pl_name`, `master.m3u8`,
            `-y`, `%v/stream.m3u8`
        );

        this.logger.info(`ffmpeg command:\n ffmpeg ${ffmpeg_args.join(" ")}`);

        for (var l of Object.values(this.levels)) {
            l.start();
        }
        
        this.ffmpeg.start(ffmpeg_args, {cwd: this.dir});
        
        // this.ffmpeg.logger.on("log", (log)=>{
        //     this.logger.log(log);
        // })

        this.ffmpeg.on("end", ()=>{
            if (!this.destroyed) console.log("FFMPEG ended unexpectedly.");
            this.stop();
        });

        globals.app.ipc.emit("media-server.live-publish", this.id);
    }

    async _stop() {
        console.info(`LIVE [${this.id}] has stopped.`);
        this.$.is_live = false;
        for (var v in this.levels) {
            await this.levels[v].destroy();
        }
        await this.ffmpeg.stop();
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
        await utils.execa(globals.app.ffmpeg_path, ffmpeg_args, {cwd: level.dir});
        this.$.thumbnail_url = `${this.url}/thumbnails/${thumbnail_name}`;
    };

    get last_level() {
        var k = String(Object.keys(this.levels).pop());
        return this.levels[k];
    }

    /** @param {Request} req @param {Response} res */
    async fetch(req, res) {
        var {id, v} = req.params;
        if (this.is_started) {
            res.set('cache-control', 'no-store');
            if (this.levels[v]) {
                await this.levels[v].fetch(req, res);
                return true;
            }
        } else {
            var f = path.join(this.dir, v, `vod.m3u8`);
            if (await fs.exists(f)) {
                res.header("content-type", "application/vnd.apple.mpegurl");
                fs.createReadStream(f, {encoding:'utf8'}).pipe(res);
                return true;
            }
        }
    }

    async end() {
        if (this.$.ended) return;
        this.$.ended = true;
        this.$.is_vod = true;
        for (var l of Object.values(this.levels)) {
            await l.end();
        }
    }

    async _destroy() {
        delete globals.app.lives[this.id];
        await fs.rm(this.dir, { recursive: true });
        this.emit("destroy");
    }
}

/** @typedef {{i:number, duration:number, uri:string}} Segment */
export class LiveLevel extends events.EventEmitter {
    /** @type {Segment[]} */
    #segments = [];
    // #bitrates = [];
    #destroyed = false;
    #ended = false;
    #started = false;
    #interval;

    /** @param {Live} live @param {Config} config */
    constructor(live, config) {
        super();
        this.live = live;
        this.config = config;
        this.live.levels[config.name] = this;
        
        this.dir = path.join(this.live.dir, config.name);
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
    get next_segment_index() { return this.#segments.length; }
    
    /** @param {string} str */
    parse(str) {
        var lines = str.split(/(?<!,)\n/);
        var segments = [];
        var m;
        var discontinuity = false;
        for (var line of lines) {
            if (m = line.match(/^#EXTINF:(.+?),\s*(.+)$/)) {
                var s = {
                    duration: +m[1],
                    uri: m[2],
                    i: +m[2].match(/^(\d+)/)[1],
                };
                if (discontinuity) {
                    s.discontinuity = true;
                }
                discontinuity = false;
                segments.push(s);
            } else if (line.match(/^#EXT-X-DISCONTINUITY$/)) {
                discontinuity = true;
            }
        }
        return segments;
    }

    async #update() {
        var str = await fs.readFile(this.live_filename, "utf-8").catch(()=>"");
        var segments = this.parse(str);
        if (segments.length && !this.#segments.length) {
            var old = await fs.readFile(this.filename, "utf-8").catch(()=>"");
            if (old) {
                old = old.replace(/#EXT-X-ENDLIST\n+?$/, "");
                await fs.writeFile(this.filename, old, "utf-8");
                this.#segments.push(...this.parse(old));
            } else {
                var init = str.match(/^#EXT-X-MAP:URI="(.+)"$/m);
                if (init) this.init_uri = init[1];
                await this.#append(this.#render_header());
            }
        }
        for (var s of segments) {
            if (s.i < this.next_segment_index) continue;
            await this.#add_segment(s);
        }
    }

    /** @param {Segment} segment */
    async #add_segment(segment) {
        this.#segments.push(segment);
        /* var stat = await fs.stat(path.join(this.dir, segment.uri)).catch(utils.noop);
        if (stat) {
            let bitrate = (stat.size * 8) / segment.duration;
            this.#bitrates.push(bitrate);
            while (this.#bitrates.length > 128) this.#bitrates.shift();
            globals.app.logger.debug(`segment ${segment.uri} bitrate: ${Math.round(bitrate/1024)}kbps | overall_avg: ${Math.round(utils.average(this.#bitrates)/1024)}kbps`);
        } */
        if (segment.discontinuity) {
            await this.#append(`#EXT-X-DISCONTINUITY\n`);
        }
        await this.#append(`#EXTINF:${segment.duration.toFixed(6)},\n${segment.uri}\n`);
        this.emit("new_segment", segment);
    }

    async #append(str) {
        await fs.appendFile(this.filename, str, "utf8");
        this.live.emit("update");
        this.emit("update");
    }
    #render_header(media_sequence) {
        var str = `#EXTM3U\n`;
        str += `#EXT-X-VERSION:9\n`;
        str += `#EXT-X-TARGETDURATION:${this.live.$.segment_duration.toFixed(6)}\n`;
        str += `#EXT-X-MEDIA-SEQUENCE:${media_sequence||0}\n`;
        if (this.init_uri) {
            str += `#EXT-X-MAP:URI="${this.init_uri}"\n`;
        }
        return str;
    }
    #render(_HLS_msn, _HLS_skip) {
        var min_segments = this.live.$.hls_list_size;
        var max_segments = Math.max(min_segments, Math.ceil(this.live.$.hls_max_duration / this.live.$.segment_duration));
        var end = this.#segments.length;
        var start = Math.max(0, end - max_segments);
        
        var lines = this.#render_header(start);
        
        lines += `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=1.0,CAN-SKIP-UNTIL=${(this.live.$.segment_duration*6).toFixed(1)}\n`;

        if (_HLS_skip) {
            let skipped_segments = utils.clamp(end - min_segments, 0, (max_segments-min_segments));
            start += skipped_segments;
            lines += `#EXT-X-SKIP:SKIPPED-SEGMENTS=${skipped_segments}\n`;
        }
        this.#segments.slice(start, end).forEach(s=>{
            if (s.discontinuity) {
                lines += `#EXT-X-DISCONTINUITY\n`;
            }
            lines += `#EXTINF:${s.duration.toFixed(6)},\n${s.uri}\n`;
        });
        return lines;
    }
    /** @param {Request} req @param {Response} res */
    async fetch(req, res) {
        var _HLS_msn = req.query._HLS_msn || 0;
        var _HLS_skip = req.query._HLS_skip || false;
        var ts = Date.now();
        while (!this.#segments[_HLS_msn] && !this.#destroyed) {
            await new Promise(r=>this.once("update", r));
            if (Date.now() > ts + FETCH_TIMEOUT) throw new Error("This is taking ages.");
        }
        res.header("content-type", "application/vnd.apple.mpegurl");
        res.send(this.#render(_HLS_msn, _HLS_skip));
    }

    async end() {
        if (this.#ended) return;
        this.#ended = true;
        await this.#append(`#EXT-X-ENDLIST\n`);
    }

    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        clearInterval(this.#interval);
        await this.#update();
    }
}

export default MediaServerApp;