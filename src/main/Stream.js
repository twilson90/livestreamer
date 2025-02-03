import fs from "fs-extra";
import path from "node:path";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import FFMPEGWrapper from "../core/FFMPEGWrapper.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import SessionTypes from "./SessionTypes.js";
import StreamTarget from "./StreamTarget.js";
import MPVSessionWrapper from "./MPVSessionWrapper.js";
import * as constants from "../core/constants.js";
/** @import { SessionBase, InternalSession, ExternalSession } from './types.d.ts' */

const WARNING_MPV_LOG_SIZE = 1 * 1024 * 1024 * 1024;
const MAX_MPV_LOG_SIZE = 8 * 1024 * 1024 * 1024;

export class Stream extends DataNode {
    get time_running() { return Date.now() - this.$.start_time } // in ms
    /** @return {any[]} */
    get state() { return this.$.state; }
    get is_gui() { return !!this.$.targets["gui"]; }
    get is_single_target() { return Object.keys(this.$.targets).length == 1; }
    get is_only_gui() { return this.is_single_target && this.is_gui; }
    get is_encode() { return !this.is_only_gui; }
    get is_realtime() { return !(this.is_single_target && this.$.targets["file"] && !this.$.targets["file"]["re"]); }
    get title() { return this.$.title; }
    get is_running() { return this.$.state === constants.State.STARTED; }
    get fps() { return isNaN(+this.$.frame_rate) ? 30 : +this.$.frame_rate; }

    /** @type {SessionBase} */
    session;
    /** @type {MPVSessionWrapper} */
    mpv;
    /** @type {FFMPEGWrapper} */
    ffmpeg;
    /** @type {Record<PropertyKey,StreamTarget>} */
    stream_targets = {};
    keys = {};
    ticks = 0;
    #reconnect_timeout;
    #tick_interval;

    /** @param {SessionBase} session */
    constructor(session) {
        super();
        Object.assign(this.$, {
            state: constants.State.STOPPED,
        });
        this.logger = new Logger("stream");
        this.logger.on("log", (log)=>(this.session||session).logger.log(log))
        this.attach(session);
    }

