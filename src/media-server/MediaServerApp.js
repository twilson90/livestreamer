import os from "node:os";
import path from "node:path";
import express, { Router } from "express";
import events from "node:events";
import net from "node:net";
import fs from "node:fs";
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
import {MpegTsDemuxer} from "mpegts-demuxer"

import {globals, Live} from "./exports.js";
import {Blocklist, WebServer, CoreFork} from "../core/exports.js";

/** @typedef {(NodeRtmpSession | NodeFlvSession) & {live: Live}} Session */
/** @import {Request, Response} from "express" */

const dirname = import.meta.dirname;

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

export const APPNAMES = new Set([
    "live", // local encoding server
    "external", "livestream", // external
    "private", "session", // session playlist items
    "internal", // internal session
]);

export class MediaServerApp extends CoreFork {
    /** @type {Record<PropertyKey,Live>} */
    lives = {};
    aspect_ratio_cache = {};

    constructor() {
        super("media-server", {});
        globals.app = this;
    }

    async init() {
        this.blocklist_path = path.join(this.appdata_dir, "media-server-blocklist");
        this.media_dir = path.join(this.appdata_dir, "media");
        this.live_dir = path.join(this.media_dir, "live");

        await fs.promises.mkdir(this.media_dir, {recursive:true});
        await fs.promises.mkdir(this.live_dir, {recursive:true});

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

        this.ipc.on("main.stream.aspect-ratio", ({id, aspect_ratio})=>{
            this.aspect_ratio_cache[id] = aspect_ratio;
        })
        this.ipc.respond("create_live", async ()=>{
            let live_id = this.generate_uid("live");
            new Live(live_id);
            return live_id;
        })
        this.ipc.respond("start_live", async (live_id, data)=>{
            var live = this.lives[live_id];
            if (!live) {
                console.error(`No Live found for id '${live_id}'`);
                return;
            }
            await live.restart(data);
        })
        this.ipc.respond("stop_session", (id)=>{
            var session = this.get_nms_session(id);
            if (session) session.stop();
        });
        this.ipc.respond("stop_live", async (live_id)=>{
            this.lives[live_id]?.stop();
        })
        this.ipc.respond("destroy_live", async (live_id)=>{
            this.lives[live_id]?.destroy();
        })
        this.ipc.respond("get_session", (id)=>{
            return session_json(this.get_nms_session(id));
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
                // ping_timeout: 2147483647/1000,
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
        });
        nms_ctx.nodeEvent.on('doneConnect', (id, args)=>{
            let session = nms_ctx.sessions.get(id);
            let socket = (session instanceof NodeFlvSession) ? session.req.socket : session.socket;
            nms_ctx.stat.inbytes += socket.bytesRead;
            nms_ctx.stat.outbytes += socket.bytesWritten;
        });

        this.media_router = Router();
        this.media_router.get("/live/:id/master.m3u8", async (req, res, next)=>{
            var {id} = req.params;
            var live = this.lives[id];
            if (live) {
                if (await live.fetch_manifest(req, res)) return;
            }
            next();
        });
        this.media_router.get("/live/:id/:v/stream.m3u8", async (req, res, next)=>{
            var {id} = req.params;
            var live = this.lives[id];
            if (live) {
                if (await live.fetch_stream(req, res)) return;
            }
            next();
        });
        this.media_router.use("/", express.static(this.media_dir, {
            maxAge: "2y",
            etag: false,
            setHeaders: (res, file_path, stat)=>{
                res.removeHeader("connection");
                // var metadata = await fs.promises.readFile(file_path+".metadata.json", "utf8").catch(utils.noop);
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
            var session = this.get_nms_session(id);
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
            var session = this.get_nms_session(id);
            // if (!precheck_session(id, StreamPath)) return;
            if (!this.blocklist.is_valid(session.ip)) {
                session_reject(session, `blocked '${session.ip}' trying to connect.`);
                return;
            }
            this.ipc.emit("media-server.pre-connect", id);
        });
        this.nms.on('postConnect', (id, args)=>{
            log_event('postConnect', {id, args});
            var session = this.get_nms_session(id);
            this.ipc.emit("media-server.post-connect", id);
        });
        this.nms.on('doneConnect', (id, args)=>{
            log_event('doneConnect', {id, args});
            var session = this.get_nms_session(id);
            this.ipc.emit("media-server.done-connect", id);
        });

        //-------------------------------------------------

        this.nms.on('prePlay', (id, StreamPath, args)=>{
            log_event('prePlay', {id, StreamPath, args});
            if (!precheck_session(id, StreamPath)) return;
            var session = this.get_nms_session(id);
            this.ipc.emit("media-server.pre-play", id);
        });
        this.nms.on('postPlay', (id, StreamPath, args)=>{
            log_event('postPlay', {id, StreamPath, args});
            var session = this.get_nms_session(id);
            this.ipc.emit("media-server.post-play", id);
        });
        this.nms.on('donePlay', (id, StreamPath, args)=>{
            log_event('donePlay', {id, StreamPath, args});
            var session = this.get_nms_session(id);
            this.ipc.emit("media-server.done-play", id);
        });

        //-------------------------------------------------

        this.nms.on('prePublish', async (id, StreamPath, args)=>{
            log_event('prePublish', {id, StreamPath, args});
            if (!precheck_session(id, StreamPath)) return;
            var session = this.get_nms_session(id);
            if (session.appname === "live") {
                let live_id = StreamPath.split("/").pop();
                let live = this.lives[live_id];
                if (live && live.is_started) {
                    session_reject(session, `live is already running: ${StreamPath}`);
                }
            }
            this.ipc.emit("media-server.pre-publish", id);
        });

        /** @type {Record<string,Session>} */
        var external_session_map = {};
        this.nms.on('postPublish', async (id, StreamPath, args)=>{
            log_event('postPublish', {id, StreamPath, args});
            var session = this.get_nms_session(id);
            /* if (session.appname.match(/^(external|livestream)$/)) {
                var stream_id = StreamPath.split("/").pop();
                external_session_map[stream_id] = session;
            } */
            this.ipc.emit("media-server.post-publish", session_json(session));
            await session_ready(session).catch(()=>{
                this.logger.error("No video and audio stream detected.");
                return;
            });
            if (!session.isPublishing || !session.publishStreamPath) {
                console.warn(`Session probably just ended but still sending chunks, ignoring...`, id);
                return;
            }
            this.ipc.emit("media-server.metadata-publish", session_json(session));
        });

        this.nms.on('donePublish', async(id, StreamPath, args)=>{
            log_event('donePublish', {id, StreamPath, args});
            var session = this.get_nms_session(id);
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

    /** @returns {Session} */
    get_nms_session(id) {
        id = String(id);
        if (id.startsWith("/")) {
            return [...nms_ctx.sessions.values()].find(s=>s.publishStreamPath == id);
        } else {
            return this.nms.getSession(id) || [...nms_ctx.sessions.values()].find(s=>s.publishStreamPath == `/internal/${id}`);
        }
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
export default MediaServerApp;