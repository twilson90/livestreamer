import fs from "fs-extra";
import path from "node:path";
import { PassThrough } from "node:stream";
import * as ebml from 'ts-ebml';
import {globals, SessionTypes, StreamTarget, SessionPlayer, SessionPlayer$} from "./exports.js";
import {utils, constants, FFMPEGWrapper, Logger, StopStartStateMachine, StopStartStateMachine$, ClientUpdater} from "../core/exports.js";
/** @import { Session, InternalSession, ExternalSession, Session$ } from './exports.js' */

const WARNING_MPV_LOG_SIZE = 1 * 1024 * 1024 * 1024;
const MAX_MPV_LOG_SIZE = 8 * 1024 * 1024 * 1024;
const MAX_METRICS_SAMPLES = 1000;
const LOW_METRIC_SAMPLE_RATE = 20;

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
    player = new SessionPlayer$();
    buffer_duration = 5;
    fps = 0;
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

    get_target_opts(target_id) {
        return {
            ...(globals.app.targets[target_id]||{}).$.opts,
            ...this.$.target_opts[target_id]
        }
    }

    /** @type {Session<Session$>} */
    session;
    /** @type {SessionPlayer} */
    player;
    /** @type {FFMPEGWrapper} */
    ffmpeg;
    /** @type {Record<PropertyKey,StreamTarget>} */
    stream_targets = {};
    keys = {};
    #ticks = 0;
    #tick_interval;
    /** @type {Record<PropertyKey,utils.IncrementalAverage>} */
    #metrics_averages = {};

    /** @param {Session} session */
    constructor(session) {
        super(globals.app.generate_uid("stream"), new Stream$());
        globals.app.streams[this.id] = this;
        globals.app.$.streams[this.id] = this.$;
        this.logger = new Logger("stream");
        this.logger.on("log", (log)=>(this.session||session).logger.log(log))
        
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
        let use_hardware = this.$.use_hardware && this.$.experimental_mode;
        let ffmpeg_copy = !this.$.experimental_mode;
        
        if (error) {
            this.logger.error(`Start stream error: ${error}`)
            await this.stop("start_error");
            return false;
        }
        
        let ffmpeg_args = [
            // `-re`,
            `-strict`, `experimental`,
            `-stream_loop`, `-1`,
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
                // ffmpeg_args.push("-re") // with mpv's --orealtime it usually runs at about x1.01 (not sure why), with -re it is about x1.001 (+1s ~= +1ms sync, so over an hour the viewer will fall around 3.6 secs behind the live edge)
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

        if (this.is_encoding) {
            let internal_path = `/internal/${this.session.id}`;
            this.$.internal_path = internal_path;
            this.$.output_url = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
            let ffmpeg_output_url = this.$.output_url;
            if (this.is_test) {
                let url = new URL(ffmpeg_output_url);
                url.searchParams.append("test", 1);
                ffmpeg_output_url = url.toString();
            }
            this.$.rtmp_output_url = `rtmp://${globals.app.hostname}:${globals.app.conf["media-server.rtmp_port"]}${internal_path}`;
            this.$.ws_output_url = `ws://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
            this.$.wss_output_url = `wss://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;
            this.$.http_output_url = `http://media-server.${globals.app.hostname}:${globals.app.conf["core.http_port"]}${internal_path}.flv`;
            this.$.https_output_url = `https://media-server.${globals.app.hostname}:${globals.app.conf["core.https_port"]}${internal_path}.flv`;
            
            ffmpeg_args.push(
                "-f", "flv",
                "-map", "0:v",
                "-map", "0:a",
                `-y`,
                ffmpeg_output_url
            );

            this.ffmpeg = new FFMPEGWrapper();
            /* this.ffmpeg.logger.on("log", (log)=>{
                log.level = Logger.DEBUG;
                this.logger.log(log);
            }); */
            this.ffmpeg.on("error", (e)=>this.logger.error(e));
            if (this.session.type === SessionTypes.EXTERNAL) {
                this.ffmpeg.on("info", (info)=>{
                    this.$.bitrate = info.bitrate;
                    this.$.speed = info.speed_alt;
                })
            }
            this.ffmpeg.on("end", ()=>{
                this._handle_end("ffmpeg");
            });
            this.ffmpeg.start(ffmpeg_args);
        }

        if (this.session.type === SessionTypes.INTERNAL) {
            
            let [width, height] = this.$.resolution.split("x").map(d=>parseInt(d));
            width = Math.round(width/2)*2;
            height = Math.round(height/2)*2;

            this.player = new SessionPlayer(this, {
                width,
                height,
            });
            this.player.logger.on("log", (log)=>{
                this.logger.log(log);
            });

            var mpv_custom = false;
            
            this.mpv_log_file = path.join(globals.app.logs_dir, `mpv-${this.id}-${utils.date_to_string(Date.now())}.log`);

            var mpv_args = [];
            
            mpv_args.push(
                "--no-config",
                "--cache=no",
                "--sub-font-size=66",
                `--sub-margin-x=50`,
                "--sub-margin-y=30",
                `--sub-fix-timing=yes`,
                // `--sub-ass-vsfilter-aspect-compat=no`, // fixes fucked up sub scaling on ass files for anamorphic vids (vids with embedded aspect ratio)
                `--autoload-files=no`,
                // -----------------------------
                "--stream-buffer-size=4k",
                "--interpolation=no",
                `--video-sync=display-resample`,
                // "--interpolation-threshold=-1",
                `--tscale=box`,
                `--tscale-window=sphinx`,
                `--tscale-clamp=0.0`,
                `--tscale-param1=0.1`,
                `--tscale-radius=0.95`,
                "--force-window=yes",
                // "--ytdl=no",
                `--ytdl-format=${globals.app.conf["core.ytdl_format"]}`,
                // `--script-opts-append=ytdl_hook-try_ytdl_first=yes`, // <-- important for detecting youtube edls on load hook in livestreamer.lua
                // `--script-opts-append=ytdl_hook-ytdl_path=${globals.app.conf["core.ytdl_path"]}`,
                `--script=${globals.app.resources.get_path("mpv_lua/livestreamer.lua")}`,
                `--script-opts-append=livestreamer-fix_discontinuities=${this.$.fix_discontinuities?"yes":"no"}`,
                "--quiet",
                `--log-file=${this.mpv_log_file}`,

                `--audio-stream-silence=no`, // maybe fixes issue with silent segments in EDLs?
                //--------------------
                // "--sub-use-margins=no", // new
                // "--image-subs-video-resolution=yes",
                //--------------------
            );
            if (mpv_custom) {
                mpv_args.push(`--end-on-eof=${this.is_encoding ? "yes" : "no"}`);
            }
            
            if (this.is_realtime) {
                // mpv_args.push(
                //     "--cache=yes",
                //     "--cache-secs=1",
                //     // `--demuxer-max-bytes=${32*1024*1024}`,
                //     // `--demuxer-readahead-secs=5`,
                //     "--demuxer-readahead-secs=1",
                //     "--demuxer-hysteresis-secs=1",
                //     // -----------------
                // );

                if(mpv_custom) mpv_args.push("--orealtime");
            }

            if (use_hardware && globals.app.conf["core.mpv_hwdec"]) {
                mpv_args.push(`--hwdec=${globals.app.conf["core.mpv_hwdec"]}-copy`);
            }
            if (this.is_encoding) {
                mpv_args.push(
                    // "--gapless-audio=yes",
                    "--audio-format=float",
                    "--audio-samplerate=48000",
                    `--audio-channels=stereo`,
                    "--framedrop=no",
                    `--o=-`,
                    "--ofopts-add=strict=+experimental",
                    "--ofopts-add=fflags=+genpts+autobsf",
                    // "--ofopts-add=fflags=+discardcorrupt+genpts+igndts+autobsf",
                    // "--demuxer-lavf-analyzeduration=0.1",
                    // "--ofopts-add=fflags=+nobuffer+fastseek+flush_packets+genpts+autobsf",
                    // `--demuxer-lavf-o-add=avoid_negative_ts=make_zero`,
                    // `--demuxer-lavf-o-add=copyts`,
                    // `--demuxer-lavf-o-add=use_wallclock_as_timestamps=1`,
                    // ----------------
                    "--no-ocopy-metadata",
                );
                if (mpv_custom) {
                    mpv_args.push("--ocontinue-on-fail");
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
                        // `--ovcopts-add=x264opts=no-scenecut`, // only if using force key frames
                        // `--oforce-key-frames=expr:gte(t,n_forced*2)`, // keyframe every 2 seconds.
                    );
                    var x264opts = {
                        "nal-hrd": `cbr`,
                        "force-cfr": `1`,
                        "scenecut": `0`,
                    }
                    if (mpv_custom) {
                        mpv_args.push(
                            `--oforce-key-frames=expr:gte(t,n_forced*${keyframes_per_second})`,
                        );
                    } else {
                        x264opts["keyint"] = this.fps*keyframes_per_second;
                        x264opts["min-keyint"] = this.fps*keyframes_per_second;
                    }
                    mpv_args.push(
                        `--ovcopts-add=x264opts=${Object.entries(x264opts).map(([k,v])=>`${k}=${v}`).join(":")}`,
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
                        `--of=matroska` // nut, matroska, avi
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
                let opts = this.get_target_opts("gui");
                mpv_args.push(
                    `--osc=${opts.osc?"yes":"no"}`,
                    // `--script-opts-append=livestreamer-capture-mode=1`,
                    "--force-window",
                    // `--interpolation=yes`,
                    `--profile=gpu-hq`,
                    `--deband=no`,
                    `--blend-subtitles=yes`,
                    `--osd-level=1`,
                    `--term-osd=force`,
                );
            }
            
            // -------------------------------------------------------

            this.player.mpv.on("before-start", ()=>{
                if (this.ffmpeg) {
                    this.mkv_packet_handler = new MKVPacketHandler(this, this.is_realtime);
                    this.player.mpv.process.stdout.pipe(this.mkv_packet_handler.stream).pipe(this.ffmpeg.process.stdin);
                    this.player.mpv.on("before-quit", ()=>{
                        this.player.mpv.process.stdout.unpipe(this.mkv_packet_handler.stream).unpipe(this.ffmpeg.process.stdin);
                    })
                    this.ffmpeg.process.stdin.on("error", (e)=>{
                        this.logger.warn(e);
                    }); // needed to swallow 'Error: write EOF' when unpiping!!!
                }
            })

            let res = await this.player.start(mpv_args);
            if (!res) {
                return;
            }
            this.logger.info("Started MPV successfully");
            
            this.player.mpv.on("quit", async ()=>{
                if (this.is_only_gui) await this.stop("quit");
                else this._handle_end("mpv");
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
            let key = (this.session.type === SessionTypes.EXTERNAL) ? "upstream" : "trans";
            this.register_metric(`${key}:speed`, this.$.speed);
            this.register_metric(`${key}:bitrate`, this.$.bitrate);
            for (let st of Object.values(this.stream_targets)) {
                this.register_metric(`${st.$.key}:speed`, st.$.speed);
                this.register_metric(`${st.$.key}:bitrate`, st.$.bitrate);
            }
        }
        
        if (this.mkv_packet_handler) {
            let bitrate = this.mkv_packet_handler.bitrate_avg;
            let speed = this.mkv_packet_handler.speed_avg;
            this.$.bitrate = bitrate;
            this.$.speed = speed;
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
            this.logger.info("Terminating MPV...");
            let t0 = Date.now();
            await this.player.mpv.quit();
            let t1 = Date.now();
            this.logger.info(`MPV terminated in ${(t1-t0)/1000} secs.`);
        }
        if (this.ffmpeg) {
            this.ffmpeg.stop();
        }

        globals.app.ipc.emit("main.stream.stopped", this.id);
        
        this.emit("stopped");
        
        this.logger.info(`Stream stopped, total duration was ${utils.ms_to_timespan_str(Math.round(Date.now()-this.$.start_ts))}`);
        
        return super.onstop();
    }

    register_metric(key, y) {
        // if (this.disable_register_metric) return;
        if (!this.#metrics_averages[key]) this.#metrics_averages[key] = new utils.IncrementalAverage();
        this.#metrics_averages[key].push(y);
        if (!this.$.metrics[key]) this.$.metrics[key] =  {high:{min:0,max:0,data:{}}, low:{min:0,max:0,data:{}}};
        var d = this.$.metrics[key];
        d.high.data[d.high.max++] = y;
        if (d.high.max % LOW_METRIC_SAMPLE_RATE == 0) {
            d.low.data[d.low.max++] = this.#metrics_averages[key].average;
            this.#metrics_averages[key].clear();
        }
        for (var k in d) {
            if (d[k].max > MAX_METRICS_SAMPLES) {
                delete d[k].data[d[k].min++];
            }
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
    }

    onresume() {
        if (this.mkv_packet_handler) this.mkv_packet_handler.resume();
        this.player.set_property("pause", false);
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



class MKVPacketHandler {
    #pts = 0;
    /** @type {Stream} */
    #stream;
    #bitrate_avg = new utils.ExponentialMovingAverage(10000);
    #speed_avg = new utils.ExponentialMovingAverage(10000);
    #timer = new utils.StopWatchHR();

    get speed_avg() { return this.#speed_avg.average; }
    get bitrate_avg() { return this.#bitrate_avg.average; }
    get pts() { return this.#pts + this.pts_offset; } // in seconds
    pts_offset = 0;

    /** @param {Stream} stream */
    constructor(stream) {
        this.#stream = stream;
        let is_realtime = stream.is_realtime;
        this.#timer.start();

        var decoder = new ebml.Decoder();
        var reader = new ebml.Reader();

        var push = (chunk, pts, callback)=>{
            this.#pts = pts;
            this.stream.push(chunk);
            reader.cues.length = 0; // dump this it builds up quickly consuming memory and doesnt appear to affect pts
            callback();
        }

        var last_elapsed = 0;
        this.stream = new PassThrough({
            transform: (chunk, encoding, callback)=>{
                let elapsed = this.#timer.elapsed;
                let delta = elapsed - last_elapsed;
                var buffer_duration = Math.min(this.#stream.$.buffer_duration, 60);
                
                const elements = decoder.decode(chunk);
                for (var e of elements) reader.read(e);
                const nanosec = reader.duration * reader.timestampScale;
                let next_pts = nanosec / 1000 / 1000 / 1000;
                let pts_delta = next_pts - this.#pts;
                
                const time_diff = this.pts - (elapsed/1000);

                if (is_realtime && time_diff > buffer_duration) {
                    const delay = (time_diff - buffer_duration) * 1000;
                    setTimeout(()=>push(chunk, next_pts, callback), delay);
                } else {
                    push(chunk, next_pts, callback);
                }

                if (delta > 0) {
                    let speed = pts_delta / (delta/1000);
                    let bitrate = chunk.length / (delta/1000);
                    this.#bitrate_avg.add(bitrate, elapsed);
                    this.#speed_avg.add(speed, elapsed);
                }
                
                last_elapsed = elapsed;
            }
        });
    }
    pause() {
        this.#timer.pause();
    }
    resume() {
        this.#timer.resume();
    }
}

export default Stream;