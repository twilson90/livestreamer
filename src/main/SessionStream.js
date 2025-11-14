import path from "node:path";
import stream from "node:stream";
import {getResolution} from "get-screen-resolution";
import {globals, StreamTarget, InternalSessionPlayer, InternalSessionPlayer$, OUTPUT_FORMAT} from "./exports.js";
import {utils, constants, FFMPEGWrapper, Logger, StopStartStateMachine, StopStartStateMachine$, ClientUpdater, StreamServer} from "../core/exports.js";
/** @import { Session, InternalSession, ExternalSession, Session$ } from './exports.js' */

const MAX_METRICS_SAMPLES = 1000;
const META_TRACK = false;

export class SessionStream$ extends StopStartStateMachine$ {
    metrics = {};
    stream_targets = {};
    bitrate = 0;
    speed = 0;
    scheduled = false;
    publish_stream_path = "";
    player = new InternalSessionPlayer$();
    // Stream settings
    targets = [];
    target_opts = {};
    title = "";
    fps = 0;
    resolution = "1280x720";
    h264_preset = "veryfast";
    video_bitrate = 5000;
    audio_bitrate = 160;
    buffer_duration = 5;
    use_hardware = false;
    test = false;
    gui = false;
}

/**
 * @typedef {{
 *   attach: [Session];
 *   detach: [Session];
 * }} Events
 */

