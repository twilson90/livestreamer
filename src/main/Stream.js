import fs from "fs-extra";
import path from "node:path";
import { PassThrough, pipeline } from "node:stream";
import events from "node:events";
import * as ebml from 'ts-ebml';
import child_process from 'node:child_process';
import readline from 'readline';
import net from 'node:net';
import {globals, SessionTypes, StreamTarget, InternalSessionPlayer, InternalSessionPlayer$} from "./exports.js";
import {utils, constants, FFMPEGWrapper, Logger, StopStartStateMachine, StopStartStateMachine$, ClientUpdater} from "../core/exports.js";
/** @import { Session, InternalSession, ExternalSession, Session$ } from './exports.js' */

const WARNING_MPV_LOG_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB
const MAX_MPV_LOG_SIZE = 8 * 1024 * 1024 * 1024; // 8 GB
const MAX_METRICS_SAMPLES = 1000;

export class Stream$ extends StopStartStateMachine$ {
    targets = [];
    target_opts = {};
    metrics = {};
    stream_targets = {};
    bitrate = 0;
    speed = 0;
    scheduled = false;
    is_encoding = false;
    fix_discontinuities = true;
    internal_path = "";
    /** @type {string | undefined} */
    title;
    player = new InternalSessionPlayer$();
    buffer_duration = 5;
    fps = 0;
    
    // Stream settings
    targets = [];
    target_opts = {};
    title = "";
    fps = 0;
    use_hardware = 0;
    resolution = "1280x720";
    h264_preset = "veryfast";
    video_bitrate = 5000;
    audio_bitrate = 160;
    buffer_duration = 5;
    test = false;
}

/**
 * @typedef {{
 *   attach: [Session];
 *   detach: [Session];
 * }} Events
 */

