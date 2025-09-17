import path from "node:path";
import fs from "node:fs";
import events from "node:events";
import * as hls from "hls-parser";

import { globals } from "./exports.js";
import { utils, FFMPEGWrapper, Logger, StopStartStateMachine, StopStartStateMachine$, constants } from "../core/exports.js";

/** @import {Session} from "./exports.js" */
/** @import {Request, Response} from "express" */
/** @typedef {typeof default_configs[0]} LiveLevelConfig */

const THUMBNAIL_INTERVAL = 60 * 1000;
const AUTO_END_LIVE_TIMEOUT = 5 * 60 * 1000;
const FETCH_TIMEOUT = 60 * 1000;
const THUMBNAIL_FORMAT = "webp";
const THUMBNAIL_QUALITY = 70;
const THUMBNAIL_HEIGHT = 360;
const HLS_EXT_VERSION = 9;

export class Live$ extends StopStartStateMachine$ {
    hls_list_size = 0;
    hls_live_window = 0;
    segment_duration = 0;
    segments = {};
    origin = "";
    title = "";
    url = "";
    is_vod = false;
    is_live = false;
    ts = Date.now();
    duration = 0;
    size = 0;
    settings = new class {
        input = "";
        input_format = "";
        width = 0;
        height = 0;
        fps = 0;
        opts = {
            use_hardware: false,
            use_hevc: false,
            // fps_passthrough: true,
        }
    }
}

const default_configs = [
    {
        "name": "240p",
        "resolution": 240,
        "video_bitrate": 500, // recommended 300–500 kbps
        "audio_bitrate": 128,
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
        "video_bitrate": 1000, // recommended 1000–1500 kbps
        "audio_bitrate": 128,
    },
    {
        "name": "720p",
        "resolution": 720,
        "video_bitrate": 2000, // recommended 2000–3000 kbps
        "audio_bitrate": 160,
    },
    {
        "name": "1080p",
        "resolution": 1080,
        "video_bitrate": 3500, // recommended 3000–5000 kbps
        "audio_bitrate": 160,
    }
];

/** @extends {StopStartStateMachine<Live$>} */
export class Live extends StopStartStateMachine {
    /** @type {FFMPEGWrapper} */
    ffmpeg;
    /** @type {Record<PropertyKey, LiveLevel>} */
    levels = {};
    metadata = {};
    /** @type {Session} */
    session;
    #base_url = "";
    #ticks = 0;
    #master = "";

    get aspect_ratio() { return this.$.settings.width / this.$.settings.height; }

    constructor(id) {

        super(id, new Live$());
        globals.app.lives[this.id] = this;

        this.dir = path.join(globals.app.live_dir, this.id);
        this.thumbnails_dir = path.join(this.dir, "thumbnails");
        this.data_filename = path.join(this.dir, "data.json");

        fs.mkdirSync(this.dir, { recursive: true });
        fs.mkdirSync(this.thumbnails_dir, { recursive: true });

        var base = `${globals.app.get_urls("media-server").url}`;
        this.#base_url = `${base}/media/live/${this.id}`;
        var player_url = `${base}/player/index.html?id=${this.id}`;
        var manifest_url = `${this.#base_url}/master.m3u8`;
        
        this.manifest_path = path.join(this.dir, "master.m3u8");

        Object.assign(this.$, {
            url: player_url,
            manifest_url,
            is_live: false,
        });

        this.logger = new Logger(`live-${this.id}`);
        globals.app.logger.add(this.logger);

        this.observer.on("change", (e) => {
            if (e.subtree) return;
            this.debounced_save();
        });
    }

    generate_levels() {
        var configs = default_configs.filter(c => c.resolution <= this.$.settings.height);
        for (var c of configs) {
            new LiveLevel(this, c);
        }
    }

    async load() {
        var d;
        try { d = JSON.parse(await fs.promises.readFile(this.data_filename, "utf-8").catch(utils.noop)); } catch { };
        if (d) {
            Object.assign(this.$, d);
            this.generate_levels();
            // await this.end();
            await this.stop();
            return true;
        }
    }

