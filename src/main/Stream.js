import fs from "fs-extra";
import path from "node:path";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import FFMPEGWrapper from "../core/FFMPEGWrapper.js";
import MPVWrapper from "../core/MPVWrapper.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import SessionTypes from "./SessionTypes.js";
import InternalSessionProps from './InternalSessionProps.js';
/** @import { SessionBase, InternalSession, ExternalSession, Target } from './types.d.ts' */

const default_fps = 30;
const TICK_RATE = 30;
const WARNING_MPV_LOG_SIZE = 1 * 1024 * 1024 * 1024;
const MAX_MPV_LOG_SIZE = 8 * 1024 * 1024 * 1024;
const EDL_TRACK_TYPES = ["video", "audio", "sub"];
const RESTRICT_TEST_STREAM_TO_LOWER_SETTINGS = true;

const ALBUMART_FILENAMES = Object.fromEntries([
    "albumart", "album", "cover", "front", "albumartsmall", "folder", ".folder", "thumb",
].map((ext,)=>[ext, 1]));

const SUBTITLE_EXTS = Object.fromEntries([
    ".utf", ".utf8", ".utf-8", ".idx", ".sub", ".srt", ".rt", ".ssa", ".ass", ".mks", ".vtt", ".sup", ".scc", ".smi", ".lrc", ".pgs"
].map((ext,)=>[ext, 1]));

const AUDIO_EXTS = Object.fromEntries([
    ".mp3", ".aac", ".mka", ".dts", ".flac", ".ogg", ".m4a", ".ac3", ".opus", ".wav", ".wv", ".eac3"
].map((ext,)=>[ext, 1]));

const IMAGE_EXTS = Object.fromEntries([
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
].map((ext,)=>[ext, 1]));

const State = new class {
    STARTED = "started";
    STARTING = "starting";
    STOPPED = "stopped";
    STOPPING = "stopping";
};

let ignore_mpv_realtime_changes = {
    "time-pos": 1,
    "output-frames": 1,
    "output-pts": 1,
    "volume": 1
};

const stream_volume_normalization_configs = {
    "dynaudnorm1": `dynaudnorm=f=500:p=0.9:m=8.0:g=7`,
    "dynaudnorm2": `dynaudnorm=f=250:p=0.9:m=8.0:g=5`,
    "loudnorm": `loudnorm=dual_mono=true`
};

export class Stream extends DataNode {
    get time_running() { return Date.now() - this.$.start_time } // in ms
    /** @return {any[]} */
    get state() { return this.$.state; }
    get is_realtime() { return (this.$.method != "file" || this.$.re == "1"); }
    /** @return {InternalSession} */
    get title() { return this.$.title; }
    get is_running() { return this.$.state === State.STARTED; }
    get fps() { return isNaN(+this.$.frame_rate) ? 30 : +this.$.frame_rate; }
    get fps_mode() {
        return "cfr";
        // if (!isNaN(+this.$.frame_rate)) return "cfr";
        // return this.$.frame_rate;
    }
    get vsync() { 
        return "1";
        // if (!isNaN(+this.$.frame_rate)) return "1";
        // if (this.$.frame_rate === "passthrough") return "0";
        // if (this.$.frame_rate === "vfr") return "2";
        // return "-1";
    }

    /** @type {SessionBase} */
    session;
    /** @type {MPVSessionWrapper} */
    mpv;
    /** @type {FFMPEGWrapper} */
    ffmpeg;
    /** @type {Record<PropertyKey,StreamTarget>} */
    stream_targets = {};
    hosts = {};
    internal_stream_paths = [];
    ticks = 0;

    /** @param {SessionBase} session */
    constructor(session) {
        super();
        Object.assign(this.$, {
            state: State.STOPPED,
        });
        this.logger = new Logger("stream");
        this.logger.on("log", (log)=>(this.session||session).logger.log(log))
        this.attach(session);
    }

