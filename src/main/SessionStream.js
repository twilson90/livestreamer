import fs from "fs-extra";
import stream from "node:stream";
import path from "node:path";
import {globals, SessionTypes, StreamTarget, InternalSessionPlayer, InternalSessionPlayer$, OUTPUT_FORMAT} from "./exports.js";
import {utils, constants, FFMPEGWrapper, Logger, StopStartStateMachine, StopStartStateMachine$, ClientUpdater} from "../core/exports.js";
/** @import { Session, InternalSession, ExternalSession, Session$ } from './exports.js' */

const MAX_METRICS_SAMPLES = 1000;

export class SessionStream$ extends StopStartStateMachine$ {
    metrics = {};
    stream_targets = {};
    bitrate = 0;
    speed = 0;
    scheduled = false;
    internal_path = "";
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
    get internal_session() { return this.session.type === SessionTypes.INTERNAL ? this.session : null; }
    /** @type {ExternalSession} */
    get external_session() { return this.session.type === SessionTypes.EXTERNAL ? this.session : null; }

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

    /** @param {Session} session */
    constructor(session) {
        super(globals.app.generate_uid("stream"), new SessionStream$());
        globals.app.session_streams[this.id] = this;
        globals.app.$.session_streams[this.id] = this.$;
        this.logger = new Logger("stream");
        this.logger.on("log", (log)=>{
            (this.session||session).logger.log(log);
        });
        
        this.client_updater = new ClientUpdater(this.observer, ["streams", this.id], {
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
        });
        this.on("detach", (session)=>{
            session.clients.forEach(c=>this.client_updater.unsubscribe(c));
            session.client_updater.off("subscribe", onsubscribe);
            session.client_updater.off("unsubscribe", onunsubscribe);
        });

        this.on("started", ()=>{
            this.try_start_playlist();
            globals.app.ipc.emit("main.stream.started", this.id);
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
                this.$.resolution = "854x480";
                // this.$.buffer_duration = 0;
            }
            this.$.targets = [];
        }

        this.$.title = this.$.title || this.session.name; // this.session.$.default_stream_title || 
        this.$.metrics = {};
        this.$.stream_targets = {};
        this.$.bitrate = 0;
        this.$.speed = 0;

        let internal_path = `/internal/${this.session.id}`;
        this.$.internal_path = internal_path;
        this.$.output_url = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
        this.$.rtmp_output_url = `rtmp://${globals.app.hostname}:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
        this.$.ws_output_url = `ws://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
        this.$.wss_output_url = `wss://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;
        this.$.http_output_url = `http://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
        this.$.https_output_url = `https://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;

        let ffmpeg_output_url = this.$.output_url;
        if (this.is_test) {
            let url = new URL(ffmpeg_output_url);
            url.searchParams.append("test", 1);
            ffmpeg_output_url = url.toString();
        }
    
        let ffmpeg_args = [
            // `-re`,
            // "-flags", "low_delay",
            // "-thread_queue_size", "4096",
            // "-probesize", "32",
            // "-analyzeduration", "0",
            // "-avioflags", "direct",
            // "-probesize", `${1024*1024}`,
            // `-ignore_unknown`,
            // `-copy_unknown`,
            "-err_detect", "ignore_err",
            `-strict`, `experimental`,
            // "-avoid_negative_ts", "1",
            "-fflags", "+autobsf+flush_packets", //  +discardcorrupt+nobuffer
            "-flush_packets", "1",
            // ...(this.is_realtime ? ["-readrate", "1"] : []), // "-readrate_catchup", "1" // doesnt exist on my build of ffmpeg yet
        ];
        if (this.session.type === SessionTypes.EXTERNAL) {
            ffmpeg_args.push(
                `-f`, `flv`,
                `-stream_loop`, `-1`,
                "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${this.external_session.nms_session.publishStreamPath}`,
            );
        } else {
            ffmpeg_args.push(
                "-f", OUTPUT_FORMAT,
                "-i", "pipe:0",
            );
            // if (FFMPEG_OUTPUT_FORMAT === "mpegts") ffmpeg_args.push("-merge_pmt_versions", "1");
        }
        ffmpeg_args.push(
            // "-muxdelay", "0",
            // "-muxpreload", "0",
            `-fps_mode`, "passthrough",
            // "-r", `${this.$.fps || constants.DEFAULT_FPS}`, // if we do this after +genpts + passthrough, it will mess up all the timestamps
            "-c", "copy",
            `-map_metadata`, `0`,
            // "-map_metadata", "-1",
            // "-bsf:a", "aac_adtstoasc",
            // "-bsf:v", "h264_mp4toannexb",
            "-flvflags", "no_duration_filesize", // +aac_seq_header_detect+no_sequence_end
            "-f", "flv",
            `-y`,
            ffmpeg_output_url
        );
        this.#ffmpeg = new FFMPEGWrapper({log_filename: path.join(globals.app.logs_dir, `ffmpeg-stream-${this.id}-${utils.date_to_string()}.log`)});
        this.#ffmpeg.start(ffmpeg_args).catch(e=>{
            this.logger.error(new Error(`SessionStream ffmpeg error: ${e.message}`));
            this.stop("error");
        });
        this.#ffmpeg.on("line", (line)=>{
            if (line.match(/non-monotonic/i)) {
                this.logger.warn(line);
            }
        });

        if (this.session.type === SessionTypes.INTERNAL) {
            this.player = new InternalSessionPlayer(this);
            
            this.player.out.pipe(this.#ffmpeg.stdin)

            this.#ffmpeg.stdin.on('error', (e)=>{
                // we always get a complaint about premature closure, EOF, etc. Just ignore it.
                if (this.player.destroyed) return;
                this.logger.error('FFmpeg stdin error:', e)
            });
            
            // stream.promises.pipeline(this.player.out, this.#ffmpeg.stdin)
            //     .catch(utils.pipe_error_handler(this.logger, "player.out -> ffmpeg.stdin"));
            
            this.player.logger.on("log", (log)=>{
                this.logger.log(log);
            });
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
                this.stream_targets[target_id].update();
                curr_targets.add(this.stream_targets[target_id]);
            }
        }

        if (!this.is_paused) {
            // if (this.player) this.register_metric(`decoder:speed`, this.player.$.playback_speed);
            this.$.speed = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.speed_alt : 0;
            this.$.bitrate = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.bitrate : 0;
            let key = (this.session.type === SessionTypes.EXTERNAL) ? "upstream" : "trans";
            if (this.#ffmpeg) {
                this.register_metric(`${key}:speed`, this.$.speed);
                this.register_metric(`${key}:bitrate`, this.$.bitrate);
            }
            for (let st of Object.values(this.stream_targets)) {
                this.register_metric(`${st.$.key}:speed`, st.$.speed);
                this.register_metric(`${st.$.key}:bitrate`, st.$.bitrate);
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
        await this.#ffmpeg.destroy();

        /* for (var target of Object.values(this.stream_targets)) {
            await target.destroy();
        } */

        globals.app.ipc.emit("main.stream.stopped", this.id);
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_ts))}`);
        
        return super._stop();
    }

    register_metric(key, y) {
        // if (this.disable_register_metric) return;
        // if (!this.$.metrics[key] && y == 0) return;
        if (!this.$.metrics[key]) this.$.metrics[key] =  {min:0,max:0,data:{}};
        var d = this.$.metrics[key];
        d.data[d.max++] = y;
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
        if (this.session.type == SessionTypes.INTERNAL) {
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