    async save() {
        if (this.destroyed) return;
        await utils.safe_write_file(this.data_filename, JSON.stringify(this.$), "utf-8");
    }

    debounced_save = utils.debounce(async () => {
        await this.save();
    }, 10);

    async tick() {
        var now = Date.now();
        if (this.is_started) {
            this.$.ts = now;
            this.$.duration = now - this.$.start_ts;
        } else if (this.is_started && now > (this.$.ts + AUTO_END_LIVE_TIMEOUT)) {
            this.logger.warn(`LIVE [${this.id}] was not ended manually, ending automatically...`);
            // await this.end();
            await this.stop();
        } else if (now > (this.$.ts + (globals.app.conf["media-server.media_expire_time"] * 1000))) {
            this.logger.warn(`LIVE [${this.id}] has expired, destroying...`);
            await this.destroy();
        }
        //  else if ((this.#ticks % 60 == 0) && !(await utils.file_exists(this.data_filename))) {
        //     await this.destroy();
        // }
        this.#ticks++;
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
        new FFMPEGWrapper().start(ffmpeg_args, { cwd: level.dir })
            .then(() => {
                this.$.thumbnail_url = `${this.#base_url}/thumbnails/${thumbnail_name}`;
            })
            .catch((e) => {
                // 1 bad thumbnail, whatever.
            });
    };

    get last_level() {
        var k = String(Object.keys(this.levels).pop());
        return this.levels[k];
    }