    async start(settings) {
        if (this.state !== State.STOPPED) return;
        this.logger.info(`Starting stream...`);
        this.$.state = State.STARTING;

        if (settings.test && RESTRICT_TEST_STREAM_TO_LOWER_SETTINGS) {
            settings.audio_bitrate = "128";
            settings.video_bitrate = "2000";
            settings.h264_preset = "veryfast";
            settings.resolution = "854x480";
        }
        
        Object.assign(this.$, settings);

        this.$.title = this.$.title || this.session.name; // this.session.$.default_stream_title || 
        this.$.start_time = Date.now();
        this.$.metrics = {};
        this.$.stream_targets = {};
        this.$.internal_stream_paths = [];
        this.$.bitrate = 0;
        
        let stream_method = this.$.method;
        let outputs = [];
        let error;
        let keyframes_per_second = 2.0;
        let use_hardware = this.$.use_hardware && this.$.experimental_mode;
        let ffmpeg_copy = !this.$.experimental_mode;
        
        if (stream_method == "rtmp") {
            let path = `/internal/${this.session.id}`;
            this.$.internal_stream_paths.push(path);
            let url = new URL(`rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${path}`);
            if (this.$.test) url.searchParams.append("test", 1);
            outputs.push(url.toString());
            if (!outputs.length) error = `No outputs specified`;
        } else if (stream_method == "file") {
            try {
                let filename = await globals.app.evaluate_filename(globals.app.files_dir, this.$.filename).catch(e=>this.logger.error(e.message));
                this.$.filename_evaluated = path.basename(filename);
                if (filename) outputs.push(filename);
            } catch (e) {
                this.logger.error(`Bad file path: '${e.filepath}'`);
            }
            if (!outputs.length) error = `No outputs specified`;
        } else if (stream_method == "gui") {
            // -
        }  else if (stream_method == "ffplay") {
            outputs.push("-");
        } else {
            this.logger.error(`Invalid stream_method '${stream_method}'`);
        }

        this.outputs = outputs;
        
        if (error) {
            this.logger.error(`Start stream error: ${error}`)
            await this.stop();
            return false;
        }
        
        let ffmpeg_args = [
            `-strict`, `experimental`,
            // `-re`
        ];
        
        var hwenc = (use_hardware && globals.app.conf["core.ffmpeg_hwenc"]);
        var hwaccel = (use_hardware && globals.app.conf["core.ffmpeg_hwaccel"]);
        
        if (this.session.type === SessionTypes.EXTERNAL) {
            /** @type {ExternalSession} */
            let session = this.session;
            ffmpeg_args.push(
                "-i", `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${this.session.nms_session.publishStreamPath}`,
                "-c", "copy",
            );
            if (session.nms_session.publishArgs.volume_normalization == "1") {
                ffmpeg_args.push(
                    "-af", stream_volume_normalization_configs.dynaudnorm1,
                    "-c:a", "aac",
                    "-b:a", "160k",
                );
            }
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
                "-i", "pipe:",
                "-bsf:a", "aac_adtstoasc",
                "-bsf:v", "h264_mp4toannexb",
            );
            ffmpeg_args.push(
                `-vsync`, this.vsync,
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

        var ext_format_map = {
            ".mkv": "matroska",
            ".flv": "flv",
            ".mp4": "mp4",
        };
        var get_format = (o)=>{
            var ext = path.extname(o).toLowerCase();
            if (utils.is_valid_rtmp_url(o)) return "flv";
            return ext_format_map[ext] || "matroska";
        }
        if (outputs.length == 1) {
            ffmpeg_args.push(
                "-f", get_format(outputs[0]),
                "-map", "0:v",
                "-map", "0:a",
                outputs[0]
            );
        } else if (outputs.length > 1) {
            ffmpeg_args.push(
                "-f", "tee",
                "-map", "0:v",
                "-map", "0:a",
                outputs.map(o=>{
                    var f = get_format(o);
                    return (f ? `[f=${f}]`:"") + o.replace(/\\/g,"/");
                }).join("|")
            );
        }

        if (this.$.method != "gui") {
            this.ffmpeg = new FFMPEGWrapper();
            this.ffmpeg.logger.on("log", (log)=>{
                this.logger.log(log);
            });
            this.ffmpeg.on("info", (info)=>{
                this.$.bitrate = info.bitrate
                this.register_metric(`trans:bitrate`, this.time_running, info.bitrate);
                if (this.session.type === SessionTypes.EXTERNAL) {
                    this.register_metric(`upstream:speed`, this.time_running, info.speed);
                }
            })
            this.ffmpeg.on("end", ()=>{
                this.stop();
            });
            this.ffmpeg.start(ffmpeg_args);
            // this.ffmpeg.on("line", (line)=>{
            //     this.logger.info(line);
            // });
        }

        if (this.session.type === SessionTypes.INTERNAL) {
            
            let [width, height] = this.$.resolution.split("x").map(d=>parseInt(d));

            this.mpv = new MPVSessionWrapper(this, {
                width,
                height,
                cwd: globals.app.tmp_dir,
            });
            this.mpv.logger.on("log", (log)=>{
                this.logger.log(log)
            });
            this.mpv.on("quit", async ()=>{
                await this.stop();
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
                "--no-ocopy-metadata",
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
                `--ocontinue-on-fail`,
                "--end-on-eof=yes",
            );
            if (this.is_realtime) {
                mpv_args.push("--orealtime");
            }
            if (this.$.method === "gui") {
                mpv_args.push(
                    `--osc=${this.$.osc?"yes":"no"}`,
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
                    // --------------
                    "--end-on-eof=no"
                );
            } else {
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
                );
                if (use_hardware && globals.app.conf["core.mpv_hwdec"]) {
                    mpv_args.push(`--hwdec=${globals.app.conf["core.mpv_hwdec"]}-copy`);
                }
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
            // -------------------------------------------------------

            await this.mpv.start(mpv_args);
            this.logger.info("Started MPV");

            if (this.mpv.allowed_mpv_props["output-pts"]) {
                this.mpv.on("speed",(speed)=>{
                    this.register_metric(`trans:speed`, this.time_running, speed);
                });
            } else if (this.ffmpeg) {
                this.ffmpeg.on("info", (info)=>{
                    this.register_metric(`trans:speed`, this.time_running, info.speed_alt);
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

        if (this.ffmpeg) {
            this.ffmpeg.on("end", ()=>{
                if (this.state !== State.STOPPING && this.state !== State.STOPPED) {
                    this.logger.warn(`FFMPEG ended unexpectedly.`);
                    this.reconnect_timeout = setTimeout(()=>{
                        this.stop();
                        this.start();
                    }, 5000);
                }
            });
        }

        if (stream_method == "ffplay") {
            let ffplay = utils.execa("ffplay", ["-"], {buffer:false});
            this.ffmpeg.process.stdout.pipe(ffplay.stdin);
            ffplay.stdin.on("error", this.logger.error);
            this.ffmpeg.on("end", ()=>{
                ffplay.kill()
            });
            ffplay.on("close", ()=>{
                this.ffmpeg.process.stdout.unpipe(ffplay.stdin);
                this.mpv.quit();
            });
        }

        this.$.state = State.STARTED;
        
        globals.app.ipc.emit("main.stream.started", this.$);
        this.emit("started");

        this.try_start_playlist();
        
        this.tick_interval = setInterval(()=>this.tick(), 1000);

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
        if (this.$.method == "rtmp" && !this.$.test) {
            let old_targets = Object.values(this.stream_targets);
            let curr_targets = new Set();
            for (let target_id of this.$.targets) {
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
                this.stream_targets[target_id].$.title = this.$.title;
                curr_targets.add(this.stream_targets[target_id]);
            }
            for (let target of old_targets) {
                if (!curr_targets.has(target)) {
                    target.destroy();
                }
            }
        }
    }

    async stop() {
        if (this.state === State.STOPPING || this.state === State.STOPPED) return;
        this.$.state = State.STOPPING;

        clearInterval(this.tick_interval);
        
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

        this.$.state = State.STOPPED;

        globals.app.ipc.emit("main.stream.stopped", this.id);
        this.emit("stopped");
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_time))}`);

        this.attach(null, true);
        this.destroy();
    }

    async destroy() {
        await this.stop();
        super.destroy();
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
            this.logger.warn(`[stream] Attach error: Session does not exist.`);
            return;
        }
        var stream = session && session.stream;
        if (stream && stream.state !== State.STOPPED) {
            this.logger.warn(`[stream] Attach error: Session '${session.name}' is already streaming.`)
            return;
        }
        if (session === last_session) {
            this.logger.warn(`[stream] Attach error: Already attached to '${session.name}'.`);
            return;
        }

        if (last_session) {
            // do not set this.session to null, need somewhere to write logs to. It should eventually get garbaged.
            last_session.$.stream = utils.deep_copy(this.$);
            last_session.$.stream.state = State.STOPPED;
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
        if (this.session.type === SessionTypes.INTERNAL && this.state === State.STARTED) {
            /** @type {InternalSession} */
            let session = this.session;
            await session.playlist_play(session.$.playlist_id, { start: session.$.time });
        }
    }
}

export class StreamTarget extends DataNode {
    #state = State.STOPPED;
    get state() { return this.#state; }
    /** @param {Stream} stream @param {Target} target */
    constructor(stream, target) {
        super();

        this.logger = new Logger(`target-${target.id}`);
        this.logger.on("log", (log)=>this.stream.logger.log(log));

        this.stream = stream;
        this.target = target;

        stream.stream_targets[target.id] = this;
        stream.$.stream_targets[target.id] = this.$;

        this.evaluated_target = target.evaluate(this);
        this.$.evaluated_target = this.evaluated_target;
        this.$.stream = stream.id;
        this.$.target = target.id;

        this.ffmpeg = new FFMPEGWrapper();
        var host = new URL(this.evaluated_target.rtmp_url).hostname;
        if (!stream.hosts[host]) stream.hosts[host] = 0;
        var hostname = `${host}:${stream.hosts[host]++}`;
        // this.ffmpeg.on("line", console.log);
        this.ffmpeg.on("info", (info)=>{
            stream.register_metric(`${hostname}:speed`, this.stream.time_running, info.speed);
        });
        this.ffmpeg.logger.on("log",(log)=>{
            if (log.level !== Logger.DEBUG) this.logger.log(log);
        });
        this.ffmpeg.on("end",(e)=>{
            if (this.state !== State.STOPPING && this.state !== State.STOPPED) {
                this.logger.warn(`StreamTarget ended unexpectedly, attempting restart soon.`);
                this.reconnect_timeout = setTimeout(()=>{
                    this.logger.info(`Restarting StreamTarget.`);
                    this.restart();
                }, 5000);
            }
        });
    }

    start() {
        if (this.#state === State.STARTED) return;
        this.#state = State.STARTED;
        this.ffmpeg.start([
            // `-re`, // maybe use?
            "-i", this.stream.outputs[0],
            "-c", "copy",
            "-f", "flv",
            this.evaluated_target.rtmp_url
        ]);
        globals.app.emit("stream-target.started", this.id);
    }
    stop() {
        if (this.#state === State.STOPPED) return;
        this.#state = State.STOPPED;
        this.ffmpeg.stop();
        globals.app.emit("stream-target.stopped", this.id);
    }
    restart() {
        this.stop();
        this.start();
    }

    destroy() {
        super.destroy();
        this.stop();
        delete this.stream.stream_targets[this.target.id];
        clearTimeout(this.reconnect_timeout);
        this.ffmpeg.destroy();
    }
}

const MAX_EDL_REPEATS = 1024;
const EDL_GENERAL_HEADERS = ["new_stream", "no_clip", "delay_open", "mp4_dash", "global_tags", "no_chapters", "track_meta"];

class EDLEntry {
    constructor(file_or_header, named_params) {
        if (file_or_header instanceof EDLEntry) {
            named_params = file_or_header.params;
            file_or_header = file_or_header.file_or_header;
        }
        this.file_or_header = file_or_header;
        this.params = Object.assign({}, named_params);
    }
    append(k, v) {
        if (arguments.length === 1 && typeof k === "object") {
            for (let j in k) this.params[j] = String(k[j]);
        } else {
            this.params[k] = v;
        }
    }
    toString() {
        let parts = [this.file_or_header.toString()];
        for (var k in this.params) {
            let v = String(this.params[k]);
            v = EDL.escape(v, true);
            parts.push(`${k}=${v}`);
        }
        return parts.join(",");
    }
}

class EDL {
    get duration() {
        var d = [0];
        for (var e of this.entries) {
            if (e.file_or_header == "!new_stream") d.push(0);
            if (e.params.length) d[d.length-1] += e.params.length;
        }
        return Math.max(...d);
    }
    /** @type {EDLEntry[]} */
    entries = [];
    get length() { return this.entries.length; }

    constructor(entries=[]) {
        /** @type {EDLEntry[]} */
        this.append(...entries);
    }

    static escape(str, check=false) {
        str = String(str);
        if (check && !str.match(/[,;\n!]/)) return str;
        // returns incorrect length if slanted apostrophe in string
        return `%${Buffer.byteLength(str, "utf8")}%${str}`;
    }

    /** @param {string} filename @param {{start:number, end:number, duration:number, offset:number, loops:number}} opts */
    static repeat(filename, opts) {
        let edl = new EDL();
        let clip_start = Math.max(0, opts.start || 0);
        let clip_end = Math.max(0, opts.end || opts.duration || 0);
        let clip_length = Math.max(0, clip_end - clip_start);
        let clip_offset = opts.offset || 0;
        if (clip_length < 0.01) clip_length = 0;
        let duration = Math.max(0, opts.duration || (clip_length * (opts.loops || 1)));
        for (let k of EDL_GENERAL_HEADERS) {
            if (k in opts) {
                let header = `!${k}`;
                if (typeof opts[k] === "object") header.append(opts[k]);
                edl.append(header);
            }
        }
        if (filename) {
            let t = utils.loop(clip_start + clip_offset, clip_start, clip_end);
            if (clip_length == 0) {
                edl.append(new EDLEntry(EDL.escape(filename), {
                    start: t.toFixed(3)
                }));
            } else {
                let d_left = duration;
                let i = 0;
                while (d_left > 0 && i < MAX_EDL_REPEATS) {
                    let e = Math.min(t + clip_length, t + d_left, clip_end)
                    let d = e - t;
                    edl.append(new EDLEntry(EDL.escape(filename), {
                        start:t.toFixed(3),
                        length:d.toFixed(3)
                    }));
                    d_left -= d;
                    i++;
                    if (e == clip_end) t = clip_start;
                }
            }
        }
        return edl;
    }

    /** @param {EDLEntry[]} entries */
    append(...entries) {
        for (let e of entries) {
            if (!(e instanceof EDLEntry)) e = new EDLEntry(e);
            this.entries.push(e);
        }
    }
    toString(full=false) {
        var entries = this.entries.map(e=>e.toString());
        if (full) return [`# mpv EDL v0`, ...entries].join("\n");
        else return `edl://${entries.join(";")}`;
    }
    
    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]();
    }
}

class MPVSessionWrapper extends MPVWrapper {
    #mpv_last_speed_check = Date.now();
    #mpv_last_pts = 0;
    #tick_interval;
    #long_tick_interval;
    #current_props_override = {};
    #mpv_expected_props = {};
    #mpv_load_props = {};
    allowed_mpv_args = {};
    allowed_mpv_props = {};
    #props = {};
    width = 0;
    height = 0;
    $ = new utils.Observer();