/** @extends {StopStartStateMachine<SessionStream$, Events>} */
export class SessionStream extends StopStartStateMachine {
    /** @returns {any[]} */
    get is_gui() { return !!this.$.targets.includes("gui"); }
    get is_single_target() { return this.$.targets.length == 1; }
    get is_realtime() { return !(this.is_single_target && this.$.targets.includes("file") && !this.get_target_opts("file")["re"]) || this.is_test; }
    get is_test() { return !!this.$.test; }
    get title() { return this.$.title; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get fps() { return this.$.fps; }
    /** @type {InternalSession} */
    get internal_session() { return this.session.type === constants.SessionTypes.INTERNAL ? this.session : null; }
    /** @type {ExternalSession} */
    get external_session() { return this.session.type === constants.SessionTypes.EXTERNAL ? this.session : null; }
    get width() { return +this.$.resolution.split("x")[0]; }
    get height() { return +this.$.resolution.split("x")[1]; }
    get aspect_ratio() { return utils.nearest_aspect_ratio(this.width/this.height).value; }

    get_target_opts(target_id) {
        return {
            ...globals.app.targets[target_id]?.$.opts,
            ...this.$.target_opts[target_id]
        }
    }

    /** @type {Session<Session$>} */
    session;
    /** @type {InternalSessionPlayer} */
    player;
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @type {Record<PropertyKey,StreamTarget>} */
    stream_targets = {};
    keys = {};
    #ticks = 0;

    constructor() {
        super(globals.app.generate_uid("session-stream"), new SessionStream$());
        globals.app.session_streams[this.id] = this;
        globals.app.$.session_streams[this.id] = this.$;
        this.logger = new Logger("session-stream");
        this.logger.on("log", (log)=>{
            if (this.session) this.session.logger.log(log);
        });
        
        this.client_updater = new ClientUpdater(this.observer, ["session_streams", this.id], {
            filter: (c)=>{
                if (c.type === "delete" && c.path[0] === "metrics") return false;
                return true;
            }
        });
        var onsubscribe = (client)=>this.client_updater.subscribe(client);
        var onunsubscribe = (client)=>this.client_updater.unsubscribe(client);
        this.on("attach", (session)=>{
            session.clients.forEach(c=>this.client_updater.subscribe(c));
            session.client_updater.on("subscribe", onsubscribe);
            session.client_updater.on("unsubscribe", onunsubscribe);
            
            if (!this.$.gui && !this.$.publish_stream_path) {
                // we only do this once, if we detach / attach to another session the urls remain the same.
                let publish_stream_path = `/internal/${this.id}`;
                this.$.publish_stream_path = publish_stream_path;
                var urls = globals.app.get_urls("media-server");
                let rtmp = `rtmp://${globals.app.hostname}:${globals.app.conf["media-server.rtmp_port"]}`;
                this.$.rtmp_url = `${rtmp}${publish_stream_path}`;
                this.$.ws_url = `${urls.ws}${publish_stream_path}.flv`;
                this.$.wss_url = `${urls.wss}${publish_stream_path}.flv`;
                this.$.http_url = `${urls.http}${publish_stream_path}.flv`;
                this.$.https_url = `${urls.https}${publish_stream_path}.flv`;
            }
        });
        this.on("detach", (session)=>{
            session.clients.forEach(c=>this.client_updater.unsubscribe(c));
            session.client_updater.off("subscribe", onsubscribe);
            session.client_updater.off("unsubscribe", onunsubscribe);
        });

        this.on("started", ()=>{
            this.try_start_playlist();
            globals.app.ipc.emit("main.stream.started", this.$);
            this.tick();
        });
    }

    async _start(settings) {
        this.#ticks = 0;
        if (settings) {
            Object.assign(this.$, settings);
        }

        this.logger.info(`Starting stream...`);
        this.$.scheduled = !!this.internal_session?.$.schedule_start_time;

        if (this.is_test) {
            if (globals.app.conf["main.test_stream_low_settings"]) {
                this.$.audio_bitrate = 128;
                this.$.video_bitrate = 2000;
                this.$.h264_preset = "veryfast";
                let [w, h] = [this.width, this.height];
                let ar = this.aspect_ratio;
                if (h > 480) {
                    h = 480;
                    w = Math.round(h * ar / 2) * 2;
                    this.$.resolution = `${w}x${h}`;
                }
                // this.$.buffer_duration = 0; // this actually makes the test stream take a while longer to appear because it needs a few seconds of video before it starts streaming
            }
            this.$.targets = [];
        }
        if (this.$.gui) {
            this.$.targets = [];
            const {width,height} = await getResolution();
            this.$.resolution = `${width}x${height}`;
        }

        this.$.title = this.$.title || this.session.name; // this.session.$.default_stream_title || 
        this.$.metrics = {};
        this.$.stream_targets = {};
        this.$.bitrate = 0;
        this.$.speed = 0;
    
        if (!this.$.gui) {
            let ffmpeg_args = [
                // "-flags", "low_delay",
                // "-thread_queue_size", "4096",
                // "-probesize", "32",
                // "-analyzeduration", "0",
                // "-avioflags", "direct",
                // "-probesize", `${1024*1024}`,
                // `-ignore_unknown`,
                // `-copy_unknown`,
                // "-avioflags", "direct",
                `-err_detect`, `ignore_err`,
                `-strict`, `experimental`,
                // "-avoid_negative_ts", "1",
                `-flags`, "+global_header", // +low_delay
                "-fflags", "+genpts+igndts+discardcorrupt+autobsf+flush_packets", //  +nobuffer
                "-flush_packets", "1",
                // `-rw_timeout`, `15000000`,
                // `-tag:v`, `7`, // needed for tee muxer
                // `-tag:a`, `10`, // needed for tee muxer
                // ...(this.is_realtime ? ["-readrate", "1"] : []), // "-readrate_catchup", "1" // doesnt exist on my build of ffmpeg yet
            ];
            
            if (this.session.type === constants.SessionTypes.EXTERNAL) {
                ffmpeg_args.push(
                    // `-reconnect_on_network_error`, `1`,
                    // `-reconnect_on_http_error`, `1`,
                    // `-reconnect_delay_max`, `5`,
                    // `-stream_loop`, `-1`,
                    `-re`,
                    `-f`, `live_flv`, // "important to survive timestamp discontinuities"
                    "-i", `rtmp://media-server.${globals.app.hostname}:${globals.app.conf["media-server.rtmp_port"]}${this.external_session.nms_session.publishStreamPath}`,
                );
            } else {
                ffmpeg_args.push(
                    "-f", OUTPUT_FORMAT,
                    "-i", "pipe:0",
                );
                // if (FFMPEG_OUTPUT_FORMAT === "mpegts") ffmpeg_args.push("-merge_pmt_versions", "1");
            }
            /* if (META_TRACK) {
                ffmpeg_args.push(
                    "-f", "webvtt",
                    `-analyzeduration`, `0`,
                    `-probesize`, `32`,
                    "-i", "pipe:4",
                );
            } */
            ffmpeg_args.push(
                "-muxdelay", "0",
                "-muxpreload", "0",
                `-fps_mode`, "passthrough",
                // "-r", `${this.$.fps || constants.DEFAULT_FPS}`, // if we do this after +genpts + passthrough, it will mess up all the timestamps
                // "-bsf:a", "aac_adtstoasc",
                // "-bsf:v", "h264_mp4toannexb",
            );
            
            this.server = new StreamServer(`stream-${this.id}`);
            this.$.socket = this.server.socket;

            var c_args = [
                "-map", "0:v:0",
                "-c:v", "copy",
                "-map", "0:a:0",
                "-c:a", "copy",
                // `-map_metadata`, `0`,
            ];

            ffmpeg_args.push(
                ...c_args,
                "-f", "flv",
                "-flvflags", "+no_duration_filesize", // +aac_seq_header_detect+no_sequence_end
                `-y`,
                this.$.rtmp_url
            );

            ffmpeg_args.push(
                ...c_args,
            );
            /* if (META_TRACK) {
                ffmpeg_args.push(
                    "-map", "1:s:0",
                    "-c:s", "copy",
                );
            } */
            ffmpeg_args.push(
                "-f", "mpegts",
                "-mpegts_flags", "+resend_headers",
                `-y`,
                "pipe:1"
            );

            this.#ffmpeg = new FFMPEGWrapper({
                log_filename: path.join(globals.app.logs_dir, `ffmpeg-stream-${this.id}-${utils.date_to_string()}.log`)
            });

            this.#ffmpeg.start(ffmpeg_args).catch(e=>{
                this.logger.error(new Error(`SessionStream ffmpeg error: ${e.message}`));
                this.stop("error");
            });

            // this.#ffmpeg.stdout.on("error", (e)=>{
            //     console.error(`ffmpeg.stdout error: ${e.message}`)
            // })
            // this.#ffmpeg.stdout.pipe(this.server);

            stream.promises.pipeline(this.#ffmpeg.stdout, this.server).catch((e)=>{
                this.logger.error(`ffmpeg.stdout piping error: ${e.message}`)
            })
        }

        if (this.session.type === constants.SessionTypes.INTERNAL) {
            this.player = new InternalSessionPlayer(this);
        }

        if (this.#ffmpeg && this.player) {
            stream.promises.pipeline(this.player.out, this.#ffmpeg.stdin).catch((e)=>{
                if (this.player.destroyed) return;
                this.logger.error('FFmpeg stdin error:', e);
                this.stop("error");
            });
            
            this.logger.add(this.player.logger);
        }

        return super._start();
    }

    tick() {
        if (!this.is_started) return;
        
        this.#ticks++;

        let old_targets = Object.values(this.stream_targets);
        let curr_targets = new Set();

        var targets = this.$.targets || [];
        for (let target_id of targets) {
            let target = globals.app.targets[target_id];
            if (!target) {
                this.logger.warn(`Target '${target_id}' not found.`);
                continue;
            }
            if (!this.stream_targets[target_id]) {
                if (target.limit && target.streams.length >= target.limit) {
                    this.logger.warn(`Target '${target}' cannot be used by more than ${target.limit} streams concurrently.`);
                } else {
                    var st = new StreamTarget(this, target);
                    st.start();
                }
            }
            if (this.stream_targets[target_id]) {
                this.stream_targets[target_id].tick();
                curr_targets.add(this.stream_targets[target_id]);
            }
        }

        if (!this.is_paused) {
            if (this.#ffmpeg) {
                // if (this.player) this.register_metric(`decoder:speed`, this.player.$.playback_speed);
                this.$.speed = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.speed_alt : 0;
                this.$.bitrate = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.bitrate : 0;
                let key = (this.session.type === constants.SessionTypes.EXTERNAL) ? "upstream" : "trans";
                this.register_metric(`${key}:speed`, this.$.speed);
                this.register_metric(`${key}:bitrate`, this.$.bitrate);
            }
            for (let st of Object.values(this.stream_targets)) {
                if (st.ffmpeg) {
                    this.register_metric(`${st.$.key}:speed`, st.ffmpeg_speed);
                    this.register_metric(`${st.$.key}:bitrate`, st.ffmpeg_bitrate);
                }
            }
        }

        for (let target of old_targets) {
            if (!curr_targets.has(target)) {
                target.destroy();
            }
        }

        if (this.player) this.player.tick();
    }

    async _stop() {
        this.logger.info(`Stopping stream...`);
        
        // this is the order of destruction (sounds like metal lyrics)
        // player + mpv has to be destroyed before ffmpeg, ffmpeg is consuming mpv's output, which is what keeps it running. if we try to destroy ffmpeg first, then mpv is left out a consumer and hangs indefinitely.
        if (this.player) await this.player.destroy();
        if (this.#ffmpeg) await this.#ffmpeg.destroy();
        if (this.server) this.server.destroy();

        globals.app.ipc.emit("main.stream.stopped", this.id);
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_ts))}`);
        
        return super._stop();
    }

    register_metric(key, y) {
        // if (this.disable_register_metric) return;
        // if (!this.$.metrics[key] && y == 0) return;
        if (!this.$.metrics[key]) this.$.metrics[key] =  {min:0,max:0,data:{}};
        var d = this.$.metrics[key];
        d.max = this.#ticks;
        d.data[d.max] = y;
        if (d.max > MAX_METRICS_SAMPLES) {
            delete d.data[d.min++];
        }
    }
    
    /** @param {Session<Session$>} session */
    attach(session, detach=true) {
        session = (typeof session === "string") ? globals.app.sessions[session] : session;
        let last_session = this.session;
        if (session && session.stream && session.stream.state !== constants.State.STOPPED) {
            this.logger.warn(`Attach error: Session '${session.name}' already has an active stream.`)
            return;
        }
        if (session === last_session) {
            this.logger.warn(`Attach error: Already attached to '${session.name}'.`);
            return;
        }

        if (detach && last_session) {
            last_session.$.stream_id = null;
            this.emit("detach", last_session);
        }

        if (session) {
            this.$.session_id = session.id;
            this.session = session;
            session.$.stream_id = this.id;
            this.emit("attach", session);
        }

        this.try_start_playlist();
    }

    _pause() {
        this.player.pause();
    }

    _resume() {
        this.player.resume();
    }
    
    try_start_playlist() {
        if (this.session.type == constants.SessionTypes.INTERNAL) {
            this.internal_session.playlist_play(this.internal_session.$.playlist_id || this.internal_session.first_item_id, { start: this.internal_session.$.time_pos });
        }
    }

    get_stream_targets(id) {
        return Object.values(this.stream_targets).filter(st=>st.id == id || st.target.id == id || st.stream.id == id);
    }

    /** @param {string[]} ids */
    restart_targets(ids) {
        if (!ids || !ids.length) ids = Object.keys(this.stream_targets);
        var stream_targets = ids.map(id=>this.stream_targets[id]).filter(st=>st);
        return Promise.all(stream_targets.map(st=>st.restart()));
    }
    async _destroy() {
        delete globals.app.session_streams[this.id];
        delete globals.app.$.session_streams[this.id];
        this.client_updater.destroy();
        return super._destroy();
    }
}

export default SessionStream;