    /** @param {Request} req @param {Response} res */
    async fetch_master(req, res) {
        if (!this.#master) {
            var default_bandwidth = 2000000;
            var variants = Object.values(this.levels).map((level, i) => {
                var codec = this.use_hevc ? "hevc" : "h264";
                var codec_profile = "main";
                var codec_level = this.use_hevc ? "3.1" : "4.1";
                var codecs_string = utils.get_hls_segment_codec_string(codec, codec_profile, codec_level);
                var bandwidth = (level.config.video_bitrate + level.config.audio_bitrate) * 1000;
                return new hls.types.Variant({
                    uri: `${level.name}/stream.m3u8`,
                    bandwidth: bandwidth,
                    resolution: {
                        width: level.width,
                        height: level.height,
                    },
                    codecs: codecs_string,
                });
            });
            var obj = new hls.types.MasterPlaylist({
                version: HLS_EXT_VERSION,
                variants,
            })

            // Find the index closest to default_bandwidth
            let closestIndex = variants.reduce((closest, lvl, i) => {
                let diff = Math.abs(lvl.bandwidth - default_bandwidth);
                return diff < Math.abs(variants[closest].bandwidth - default_bandwidth) ? i : closest;
            }, 0);

            // Move the closest level to the start of the array
            variants.unshift(...variants.splice(closestIndex, 1));
            this.#master = hls.stringify(obj);
        }

        res.header("content-type", "application/vnd.apple.mpegurl");
        res.send(this.#master);

        return true;
    }

    /** @param {Request} req @param {Response} res */
    async fetch_playlist(req, res) {
        var { id, v } = req.params;
        var vod_path = path.join(this.dir, v, `vod.m3u8`);
        if (req.query.vod || !this.$.is_live) {
            let str = await fs.promises.readFile(vod_path, "utf8").catch(utils.noop);
            if (!str) return false;
            res.header("content-type", "application/vnd.apple.mpegurl");
            res.send(str+`\n#EXT-X-ENDLIST`);
            return true;
        } else {
            if (this.levels[v]) {
                return await this.levels[v].fetch_playlist(req, res);
            }
        }
    }

    update(data) {
        Object.assign(this.$, data);
    }

    async _start(settings) {
        Object.assign(this.$.settings, utils.json_copy(settings));

        this.generate_levels();

        this.$.segments = Object.fromEntries(Object.keys(this.levels).map((k) => [k, -1]));

        this.$.is_live = true;
        this.$.hls_list_size = globals.app.conf["media-server.hls_list_size"];
        this.$.hls_live_window = globals.app.conf["media-server.hls_live_window"];
        this.$.segment_duration = +globals.app.conf["media-server.hls_segment_duration"];

        this.use_hardware = this.$.settings.opts.use_hardware && globals.app.conf["media-server.allow_hardware"];
        this.use_hevc = this.$.settings.opts.use_hevc && globals.app.conf["media-server.allow_hevc"];

        this.ffmpeg = new FFMPEGWrapper({ log_filename: path.join(globals.app.logs_dir, `ffmpeg-live-${this.id}-${utils.date_to_string()}.log`) });

        var last_s;
        var last_level = this.last_level;
        last_level.on("update", () => {
            var s = Math.floor(this.$.segments[last_level.name] * this.$.segment_duration * 1000 / THUMBNAIL_INTERVAL);
            if (s != last_s) this.create_thumbnail();
            last_s = s;
        });

        console.info(`Starting LIVE [${this.id}]...`);

        let ffmpeg_args = [
            "-strict", "experimental"
        ];

        let hwaccel = this.use_hardware ? globals.app.conf["core.ffmpeg_hwaccel"] : null;
        let hwenc = this.use_hardware ? globals.app.conf["core.ffmpeg_hwenc"] : null;
        let hwdec = false; // whether all frames should start on gpu. With multiple mpv inputs there is an issue with sub-formats causing fuck ups, setting false fixes this by decoding by cpu but still allowing scaling and encoding with gpu
        hwdec = true;

        // hwaccel = null;
        // hwenc = null;

        // when we take the input from mpv and the format is changing slightly (which happens with multiple encoding instances being stitched together and being copied whole-sale) then we run into an issue here, so instead we must decode with cpu, but we can scale with gpu later by explicitly uploading to gpu with format=nv12,hwupload
        if (hwdec && hwaccel) {
            ffmpeg_args.push(
                "-hwaccel", hwaccel,
                "-hwaccel_output_format", hwaccel,
                // `-extra_hw_frames`, `10` // fucks up
            );
        }

        /* if (hwaccel) {
            ffmpeg_args.push(
                "-hwaccel", hwaccel,
                "-hwaccel_output_format", hwaccel,
                // "-hwaccel_device", utils.is_windows() ? "0" : "/dev/dri/renderD128"
            );
        } */

        // var fps = this.$.settings.opts.fps_passthrough ? 0 : this.$.settings.fps ?? 0;
        var fps = this.$.settings.fps;
        // if (hwenc) fps = 60; // VERY ANNOYING, but a builtin limitation of nvenc (and it looks like VAAPI too) is rate control with variable frame rate is not possible. it will take the container fps and that's that. If it varies, so will the bitrate... potentially massively, so we must fix it.

        // without nvenc frame times are not working, 23.976fps still looks like garbage. Forcing 60fps.
        // fps = 60;

        var keyint = globals.app.conf["media-server.keyframe_interval"] || globals.app.conf["media-server.hls_segment_duration"] || 2;
        var use_hevc = this.use_hevc;


        // /** @type {net.Socket} */
        // var socket = await new Promise(resolve=>{
        //     var socket = net.createConnection(this.$.settings.input, ()=>{
        //         resolve(socket);
        //     });
        // });

        ffmpeg_args.push(
            // '-probesize', '32',           // Minimal initial analysis
            // '-analyzeduration', '0',      // No buffering delay
            // '-flags', 'low_delay',
            // `-use_wallclock_as_timestamps`, `1`,
            // `-re`, // if enabled, whenever there is speedup live stream will be way behind.
            // `-noautoscale`,
            // `-ignore_unknown`,
            "-fflags", "+genpts+igndts", // +discardcorrupt +autobsf
            // `-copyts`, // necessary to read the overall pts of the stream...
            `-avoid_negative_ts`, `make_zero`,
            // `-flush_packets`, `1`,
            // ...(fps ? [`-r`, `${fps || constants.DEFAULT_FPS}`] : []), // this is fucked with passthrough.
            "-f", this.$.settings.input_format,
            "-i", this.$.settings.input,
            // "-i", "pipe:0",
            `-ar`, `44100`,
            `-ac`, `2`,
            `-bsf:v`, [
                use_hevc ? `hevc_mp4toannexb` : `h264_mp4toannexb`,
                // `h264_metadata=sample_aspect_ratio=1/1:aud=insert` // forces SAR = 1 but then leads to inconsistent DARs
            ].join(","),
            `-bsf:a`, `aac_adtstoasc`,
            `-g`, `${(fps || constants.DEFAULT_FPS) * keyint}`,
            `-force_key_frames`, `expr:gte(t,n_forced*${keyint})`, // keyframe every 2 seconds, this takes precedence over -g but apparently isn not working for some reason (vfr related)

            // "-r", fps,
            "-fps_mode", fps ? "cfr" : "vfr",
        );
        if (fps) {
            ffmpeg_args.push(`-r`, `${fps}`);
        } else {
            ffmpeg_args.push(`-enc_time_base`, `1/90000`);
        }

        var encoder = use_hevc ? `libx265` : `libx264`;
        if (hwenc) {
            encoder = `${use_hevc ? "hevc" : "h264"}_${hwenc}`;
            ffmpeg_args.unshift(
                `-threads`, `${Object.values(this.levels).length}`
            );
        }

        ffmpeg_args.push(...utils.get_encoder_ffmpeg_args(encoder, "main", use_hevc ? "3.1" : "4.1"))

        let _vi = 0;
        let _ai = 0;
        let genvid = () => `v${++_vi}`;
        let genaid = () => `a${++_ai}`;

        let filter_complex = [];
        ffmpeg_args.push(`-aspect`, `${this.aspect_ratio.toFixed(6)}`);

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
        var levels = Object.values(this.levels);
        let vids = levels.map(c => genvid());
        let aids = levels.map(c => genaid());
        let filter_complex_v_init = [
            `split=${vids.length}${vids.map((vid) => `[${vid}]`).join("")}`
        ]
        if (!hwdec && hwenc) {
            let hwu = (hwaccel == "cuda") ? `hwupload_cuda` : `hwupload`;
            filter_complex_v_init.unshift(`format=nv12`, hwu) // converts all frames to GPU surfaces
        }
        let filter_complex_a_init = [
            `aresample=async=1:min_hard_comp=0.100000:first_pts=0`,
            `asplit=${aids.length}${aids.map((aid) => `[${aid}]`).join("")}`
        ];
        filter_complex.push(
            // setpts=PTS-STARTPTS,
            // asetpts=PTS-STARTPTS,
            `[${vid}]${filter_complex_v_init.join(",")}`,
            `[${aid}]${filter_complex_a_init.join(",")}`,
        );
        for (let i = 0; i < levels.length; i++) {
            let level = levels[i];
            let config = level.config;
            let vid = vids[i];
            let aid = aids[i];
            let graph = [];
            let s = `${level.width}:${level.height}`;
            if (hwaccel) graph.push(`scale_${hwaccel}=${s}`);
            else graph.push(`scale=${s}`);

            if (hwaccel && !hwenc) {
                graph.push(`hwdownload`, `format=yuv420p`);
                vid = tmp;
            }
            if (graph.length) {
                let tmp = genvid();
                filter_complex.push(`[${vid}]${graph.join(",")}[${tmp}]`);
                vid = tmp;
            }
            ffmpeg_args.push("-map", `[${vid}]`);
            ffmpeg_args.push(
                `-c:v:${i}`, encoder,
                `-b:v:${i}`, `${config.video_bitrate}k`,
                // `-minrate:v:${i}`, `${c.video_bitrate}k`,
                `-maxrate:v:${i}`, `${config.video_bitrate}k`,
                `-bufsize:v:${i}`, `${config.video_bitrate}k`,
            );
            ffmpeg_args.push("-map", `[${aid}]`);
            ffmpeg_args.push(`-c:a:${i}`, "aac");
            ffmpeg_args.push(`-b:a:${i}`, `${config.audio_bitrate}k`);
        }
        ffmpeg_args.push("-filter_complex", filter_complex.join(";"));
        // var fix_name = /** @param {string} s */(s)=>s.trim().replace(/\s+/g, "-").toLowerCase();
        ffmpeg_args.push(
            `-var_stream_map`, levels.map((c, i) => `v:${i},a:${i},name:${encodeURIComponent(c.name)}`).join(" "),
            `-hls_list_size`, this.$.hls_list_size,
            `-hls_segment_filename`, `%v/%03d.${use_hevc ? "m4s" : "ts"}`,
            // `-hls_playlist_type`, `event`,
            `-threads`, `0`,
            `-f`, `hls`,
            `-hls_segment_type`, use_hevc ? `fmp4` : `mpegts`,
            // `-hls_init_time`, `1`,
            `-hls_time`, `${this.$.segment_duration}`,
            `-hls_flags`, `independent_segments+append_list+program_date_time`, // +discont_start // +split_by_time
            `-master_pl_name`, `master.m3u8`,
            `-y`, `%v/stream.m3u8`
        );

        this.logger.info(`ffmpeg command:\n ffmpeg ${ffmpeg_args.join(" ")}`);

        for (var l of levels) {
            l.start();
        }

        this.ffmpeg.start(ffmpeg_args, { cwd: this.dir })
            .catch((e) => {
                this.logger.error(new Error(`Live [${this.id}] ffmpeg error: ${e.message}`));
            })
            .then(() => {
                // if (!this.destroyed) console.log("Live FFMPEG ended unexpectedly.");
                this.stop();
            })

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
        // await this.end();
        return super._stop();
    }

    async _destroy() {
        delete globals.app.lives[this.id];
        await fs.promises.rm(this.dir, { recursive: true }).catch(err => console.warn(err));
        this.logger.info(`${this} has been destroyed.`);
        this.logger.destroy();
        return super._destroy();
    }
}

export class LiveLevel extends events.EventEmitter {
    /** @type {hls.types.Segment[]} */
    #segments = [];
    #header = "";
    /** @type {Live} */
    #live;
    #stopped = false;
    // #ended = false;
    #started = false;
    #interval;
    /** @type {LiveLevelConfig} */
    #config = {};
    #segment_map = {};
    /** @type {Record<number, utils.Deferred>} */
    #msn_promises = {};
    get msn() {
        return this.#live.$.segments[this.name];
    }
    set msn(value) {
        this.#live.$.segments[this.name] = value
    }
    get config() { return this.#config; }
    get name() { return this.#config.name; }
    get width() { return Math.round(this.#live.aspect_ratio * this.#config.resolution / 2) * 2; }
    get height() { return Math.round(this.#config.resolution / 2) * 2; }

    /** @param {Live} live @param {LiveLevelConfig} config */
    constructor(live, config) {
        super();
        this.#config = config;
        this.#live = live;
        this.#live.levels[config.name] = this;

        this.dir = path.join(this.#live.dir, config.name);
        fs.mkdirSync(this.dir, { recursive: true }) // just incase...
        this.live_filename = path.join(this.dir, "stream.m3u8");
        this.filename = path.join(this.dir, "vod.m3u8");
    }

    start() {
        if (this.#started) return;
        this.#started = true;
        var last_mtime;
        var updating = false;
        this.#interval = setInterval(async () => {
            if (updating) return;
            var stat = await fs.promises.stat(this.live_filename).catch(utils.noop);
            if (stat && stat.mtime != last_mtime) {
                last_mtime = stat.mtime;
                updating = true;
                this.update().finally(() => updating = false);
            }
        }, 500);
    }

    get last_segment() {
        return this.#segments[this.#segments.length - 1];
    }
    get last_segment_filename() {
        var s = this.last_segment;
        return s ? s.uri : null;
    }

    /** @param {string} str */
    async #parse_segments(str) {
        /** @type {hls.types.MediaPlaylist} */
        var data = hls.parse(str);
        var new_obj = new hls.types.MediaPlaylist({
            version: HLS_EXT_VERSION,
            targetDuration: this.#live.$.segment_duration,
        });
        let stream_id = this.#live.$.settings?.stream_id;
        let ar;
        if (stream_id) {
            try { ar = globals.app.aspect_ratio_cache[stream_id]; } catch (e) { }
        }
        var new_segments = [];
        for (var segment of data.segments) {
            if (this.#segment_map[segment.uri]) continue;

            var uri_full = path.join(this.dir, segment.uri);
            if (ar) {
                segment.aspect_ratio = ar;
            }
            this.#segments.push(segment);
            this.#segment_map[segment.uri] = segment;
            new_segments.push(segment);
            var msn = ++this.msn;
            fs.promises.stat(uri_full)
                .catch(utils.noop)
                .then(stat => {
                    this.#live.$.size += stat?.size ?? 0;
                });
            this.#msn_promises[msn]?.resolve();
            delete this.#msn_promises[msn];
            this.emit(`segment.${msn}`);
        }
        if (!new_segments.length) return;
        
        new_obj.segments = new_segments;
        var header;
        var new_str = hls.stringify(new_obj, {
            segmentProcessor: (lines, start, end, segment, i) => {
                if (!header) {
                    header = lines.slice(0, start).join("\n");
                }
                if (segment.aspect_ratio) {
                    lines.splice(end - 1, 0, `#EXT-X-ASPECT:${segment.aspect_ratio.toFixed(6)}`);
                    end++;
                }
                segment.lines = lines.slice(start, end + 1).join("\n");
            }
        });
        this.#header = header;
        this.#live.emit("update");
        this.emit("update");
        var exists = await utils.file_exists(this.filename);
        if (exists) new_str = new_str.slice(header.length);
        await fs.promises.appendFile(this.filename, new_str, "utf8");
    }

    async update() {
        var str = await fs.promises.readFile(this.live_filename, "utf-8").catch(() => "");
        await this.#parse_segments(str);
    }

    async wait_for_segment(msn) {
        if (this.msn >= msn) return;
        if (!this.#msn_promises[msn]) this.#msn_promises[msn] = new utils.Deferred();
        return this.#msn_promises[msn].promise;
    }

    /** @param {Request} req @param {Response} res */
    async fetch_playlist(req, res) {
        res.header("Content-type", "application/vnd.apple.mpegurl");
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.header("Connection", "keep-alive");
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');
        req.setTimeout(0);        // No request timeout
        req.socket.setTimeout(0); // No socket timeout

        let { _HLS_msn, _HLS_skip, full } = req.query;
        const hasMSN = _HLS_msn !== undefined;
        const msn = hasMSN ? Math.max(0, Number(_HLS_msn)) : 0;
        const wantSkip = (_HLS_skip || "").toUpperCase() === "YES";

        // Block until requested msn exists (if provided) unless we've stopped.
        if (hasMSN && !this.#segments[msn] && !this.#stopped) {
            await this.wait_for_segment(msn);
        }

        // Config
        let segment_duration = this.#live.$.segment_duration;
        let min_segments = this.#live.$.hls_list_size;
        let total_segments = this.#segments.length;
        let dvr_duration = full ? total_segments * segment_duration : this.#live.$.hls_live_window;
        let max_segments = Math.max(min_segments, Math.ceil(dvr_duration / segment_duration));
        let start = Math.max(0, total_segments - max_segments);
        let end = total_segments - 1;

        const obj = new hls.types.MediaPlaylist({
            version: HLS_EXT_VERSION,
            targetDuration: this.#live.$.segment_duration,
            mediaSequenceBase: start,
        });
        obj.lowLatencyCompatibility = {
            canBlockReload: true,
            canSkipUntil: this.#live.$.hls_list_size * segment_duration,
        }
        let skipped_segments = 0;
        if (wantSkip) {
            skipped_segments = utils.clamp(end + 1 - min_segments, 0, (max_segments - min_segments));
            obj.skip = skipped_segments
        }
        let recent_segments = this.#segments.slice(start + skipped_segments, end + 1);
        res.send(hls.stringify(obj) + "\n" + recent_segments.map(s => s.lines).join("\n"));
        return true;
    }

    /* async end() {
        if (this.#ended) return;
        this.#ended = true;
        await this.#append(`#EXT-X-ENDLIST\n`);
    } */

    async stop() {
        if (this.#stopped) return;
        this.#stopped = true;
        clearInterval(this.#interval);
        await this.update();
    }
}