/** @extends {StopStartStateMachine<Stream$, Events>} */
export class Stream extends StopStartStateMachine {
    /** @returns {any[]} */
    get is_gui() { return !!this.$.targets.includes("gui"); }
    get is_single_target() { return this.$.targets.length == 1; }
    get is_only_gui() { return this.is_single_target && this.is_gui; }
    get is_encoding() { return !this.is_only_gui; }
    get is_realtime() { return !(this.is_single_target && this.$.targets.includes("file") && !this.get_target_opts("file")["re"]) || this.is_test; }
    get is_test() { return !!this.$.test; }
    get title() { return this.$.title; }
    get is_running() { return this.$.state === constants.State.STARTED; }
    get fps() { return isNaN(+this.$.fps) ? 30 : +this.$.fps; }
    get pts() { return this.#pts; }

    get_target_opts(target_id) {
        return {
            ...(globals.app.targets[target_id]||{}).$.opts,
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
    #tick_interval;
    /** @type {Record<PropertyKey,utils.IncrementalAverage>} */
    #metrics_averages = {};
    #pts = 0;
    #dts = 0;
    #timer = new utils.StopWatchHR();

    /** @param {Session} session */
    constructor(session) {
        super(globals.app.generate_uid("stream"), new Stream$());
        globals.app.streams[this.id] = this;
        globals.app.$.streams[this.id] = this.$;
        this.logger = new Logger("stream");
        this.logger.on("log", (log)=>(this.session||session).logger.log(log));
        
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
    }

    async onstart(settings) {
        this.#ticks = 0;
        if (settings) {
            Object.assign(this.$, settings);
        }

        this.logger.info(`Starting stream...`);
        this.$.scheduled = !!this.session.$.schedule_start_time;

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
        this.$.is_encoding = this.is_encoding;

        this.$.title = this.$.title || this.session.name; // this.session.$.default_stream_title || 
        this.$.metrics = {};
        this.$.stream_targets = {};
        this.$.bitrate = 0;
        this.$.speed = 0;
        
        let error;
        let keyframes_per_second = 2.0;
        let use_hardware = this.$.use_hardware;
        
        if (error) {
            this.logger.error(`Start stream error: ${error}`)
            await this.stop("start_error");
            return false;
        }
        
        var hwenc = (use_hardware && globals.app.conf["core.ffmpeg_hwenc"]);
        var hwaccel = (use_hardware && globals.app.conf["core.ffmpeg_hwaccel"]);

        if (this.is_encoding) {
            let internal_path = `/internal/${this.session.id}`;
            this.$.internal_path = internal_path;
            this.$.output_url = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
            this.$.rtmp_output_url = `rtmp://${globals.app.hostname}:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
            this.$.ws_output_url = `ws://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
            this.$.wss_output_url = `wss://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;
            this.$.http_output_url = `http://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
            this.$.https_output_url = `https://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;

            this.#ffmpeg = new FFMPEGWrapper();
            let ffmpeg_output_url = this.$.output_url;
            if (this.is_test) {
                let url = new URL(ffmpeg_output_url);
                url.searchParams.append("test", 1);
                ffmpeg_output_url = url.toString();
            }
        
            let ffmpeg_args = [
                // `-re`,
                `-strict`, `experimental`,
                `-stream_loop`, `-1`,
                "-err_detect", "ignore_err",
            ];
            if (this.session.type === SessionTypes.EXTERNAL) {
                /** @type {ExternalSession} */
                let session = this.session;
                ffmpeg_args.push(
                    // `-noautoscale`,
                    "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${session.nms_session.publishStreamPath}`,
                    "-c", "copy",
                );
            } else {
                
                if (hwaccel) {
                    ffmpeg_args.push(
                        "-hwaccel", globals.app.conf["core.ffmpeg_hwaccel"],
                        "-hwaccel_output_format", globals.app.conf["core.ffmpeg_hwaccel"],
                        // "-extra_hw_frames", "10"
                    );
                }
                ffmpeg_args.push(
                    // `-noautoscale`,
                    "-fflags", "+genpts",
                    // "-use_wallclock_as_timestamps", "1",
                    "-i", "pipe:0",
                    "-bsf:a", "aac_adtstoasc",
                    "-bsf:v", "h264_mp4toannexb",
                    `-fps_mode`, this.fps ? "cfr" : "passthrough",
                    "-enc_time_base", "-1",
                    "-muxdelay", "0",
                    "-flush_packets", "1",
                );

                ffmpeg_args.push(
                    "-c:v", hwenc ? `h264_${globals.app.conf["core.ffmpeg_hwenc"]}` : "libx264",
                    "-preset", hwenc ? `p7` : this.$.h264_preset,
                );
                if (hwaccel) {
                    ffmpeg_args.push(
                        `-no-scenecut`, `1`,
                        `-rc`, `cbr_hq`,
                        `-forced-idr`, `1`
                    );
                    if (this.fps) {
                        ffmpeg_args.push(
                            `-rc-lookahead`, this.fps
                        );
                    }
                }
                ffmpeg_args.push(
                    "-b:v", `${this.$.video_bitrate}k`,
                    `-maxrate`, `${this.$.video_bitrate}k`,
                    `-bufsize`, `${this.$.video_bitrate}k`,
                    "-c:a", `aac`,
                    "-b:a", `${this.$.audio_bitrate}k`,
                    "-force_key_frames", `expr:gte(t,n_forced*${keyframes_per_second})`,
                );

                if (this.fps) {
                    // doesnt actually apply frame rate conversion with -c copy, just writes it as a tag
                    ffmpeg_args.push(
                        "-r", this.fps
                    );
                }
            }
            ffmpeg_args.push(
                "-map_metadata", "-1",
                "-flvflags", "no_duration_filesize",
                "-f", "flv",
                `-y`,
                ffmpeg_output_url
            );
            this.#ffmpeg.start(ffmpeg_args);
        }

        if (this.session.type === SessionTypes.INTERNAL) {
            this.player = new InternalSessionPlayer(this);
            this.player.out.pipe(this.#ffmpeg.stdin);
            this.player.logger.on("log", (log)=>{
                this.logger.log(log);
            });
        }
        
        this.#tick_interval = setInterval(()=>this.tick(), 1000);

        process.nextTick(async ()=>{
            await this.try_start_playlist();
            globals.app.ipc.emit("main.stream.started", this.id);
            this.emit("started");
            this.tick()
        });

        return super.onstart();
    }

    async tick() {
        this.#ticks++;
        if (this.#ticks%60 == 0) {
            if (this.mpv_log_file) {
                fs.stat(this.mpv_log_file).then(stat=>{
                    if (stat.size > MAX_MPV_LOG_SIZE) {
                        this.logger.error(`mpv log file limit reached (${utils.format_bytes(MAX_MPV_LOG_SIZE)}), stopping stream...`)
                        this.stop("mpv_log_limit");
                    } else if (stat.size > WARNING_MPV_LOG_SIZE) {
                        this.logger.error(`mpv log file is producing excessive logs (${utils.format_bytes(WARNING_MPV_LOG_SIZE)}), consider stopping...`)
                    }
                }).catch(utils.noop);
            }
        }

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
            this.stream_targets[target_id].update();
            curr_targets.add(this.stream_targets[target_id]);
        }

        if (!this.is_paused) {
            if (this.player) this.register_metric(`decoder:speed`, this.player.$.playback_speed);
            this.$.speed = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.speed_alt : 0;
            this.$.bitrate = this.#ffmpeg.last_info ? this.#ffmpeg.last_info.bitrate : 0;
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
    }

    async onstop() {
        clearInterval(this.#tick_interval);
        
        this.logger.info(`Stopping stream...`);
        for (var target of Object.values(this.stream_targets)) {
            target.destroy();
        }
        if (this.player) {
            this.player.destroy();
        }
        if (this.#ffmpeg) {
            this.#ffmpeg.stop();
        }

        globals.app.ipc.emit("main.stream.stopped", this.id);
        
        this.emit("stopped");
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_ts))}`);
        
        return super.onstop();
    }

    register_metric(key, y) {
        // if (this.disable_register_metric) return;
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

        process.nextTick(()=>{
            this.try_start_playlist();
        });
    }

    onpause() {
        if (this.mkv_packet_handler) this.mkv_packet_handler.pause();
        this.player.set_property("pause", true);
        this.#timer.pause();
    }

    onresume() {
        if (this.mkv_packet_handler) this.mkv_packet_handler.resume();
        this.player.set_property("pause", false);
        this.#timer.resume();
    }
    
    async try_start_playlist() {
        if (this.session.type === SessionTypes.INTERNAL && this.state === constants.State.STARTED) {
            /** @type {InternalSession} */
            let session = this.session;
            await session.playlist_play(session.$.playlist_id || session.first_item_id, { start: session.$.time_pos });
        }
    }

    get_stream_targets(id) {
        return Object.values(this.stream_targets).filter(st=>st.id == id || st.target.id == id || st.stream.id == id);
    }

    /** @param {string[]} ids */
    restart(ids) {
        if (!ids || !ids.length) ids = Object.keys(this.stream_targets);
        var stream_targets = ids.map(id=>this.stream_targets[id]).filter(st=>st);
        return Promise.all(stream_targets.map(st=>st.restart()));
    }
    async ondestroy() {
        delete globals.app.streams[this.id];
        delete globals.app.$.streams[this.id];
        this.client_updater.destroy();
        return super.ondestroy();
    }
}

// class MKVPacketHandler extends events.EventEmitter {
//     #pts = 0;
//     #corrected_pts = 0;
//     /** @type {Stream} */
//     #stream;
//     #timer = new utils.StopWatchHR();

//     get pts() { return this.#pts; } // in seconds
//     get corrected_pts() { return this.#corrected_pts; } // in seconds

//     /** @param {Stream} stream */
//     constructor(stream) {
//         super();
//         this.#stream = stream;
//         let is_realtime = stream.is_realtime;
//         this.#timer.start();

//         var decoder = new ebml.Decoder();
//         var reader = new ebml.Reader();
//         var encoder = new ebml.Encoder();
//         // reader.use_duration_every_simpleblock = true;

//         var push = (chunk, pts, callback)=>{
//             this.#pts = pts;
//             this.#corrected_pts = pts + pts_correction;
//             this.stream.push(chunk);
//             this.emit("pts", this.#pts);
//             callback();
//         }

//         var last_elapsed = 0;
//         var elapsed_correction = 0;
//         var pts_correction = 0;
//         var avg_pts_delta = new utils.ExponentialMovingAverage(1000);

//         this.stream = new PassThrough({
//             transform: (chunk, encoding, callback)=>{
//                 let elapsed = this.#timer.elapsed/1000;
//                 let elapsed_adjusted = elapsed + elapsed_correction;
//                 let delta = elapsed - last_elapsed;
//                 let buffer_duration = Math.min(this.#stream.$.buffer_duration, 60);
//                 let next_pts;
//                 this.#stream.logger.console_adapter(()=>{
//                     let elements = decoder.decode(chunk);
//                     for (var e of elements) reader.read(e);
//                     next_pts = (reader.duration * reader.timestampScale / 1000 / 1000 / 1000); // seconds
//                     reader.cues.length = 0; // dump this it builds up quickly consuming memory and doesnt appear to affect pts
//                 }, utils.noop);
//                 let next_pts_corrected = next_pts + pts_correction;
//                 let pts_delta = next_pts_corrected - this.#corrected_pts;
//                 let avg_pts_delta_avg = avg_pts_delta.average || delta;
//                 let expected_next_pts = this.#corrected_pts + avg_pts_delta_avg;
//                 let pts_time_diff = this.#corrected_pts - elapsed_adjusted;
//                 let fix_pts = is_realtime && Math.abs(pts_delta) > constants.MAX_PTS_JUMP;
//                 if (fix_pts) {
//                     stream.logger.warn(`Fixing PTS: ${next_pts_corrected.toFixed(3)} => ${expected_next_pts.toFixed(3)}s`);
//                     let offset_diff = expected_next_pts - next_pts_corrected;
//                     pts_correction += offset_diff;
//                     pts_delta = expected_next_pts - this.#corrected_pts; // pts_delta = delta
//                 }
//                 avg_pts_delta.add(pts_delta);
                
//                 if (is_realtime && pts_time_diff < 0) {
//                     // this prevents the buffer from speeding up when there has been a significant pause
//                     elapsed_correction += pts_time_diff;
//                 }

//                 if (is_realtime && pts_time_diff > buffer_duration) {
//                     let delay = (pts_time_diff - buffer_duration) * 1000;
//                     if (delay > 1000) stream.logger.warn(`Long delay: ${delay.toFixed(3)}ms`);
//                     setTimeout(()=>push(chunk, next_pts, callback), delay);
//                 } else {
//                     push(chunk, next_pts, callback);
//                 }
                
//                 last_elapsed = elapsed;
//             }
//         });
//     }
//     pause() {
//         this.#timer.pause();
//     }
//     resume() {
//         this.#timer.resume();
//     }
// }

export default Stream;