    get time_pos() { return (this.$.special_start_time + (this.#props["time-pos"] || 0)) || 0; }

    get is_encoding() { return !!this.#props.o; }
    /** @type {InternalSession} */
    get session() { return this.stream.session; }
    
    /** @param {Stream} stream */
    constructor(stream, opts) {
        super({
            width: 1280,
            height: 720,
            ...opts
        });
        
        this.width = this.options.width;
        this.height = this.options.height;

        this.stream = stream;
        
        Object.assign(this.$, {
            playing: false,
            seeks: 0,
            seeking: false,
            loaded: true,
            preloaded: true,
            time: 0,
            duration: 0,
            is_special: false,
            special_start_time: 0,
            seekable: false, 
            seekable_ranges: [],
            loaded_item: null,
            props: {}
        });
    }

    async start(mpv_args) {
        var proc = await utils.execa(globals.app.conf["core.mpv_executable"], ["--list-options"]);
        let temp_mpv_out = proc.stdout;
        for (let line of temp_mpv_out.split("\n")) {
            let m = line.trim().match(/^--([^=\s]+)(?:\s+(.+))?$/);
            if (m) {
                this.allowed_mpv_args[m[1]] = true;
                this.allowed_mpv_props[m[1]] = true;
                if (m[2] && m[2].startsWith("Flag")) {
                    this.allowed_mpv_args["no-"+m[1]] = true;
                }
            }
        }

        mpv_args = (()=>{
            let filtered = [];
            for (var arg of mpv_args) {
                if (!arg) continue;
                let m = arg.match(/^--([^=]+)/);
                if (!m) {
                    filtered.push(arg);
                    continue;
                }
                let prop = m[1]
                if (this.allowed_mpv_args[prop]) filtered.push(arg);
                else this.logger.error("Bad mpv arg:", prop);
            }
            return filtered;
        })();
        
        await super.start(mpv_args).catch((e)=>{
            this.logger.error(e);
        });

        let mpv_props = {
            ["time-pos"]: 0,
            ["path"]: null,
            ["stream-path"]: null,
            ["stream-open-filename"]: null,
            ["duration"]: 0,
            ["mute"]: false,
            ["pause"]: false,
            ["deinterlace"]: false,
            ["core-idle"]: false,
            // ["idle-active"]: true,
            ["interpolation"]: false,
            ["estimated-vf-fps"]: 0,
            ["estimated-display-fps"]: 0,
            ["file-format"]: null,
            ["track-list"]: [],
            ["aid"]: null,
            ["vid"]: null,
            ["sid"]: null,
            // if false actually means source is live (e.g. youtube live-stream)
            ["seekable"]: null,
            ["demuxer-via-network"]: false,
            ["eof-reached"]: false,
            ["cache-buffering-state"]: 0,
            ["paused-for-cache"]: 0,
            // these are new props that I added...
            ["output-pts"]: 0,
            ["output-frames"]: 0,
        }

        this.$.is_encoding = !!await this.get_property("o");

        for (let k in mpv_props) {
            this.#props[k] = mpv_props[k];
            this.$.props[k] = mpv_props[k];
            this.observe_property(k);
        }
        
        let log_history = {};

        this.on("before-quit", ()=>{
            clearInterval(this.#tick_interval);
            clearInterval(this.#long_tick_interval);
        });
        
        this.on("log-message", (log)=>{
            // this.logger.debug(log.text);
            let text = log.text.trim();
            if (log.level == "warn") {
                let pattern = utils.escape_regex(text).replace(/\d+/g, "\\d+");
                let last = log_history[pattern] || 0;
                let now = Date.now();
                // prevents fast, numerous messages like 'Invalid audio PTS' or 'Correcting Video PTS'
                if ((now-last) > 2000) {
                    log_history[pattern] = now;
                    this.logger.warn(`[mpv] ${text}`);
                }
            } else if (log.level == "error") {
                this.logger.error(`[mpv] ${text}`);
            }
        })
        
        this.on("start-file", (e)=>{
        });

        let eof_reason;
        let valid_eof_reasons = new Set(["eof","error","unknown"]);
        this.on("end-file", (e)=>{
            eof_reason = e.reason;
            var fn1 = this.#props["path"]
            var fn2 = this.#props["stream-open-filename"]
            var fn3 = this.#props["stream-path"];
            if (fn1 != "null://eof" && valid_eof_reasons.has(eof_reason)) {
                this.load_next();
            }
        });
        
        this.on("file-loaded", async (e)=>{
            this.$.loaded = true;
            Object.assign(this.#mpv_expected_props, this.#mpv_load_props);
        });

        this.on("seek", (e)=>{
            this.$.playing = false;
            this.$.seeking = true;
            this.update_time_pos();
        });

        this.on("playback-restart", (e)=>{
            this.$.playing = true;
            this.$.seeks++;
            this.$.seeking = false;
            this.$.user_seeking = false;
            this.update_time_pos();
        });

        /* this.on("on_after_end_file", (e)=>{
            if (valid_eof_reasons.has(eof_reason)) {
                this.session.playlist_next();
            }
        }); */

        this.on("property-change", async (e)=>{
            let {name, data} = e;
            if (name === "eof-reached") {
                if (data) {
                    this.logger.info("eof-reached");
                    if (this.#props.loop_file) this.seek(0);
                    else this.load_next();
                }
            }
            if (name in this.#mpv_expected_props && this.#mpv_expected_props[name] !== data) {
                this.emit("user-property-change", e);
                this.#mpv_expected_props[name] = data;
            }
            if (!(name in ignore_mpv_realtime_changes)) {
                this.$.props[name] = data;
            }
            if (name === "time-pos" && this.$.seeking) {
                this.update_time_pos();
            }
            this.#props[name] = data;
        });
        
        this.on("user-property-change", async (e)=>{
            let {name, data} = e;
            /* if (name === "volume") {
                this.session.$.volume_target = data / this.#props.volume_multiplier;
            } */
            // too confusing...
            /* else if (["sid", "aid"].includes(name)) {
                let override_key = `${name}_override`;
                let auto_key = `${name}_auto`;
                if (data == "auto") return;
                if (this.#props[override_key] == null && data == this.#props[auto_key]) return;
                this.#props[override_key] = (data == this.#props[auto_key]) ? null : data;
            } */
        });
        
        this.on("quit", async ()=>{
            this.session.$.time = this.$.time;
        });

        this.on("idle", ()=>{
            this.logger.info("MPV idle.");
            // this.session.playlist_next();
            // this.stop();
        });

        this.request_log_messages("info");

        this.#mpv_last_pts = 0;
        this.#mpv_last_speed_check = Date.now();
        this.#tick_interval = setInterval(()=>this.#tick(), 1000/TICK_RATE);
        this.#long_tick_interval = setInterval(()=>this.#long_tick(), 1000);
    }

    load_next() {
        return this.session.playlist_next();
    }

    seek(t) {
        if (!this.$.seekable) return;
        this.$.user_seeking = true;
        this.$.seek_time = t;
        if (this.$.is_special) {
            return this.loadfile(this.loaded_item, { start: t, reload_props:false, pause:this.#props.pause });
        } else {
            return super.seek(t);
        }
    }

    reload(reload_props=true) {
        return this.loadfile(this.session.get_playlist_item(this.loaded_item.id), { start: this.$.time, reload_props, pause:this.#props.pause });
    }
        
    /** @param {{offset:number, duration:number, media_type:string}} opts */
    async #process(item, opts) {
        opts = Object.assign({}, opts);
        let is_root = item === this.loaded_item;
        item = fix_item(item);
        let duration = opts.duration || 0;
        let offset = opts.offset || 0;
        let is_playlist = item.filename && this.session.is_item_playlist(item.id);
        let mi = await globals.app.probe_media(item.filename);
        let exists = mi.exists;
        let is_image = mi.duration <= 0.04;
        let filename = item.filename;
        var duration_override = Number.MAX_SAFE_INTEGER;
        var use_duration_override = false;

        if (is_playlist && (item.props.playlist_mode || !is_root)) {
            exists = true;
            let is_2track = item.props.playlist_mode == 2;
            let edl = new EDL();
            let tracks = [];
            let playlist_tracks = this.session.get_playlist_tracks(item.id);
            
            for (var i = 0; i < playlist_tracks.length; i++) {
                let track = {
                    entries: [],
                    duration: 0
                };
                if (is_2track) {
                    track.type = EDL_TRACK_TYPES[i];
                }
                let o = offset;
                for (let item of playlist_tracks[i]) {
                    if (item.filename == "livestreamer://exit") {
                        duration_override = Math.min(duration_override, track.duration);
                        use_duration_override = true;
                    }
                    let opts = {};
                    if (track.type) opts.media_type = track.type;
                    opts.offset = o;
                    let tmp = await this.#process(item, opts);
                    let fade_in = utils.round_precise(+item.props.fade_in || 0, 3);
                    let fade_out = utils.round_precise(+item.props.fade_out || 0, 3);
                    if (fade_in) {
                        if (!is_2track || i == 0) this.loaded_item.fades.push(["v", "in", o, fade_in])
                        if (!is_2track || i == 1) this.loaded_item.fades.push(["a", "in", o, fade_in])
                    }
                    track.duration += tmp.duration;
                    o += tmp.duration;
                    if (fade_out) {
                        if (!is_2track || i == 0) this.loaded_item.fades.push(["v", "out", o-fade_out, fade_out])
                        if (!is_2track || i == 1) this.loaded_item.fades.push(["a", "out", o-fade_out, fade_out])
                    }
                    if (tmp.duration > 0) {
                        track.entries.push(new EDLEntry(EDL.escape(tmp.filename), {
                            length: tmp.duration.toFixed(3)
                        }));
                    }
                }
                tracks.push(track);
            }

            var min_duration = Math.min(...tracks.map((t)=>t.duration));
            var max_duration = Math.max(...tracks.map((t)=>t.duration));
            if (item.props.playlist_end_on_shortest_track) {
                duration = min_duration;
            } else {
                duration = max_duration;
            }
            if (use_duration_override) {
                duration = duration_override;
            }

            offset += duration;

            for (let track of tracks) {
                if (is_2track) {
                    let pad_duration = max_duration - track.duration;
                    // add padding to track if necessary
                    if (pad_duration > 0.05) {
                        if (track.type == "audio" && item.props.playlist_revert_to_video_track_audio && tracks[0].duration > tracks[1].duration) {
                            let tmp_filename = new EDL(tracks[0].entries).toString();
                            track.entries.push(new EDLEntry(EDL.escape(tmp_filename), {
                                start: (tracks[1].duration).toFixed(3),
                                length: (tracks[0].duration - tracks[1].duration).toFixed(3)
                            }));
                        } else {
                            let tmp = await this.#process(null, {duration: pad_duration, media_type: track.type, offset});
                            track.entries.push(new EDLEntry(EDL.escape(tmp.filename), {
                                length: pad_duration.toFixed(3)
                            }));
                        }
                    }
                    if (track.entries.length && track.type) {
                        edl.append(
                            "!new_stream",
                            new EDLEntry("!delay_open", {
                                media_type: track.type
                            })
                        );
                    }
                }
                edl.append(...track.entries);
            }
            
            if (edl.length) {
                duration = duration || edl.duration;
                filename = edl.toString();
            }

        } else if (!is_root) {
            // files, nulls and whatnot
            if (!exists || is_image) filename = null;
            let stream_map = {};
            let edl = new EDL();
            edl.append("!no_chapters");
            if (!duration) {
                duration = (item.props.clip_end - item.props.clip_start) || item.props.title_duration || item.props.empty_duration || mi.duration;
            }
            if (duration) {
                if (mi && mi.streams) {
                    for (let s of mi.streams) stream_map[s.type] = !s.albumart;
                }
                let required_stream_types = opts.media_type ? [opts.media_type] : ["video","audio"];
                for (let t of required_stream_types) {
                    if (!stream_map[t]) {
                        let null_filename;
                        if (t === "audio") null_filename = globals.app.null_audio_path;
                        else if (t === "video") null_filename = globals.app.null_video_path;
                        if (null_filename) {
                            var alt_filename = path.relative(this.cwd, null_filename); // significantly shortens path hopefully
                            if (alt_filename.length < null_filename) null_filename = alt_filename;
                            edl.append(
                                "!new_stream",
                                ...EDL.repeat(null_filename, {end:globals.app.null_stream_duration, duration:duration})
                            );
                        }
                    }
                }
                if (edl.length > 1) {
                    if (filename) {
                        edl.append("!new_stream");
                        edl.append(new EDLEntry(EDL.escape(filename), {
                            length:duration.toFixed(3)
                        }));
                    }
                    filename = edl.toString();
                }
            }
        }
        
        if (!duration) duration = (mi && mi.duration) || 0;

        if (!is_image) {
            if (item.props.clip_start || item.props.clip_loops || item.props.clip_end || item.props.clip_offset || item.props.clip_duration || !is_root) {
                let opts = {
                    start: item.props.clip_start,
                    end: item.props.clip_end || duration,
                    loops: item.props.clip_loops,
                    offset: item.props.clip_offset,
                    duration: item.props.clip_duration,
                };
                let temp_edl = EDL.repeat(filename, opts);
                duration = temp_edl.duration;
                filename = temp_edl.toString();
            }
        }

        return {filename, duration};
    }

    // /** @param {InternalSession.PlaylistItem} item */
    async loadfile(item, opts) {

        opts = Object.assign({
            reload_props: true,
        }, opts);

        let last_id = this.loaded_item && this.loaded_item.id;
        let last_props = utils.deep_copy(this.#props);

        // this.$.current_item_on_load = utils.deep_copy(item);
        // this.$.current_descendents_on_load = utils.deep_copy(this.get_playlist_items(id, null, true));

        item = utils.deep_copy(fix_item(item));
        let mi = await globals.app.probe_media(item.filename)
        item.media_info = mi;
        item.af_graph = [];
        item.vf_graph = [];
        item.fades = [];
        this.loaded_item = item;

        let props_def = InternalSessionProps.playlist.__enumerable__.props;
        let props = {};
        let on_load_commands = [];
        
        if (opts.reload_props) {
            for (let k in props_def) {
                props[k] = props_def[k].__default__;
            }
            for (let k in this.session.$.player_default_override) {
                props[k] = this.session.$.player_default_override[k];
            }
            for (let k in item.props) {
                props[k] = item.props[k];
            }
        } else {
            props = last_props;
        }
        if (last_id !== item.id) {
            this.#current_props_override = {};
        }
        for (let k in this.#current_props_override) {
            props[k] = this.#current_props_override[k];
        }
        
        let {filename, duration} = await this.#process(item);

        this.logger.debug(filename);

        if (!filename) filename = "livestreamer://empty";

        let ls_path, is_intertitle, is_rtmp, is_empty, is_macro;
        let is_image = mi.duration <= 0.04;
        if (is_image) {
            duration = item.props.clip_duration || 0;
        }

        if (filename.startsWith("livestreamer://")) {
            ls_path = filename.replace(/^livestreamer:\/\//, "");
            filename = "null://";
            if (ls_path == "macro") {
                is_macro = true;
            } else if (ls_path == "empty") {
                is_empty = true;
                duration = props.empty_duration;
            } else if (ls_path == "intertitle") {
                is_intertitle = true;
                duration = props.title_duration;
                let font = props.title_font;
                let size = props.title_size;
                let color = ass_color(props.title_color);
                let outline_color = ass_color(props.title_outline_color);
                let shadow_color = ass_color(props.title_shadow_color);
                let bold = (props.title_style || "").match("bold") ? -1 : 0;
                let italic = (props.title_style || "").match("italic") ? -1 : 0;
                let spacing = props.title_spacing;
                let outline_thickness = props.title_outline_thickness;
                let shadow_depth = props.title_shadow_depth;
                let alignment = props.title_alignment;
                let underline = props.title_underline ? -1 : 0;
                // let angle = 360 - (item.props.title_angle || 0);
                let margin = props.title_margin;
                let start = ass_time(0.25 * 1000);
                let end = ass_time((Math.max(0, duration - 0.5))*1000);
                let text = ass_fade(props.title_fade) + (ass_rotate(...(props.title_rotation||[])) || "") + ass_text(props.title_text);
                let ass_str = `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 384
PlayResY: 288

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: livestreamer-default,${font},${size},${color},${color},${outline_color},${shadow_color},${bold},${italic},${underline},0,100,100,${spacing},0,1,${outline_thickness},${shadow_depth},${alignment},${margin},${margin},${margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${start},${end},livestreamer-default,,0,0,0,,${text}`;
                
                filename = `memory://${ass_str}`;
            } else if (ls_path == "rtmp") {
                filename = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}/private/${this.session.$.id}`;
                // if localhost port is open and accepts request but stream is not live it breaks mpv completely. Can't figure it out.
                // filename = "wss://localhost:8112/live/"..S.rtmp_key..".flv"
                // filename = "https://localhost:8112/live/"..S.rtmp_key..".m3u8"
                // low-latency profile:
                // load_opts[audio-buffer", 0); // THIS FUCKS UP RTMP FILES (IF FAIL TO LOAD)

                
                props["vd-lavc-threads"] = 1;
                props["cache-pause"] = false;
                // load_opts["demuxer-lavf-o"] = {fflags="+nobuffer"}; // PROBLEM?
                props["demuxer-lavf-probe-info"] = "nostreams";
                props["demuxer-lavf-analyzeduration"] = 0.1;
                props["video-sync"] = "audio";
                props["interpolation"] = false;
                props["video-latency-hacks"] = true;
                props["stream-buffer-size"] = "4k";
                
                // I added these for some reason:
                // load_opts["demuxer-lavf-format"] = "flv";
                // load_opts["demuxer-lavf-buffersize"] = 8192;
                // load_opts["demuxer-lavf-hacks"] = true;
            }
        }

        let start_time = +(opts.start||0);
        let seekable = true;
        
        let m;
        if (!filename || is_image || (m = filename.match(/^(rtmp|null|memory|av):\/\//))) {
            seekable = false;
            is_rtmp = m && m[1] === "rtmp";
        }
        if (!seekable) {
            start_time = 0;
        }

        let is_special = false;
        let streams = [];
        let num_videos = 0;
        let num_audios = 0;
        let num_subtitles = 0;

        const register_streams = (...new_streams)=>{
            for (let s of new_streams) {
                s.id = streams.length;
                if (s.type == "video") {
                    // some track have 0 duration.
                    // if (s.duration != undefined && s.duration <= 0.04) s.albumart = true;
                    s.type_id = ++num_videos;
                } else if (s.type == "audio") {
                    s.type_id = ++num_audios;
                } else if (s.type == "subtitle") {
                    s.type_id = ++num_subtitles;
                }
                streams.push(s);
            }
        }

        const register_file_streams = async (file, type) =>{
            let mi = utils.deep_copy(await globals.app.probe_media(file));
            if (!mi.streams) return;
            var streams = filter_streams(mi.streams, type);
            if (!streams.length) return;
            for (var id = 0; id<streams.length; id++) {
                let s = streams[id];
                let filename = `${path.basename(file)}:${id+1}`;
                s.title = [s.title, filename].filter(s=>s).join(" | ");
            }
            register_streams(...streams);
            return true;
        }

        if (mi.streams) {
            let streams = utils.deep_copy(mi.streams);
            if (is_image) streams.filter(s=>s.type==="video").forEach(s=>s.albumart=1);
            register_streams(...streams);
        } else if (is_rtmp || props.playlist_mode) {
            register_streams({type:"video"}, {type:"audio"})
        } else if (is_intertitle) {
            register_streams({type:"subtitle"});
        }

        var get_default_stream_id = (type)=>{
            var default_stream = utils.get_default_stream(streams.filter(s=>s.type==type), type);
            return default_stream ? default_stream.type_id : false;
        }

        let vid_auto = get_default_stream_id("video");
        let aid_auto = get_default_stream_id("audio");
        let sid_auto = get_default_stream_id("subtitle");

        let video_files = [];
        let audio_files = [];
        let subtitle_files = [];

        const add_video = async (filename, start, end)=>{
            let mi = await globals.app.probe_media(filename); // , true
            let video_ext = path.extname(filename);
            let video_name = path.basename(filename, video_ext);
            start = start || 0;
            end = Math.min(end || Number.MAX_SAFE_INTEGER, mi.duration);
            // let video_length = video_end - video_start;
            
            // if already has video, a still image will have 0 framerate! This is the only way of adding a still image to a media file with video
            let data;
            let repeats = duration / (end - start);
            var albumart = false;

            if (mi.duration <= 0.04) {
                albumart = true;
                data = [filename, "select", video_name, "eng", "yes"];
            } else if (duration == 0 || !Number.isFinite(repeats) || repeats > MAX_EDL_REPEATS) {
                data = [`av://lavfi:movie='${av_escape(filename).replace(/\\/g, "/")}':loop=0,setpts=N/FRAME_RATE/TB`, "select", video_name, "eng", "no"];
                // weird issue with gifs running way too fast with this method...
            } else {
                data = [EDL.repeat(filename,  {start, end, duration}).toString(), "select", video_name, "eng", "no"];
            }
            if (mi.streams) {
                /** @type {object[]} */
                let streams = utils.deep_copy(mi.streams);
                // video-add also adds audio and subs... we must register them
                var first_video_stream = streams.find(s=>s.type === "video");
                if (first_video_stream) {
                    first_video_stream.albumart = albumart;
                    vid_auto = num_videos + 1; // select first video track added
                }
                register_streams(...streams);
                on_load_commands.push(["video-add", ...data]);
            }
        }
        const add_subtitle = async (filename)=>{
            var n = num_subtitles;
            if (await register_file_streams(filename, "subtitle")) {
                subtitle_files.push(filename);
                sid_auto = n+1;
            }
        };
        const add_audio = async (filename)=>{
            var n = num_audios;
            if (await register_file_streams(filename, "audio")) {
                audio_files.push(filename);
                aid_auto = n+1;
            }
        };

        let external_artworks = [];

        // auto add local files with similar names...
        if (item.media_info.protocol == "file:" && item.media_info.exists) {
            let filepath = utils.try_file_uri_to_path(item.filename || "");
            let dir = path.dirname(filepath);
            let filename = path.basename(filepath);
            let files = await fs.readdir(dir);

            for (let f of files) {
                if (f == filename) continue;
                let f_lower = f.toLowerCase();
                let ext = path.extname(f_lower);
                let name = path.basename(f_lower, ext);
                let similar_name = filename.startsWith(name);
                if (similar_name && ext in SUBTITLE_EXTS) {
                    await add_subtitle(path.join(dir, f));
                }
                /* if (similar_name && ext in AUDIO_EXTS) {
                    add_audios.push(path.join(dir, f));
                } */
                if (ext in IMAGE_EXTS && (similar_name || name in ALBUMART_FILENAMES)) {
                    external_artworks.push(path.join(dir, f))
                }
            }
        }

        let fix_background_file = async (f)=>{
            if (f) {
                var mi = await globals.app.probe_media(f);
                if (!mi.streams) return null;
            }
            return f;
        }
        
        let has_main_video = is_image || !!streams.find(s=>s.type==="video" && !s.albumart);
        let use_background = is_empty || is_intertitle || !!props.background_mode || !!props.background_file || !has_main_video;
        let background_mode = props.background_mode;
        let background_color = props.background_color;
        let background_file, background_file_start, background_file_end;
        
        if (!background_mode) {
            background_mode = "color";
            background_color = "#000000";
        }
        if (background_mode == "default") {
            background_mode = this.session.$.background_mode || "logo";
            background_color = this.session.$.background_color;
        }
        if (background_mode == "logo") {
            background_file = await fix_background_file(this.session.$.background_file);
            background_file_start = this.session.$.background_file_start;
            background_file_end = this.session.$.background_file_end;
        }
        if (props.background_file) {
            background_file = props.background_file;
            background_file_start = props.background_file_start;
            background_file_end = props.background_file_end;
        }
        if (background_mode !== "color") background_color = "#000000";
        if (background_file) background_mode = "file";

        if (use_background) {
            if (background_mode == "embedded" || background_mode == "external") {
                if (background_mode == "external") {
                    for (var f of external_artworks) await add_video(f);
                }
                let artwork_stream;
                let embedded_artwork_stream = streams.find(s=>s.type==="video" && !s.external && s.albumart)
                let external_artwork_stream = streams.find(s=>s.type==="video" && s.externals.albumart)
                if (background_mode == "embedded") artwork_stream = embedded_artwork_stream
                if (background_mode == "external") artwork_stream = external_artwork_stream || embedded_artwork_stream;
                if (artwork_stream) vid_auto = artwork_stream.type_id;
                else background_mode = "logo";
            }
            if (background_mode == "file") {
                await add_video(background_file, background_file_start, background_file_end);
            } else if (background_mode == "logo") {
                await add_video(path.resolve(globals.app.conf["main.logo_path"]));
            } else if (background_mode == "color") {
                // vid_auto = 0; // ?
            }
        }

        if (props.subtitle_file) {
            await add_subtitle(props.subtitle_file);
        }
        if (props.audio_file) {
            await add_audio(props.audio_file);
        }

        if (is_intertitle || (!num_videos && num_subtitles)) {
            sid_auto = 1; // select sub if no video exists
        }

        let vid = fix_stream_id(props.vid_override ?? vid_auto, streams, "video");
        let aid = fix_stream_id(props.aid_override ?? aid_auto, streams, "audio");
        let sid = fix_stream_id(props.sid_override ?? sid_auto, streams, "subtitle");

        // -------------------------------------------------
        
        let fps = default_fps;
        let lavfi_complex = [];
        let vo = [];
        let ao = [];

        let show_waveform = !!(props.audio_visualization == "waveform" && aid);
        let is_albumart = (get_stream_by_id(vid,streams)||{}).albumart;

        if (use_background || !vid || show_waveform || is_albumart) {
            let overlay_center = "overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2";
            is_special = true;
            vo.push(`color=c=${background_color}:s=${this.width}x${this.height}:r=${fps}`);
            if (vid) {
                vo.push(
                    `${vo.pop()}[bg1]`,
                    `[vid${vid||1}]scale=${this.width}x${this.height}:force_original_aspect_ratio=decrease[img1]`,
                    `[bg1][img1]${overlay_center}`
                )
                // vid = "generated";
            }
            if (show_waveform) {
                let wave_w = Math.min(1280, this.width) // cap it at 1280 or it lags.
                let wave_h = Math.ceil(wave_w * (this.height / this.width));
                let h_scale = 0.5;
                let wf_alpha = 1.0;
                let showwaves = `showwaves=mode=line:scale=lin:s=${wave_w}x${wave_h*h_scale}:colors=white@${wf_alpha}:r=${fps}`;
                if (wave_w != this.width) {
                    showwaves = `${showwaves},scale=${this.width}:-1`;
                }
                vo.push(
                    `${vo.pop()}[img2]`,
                    `[aid${aid}]asplit[ai][ao]`,
                    `[ai]dynaudnorm,${showwaves},fps=${fps}[wf1]`,
                    `[img2][wf1]${overlay_center}`
                );
                // aid = "generated";
            }
        }
        
        if (!aid) {
            is_special = true;
            ao.push("anullsrc=cl=stereo:r=48000");
        }
    
        if (vo.length) {
            lavfi_complex.push(`${vo.join(";")}[vo]`);
            // vid = 1;
        }
        if (ao.length) {
            lavfi_complex.push(`${ao.join(";")}[ao]`);
            // aid = 1;
        }

        let special_start_time = 0
        if (seekable && start_time && is_special) {
            special_start_time = start_time;
            start_time = 0;
        }
        
        const try_edlify = (filename)=>{
            if (special_start_time) {
                filename = new EDL([
                    new EDLEntry(EDL.escape(filename), {
                        start: special_start_time.toFixed(3)
                    })
                ]).toString();
            }
            return filename;
        };

        filename = try_edlify(filename);

        props.pause = !!opts.pause;
        props.start = start_time;

        if (duration) {
            props.end = duration - special_start_time;
        }
        
        props["lavfi-complex"] = lavfi_complex.join(";");
        this.logger.debug(props["lavfi-complex"]);

        // ---------------------
        // edl fades
        {
            let [w,h] = [this.width, this.height];
            let ass;
            for (let [type,dir,offset,dur] of this.loaded_item.fades) {
                offset = Math.max(0, offset - (special_start_time || 0));
                // if (type.startsWith("v")) vf_graph.push(`fade=enable='between(t,${offset},${offset+duration})':t=${dir}:st=${o}:d=${duration}`)
                if (type.startsWith("v")) {
                    if (!ass) {
                        ass =
`[Script Info]
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name,PrimaryColour,Alignment,Encoding
Style: F1,&H000000,7,0

[Events]
Format: Start,End,Style,Text`+"\n";
                    }
                    let fade, alphas, o = 0;
                    if (dir === "out") {
                        o = 0.25;
                        alphas = "0,255,0";
                    } else {
                        alphas = "255,0,255";
                    }
                    fade = [0, 0, 0, dur];
                    let start = offset - o;
                    let end = offset + dur;
                    let f = `{\\fade(${alphas},${fade.map(f=>Math.round(f*1000)).join(",")})}`;
                    let c = `{\\p1}m 0 0 l ${w} 0 ${w} ${h} 0 ${h}{\\p0}`;
                    ass += `Dialogue: ${ass_time(start*1000)},${ass_time(end*1000)},F1,${f+c}\n`;
                } else if (type.startsWith("a")) {
                    this.loaded_item.af_graph.push(`afade=enable='between(t,${offset},${offset+dur})':t=${dir}:st=${offset}:d=${dur}`);
                }
            }
            if (ass) {
                subtitle_files = [{filename:"memory://"+ass, name:"__fades__"}];
            }
        }

        // -------------------

        var fix_additional_file = (f)=>{
            if (typeof f === "string") f = {filename:f};
            f.name = f.name || path.basename(f.filename);
            return f;
        };

        video_files = video_files.map(fix_additional_file);
        subtitle_files = subtitle_files.map(fix_additional_file);
        audio_files = audio_files.map(fix_additional_file);
        
        for (var f of video_files) {
            on_load_commands.push(["video-add", try_edlify(f.filename), "select", f.name]);
        }
        for (var f of subtitle_files) {
            on_load_commands.push(["sub-add", try_edlify(f.filename), "select", f.name]);
        }
        for (var f of audio_files) {
            on_load_commands.push(["audio-add", try_edlify(f.filename), "select", f.name]);
        }

        props.vid_auto = vid_auto;
        props.sid_auto = sid_auto;
        props.aid_auto = aid_auto;

        /////////////////////////////////////////////////
        //                THE BIG APPLY                //
        /////////////////////////////////////////////////

        this.$.playing = false;
        this.$.loaded = false;
        this.$.seekable_ranges = [];
        this.$.time = start_time;
        this.$.duration = duration;
        this.$.special_start_time = special_start_time;
        this.$.is_special = is_special;
        this.$.seekable = seekable;
        this.$.streams = streams;

        this.#props = props;
        this.$.props = props;
        this.#mpv_load_props = {};
        for (var k in props) {
            this.set_property(k, props[k]);
        }
        this.rebuild_filters();
        this.rebuild_deinterlace();
        this.update_volume(true);

        if (vid != null) this.#mpv_load_props.vid = vid || false;
        if (aid != null) this.#mpv_load_props.aid = aid || false;
        if (sid != null) this.#mpv_load_props.sid = sid || false;
        if (this.$.seekable) this.#mpv_load_props.start = String(start_time);
        
        for (var k of Object.keys(this.#mpv_load_props)) {
            if (!this.allowed_mpv_props[k]) delete this.#mpv_load_props[k];
        }

        await this.on_load_promise(this.lua_message("loadfile", filename, this.#mpv_load_props, on_load_commands));

        return filename;
    }

    async set_property(key, value, current_file_override=false) {
        let changed = this.#props[key] != value;
        this.#props[key] = value;
        this.$.props[key] = value;
        let mpv_key = key, mpv_value = value;

        if (current_file_override) {
            this.#current_props_override[key] = value;
        }

        var reload = false;

        if (key === "start" || key === "end") {
            mpv_value = String(value);
        } else if (key === "deinterlace_mode") {
            this.deinterlace_dirty = true;
        } else if (key === "audio_channels" || key === "volume_normalization" || key.startsWith("crop_")) { // || k === "force_fps"
            this.filters_dirty = true;
        } else if (key === "audio_visualization") {
            reload = true;
        } else if (key === "aspect_ratio") {
            mpv_key = "video-aspect-override";
        } else if (key === "audio_delay") {
            if (this.is_encoding) this.filters_dirty = true;
            else mpv_key = "audio-delay";
        } else if (key === "sub_delay") {
            mpv_key = "sub-delay";
        } else if (key === "sub_scale") {
            mpv_key = "sub-scale";
        } else if (key === "sub_pos") {
            mpv_key = "sub-pos";
        } else if (key === "audio_pitch_correction") {
            mpv_key = "audio-pitch-correction";
        } else if (key === "vid_override" || key === "aid_override" || key === "sid_override") {
            reload = true;
        }
        
        if (this.allowed_mpv_props[mpv_key]) {
            this.#mpv_expected_props[mpv_key] = mpv_value;
        }
        if (!this.$.loaded) {
            this.#mpv_load_props[mpv_key] = mpv_value;
            return;
        }
        if (reload && changed) {
            return this.reload(false);
        }
        if (this.allowed_mpv_props[mpv_key]) {
            return super.set_property(mpv_key, mpv_value);
        }
    }

    lua_message(name, ...args) {
        return this.command("script-message-to", "livestreamer", name, JSON.stringify(args)).catch(e=>{
            this.logger.warn(`[mpv] ${JSON.stringify(e)}`);
        })
    }
    
    update_volume(immediate = false) {
        let target_volume = this.session.$.volume_target * this.#props.volume_multiplier;
        let curr_volume = this.#props.volume ?? 100;
        this.set_property("volume_target", target_volume);
        let inc = this.session.$.volume_speed;
        if (inc == 0 || immediate) {
            curr_volume = target_volume;
        } else {
            if (curr_volume < target_volume) {
                curr_volume = Math.min(curr_volume + inc, target_volume);
            } else if (curr_volume > target_volume) {
                curr_volume = Math.max(curr_volume - inc, target_volume);
            }
        }
        if (this.#props.volume != curr_volume) {
            this.set_property("volume", curr_volume);
        }
    }

    async #tick() {
        /* if (this.do_reload) {
            this.do_reload = false;
            this.reload(false);
        } */
        if (this.filters_dirty) {
            this.rebuild_filters();
        }
        if (this.deinterlace_dirty) {
            this.rebuild_deinterlace();
        }
        if (this.$.playing) {
            this.update_volume();
        }
    }

    async #long_tick() {

        let ts = Date.now();
        if (this.#props["output-pts"]) {
            let diff_pts = (this.#props["output-pts"] - this.#mpv_last_pts) * 1000;
            let diff_ts = ts - this.#mpv_last_speed_check;
            let speed = (diff_pts / diff_ts);
            if (isNaN(speed) || speed < 0) speed = 0;
            // let f = this.$["output-frames"];
            this.speed = speed;
            this.emit("speed", speed);
        }
        this.#mpv_last_pts = this.#props["output-pts"];
        this.#mpv_last_speed_check = ts;

        (async ()=>{
            let new_ranges;
            let demuxer_cache_state = (await this.get_property("demuxer-cache-state").catch(()=>null));
            // console.log(demuxer_cache_state);
            if (demuxer_cache_state) {
                new_ranges = demuxer_cache_state["seekable-ranges"];
            }
            if (JSON.stringify(new_ranges) != JSON.stringify(this.$.seekable_ranges)) {
                this.$.seekable_ranges = new_ranges || [];
            }
        })();

        if (!this.is_encoding) {
            let interpolation_mode = this.session.$.interpolation_mode || false;
            let curr_val = this.#props.interpolation;
            let new_val = curr_val;
            if (interpolation_mode == "auto") {
                let df = this.session.$.auto_interpolation_rate || 30;
                let vf = this.#props["estimated-vf-fps"];
                if (vf) {
                    if (vf < df) {
                        let r =  df % vf;
                        new_val = r > 0.1;
                    } else {
                        new_val = false
                    }
                }
            } else {
                new_val = interpolation_mode;
            }
            if (curr_val != new_val) {
                this.set_property("interpolation", new_val);
            }
        }

        this.update_time_pos();

        for (var k in this.#props) {
            this.$.props[k] = this.#props[k];
        }
    }
    update_time_pos() {
        var t = this.$.user_seeking ? this.$.seek_time : this.time_pos;
        this.$.time = t;
        this.session.$.time = t;
    }

    rebuild_deinterlace() {
        this.deinterlace_dirty = false;
        let deint = this.#props.deinterlace_mode;
        if (deint == "auto") {
            deint = false;
            if (this.loaded_item && this.loaded_item.media_info) deint = !!this.loaded_item.media_info.interlaced;
        }
        this.logger.info(`deint:`, deint)
        this.set_property("deinterlace", deint);
    }

    rebuild_filters() {
        this.filters_dirty = false;
        let [w, h] = [this.width, this.height];

        let vf_graph = [];
        // `setpts=PTS-STARTPTS`

        let af_graph = [];
        // `asetpts=PTS-STARTPTS`,
        
        // this fucks it up. Do not use.
        // if (this.stream.is_realtime && !this.$.seekable) {
        //     vf_graph.push("realtime");
        //     af_graph.push("arealtime");
        // }

        af_graph.push(
            `aformat=channel_layouts=stereo`,
            `pan=stereo|FL<1.0*FL+0.707*FC+0.707*BL|FR<1.0*FR+0.707*FC+0.707*BR`,
            `aresample=async=1`
        );
        // let fps = +(this.#props.force_fps || this.stream.fps);
        let fps = +this.stream.fps;
        if (fps) {
            vf_graph.push(
                `fps=${fps}`
            );
        }

        let crop_left = this.#props.crop_left || 0;
        let crop_right = this.#props.crop_right || 0;
        let crop_top = this.#props.crop_top || 0;
        let crop_bottom = this.#props.crop_bottom || 0;
        if (crop_left || crop_right || crop_top || crop_bottom) {
            vf_graph.push(
                `crop=w=iw*${Math.abs(1-crop_right-crop_left)}:h=ih*${Math.abs(1-crop_bottom-crop_top)}:x=iw*${crop_left}:y=ih*${crop_top}`
            );
        }

        const get_fade_in_out = ()=>{
            if ((this.loaded_item||{}).filename == "livestreamer://intertitle") {
                return [this.#props.title_fade || 0, this.#props.title_fade || 0];
            }
            return [this.#props.fade_in || 0, this.#props.fade_out || 0];
        };
        let [fade_in, fade_out] = get_fade_in_out();
        var real_duration = this.$.duration - this.$.special_start_time;
        let end_fade = real_duration - fade_out - 0.5
        
        if (fade_in && !this.$.special_start_time) {
            vf_graph.push(
                `fade=t=in:st=0:d=${fade_in}`
            );
            af_graph.push(
                `afade=t=in:st=0:d=${fade_in}`
            );
        }

        if (fade_out && end_fade >= 0 && real_duration > 0) {
            vf_graph.push(
                `fade=t=out:st=${end_fade}:d=${fade_out}`
            );
            af_graph.push(
                `afade=t=out:st=${end_fade}:d=${fade_out}`
            );
        }

        let norm_method = this.#props.volume_normalization;
        let norm_filter_option = stream_volume_normalization_configs[norm_method];
        if (norm_filter_option) {
            af_graph.push(norm_filter_option);
        }

        if (this.is_encoding && this.#props.audio_delay) {
            af_graph.push(
                `asetpts=PTS+${this.#props.audio_delay}/TB`,
                `aresample=async=1`
            );
        }

        let has_2_channels = (()=>{
            var streams = this.$.streams;
            return (get_stream_by_id(this.#props.aid, streams, "audio") || get_stream_by_id("auto", streams, "audio") || {}).channels == 2;
        })();

        let ac = this.#props.audio_channels;
        if (has_2_channels) {
            if (ac == "mix") {
                af_graph.push(
                    "pan=stereo|c0=.5*c0+.5*c1|c1=.5*c0+.5*c1"
                );
            } else if (ac == "left") {
                af_graph.push(
                    "pan=stereo|c0=c0|c1=c0"
                );
            } else if (ac == "right") {
                af_graph.push(
                    "pan=stereo|c0=c1|c1=c1"
                ); // if mono this may break as c1 does not exist?
            } else if (ac == "stereo") {
                // do nothing
            }
            // af_graph.push("pan=stereo|c0=c0|c1=c0");
        }

        vf_graph.push(
            `scale=(iw*sar)*min(${w}/(iw*sar),${h}/ih):ih*min(${w}/(iw*sar),${h}/ih)`,
            `pad=${w}:${h}:(${w}-iw*min(${w}/iw,${h}/ih))/2:(${h}-ih*min(${w}/iw,${h}/ih))/2`,
            `format=yuv420p`
        );

        /** @param {str[]} graph */
        var fix = (graph,lavfi=false) => {
            var s = graph.filter(f=>f).map(f=>f.replace(/[,]/g, m=>`\\${m}`)).join(",");
            if (lavfi) s = `lavfi=[${s.replace(/[\[\]]/g, m=>`\\${m}`)}]`;
            return s;
        }

        af_graph.push(...this.loaded_item.af_graph);
        vf_graph.push(...this.loaded_item.vf_graph);
        
        let af = fix(af_graph,true);
        let vf = fix(vf_graph,true);

        // let af = [fix(af_graph,true), fix(this.loaded_item.af_graph)].filter(s=>s).join(",");
        // let vf = [fix(vf_graph,true), fix(this.loaded_item.vf_graph)].filter(s=>s).join(",");

        this.set_property("af", af);
        this.set_property("vf", vf);
    }
}

const fix_item = (item)=>{
    if (typeof item !== "object" || item === null) item = { filename: item || null };
    if (!item.id) item.id = utils.uuidb64();
    if (!item.props) item.props = {};
    return item;
}

function filter_streams(streams, type) {
    streams = streams ? [...streams] : [];
    if (type) streams = streams.filter(s=>s.type === type);
    return streams;
}

function get_stream_by_id(id, streams, type) {
    streams = filter_streams(streams, type);
    if (id == null || id == "auto") return utils.get_default_stream(streams, type);
    if (streams[id-1]) return streams[id-1];
}

function fix_stream_id(id, streams, type) {
    return (get_stream_by_id(id, streams, type)||{}).type_id || 0;
}

function av_escape(str) {
    return str.replace(/\\/g, "\\\\\\\\").replace(/'/g, `'\\\\''`).replace(/:/g, "\\:")
}
function ass_text(text) {
    return (text||"").replace(/\r?\n/g, "\\N");
}
function ass_fade(fade) {
    fade = +(fade || 0);
    if (fade > 0) return `{\\fad(${fade*1000},${fade*1000})}`;
    return "";
}
function ass_rotate(x, y, z) {
    return `{\\frx${x||0}}{\\fry${y||0}}{\\frz${-(z||0)}}`;
}
function ass_time(a) {
    let h = Math.floor(a/(60*60*1000));
    a -= h*(60*60*1000);
    let m = Math.floor(a/(60*1000));
    a -= m*(60*1000);
    let s = Math.floor(a/1000);
    a -= s*1000;
    a = Math.floor(a/10);
    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(a).padStart(2,"0")}`;
}
function ass_color(color) { //rrggbbaa
    let str = String(color).replace(/^0x/, "").replace(/^#/, "").toUpperCase();
    let parts = [];
    if (str.length == 8) {
        parts.push((255 - parseInt(`0x${str.slice(6,8)}`)).toString(16));
    }
    // ass color is in BBGGRR or AABBGGRR format
    parts.push(str.slice(4,6));
    parts.push(str.slice(2,4));
    parts.push(str.slice(0,2));
    return `&H${parts.join("")}`;
}

export default Stream;

/* cache-speed
Current I/O read speed between the cache and the lower layer (like network). This gives the number bytes per seconds over a 1 second window (using the type MPV_FORMAT_INT64 for the client API).

This is the same as demuxer-cache-state/raw-input-rate.

demuxer-cache-duration
Approximate duration of video buffered in the demuxer, in seconds. The guess is very unreliable, and often the property will not be available at all, even if data is buffered.
demuxer-cache-time
Approximate time of video buffered in the demuxer, in seconds. Same as demuxer-cache-duration but returns the last timestamp of buffered data in demuxer.
demuxer-cache-idle
Whether the demuxer is idle, which means that the demuxer cache is filled to the requested amount, and is currently not reading more data.
demuxer-cache-state */