    async start(settings) {
        if (this.state !== constants.State.STOPPED) return;
        
        if (settings) {
            settings = utils.deep_copy(settings);
            settings.targets = Object.fromEntries(Object.entries(settings.targets).filter(([id,opts])=>opts.enabled).map(([id,opts])=>{
                var target = globals.app.targets[id];
                var defaults = target ? target.$.opts : {};
                return [id, { ...defaults, ...opts }];
            }));
            Object.assign(this.$, settings);
        }

        this.logger.info(`Starting stream...`);
        this.$.state = constants.State.STARTING;
        this.$.scheduled = !!this.session.$.schedule_start_time;

        var try_restart_soon = async ()=>{
            if (this.state !== constants.State.STOPPING && this.state !== constants.State.STOPPED) {
                this.logger.warn(`Ended unexpectedly, attempting restart soon...`);
                await this.stop(false);
                this.$.state = constants.State.RESTARTING;
                this.#reconnect_timeout = setTimeout(async ()=>{
                    await this.start();
                }, globals.app.conf["main.stream_restart_delay"] * 1000);
            }
        }

        if (this.$.test) {
            if (globals.app.conf["main.test_stream_low_settings"]) {
                this.$.audio_bitrate = "128";
                this.$.video_bitrate = "2000";
                this.$.h264_preset = "veryfast";
                this.$.resolution = "854x480";
            }
            this.$.targets = {};
        }

        this.$.title = this.$.title || this.session.name; // this.session.$.default_stream_title || 
        this.$.start_time = Date.now();
        this.$.metrics = {};
        this.$.stream_targets = {};
        this.$.bitrate = 0;
        
        let error;
        let keyframes_per_second = 2.0;
        let use_hardware = this.$.use_hardware && this.$.experimental_mode;
        let ffmpeg_copy = !this.$.experimental_mode;
        
        if (error) {
            this.logger.error(`Start stream error: ${error}`)
            await this.stop();
            return false;
        }
        
        let ffmpeg_args = [
            // `-re`,
            `-strict`, `experimental`,
        ];
        
        var hwenc = (use_hardware && globals.app.conf["core.ffmpeg_hwenc"]);
        var hwaccel = (use_hardware && globals.app.conf["core.ffmpeg_hwaccel"]);
        
        if (this.session.type === SessionTypes.EXTERNAL) {
            /** @type {ExternalSession} */
            let session = this.session;
            ffmpeg_args.push(
                // `-noautoscale`,
                "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${session.nms_session.publishStreamPath}`,
                "-c", "copy",
            );
        } else {
            
            if (use_hardware) {
                if (!globals.app.conf["core.ffmpeg_hwaccel"]) this.logger.warn(`ffmpeg_hwaccel must be set in config to use hardware acceleration.`);
                if (!globals.app.conf["core.ffmpeg_hwenc"]) this.logger.warn(`ffmpeg_hwenc must be set in config to use hardware acceleration.`);
            }

            if (this.is_realtime) {
                ffmpeg_args.push("-re") // with mpv's --orealtime it usually runs at about x1.01 (not sure why), with -re it is about x1.001 (+1s ~= +1ms sync, so over an hour the viewer will fall around 3.6 secs behind the live edge)
            }
            ffmpeg_args.push(
                "-err_detect", "ignore_err",
            );
            if (ffmpeg_copy) {
                ffmpeg_args.push(
                    "-threads", "1",
                    // "-fflags", "+genpts+igndts+nobuffer",
                    // "-flags", "+low_delay",
                    // "-thread_queue_size", "512", // is this a good idea... ?
                    // "-probesize", "32",
                    // "-analyzeduration", "0",
                    // "-rtbufsize", `${bitrate}k`,
                    // "-blocksize", "128",
                );
            }
            if (hwaccel) {
                ffmpeg_args.push(
                    "-hwaccel", globals.app.conf["core.ffmpeg_hwaccel"],
                    "-hwaccel_output_format", globals.app.conf["core.ffmpeg_hwaccel"],
                    // "-extra_hw_frames", "10"
                );
            }
            ffmpeg_args.push(
                // `-noautoscale`,
                "-i", "pipe:",
                "-bsf:a", "aac_adtstoasc",
                "-bsf:v", "h264_mp4toannexb",
                `-vsync`, "1",
            );
            if (ffmpeg_copy) {
                ffmpeg_args.push(
                    "-c:v", "copy",
                    "-c:a", "copy",
                    "-b:v", `${this.$.video_bitrate}k`, // <-+ this simply writes the bitrate as a tag. Required for Afreecatv.
                    "-b:a", `${this.$.audio_bitrate}k`, // <-+
                );

            } else {
                ffmpeg_args.push(
                    "-c:v", hwenc ? `h264_${globals.app.conf["core.ffmpeg_hwenc"]}` : "libx264",
                    "-preset", hwenc ? `p7` : this.$.h264_preset,
                );
                if (hwaccel) {
                    ffmpeg_args.push(
                        `-no-scenecut`, `1`,
                        `-rc`, `cbr_hq`,
                        `-forced-idr`, `1`,
                        `-rc-lookahead`, this.fps
                    )
                }
                ffmpeg_args.push(
                    "-b:v", `${this.$.video_bitrate}k`,
                    `-maxrate`, `${this.$.video_bitrate}k`,
                    `-bufsize`, `${this.$.video_bitrate}k`,
                    "-c:a", `aac`,
                    "-b:a", `${this.$.audio_bitrate}k`,
                    "-force_key_frames", `expr:gte(t,n_forced*${keyframes_per_second})`,
                );
            }
            ffmpeg_args.push(
                "-r", this.fps
            );
        }
        ffmpeg_args.push(
            "-map_metadata", "-1",
            // "-sn",
            "-flvflags", "no_duration_filesize"
        );

        if (this.is_encode) {
            let internal_path = `/internal/${this.session.id}`;
            this.$.internal_path = internal_path;
            let output_url = new URL(`rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`);
            if (this.$.test) output_url.searchParams.append("test", 1);
            this.output_url = output_url.toString();

            ffmpeg_args.push(
                "-f", "flv",
                "-map", "0:v",
                "-map", "0:a",
                this.output_url
            );

            this.ffmpeg = new FFMPEGWrapper();
            this.ffmpeg.logger.on("log", (log)=>{
                // log = {...log};
                this.logger.log(log);
            });
            this.ffmpeg.on("info", (info)=>{
                this.$.bitrate = info.bitrate;
                var key = this.session.type === SessionTypes.EXTERNAL ? `upstream` : `trans`;
                this.register_metric(`${key}:speed`, this.time_running, info.speed_alt);
                this.register_metric(`${key}:bitrate`, this.time_running, info.bitrate);
            })
            this.ffmpeg.on("end", ()=>{
                try_restart_soon();
            });
            this.ffmpeg.start(ffmpeg_args);
        }

        if (this.session.type === SessionTypes.INTERNAL) {
            
            let [width, height] = this.$.resolution.split("x").map(d=>parseInt(d));

            this.mpv = new MPVSessionWrapper(this, {
                width,
                height,
                cwd: globals.app.tmp_dir,
            });
            this.mpv.logger.on("log", (log)=>{
                this.logger.log(log);
            });
            this.$.mpv = this.mpv.$;

            this.mpv_log_file = path.join(globals.app.logs_dir, `mpv-${utils.date_to_string(Date.now())}.log`);

            var mpv_args = [];
            
            mpv_args.push(
                `--demuxer-max-bytes=${32*1024*1024}`,
                `--demuxer-readahead-secs=5`,
                "--sub-font-size=66",
                "--sub-margin-y=30",
                `--autoload-files=no`,
                // -----------------------------
                "--stream-buffer-size=4k",
                "--interpolation=no",
                "--force-window=yes",
                `--ytdl-format=${globals.app.conf["main.youtube_dl_format"]}`,
                `--script-opts-append=ytdl_hook-try_ytdl_first=yes`, // <-- important for detecting youtube edls on load hook in livestreamer.lua
                `--script-opts-append=ytdl_hook-ytdl_path=${globals.app.conf["main.youtube_dl"]}`,
                `--script=${path.join(globals.app.mpv_lua_dir, "livestreamer.lua")}`,
                "--quiet",
                `--log-file=${this.mpv_log_file}`,
                //--------------------
                `--sub-margin-x=50`,
                // "--sub-use-margins=no", // new
                // "--image-subs-video-resolution=yes",
                //--------------------
                `--end-on-eof=${this.is_encode ? "yes" : "no"}`,
            );
            if (this.is_realtime) {
                mpv_args.push("--orealtime");
            }
            if (use_hardware && globals.app.conf["core.mpv_hwdec"]) {
                mpv_args.push(`--hwdec=${globals.app.conf["core.mpv_hwdec"]}-copy`);
            }
            if (this.is_encode) {
                mpv_args.push(
                    // "--gapless-audio=yes",
                    "--audio-format=float",
                    "--audio-samplerate=48000",
                    `--audio-channels=stereo`,
                    // `--sub-ass-vsfilter-aspect-compat=no`, // fixes fucked up sub scaling on ass files for anamorphic vids (vids with embedded aspect ratio)
                    `--sub-fix-timing=yes`,
                    "--no-config",
                    "--framedrop=no",
                    `--o=-`,
                    "--ofopts-add=strict=+experimental",
                    "--ofopts-add=fflags=+genpts+autobsf",
                    // "--ofopts-add=fflags=+nobuffer+fastseek+flush_packets+genpts+autobsf",
                    // `--demuxer-lavf-o-add=avoid_negative_ts=make_zero`,
                    // `--demuxer-lavf-o-add=copyts`,
                    // `--demuxer-lavf-o-add=use_wallclock_as_timestamps=1`,
                    // ----------------
                    "--no-ocopy-metadata",
                    `--ocontinue-on-fail`,
                );
                if (ffmpeg_copy) {
                    mpv_args.push(
                        // "--of=fifo",
                        // "--ofopts-add=fifo_format=matroska",
                        // "--of=flv",
                        "--of=matroska",
                        // "--ofopts-add=fflags=+flush_packets", //+autobsf // +nobuffer
                        // "--ofopts-add=fflags=+genpts",
                        // `--ofopts-add=avioflags=direct`,

                        // "--ofopts-add=chunk_duration=5000000",
                        // "--ofopts=max_delay=1000000",
                        // `--ofopts-add=packetsize=${1024*1024*10}`,
                        // "--ofopts-add=flush_packets=1",
                        // "--ofopts-add=avoid_negative_ts=+make_zero",
                        // "--ofopts-add=avoid_negative_ts",

                        "--ovc=libx264",
                        `--ovcopts-add=profile=main`,
                        `--ovcopts-add=preset=${this.$.h264_preset}`,
                        `--ovcopts-add=level=4`,
                        `--ovcopts-add=b=${this.$.video_bitrate}k`,
                        `--ovcopts-add=maxrate=${this.$.video_bitrate}k`,
                        // `--ovcopts-add=minrate=${Math.floor(this.$.video_bitrate)}k`,
                        `--ovcopts-add=bufsize=${Math.floor(this.$.video_bitrate)}k`,
                        // `--ovcopts-add=tune=fastdecode`, // this reduces quality to big wet arses
                        // `--ovcopts-add=tune=zerolatency`, // <-- new
                        // `--ovcopts-add=rc_init_occupancy=${Math.floor(this.$.video_bitrate)}k`,
                        `--ovcopts-add=strict=+experimental`,
                        `--ovcopts-add=x264opts=no-scenecut`, // only if using force key frames
                        // `--ovcopts-add=x264opts=rc-lookahead=0`,
                        // `--ovcopts-add=flags=+low_delay`,
                        // `--ovcopts-add=keyint_min=30`,
                        // `--ovcopts-add=g=30`,
                        // `--ovcopts-add=x264opts=`+mpv_escape("keyint=60:min-keyint=60:no-scenecut"),

                        // `--vd-lavc-o-add=forced_keyframes=`+mpv_escape(`expr:gte(t,n_forced*1)`),
                        // `--vd-lavc-o-add=g=30`,
                        `--oac=aac`,
                        `--oacopts-add=b=${this.$.audio_bitrate}k`,
                        // --------------
                        `--oforce-key-frames=expr:gte(t,n_forced*2)`, // keyframe every 2 seconds.
                    );
                } else {
                    if (use_hardware && !globals.app.conf["core.mpv_hwdec"]) {
                        this.logger.warn(`mpv_hwdec must be set in config to use hardware acceleration.`);
                    }
                    /* mpv_args.push(
                        `--ovc=rawvideo`,
                        `--oac=pcm_s16le`,
                        `--of=nut` // nut,matroska,avi
                    ); */
                    // at 1080p server can't do this at realtime for some reason?
                    mpv_args.push(
                        // `--ovc=huffyuv`, // doesnt work on server
                        // `--ovc=utvideo`, // doesnt work on server
                        // `--ovc=rawvideo`, // works on server except when in livestreamer, not sure why
                        `--ovc=mpeg2video`,
                        `--ovcopts-add=b=500M`, // set to some absurdly high bitrate
                        `--oac=pcm_s16le`,
                        `--of=nut` // nut, matroska, avi
                    );
                    /* if (use_hardware) mpv_args.push(`--hwdec=${core.conf["core.mpv_hwdec"]}-copy`);
                    mpv_args.push(
                        use_hardware && core.conf["core.mpv_hwenc"] === "vaapi" ? `--ovc=mpeg2_vaapi` : `--ovc=mpeg2video`,
                        `--ovcopts-add=b=30m`,
                        `--ovcopts-add=maxrate=30m`,
                        `--ovcopts-add=minrate=15m`,
                        `--ovcopts-add=bufsize=15m`,
                        `--oac=pcm_s16le`,
                        `--of=nut` // nut,matroska,avi
                    ); */
                }
            }

            if (this.is_only_gui) {
                let opts = this.$.targets["gui"];
                mpv_args.push(
                    `--osc=${opts.osc?"yes":"no"}`,
                    // `--script-opts-append=livestreamer-capture-mode=1`,
                    "--force-window",
                    // `--interpolation=yes`,
                    `--profile=gpu-hq`,
                    `--deband=no`,
                    `--blend-subtitles=yes`,
                    `--video-sync=display-resample`,
                    `--tscale=box`,
                    `--tscale-window=sphinx`,
                    `--tscale-clamp=0.0`,
                    `--tscale-param1=0.1`,
                    `--tscale-radius=0.95`,
                    `--osd-level=1`,
                    `--term-osd=force`,
                );
            }
            
            // -------------------------------------------------------

            await this.mpv.start(mpv_args);
            this.logger.info("Started MPV");

            if (this.mpv.allowed_mpv_props["output-pts"]) {
                this.mpv.on("speed",(speed)=>{
                    this.register_metric(`mpv:speed`, this.time_running, speed);
                });
            }
        }

        if (this.ffmpeg && this.mpv) {
            this.mpv.process.stdout.pipe(this.ffmpeg.process.stdin);
            this.ffmpeg.process.stdin.on("error", (e)=>{}); // needed to swallow 'Error: write EOF' when unpiping!!!
            this.mpv.on("before-quit", ()=>{
                this.mpv.process.stdout.unpipe(this.ffmpeg.process.stdin);
            })
        }

        this.mpv.on("quit", async ()=>{
            if (this.is_only_gui) await this.stop();
            else try_restart_soon();
        });

        this.$.state = constants.State.STARTED;

        await this.try_start_playlist();
        
        this.#tick_interval = setInterval(()=>this.tick(), 1000);
        await this.tick();
        
        globals.app.ipc.emit("main.stream.started", this.id);
        this.emit("started");

        /* utils.Observer.listen(this.$, c=>{
            if (c.path[0] === "targets") this.update_targets();
        }); */
        // this.update_targets();

        return true;
    }
    async tick() {
        this.ticks++;
        if (this.ticks%60 == 0) {
            if (this.mpv_log_file) {
                let stat = await fs.stat(this.mpv_log_file);
                if (stat) {
                    if (stat.size > MAX_MPV_LOG_SIZE) {
                        this.logger.error(`mpv log file limit reached (${utils.format_bytes(MAX_MPV_LOG_SIZE)}), stopping stream...`)
                        this.stop();
                    } else if (stat.size > WARNING_MPV_LOG_SIZE) {
                        this.logger.error(`mpv log file is producing excessive logs (${utils.format_bytes(WARNING_MPV_LOG_SIZE)}), consider stopping...`)
                    }
                }
            }
        }

        let old_targets = Object.values(this.stream_targets);
        let curr_targets = new Set();

        for (let target_id in this.$.targets) {
            let target = globals.app.targets[target_id];
            if (!target) continue;
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

        for (let target of old_targets) {
            if (!curr_targets.has(target)) {
                target.destroy();
            }
        }
    }

    async stop(detach=true) {
        if (this.state === constants.State.STOPPING || this.state === constants.State.STOPPED) return;
        this.$.state = constants.State.STOPPING;

        clearInterval(this.#tick_interval);
        
        this.logger.info(`Stopping stream...`);
        for (var target of Object.values(this.stream_targets)) {
            target.destroy();
        }
        if (this.mpv) {
            this.logger.info("Terminating MPV...");
            let t0 = Date.now();
            await this.mpv.quit();
            let t1 = Date.now();
            this.logger.info(`MPV terminated in ${(t1-t0)/1000} secs.`);
        }
        if (this.ffmpeg) {
            this.ffmpeg.destroy();
        }

        this.$.state = constants.State.STOPPED;

        globals.app.ipc.emit("main.stream.stopped", this.id);
        
        this.emit("stopped");
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_time))}`);
        
        if (detach) this.attach(null, true);
    }

    async destroy() {
        clearTimeout(this.#reconnect_timeout);
        await this.stop();
    }

    register_metric(key, x, y) {
        var d = this.$.metrics[key] = this.$.metrics[key] ?? {min:0,max:0,data:{}};
        d.data[d.max++] = [x, y];
    }
    
    /** @param {SessionBase} session */
    attach(session, allow_null=false) {
        let last_session = this.session;
        session = (typeof session === "string") ? globals.app.sessions[session] : session;
        if (!session && !allow_null) {
            this.logger.warn(`Attach error: Session does not exist.`);
            return;
        }
        var stream = session && session.stream;
        if (stream && stream.state !== constants.State.STOPPED) {
            this.logger.warn(`Attach error: Session '${session.name}' is already streaming.`)
            return;
        }
        if (session === last_session) {
            this.logger.warn(`Attach error: Already attached to '${session.name}'.`);
            return;
        }

        if (last_session) {
            // do not set this.session to null, need somewhere to write logs to. It should eventually get garbaged.
            last_session.$.stream = utils.deep_copy(this.$);
            last_session.$.stream.state = constants.State.STOPPED;
            last_session.stream = null;
        }

        if (session) {
            this.$.session_id = session.id;
            this.session = session;
            this.session.stream = this;
            session.$.stream = this.$;
        }

        this.try_start_playlist();
    }
    
    async try_start_playlist() {
        if (this.session.type === SessionTypes.INTERNAL && this.state === constants.State.STARTED) {
            /** @type {InternalSession} */
            let session = this.session;
            await session.playlist_play(session.$.playlist_id, { start: session.$.time });
        }
    }

    get_stream_targets(id) {
        return Object.values(this.stream_targets).filter(st=>st.id == id || st.target.id == id || st.stream.id == id);
    }

    restart(ids) {
        if (!ids || !ids.length) ids = Object.keys(this.stream_targets);
        var stream_targets = ids.map(id=>this.stream_targets[id]).filter(st=>st);
        return Promise.all(stream_targets.map(st=>st.restart()));
    }
}

export default Stream;