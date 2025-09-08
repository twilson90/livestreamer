import fs from "node:fs";
import path from "node:path";
import stream from "node:stream";
import readline from "node:readline";
import child_process from "node:child_process";
import { MpegTsDemuxer } from "mpegts-demuxer";
import { globals, MPVEDL, MPVEDLEntry, FilterContext, ass } from "./exports.js";
import { utils, MPVWrapper, DataNode, DataNode$, Logger, FFMPEGWrapper, constants, BridgeTransform, MPVLoadFileError, MpegTsDemuxerPassThrough, StreamServer } from "../core/exports.js";
import { get_default_stream, get_stream_by_id, get_auto_background_mode, codec_to_ext } from "./shared.js";


/** @import { InternalSession, SessionStream, PlaylistItem$, MediaInfo, PlaylistItemProps, MediaInfoStream, MediaInfoStreamType, FilterInput, Filter, PlaylistItemPropsProps, ClipOpts } from './exports.js' */
/** @typedef {MediaInfoStream & {id:number, type_id:number, secondary:boolean}} MediaInfoStreamEx */
/** @typedef {{type:MediaInfoStreamType, start:number, end:number, duration:number, offset:number, loops:number, secondary:boolean, name:string}} RegisterFileOpts */
/** @typedef {RegisterFileOpts & {filename:string, original_filename:string, streams:MediaInfoStreamEx[], type:MediaInfoStreamType}} RegisterFileResult */


// const FORCE_NEXT_ITEM_TIMEOUT = 5 * 1000;
// const FORCE_NEXT_ITEM_TIMEOUT = Number.MAX_SAFE_INTEGER;
// const FORCE_ABORT_TIMEOUT = 10 * 1000;
/** @type {MediaInfoStreamType[]} */
const MEDIA_INFO_STREAM_TYPES = ["video", "audio", "subtitle"];
const EDL_TRACK_TYPES = ["video", "audio", "sub"];
// const DEFAULT_WIDTH = 1280;
// const DEFAULT_HEIGHT = 720;
const NULL_STREAM_DURATION = 60;
const NULL_STREAM_FPS = constants.DEFAULT_FPS;
/** @type {Map<string,Promise<string>>} */
const CACHE = new Map();
const KEYFRAMES_PER_SECOND = 2;
const AUDIO_SAMPLERATE = 44100;
const VF_FORMAT = "colorspace=all=bt709:iall=bt709:format=yuv420p:fast=1";
const H264_PROFILE = "main";
const H264_LEVEL = "4.1";

const MULTIPLE_MPV_INSTANCES = true;
const MPV_OUTPUT_RAW = false; // we can't trust mpv to output the EXACT same format all the time because it's shit, which confuses the ffmpeg vaapi encoder and causes it to end.
// Also I've now discovered playing complex edls now has a tendency to corrupt the output stream, cuasing the flv media server to buffer tons. Maybe a bug with node-media-server, who the fuck knows.

export const MPV_FORMAT = "matroska"; // flv matroska mpegts nut
export const OUTPUT_FORMAT = "mpegts";

/* const MPV_LOCAL_FILE_OPTIONS = {
    "start": 1,
    "end": 1,
    "interpolation": 1,
    "deinterlace": 1,
    // "video-aspect-override": 1,
    "audio-delay": 1,
    "sub-delay": 1,
    "sub-scale": 1,
    "sub-pos": 1,
    "loop-file": 1,
    "audio-pitch-correction": 1,
    "lavfi-complex": 1,
    "speed": 1,
    "secondary-sid": 1,
    "vid": 1,
    "aid": 1,
    "sid": 1,
    "pause": 1,
    "brightness": 1,
    "contrast": 1,
    "saturation": 1,
    "gamma": 1,
    "hue": 1,
} */

const default_parse_item_opts = {
    offset: 0,
    duration: 0,
    media_type: null,
    root: undefined,
    /** @type {ClipOpts} */
    clipping: undefined,
};

const default_load_file_opts = {
    reload_props: true,
    pause: false,
    start: 0,
};

/** @typedef {typeof default_load_file_opts} LoadFileOpts */


/** @typedef {typeof default_parse_item_opts} ParseItemOpts */

export class InternalSessionPlayer$ extends DataNode$ {
    item = {};
    seeking = false;
    internal_seeking = false;
    loaded = false;
    playing = false;
    seekable = true;
    paused = false;
    time_pos = 0;
    duration = 0;
    playback_speed = 1;
    current_fps = 0;
    bitrate = 0;
    deinterlacing = false;
    interpolation = false;
    video_bitrate = 0;
    audio_bitrate = 0;
    avsync = 0;
    aspect_ratio = 0;
}

const ytdl_cache = new utils.SimpleCache(1000 * 60 * 60);

/** @typedef {Awaited<ReturnType<InternalSessionPlayer["parse_item"]>>} ParsedItem */

/* this.#mpv_info = await get_mpv_info();

let mpv_args = [];
for (var arg of args) {
    if (!arg) continue;
    let m = arg.match(/^--([^=]+)/);
    if (!m) {
        mpv_args.push(arg);
        continue;
    }
    let prop = m[1]
    if (this.#mpv_info.allowed_args[prop]) mpv_args.push(arg);
    else this.logger.error("Bad mpv arg:", prop);
} */

let observed_mpv_props = {
    // ["time-pos"]: 0,
    // ["duration"]: 0,
    // ["mute"]: false,
    // ["pause"]: false,
    // ["deinterlace"]: false,
    // ["interpolation"]: false,
    // ["file-format"]: null,
    // ["track-list"]: [],
    // ["aid"]: null,
    // ["vid"]: null,
    // ["sid"]: null,
    // ["af"]: [],
    // ["vf"]: [],
    // ["seekable"]: null, // if false actually means source is live (e.g. youtube live-stream)
    // ["demuxer-via-network"]: false,
    // ["cache"]: false,
    // ["cache-buffering-state"]: 0,
    // ["stream-open-filename"]: "",
    // ["stream-path"]: "",
    ["avsync"]: 0,
    ["paused-for-cache"]: false,
    // ["audio-pts"]: 0,
    ["video-bitrate"]: 0,
    ["audio-bitrate"]: 0,
};

/** @extends {DataNode<InternalSessionPlayer$>} */
export class InternalSessionPlayer extends DataNode {
    /** @type {InternalSessionMPV} */
    #mpv;
    /** @type {SessionStream} */
    #stream;
    #out;
    // #meta_observer = new utils.Observer();
    #timer = new utils.StopWatchHR();
    /** @type {ParsedItem} */
    parsed_item = {};
    #paused = false;
    #loads = 0;
    fading = 0; // the time to fade out, also indicates if there was just a fade.
    pts = 0;
    dts = 0;
    fps = 0;
    current_aspect_ratio = 0;

    get stream() { return this.#stream; }
    /** @type {InternalSession} */
    get session() { return this.#stream.session; }
    get duration() { return this.$.duration; }
    get time_pos() { return this.$.time_pos; }
    get paused() { return this.$.paused; }
    get parsed_filename() { return this.parsed_item.filename; }
    get width() { return this.#stream.width; }
    get height() { return this.#stream.height; }
    get aspect_ratio() { return this.#stream.aspect_ratio; }
    get timer() { return this.#timer; }
    get out() { return this.#out; }

    /** @param {SessionStream} _stream */
    constructor(_stream) {
        super(new InternalSessionPlayer$());

        this.#stream = _stream;
        this.#stream.$.player = this.$;
        this.logger = new Logger("player");
        this.#out = new stream.PassThrough();

        // stream.promises.pipeline(this.#in, demuxer).catch(utils.pipe_error_handler(this.logger, "InternalSessionPlayer.in -> demuxer"))
        // stream.promises.pipeline(this.#in, this.#out).catch(utils.pipe_error_handler(this.logger, "InternalSessionPlayer.in -> InternalSessionPlayer.out"));
    }

    tick() {
        this.$.pts = this.pts;
        this.$.fps = this.fps;
        this.$.aspect_ratio = this.current_aspect_ratio;
        this.#mpv?.tick();
    }

    /** @param {PlaylistItem$} item @param {LoadFileOpts} opts */
    async loadfile(item, opts) {

        this.$.loaded = false;
        var curr_load_id = ++this.#loads;

        opts = {
            ...default_load_file_opts,
            ...opts,
        };

        item = utils.json_copy(item);
        // reload_props
        if (!opts.reload_props) item.props = { ...item.props, ...this.parsed_item.props };
        if (this.fading) {
            item.props.fade_in = this.session.$.fade_in_speed;
            this.fading = 0;
        }

        let start = +(opts.start || 0);

        let parsed_item = this.parsed_item = await this.parse_item(item, {
            start,
        });
        if (curr_load_id != this.#loads) return;

        let { duration, is_unknown_duration } = parsed_item;

        this.logger.info("loading file:", parsed_item.filename);

        if (!is_unknown_duration && !duration) {
            this.logger.warn(`Duration is 0, skipping '${item.filename}'...`);
            return;
        }

        if (!this.#mpv || MULTIPLE_MPV_INSTANCES) {
            if (this.#mpv) {
                this.#mpv.destroy();
                await this.#mpv.done;
            }
            if (curr_load_id != this.#loads) return;
            this.#mpv = new InternalSessionMPV(this, MULTIPLE_MPV_INSTANCES ? parsed_item : null);
            this.#mpv.start();
        }

        if (opts.pause) this.pause();
        else this.resume();

        return this.#mpv.loadfile(parsed_item)
            .then(() => {
                this.$.item = utils.json_copy(parsed_item);
                this.$.duration = parsed_item.duration;
                this.$.seekable = parsed_item.seekable;
                this.$.loaded = true;
                globals.app.ipc.emit("main.session-player.loadfile", {
                    session_id: this.session.id,
                    playlist_item_id: parsed_item.id,
                });
                return true;
            })
            .catch(e => {
                if (e instanceof MPVLoadFileError) {
                    this.$.item = {};
                    this.$.duration = 0;
                    this.$.seekable = false;
                    this.$.loaded = true;
                    if (e.type == "override") {
                        this.logger.warn(`File load override.`)
                        return false;
                    }
                    if (e.type == "ended") {
                        this.logger.warn(`Invalid media, skipping momentarily...`); // this is done when we get eof-reached.
                    }
                    return true;
                }
                this.logger.warn(`loadfile failed: ${e.message}`);
            })
            .then((wait_for_end) => {
                if (!wait_for_end) return;
                return new Promise((resolve) => {
                    var resolve_wrapper = () => {
                        resolve();
                        this.#mpv.off("idle", resolve_wrapper);
                        this.#mpv.off("eof-reached", resolve_wrapper);
                    };
                    this.#mpv.on("idle", resolve_wrapper);
                    this.#mpv.on("eof-reached", resolve_wrapper);
                    this.#mpv.done.then(resolve_wrapper);
                });
            })
    }

    pause() {
        this.#timer.pause();
        this.$.paused = true;
        this.#paused = true;
        this.#mpv?.set_property("pause", true);
    }

    resume() {
        this.#timer.resume();
        this.$.paused = false;
        this.#paused = false;
        this.#mpv?.set_property("pause", false);
    }

    /** @param {PlaylistItem$} _item @param {ParseItemOpts} opts */
    async parse_item(_item, opts) {

        let t0 = Date.now();
        if (typeof _item !== "object" || _item === null) _item = { filename: _item || null };
        let item = this.session.evaluate_playlist_item(_item);

        opts = {
            ...default_parse_item_opts,
            ...opts,
        };

        let media_info = await this.session.update_media_info(item.filename, { silent: true });

        if (!item.fades) item.fades = [];
        let { filename, id, props } = item;
        let original_filename = filename;
        let { offset, duration, media_type, loop, root, clipping } = opts;
        duration = duration || props.duration || 0;
        if (props.clip_start || props.clip_end || props.clip_offset || props.clip_loops != 1) {
            clipping = {
                start: props.clip_start || 0,
                end: props.clip_end || 0,
                offset: props.clip_offset || 0,
                loops: props.clip_loops || 1,
            }
        }
        let is_clipped = !!(clipping?.duration || clipping?.end || clipping?.start || clipping?.offset || clipping?.loops);

        if (is_clipped) {
            clipping.start = clipping.start ?? 0;
            clipping.end = clipping.end ?? media_info.duration;
        }

        let map = new StreamMap();
        let is_empty = filename === "livestreamer://empty";
        let is_playlist = this.session.is_item_playlist(item.id);

        let is_video = !!media_info.streams?.find((s) => s.type == "video" && !s.albumart)
        let is_image = !!(media_info.streams?.filter((s) => s.type == "video").length && media_info.duration <= 0.04); // weird way of doing it but I guess it works.
        let has_artwork = media_info.streams?.filter(s => s.type == "video" && s.albumart).length > 0;
        let is_audio = !!(media_info.streams?.find(s => s.type == "audio") && media_info.streams?.filter(s => s.type == "video" && !s.albumart).length == 0);
        let albumart_file;

        if (is_audio) {
            if (has_artwork) {
                let res = await separate_albumart_from_audio_file(original_filename).catch((e) => {
                    this.logger.error(new Error(`Failed to extract albumart: ${e.message}`));
                });
                map.register_stream({ type: "audio" }, true);
                if (res) {
                    [filename, albumart_file] = res;
                }
            }
        }

        // if (is_image) media_type = "video"
        // if (is_audio) media_type = "audio";

        let background_color = (root && root.props && root.props.background_color) || props.background_color || this.session.$.background_color || "#000000";
        /** @type {PlaylistItem$[]} */
        let children = [];

        root = root || item;
        let is_root = (root === item);
        let media_duration = media_info.duration || (is_empty ? NULL_STREAM_DURATION : 0);
        let background_mode_default = this.session.$.background_mode || "logo";
        let background_mode = props.background_mode;
        if (background_mode == "auto") background_mode = get_auto_background_mode(item, media_info);
        if (background_mode == "default") background_mode = background_mode_default;

        if ((filename || "").startsWith("livestreamer://")) {
            let ls_path = new URL(filename).host;
            filename = "null://";
            if (ls_path == "intertitle") {
                let ass_str = ass.create(undefined, [{
                    font: props.title_font || "Arial",
                    size: props.title_size || 20,
                    color: props.title_color || "#ffffff",
                    outline_color: props.title_outline_color || "#000000",
                    shadow_color: props.title_shadow_color || "#000000",
                    bold: (props.title_style || "").match("bold") ? 1 : 0,
                    italic: (props.title_style || "").match("italic") ? 1 : 0,
                    spacing: props.title_spacing,
                    outline_thickness: props.title_outline_thickness,
                    shadow_depth: props.title_shadow_depth,
                    alignment: props.title_alignment,
                    underline: props.title_underline ? 1 : 0,
                    margin: props.title_margin,
                }], [{
                    start: 0.25 * 1000,
                    end: (Math.max(0, (duration || Number.MAX_SAFE_INTEGER) - 0.5)) * 1000,
                    text: ass.fade(props.fade_in || 0, props.fade_out || 0) + (ass.rotate(...(Array.from(props.title_rotation) || [0, 0, 0]))) + ass.text(props.title_text),
                }]);
                filename = await get_ass_subtitle_as_path(ass_str);
                map.register_stream({ type: "subtitle" }, true);
            } else if (ls_path == "rtmp") {
                filename = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}/session/${this.session.$.id}`;
            }
        }
        if (media_info.virtual_filename) {
            filename = media_info.virtual_filename;
        }

        if (is_image) {
            // let title = `Image (${path.basename(filename)})`;
            filename = await globals.app.generate_media({
                type: "video",
                duration: NULL_STREAM_DURATION,
                width: this.width,
                height: this.height,
                background: background_color,
                fps: NULL_STREAM_FPS,
                filename,
            });
            media_duration = NULL_STREAM_DURATION;
            if (duration != media_duration) {
                let edl = new MPVEDL(MPVEDL.clip(filename, { end: media_duration, duration }));
                filename = edl.toString();
                media_duration = duration;
            }
        }

        let is_rtmp = !!filename.match(/^rtmps?:/);
        if (is_rtmp) {
            map.register_stream({ type: "video", title: "RTMP Video" }, true);
            map.register_stream({ type: "audio", title: "RTMP Audio" }, true);
        }

        if (media_info.ytdl) {
            filename = await this.youtube_url_to_edl(filename);
        }

        let is_unknown_duration = !duration && !media_info.duration && !is_playlist;
        duration = duration || media_duration;

        if (is_playlist && (props.playlist_mode || !is_root)) {

            let is_2track = props.playlist_mode == 2;
            let edl = new MPVEDL();
            let tracks = [];
            let playlist_tracks = this.session.get_playlist_tracks(id);
            let duration_override = false;

            /** @param {PlaylistItem[]} items @param {string} type */
            var parse_track = async (items, type) => {
                let entries = [];
                let duration = 0;
                let o = offset;
                for (let item of items) {
                    if (item.filename == "livestreamer://exit") {
                        if (duration_override === false) duration_override = duration;
                        else duration_override = Math.min(duration_override, duration);
                    }
                    let tmp = await this.parse_item(item, { offset: o, media_type: type, root });
                    children.push(tmp);

                    duration += tmp.duration;
                    o += tmp.duration;

                    if (tmp.duration > 0) {
                        entries.push(new MPVEDLEntry(tmp.parsed_filename, {
                            length: tmp.duration.toFixed(3)
                        }));
                    }
                }
                return { entries, duration, type }
            };

            for (var i = 0; i < playlist_tracks.length; i++) {
                tracks.push(await parse_track(playlist_tracks[i], is_2track ? EDL_TRACK_TYPES[i] : null));
            }

            let min_duration = Math.min(...tracks.map((t) => t.duration));
            let max_duration = Math.max(...tracks.map((t) => t.duration));
            if (duration_override) {
                duration = duration_override;
            } else if (props.playlist_end_on_shortest_track) {
                duration = min_duration;
            } else {
                duration = max_duration;
            }

            offset += duration;

            for (let track of tracks) {
                let pad_duration = Math.max(0, duration - track.duration);
                if (is_2track) {
                    if (pad_duration > 0.04) {
                        if (track.type == "audio" && props.playlist_revert_to_video_track_audio) {
                            // if audio track is longer than video track, revert to video track after audio track ends
                            let video_track = await parse_track(playlist_tracks[0], "audio")
                            let tmp = new MPVEDL(video_track.entries);
                            track.entries.push(new MPVEDLEntry(tmp, {
                                start: (track.duration).toFixed(3),
                                length: pad_duration.toFixed(3)
                            }));
                        } else {
                            // add padding to track if necessary
                            let tmp = await this.parse_item(null, { duration: pad_duration, media_type: track.type, offset, root });
                            if (tmp.duration) {
                                // track.entries.push(new MPVEDLEntry("C:\\Users\\hedge\\Downloads\\na.wav", {length: "60.000"}));
                                // if (tmp.edl) track.entries.push(...tmp.edl.entries);
                                track.entries.push(new MPVEDLEntry(tmp.parsed_filename, {
                                    length: pad_duration.toFixed(3)
                                }));
                            }
                        }
                    }
                }
                if (track.entries.length && track.type) {
                    edl.append("!new_stream");
                    edl.append(new MPVEDLEntry("!delay_open", { media_type: edl_track_type(track.type) }));
                }
                edl.append(...track.entries);
            }
            filename = edl.toString();
            map.register_stream({ type: "video", title: "EDL Video" }, true);
            map.register_stream({ type: "audio", title: "EDL Audio" }, true);

        }
        
        if (media_type || !is_root) {

            let needs_video = !media_type || media_type == "video";
            let needs_audio = !media_type || media_type == "audio";
            let needs_subtitle = media_type == "subtitle";
            let has_video = media_info.streams?.find(s=>s.type == "video" && !s.albumart);
            let has_audio = media_info.streams?.find(s=>s.type == "audio");
            let has_subtitle = media_info.streams?.find(s=>s.type == "subtitle");

            let media_type_mismatch = (needs_audio != has_audio || needs_video != has_video || (needs_subtitle && !has_subtitle));

            if (media_type_mismatch || media_type) {
                let edl = new MPVEDL();
                
                if (media_info.exists) {
                    edl.append("!new_stream", "!no_chapters");
                    if (media_type) {
                        map.register_stream({ type: media_type, title: utils.capitalize(media_type) }, true);
                        edl.append(new MPVEDLEntry("!delay_open", { media_type: edl_track_type(media_type) }));
                    } else {
                        map.register_default_media_streams(media_info.streams);
                    }
                    edl.append(new MPVEDLEntry(filename, {
                        length: media_duration.toFixed(3)
                    }));
                }

                let add_stream = (null_filename, type)=>{
                    edl.append(
                        "!new_stream", "!no_chapters",
                        new MPVEDLEntry("!delay_open", { media_type: edl_track_type(type) }),
                        ...MPVEDL.clip(null_filename, { end: NULL_STREAM_DURATION, duration })
                    );
                    map.register_stream({ type, title: "Nothing" }, true);
                }
                if (needs_video && !has_video) {
                    let null_filename = await globals.app.generate_media({
                        type: "video",
                        duration: NULL_STREAM_DURATION,
                        width: this.width,
                        height: this.height,
                        background: background_color,
                        fps: NULL_STREAM_FPS
                    });
                    add_stream(null_filename, "video");
                }
                if (needs_audio && !has_audio) {
                    let null_filename = await globals.app.generate_media({
                        type: "audio",
                        duration: NULL_STREAM_DURATION
                    });
                    add_stream(null_filename, "audio");
                }
                if (needs_subtitle && !has_subtitle) {
                    let null_filename = await globals.app.generate_media({
                        type: "subtitle",
                        duration: NULL_STREAM_DURATION
                    });
                    add_stream(null_filename, "subtitle");
                }

                filename = edl.toString();
            }
        } else {
            
            if (!map.streams.length) {
                map.register_default_media_streams(media_info.streams);
            }
        }

        map.calculate_auto_ids();

        if (is_root) {

            /** @param {string} filename @param {MediaInfoStreamType} type @param {ClipOpts} clipping */
            const add_file = async (filename, type, clipping) => {
                if (!clipping) clipping = {};
                var original_filename = filename;
                let name = original_filename ? path.basename(original_filename) : "None";
                if (!type) throw new Error("type is required");
                let tmp = (await this.parse_item({ filename }, {
                    media_type: type,
                    duration,
                    clipping,
                    root: {}, // <-- hack
                }));
                filename = tmp.parsed_filename;
                let streams = tmp.map.streams;

                await map.register_file({
                    filename,
                    original_filename,
                    streams,
                    name,
                    type
                });
            }

            if (background_mode == "embedded" && albumart_file) {
                await add_file(albumart_file, "video");
            }
            if (background_mode == "file") {
                await add_file(this.session.$.background_file, "video", { start: this.session.$.background_file_start, end: this.session.$.background_file_end, duration });
            }
            if (background_mode == "logo") {
                await add_file(path.resolve(globals.app.conf["main.logo_path"]), "video");
            }
            if (props.video_file) {
                await add_file(props.video_file, "video", { start: props.video_file_start, end: props.video_file_end, duration });
            }
            if (background_mode === "none" || !map.has("video")) {
                await add_file(null, "video");
            }
            if (props.audio_file) {
                await add_file(props.audio_file, "audio", { start: props.audio_file_start, end: props.audio_file_end, duration });
            }
            if (!map.has("audio")) {
                await add_file(null, "audio");
            }
            if (props.subtitle_file) {
                await add_file(props.subtitle_file, "subtitle");
            }

        } else {
            let fade_in = utils.round_precise(props.fade_in || 0, 3);
            if (fade_in > 0) {
                if (map.video.streams.length) root.fades.push(["v", "in", offset, fade_in])
                if (map.audio.streams.length) root.fades.push(["a", "in", offset, fade_in])
            }

            if (duration) {
                let fade_out = utils.round_precise(props.fade_out || 0, 3);
                if (fade_out > 0) {
                    if (map.video.streams.length) root.fades.push(["v", "out", offset + duration - fade_out, fade_out])
                    if (map.audio.streams.length) root.fades.push(["a", "out", offset + duration - fade_out, fade_out])
                }
            }
        }

        // if is root, we do not want to wrap in EDL if it doesn't exist, just ignore.
        if (is_clipped && media_info.exists) {
            let edl = new MPVEDL(MPVEDL.clip(filename, { ...clipping }));
            filename = edl.toString();
            duration = edl.duration;
        }

        if (is_unknown_duration) duration = 0;
        let seekable = !!duration;
        let internal_seekable = !is_rtmp;
        let t1 = Date.now();

        if (is_root) {
            this.logger.debug(`parse_item ${item.filename} took ${t1 - t0}ms`);
            let secondary_sid = (map.subtitle?.streams.find(s => s.secondary))?.type_id ?? false;
            props["secondary-sid"] = secondary_sid;
            if (!duration) props.loop_file = true;
            props.pause = !!opts.pause;
            let start = opts.start;
            if (!seekable) start = 0;
            if (start > 0) props.start = start;
            if (duration) props.end = duration;
        }

        return {
            ...item,
            parsed_filename: filename,
            props,
            duration,
            is_unknown_duration,
            media_info,
            background_color,
            seekable,
            internal_seekable,
            children,
            map,
        };
    }

    seek(time) {
        this.#mpv?.seek(time).catch(e => {
            this.logger.error(new Error(`Failed to seek to ${time}ms: ${e.message}`));
        });
    }

    set_property(key, value) {
        this.#mpv?.set_property(key, value);
    }

    update_volume() {
        this.#mpv?.update_volume();
    }

    async fade_out_in() {
        this.fading = this.#mpv.time;
        this.#mpv?.fade_out();
    }

    /** @param {string} url @returns {Promise<string>} */
    async youtube_url_to_edl(url) {
        if (!ytdl_cache.has(url)) ytdl_cache.set(url, globals.app.youtube_url_to_edl(url));
        return ytdl_cache.get(url);
    }

    async _destroy() {
        await this.#mpv.destroy();
        this.logger.destroy();
        return super._destroy();
    }
}

var mpv_id = 0;

class InternalSessionMPV extends MPVWrapper {
    /** @type {typeof PlaylistItemPropsProps} */
    #props = {};
    #props_hashed = {};
    #last_seek_time = 0;
    /** @type {InternalSessionPlayer} */
    #player;
    /** @type {ParsedItem} */
    #parsed_item;
    #preloaded = false;
    #playing = false;
    #seeking = false;
    #mpv_log_file;
    #mpv_props_on_load = {};
    #ticks = 0;
    #last_session_stream_fps = 0;
    #done;
    #id = 0;

    get loaded() { return this.#preloaded; }
    get session() { return this.#player.session; }
    get session_stream() { return this.#player.session.stream; }
    get parsed_item() { return this.#parsed_item; }
    get player() { return this.#player; }
    get done() { return this.#done; }

    /** @param {InternalSessionPlayer} player @param {ParsedItem} parsed_item */
    constructor(player, parsed_item) {
        super({ ipc: true });
        this.#id = ++mpv_id;
        this.#player = player;
        this.#parsed_item = parsed_item;
        this.#last_session_stream_fps = this.session_stream.$.fps;

        this.on("log-message", (log) => {
            // this.logger.debug(log.text);
            let text = `[${log.prefix}] ${log.text.trim()}`;
            if (log.prefix == "encode" && log.text.match(/Encoder was reinitialized; this is not allowed/)) {
                this.#player.stream.stop("encoder error");
            }
            if (globals.app.debug && log.prefix == "livestreamer" && log.level == "fatal") {
                throw new Error(text);
            } else if (log.level == "warn") {
                this.logger.warn(text);
            } else if (log.level == "error" || log.level == "fatal") {
                this.logger.error(text);
            }
        });
        this.on("seek", (e) => {
            if (this.destroyed) return;
            this.#player.$.internal_seeking = true;
        });
        this.on("playback-restart", (e) => {
            if (this.destroyed) return;
            this.#playing = true;
            this.#seeking = false;
            this.#player.$.internal_seeking = false;
            this.#player.$.seeking = false;
        });
        this.on("end-file", ({ reason }) => {
            if (this.destroyed) return;
            this.#playing = false;
        });
        this.on("property-change", async (e) => {
            if (this.destroyed) return;
            let { name, data } = e;
            this.#props[name] = data;
            this.#props_hashed[name] = JSON.stringify(data);
        });
    }

    async tick() {
        if (this.destroyed) return;

        /* if (this.#props.cache) {
            let new_ranges;
            let demuxer_cache_state = (await this.get_property("demuxer-cache-state").catch(()=>null));
            if (this.destroyed) return;
            if (demuxer_cache_state) {
                new_ranges = demuxer_cache_state["seekable-ranges"];
            }
            var new_hash = JSON.stringify(new_ranges);
            if (new_hash != this.#seekable_ranges_hash) {
                this.#seekable_ranges_hash = new_hash;
                this.#player.$.seekable_ranges = new_ranges || [];
            }
        } */

        this.#player.$.bitrate = this.#props["video-bitrate"] + this.#props["audio-bitrate"];
        this.#player.$.video_bitrate = this.#props["video-bitrate"];
        this.#player.$.audio_bitrate = this.#props["audio-bitrate"];
        this.#player.$.avsync = this.#props["avsync"];

        this.#update_time_pos();

        if (this.session_stream.$.fps != this.#last_session_stream_fps) {
            this.#last_session_stream_fps = this.session_stream.$.fps;
            this.rebuild_filters();
        }

        this.#ticks++;
    }

    start() {
        if (this.#done) throw new Error("mpv cannot be started twice.")
        this.#done = new Promise((resolve, reject) => {
            this.#props = utils.json_copy(observed_mpv_props);

            this.#mpv_log_file = path.join(globals.app.logs_dir, `mpv-${utils.date_to_string()}-${this.id}.log`);

            var mpv_args = [
                "--no-config",
                "--cache=no",
                `--demuxer-thread=no`,
                "--demuxer-readahead-secs=0.1",
                // "--demuxer-hysteresis-secs=0.1",
                // `--demuxer-max-bytes=1`,
                // `--demuxer-max-back-bytes=0`,
                // `--demuxer-lavf-probesize=32`,
                // `--demuxer-lavf-analyzeduration=0.1`,

                "--sub-font-size=66",
                `--sub-margin-x=50`,
                "--sub-margin-y=30",
                `--sub-blur=1`, // applies nice blur to outline/shadow
                // "--sub-use-margins=no",
                `--sub-fix-timing=yes`,
                // `--sub-ass-video-aspect-override=${4/3}`,
                // `--sub-ass-vsfilter-aspect-compat=no`, // fixes fucked up sub scaling on ass files for anamorphic vids (vids with embedded aspect ratio)
                `--autoload-files=no`,
                `--audio-display=no`, // IMPORTANT
                `--idle=${MULTIPLE_MPV_INSTANCES ? "once" : "yes"}`,

                // `--correct-pts=no`, // this fucks up too much, we can never use this.

                "--audio-buffer=0",
                // "--vd-lavc-threads=1",
                // `--demuxer-lavf-o-add=err_detect=ignore_err`,
                "--demuxer-lavf-o-add=fflags=+autobsf+flush_packets+genpts+igndts", // +nobuffer //+discardcorrupt
                "--demuxer-lavf-o-add=flush_packets=1",
                `--demuxer-lavf-o-add=avoid_negative_ts=make_non_negative`,
                // `--demuxer-lavf-o-add=copyts=1`,
                // `--demuxer-lavf-o-add=mpegts_copyts`,
                // "--demuxer-lavf-probe-info=nostreams",
                // "--demuxer-lavf-analyzeduration=0.1",
                // "--demuxer-lavf-buffersize=1024",
                // "--demuxer-readahead-secs=0.1",

                // `--vd-lavc-skiploopfilter=all`,
                // `--vd-lavc-skipidct=all`,
                // `--vd-lavc-show-all=yes`,
                // `--vd-lavc-fast=yes`,

                "--video-sync=audio",
                // `--hr-seek-framedrop=no`,
                // "--stream-buffer-size=1k",
                // "--stream-buffer-size=4096",
                // "--demuxer-max-bytes=1024",

                "--ytdl=no",
                `--script=${globals.app.resources.get_path("mpv_lua/livestreamer.lua")}`,
                "--quiet",
                `--log-file=${this.#mpv_log_file}`,
                `--audio-stream-silence=no`, // maybe fixes issue with silent segments in EDLs?
                // "--sub-use-margins=no", // new
                // "--image-subs-video-resolution=yes",
                "--audio-format=float",
                `--audio-samplerate=${AUDIO_SAMPLERATE}`,
                `--audio-channels=stereo`,
                "--ocopy-metadata=no",
                `--oset-metadata=title="livestreamer",comment="livestreamer"`,
                `--of=${MPV_FORMAT}`,
                `--o=-`,
            ];

            if (MPV_OUTPUT_RAW) {

                mpv_args.push(
                    `--ovc=rawvideo`,
                    `--oac=pcm_s16le`
                );

            } else {

                let fps = Math.min(60, this.#parsed_item?.media_info?.fps ?? constants.DEFAULT_FPS); // clamp it incase media info suggests some CRAZY value like 90000 as it once did...

                let x264_params = {
                    "nal-hrd": `cbr`, // VERY IMPORTANT, maintains constant bitrate
                    // "bframes": "0",
                    // "b-pyramid":"none",
                    // "sync-lookahead":"0",
                    // "force-cfr": `1`, // not necessary?
                    // "scenecut": `0`,
                    "keyint": Math.ceil(fps * KEYFRAMES_PER_SECOND),
                    "min-keyint": Math.ceil(fps * KEYFRAMES_PER_SECOND),
                    "cabac": 1,
                    "weightp": 1,
                    "scenecut": 0,
                    // "debug":"mb_type",
                    // "verbose":"1",
                };

                mpv_args.push(
                    "--ovc=libx264",
                    `--ovcopts-add=profile=${H264_PROFILE}`,
                    `--ovcopts-add=preset=${this.session_stream.$.h264_preset}`,
                    `--ovcopts-add=level=${H264_LEVEL}`,
                    `--ovcopts-add=b=${this.session_stream.$.video_bitrate}k`,
                    `--ovcopts-add=maxrate=${this.session_stream.$.video_bitrate}k`,
                    `--ovcopts-add=minrate=${Math.floor(this.session_stream.$.video_bitrate)}k`,
                    `--ovcopts-add=bufsize=${Math.floor(this.session_stream.$.video_bitrate)}k`, // *2
                    // `--ovcopts-add=bf=0`,
                    // `--ovcopts-add=tune=fastdecode`, // this reduces quality to big wet arses
                    // `--ovcopts-add=tune=zerolatency`, // <-- new
                    // `--ovcopts-add=strict=+experimental`,
                    ...(Object.keys(x264_params).length ? [`--ovcopts-add=x264-params=${Object.entries(x264_params).map(([k, v]) => `${k}=${v}`).join(":")}`] : []),
                    `--oac=aac`,
                    `--oacopts-add=b=${this.session_stream.$.audio_bitrate}k`,
                    // `--oacopts-add=aac_coder=twoloop`,
                    `--oacopts-add=profile=aac_low`,
                    `--oacopts-add=ar=${AUDIO_SAMPLERATE}`,
                    // `--oacopts=export_side_data=prft`,
                    // `--force-seekable=yes`, // important for generated media urls / piped input, don't support range requests
                    // `--ofopts-add=muxrate=${(this.session_stream.$.video_bitrate+this.session_stream.$.audio_bitrate)*1000}`,
                    // `--ofopts-add=preload=${100000}`, // 0.1 seconds

                    // none of this appears to do jack shit
                    // `--ofopts-add=strict=+experimental`,
                    // `--ofopts-add=fflags=+autobsf+flush_packets+genpts+igndts`, // +discardcorrupt
                    // `--ofopts-add=avoid_negative_ts=make_non_negative`,
                    // `--ofopts-add=flush_packets=1`,

                    // `--ofopts-add=err_detect=ignore_err`,
                    // `--ofopts-add=mpegts_copyts`,
                    // `--ofopts-add=mpegts_flags=+resend_headers+initial_discontinuity`,
                    // `--ofopts-add=muxrate=${this.session_stream.$.video_bitrate+this.session_stream.$.audio_bitrate}k`, // causes tons of 'mpegts: dts < pcr, TS is invalid'
                    // `--ofopts-add=pes_payload_size=0`,
                    // `--ofopts-add=output_ts_offset=${pts}`,
                    // `--ofopts-add=mpegts_flags=+initial_discontinuity+resend_headers`,
                );
            }

            if (this.session_stream.$.use_hardware && globals.app.conf["core.mpv_hwdec"]) {
                mpv_args.push(`--hwdec=${globals.app.conf["core.mpv_hwdec"]}-copy`);
                // mpv_args.push(`--correct-pts=no`); // files like billy joel get PTS errors and breaks encoder unless we disable correct-pts
            } else {
                mpv_args.push(`--hwdec=no`); // even though this is the default setting supposedly, without this it was leading to some weird format conversion error in MediaServerApp Live, presumably it was doing some hwdecoding stuff and as we copy the mpv output it was leading to some weirdness... ?
            }
            this.#player.logger.add(this.logger, (log) => ({ ...log, prefix: log.prefix.slice(1) }));

            super.start(mpv_args);

            this.ready = this.ipc_ready.then(async () => {

                this.request_log_messages("info");

                var features = this._features = await super.features();

                let vf_graph = [];
                if (features.libavfilters.drawtext) {
                    let font_path = globals.app.resources.get_path("fonts/RobotoMono-Regular.ttf");
                    vf_graph.push(
                        `drawtext=text='Invalid Media':fontfile='${utils.ffmpeg_escape(font_path)}':fontsize=20:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2`,
                    );
                }

                vf_graph.push(VF_FORMAT);
                vf_graph = vf_graph.map(make_lavfi_filter);

                this.#lua_message("init", [{
                    keep_open: MULTIPLE_MPV_INSTANCES,
                    default_vf: vf_graph,
                    fix_discontinuities: true, // this actually works brilliantly with the billy joel broken.mkv music video
                    width: this.#player.width,
                    height: this.#player.height,
                    fps: this.#player.stream.fps || constants.DEFAULT_FPS,
                    handle_load_fail: true,
                }]);

                for (var k in observed_mpv_props) {
                    this.observe_property(k);
                }
            });

            var stream_fixer = new StreamFixerTransform(this.player);
            var last_pts = this.player.pts;
            var last_dts = this.player.dts;

            var demuxer = new MpegTsDemuxerTransform();
            demuxer.on("pts", ({ pts, dts, fps }) => {
                var delta_pts = pts - last_pts;
                var delta_dts = dts - last_dts;
                this.#player.pts += Math.max(0, delta_pts);
                this.#player.dts += Math.max(0, delta_dts);
                this.#player.fps = fps;
                last_pts = pts;
                last_dts = dts;
            })

            var realtime = new RealTimeBufferTransform(this.player);

            stream.promises.pipeline(this.stdout, realtime, stream_fixer, demuxer, this.#player.out, { end: false }).catch(utils.pipe_error_handler(this.logger, "mpv.stdout -> player.in"))
                .catch(reject)
                .then(resolve);
        });
        return this.#done;
    }

    /** @param {ParsedItem} parsed_item */
    async loadfile(parsed_item) {

        this.#parsed_item = parsed_item;
        this.#preloaded = false;

        await this.ready;

        var on_load_commands = [];
        for (var f of this.#parsed_item.map.video.files) {
            on_load_commands.push(["video-add", f.filename, "select", f.name]);
        }
        for (var f of this.#parsed_item.map.subtitle.files) {
            on_load_commands.push(["sub-add", f.filename, f.secondary ? "auto" : "select", f.name]);
        }
        for (var f of this.#parsed_item.map.audio.files) {
            on_load_commands.push(["audio-add", f.filename, "select", f.name]);
        }

        this.#mpv_props_on_load = {};
        for (var k in this.#parsed_item.props) {
            this.set_property(k, this.#parsed_item.props[k]); // important to use force!
        }

        this.#rebuild_filters();
        this.#update_volume(true);
        this.#update_time_pos();

        this.#lua_message("setup_loadfile", [{
            commands: on_load_commands,
            props: this.#mpv_props_on_load,
        }]);

        this.#preloaded = true;

        return super.loadfile(this.#parsed_item.parsed_filename);
    }

    fade_out() {
        this.set_property("end", String(this.time + this.session.$.fade_out_speed + 0.5));
        this.#rebuild_filters();
    }

    async set_property(key, value, force = false) {
        force = !this.#preloaded || force;
        var hash = JSON.stringify(value);
        if (this.#props_hashed[key] === hash && !force) return;
        this.#props[key] = value;
        this.#props_hashed[key] = hash;
        let mpv_key = key, mpv_value = value;
        var reload, rebuild_filters, update_volume;

        switch (key) {
            case "color":
            case "label":
            case "duration":
            case "function":
            case "function_handover_session":
            case "title_color":
            case "title_alignment":
            case "title_style":
            case "title_text":
            case "title_font":
            case "title_margin":
            case "title_outline_color":
            case "title_outline_thickness":
            case "title_rotation":
            case "title_shadow_color":
            case "title_shadow_depth":
            case "title_size":
            case "title_spacing":
            case "title_underline":
                mpv_key = null;
                break;
            case "playlist_revert_to_video_track_audio":
            case "playlist_mode":
            case "playlist_end_on_shortest_track":
            case "background_color":
            case "background_mode":
            case "clip_end":
            case "clip_offset":
            case "clip_start":
            case "clip_loops":
            case "auto_interpolation_rate":
            case "interpolation_mode": // weird but subs disappear when interpolation is enabled, requires reload.
            case "fade_in":
            case "fade_out":
            case "video_file":
            case "video_file_end":
            case "video_file_start":
            case "audio_file":
            case "subtitle_file":
            case "vid_override": // get pts dts bollocks if we do this without restarting sometimes.
                mpv_key = null;
                reload = true;
                break;
            case "contrast":
            case "brightness":
            case "saturation":
            case "gamma":
            case "hue":
            case "deinterlace_mode":
            case "interpolation_mode":
            case "audio_delay":
            case "audio_channels":
            case "volume_normalization":
            case "crop":
            case "filters":
            case "pre_filters":
            case "aspect_ratio":
            case "aid_override":
            case "sid_override":
                mpv_key = null;
                rebuild_filters = true;
                break;
            case "volume_multiplier":
            case "volume_target":
                mpv_key = null;
                update_volume = true;
                break;
            case "start":
            case "end":
                mpv_value = String(value);
                break;
            case "sub_delay":
                mpv_key = "sub-delay";
                break;
            case "sub_scale":
                mpv_key = "sub-scale";
                break;
            case "sub_pos":
                mpv_key = "sub-pos";
                break;
            case "loop_file":
                mpv_key = "loop-file";
                mpv_value = value ? "inf" : false
                break;
            case "audio_pitch_correction":
                mpv_key = "audio-pitch-correction";
                break;
        }

        if (this.#preloaded) {
            if (reload) this.reload();
            if (rebuild_filters) this.rebuild_filters();
            if (update_volume) this.update_volume();
        }

        /* if (mpv_key in MPV_LOCAL_FILE_OPTIONS) {
            mpv_key = `file-local-options/${mpv_key}`;
        } */

        if (mpv_key) {
            if (this.#preloaded) {
                return super.set_property(mpv_key, mpv_value);
            } else {
                this.#mpv_props_on_load[mpv_key] = mpv_value;
            }
        }
    }

    reload = utils.debounce(() => this.#reload(), 10);
    rebuild_filters = utils.debounce(() => this.#rebuild_filters(), 10);
    update_volume = utils.debounce(() => this.#update_volume(), 10);

    #reload(remember_time_pos = true) {
        if (remember_time_pos) this.#update_time_pos();
        return this.session.reload(remember_time_pos);
    }

    seek(t) {
        if (this.destroyed) return;
        if (!this.#parsed_item.internal_seekable) return;
        if (t === undefined) t = this.time;
        if (t === undefined) return;
        this.#last_seek_time = t;
        this.#seeking = true;
        this.#player.$.seeking = true;
        this.#update_time_pos();
        return super.seek(t);
    }

    #lua_message(name, args) {
        if (this.destroyed) return;
        return this.command("script-message-to", "livestreamer", name, JSON.stringify(args));
    }

    /** @param {number|undefined} time_pos @description time_pos is the time position to set the video to (according to the user). */
    #update_time_pos(time_pos) {
        if (this.destroyed) return;
        // if (!this.#preloaded) return;
        if (time_pos === undefined) {
            if (this.#seeking) {
                time_pos = this.#last_seek_time;
            } else {
                time_pos = Math.max(0, +(this.time ?? this.#props.start ?? 0));
            }
        }
        this.session.$.time_pos = time_pos;
    }

    #rebuild_filters() {
        if (this.destroyed) return;
        if (!this.#parsed_item) return;

        let vid_auto = this.#parsed_item.map.video.force_id ?? this.#parsed_item.map.video.auto_id ?? 1;
        let aid_auto = this.#parsed_item.map.audio.force_id ?? this.#parsed_item.map.audio.auto_id ?? 1;
        let sid_auto = this.#parsed_item.map.subtitle.force_id ?? this.#parsed_item.map.subtitle.auto_id ?? false;

        var get_stream_id = (id, type) => {
            id = +id || 1;
            /** @type {StreamCollection} */
            var sc = this.#parsed_item.map[type];
            var s = sc.streams[id - 1];
            if (s?.replacement_stream_id) id = s.replacement_stream_id;
            return id;
        }

        let vid = this.#props.vid_override == "auto" ? vid_auto : get_stream_id(this.#props.vid_override, "video");
        let aid = this.#props.aid_override == "auto" ? aid_auto : this.#props.aid_override;
        let sid = this.#props.sid_override == "auto" ? sid_auto : this.#props.sid_override;

        if (vid == false) vid = vid_auto; // can never be false
        if (aid == false) aid = aid_auto; // can never be false

        let v_stream = this.#parsed_item.map.video.streams[vid - 1];
        let reason;
        if (!v_stream) reason = "no stream";
        else if (v_stream.albumart) reason = "albumart";

        if (reason) {
            this.logger.error(`Bad video stream selected [${reason}]...`);
            v_stream = this.#parsed_item.map.video.streams.find(s => s.type == "video" && !s.albumart);
            if (v_stream) {
                vid = v_stream.type_id;
                this.logger.error(`Setting to a safe fallback [${vid}]...`);
            } else {
                throw `Stream selection failed.`;
            }
        }

        let a_stream = this.#parsed_item.map.audio.streams[aid - 1];
        let s_stream = this.#parsed_item.map.subtitle.streams[sid - 1];

        let [ow, oh, oar] = [this.#player.width, this.#player.height, this.#player.aspect_ratio];
        let [iw, ih] = [v_stream.width ?? ow, v_stream.height ?? oh];
        let fps = this.session_stream.fps;
        // let fps = v_stream.fps ?? constants.DEFAULT_FPS;

        let interpolation;
        {
            let dfps = this.session_stream.fps || constants.DEFAULT_FPS;
            let vfps = v_stream.fps || v_stream.avg_fps || fps || constants.DEFAULT_FPS;
            if (this.#props.interpolation_mode == "auto") {
                if (vfps) {
                    if (vfps < dfps) {
                        let r = dfps % vfps;
                        interpolation = r > 0.1;
                    } else {
                        interpolation = false
                    }
                }
            } else {
                interpolation = this.#props.interpolation_mode;
            }
        }
        this.#player.$.interpolation = interpolation;

        var ctx = new FilterContext({
            aid: `aid${aid}`,
            vid: `vid${vid}`,
            fps: fps || constants.DEFAULT_FPS,
            width: ow,
            height: oh,
            color: this.#parsed_item.background_color,
        });

        let is_filter_allowed = (filter) => {
            // var name = String(filter).match(/\w+/i)[0];
            // var allowed = name in this.#mpv_info.allowed_filters;
            // if (!allowed) this.logger.warn(`Filter '${name}' not allowed.`);
            // return allowed;
            return true;
        }

        // -----------------------------------------

        let pre_vf_graph = [];
        let pre_af_graph = [];

        // pre_vf_graph.push(`setpts=N/${fps}/TB`); // fixes bad PTS for MPEG-TS
        // pre_af_graph.push(`asetpts=N/SR/TB`);

        // let fps = +(this.props.force_fps || this.stream.fps);

        let deinterlace = this.#props.deinterlace_mode;
        if (deinterlace == "auto") deinterlace = !!v_stream?.interlaced;
        this.#player.$.deinterlacing = deinterlace;

        if (deinterlace) {
            let mode = v_stream.field_order == "tt" || v_stream.field_order == "bb" ? 1 : 0;
            pre_vf_graph.push(`yadif=mode=${mode}`);
        }

        {
            let left = utils.clamp(Math.abs(this.#props.crop[0] || 0));
            let top = utils.clamp(Math.abs(this.#props.crop[1] || 0));
            let right = utils.clamp(Math.abs(this.#props.crop[2] || 0));
            let bottom = utils.clamp(Math.abs(this.#props.crop[3] || 0));
            let cx = left;
            let cy = top;
            let cw = utils.clamp(1 - right - left);
            let ch = utils.clamp(1 - bottom - top);
            let min_x = 1 / ow;
            let min_y = 1 / oh;

            [iw, ih] = [cw * iw, ch * ih];

            if ((cw != 1 || ch != 1) && cw >= min_x && ch >= min_y) {
                pre_vf_graph.push(
                    `crop=w=iw*${cw}:h=ih*${ch}:x=iw*${cx}:y=ih*${cy}`
                );
            }
        }

        let dar = v_stream.dar ?? this.#player.aspect_ratio;
        let sar = v_stream.sar ?? 1;
        let par = iw / ih;

        if (this.#props.aspect_ratio != "auto") {
            let ar_str = this.#props.aspect_ratio;
            let parts = ar_str.split(":");
            let [w, h] = parts;
            pre_vf_graph.push(`setdar=${w}/${h}`);
            dar = w / h;
        }

        {
            let w = iw * sar;
            let h = ih;
            const ar = w / h;
            if (Math.abs(ar - dar) > 0.0001) {
                if (ar > dar) w = h * dar;
                else h = w / dar;
            }
            par = w / h;
        }

        {
            let margin_percent = (1 - (par / oar)) / 2;
            let sw = 720 * oar;
            let sx = margin_percent * sw;
            sx = utils.clamp(sx, 50, 300);
            this.set_property("sub-margin-x", `${Math.round(sx)}`);
        }

        if (this.#player.current_aspect_ratio != par) {
            this.#player.current_aspect_ratio = par;
            globals.app.ipc.emit("main.stream.aspect-ratio", { id: this.#player.stream.id, aspect_ratio: par })
        }

        pre_vf_graph.push(`scale=width=(iw*sar)*min(${ow}/(iw*sar)\\,${oh}/ih):height=ih*min(${ow}/(iw*sar)\\,${oh}/ih):force_divisible_by=2`); // :reset_sar=1 does not exist on old ffmpeg versions.

        {
            let c = this.#props.contrast;
            let b = this.#props.brightness;
            let s = this.#props.saturation;
            let g = this.#props.gamma;
            let h = this.#props.hue;
            if (b || s || g || c) {
                pre_vf_graph.push(`eq=${[
                    b && `brightness=${utils.map_range(b, -100, 100, -1, 1)}`,
                    c && `contrast=${utils.map_range(c, -100, 100, 0, 2)}`,
                    s && `saturation=${utils.map_range(s, -100, 100, 0, 2)}`,
                    g && `gamma=${utils.map_range(g, -100, 100, 0, 2)}`
                ].filter(s => s).join(":")}`);
            }
            if (h) {
                pre_vf_graph.push(`hue=${utils.map_range(h, -100, 100, -180, 180)}`);
            }
        }

        if (fps) {
            // it appears interpolation is not applied in encoding mode so we have to use filters:
            if (interpolation) {
                // works well but slow as fuck
                /* pre_vf_graph.push(
                    `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
                ); */
                pre_vf_graph.push(
                    `framerate=fps=${fps}`
                );
            } else {
                pre_vf_graph.push(
                    `fps=${fps}`
                );
            }
        }

        let audio_stream = get_stream_by_id(this.#props.aid, this.#parsed_item.map.audio.streams);
        let has_2_channels = audio_stream ? audio_stream.channels >= 2 : false;

        let pan;
        let ac = this.#props.audio_channels;
        if (has_2_channels && ac == "mix") {
            pan = "pan=stereo|c0=.5*c0+.5*c1|c1=.5*c0+.5*c1";
        } else if (has_2_channels && ac == "left") {
            pan = "pan=stereo|c0=c0|c1=c0";
        } else if (has_2_channels && ac == "right") {
            pan = "pan=stereo|c0=c1|c1=c1";
        } else {
            pan = "pan=stereo|FL<1.0*FL+0.707*FC+0.707*BL|FR<1.0*FR+0.707*FC+0.707*BR";
        }
        if (pan) {
            pre_af_graph.push(pan);
        }

        if (this.#props.audio_delay) {
            pre_af_graph.push(`asetpts=PTS+${this.#props.audio_delay}/TB`);
        }

        pre_af_graph.push(`aresample=async=1`);

        pre_af_graph = pre_af_graph.filter(is_filter_allowed);
        pre_vf_graph = pre_vf_graph.filter(is_filter_allowed);

        if (pre_vf_graph.length) {
            let pre_vf = ctx.id("pre_vf");
            ctx.stack.push(`[${ctx.vid}]${pre_vf_graph.join(",")}[${pre_vf}]`);
            ctx.vid = pre_vf;
        }

        if (pre_af_graph.length) {
            let pre_af = ctx.id("pre_af");
            ctx.stack.push(`[${ctx.aid}]${pre_af_graph.join(",")}[${pre_af}]`);
            ctx.aid = pre_af;
        }

        var get_filters = (p) => Object.values(p).sort((a, b) => a.index - b.index).filter(f => is_filter_allowed(f.name));

        var props_pre_filters = get_filters(this.#props.pre_filters);
        var props_filters = get_filters(this.#props.filters);

        ctx.apply([...props_pre_filters, ...props_filters]);

        // we need to put this in the lavfi-complex (and not vf) so we can assure the frame size is consistent from start to finish. If we pad later, we get a warning in mpv (and crash): 'Changing video frame properties on the fly is not supported by all filters.'

        let pad_vf = ctx.id("pad_vf");
        ctx.stack.push(`[${ctx.vid}]pad=width=${ow}:height=${oh}:x=(ow-iw)/2:y=(oh-ih)/2:color=${this.#parsed_item.background_color}[${pad_vf}]`);
        ctx.vid = pad_vf;

        // -----------------------------------------

        let vf_graph = [];
        let af_graph = [];

        const STREAM_VOLUME_NORMALIZATION_CONFIGS = {
            "dynaudnorm1": `dynaudnorm=f=500:p=0.9:m=8.0:g=7`,
            "dynaudnorm2": `dynaudnorm=f=250:p=0.9:m=8.0:g=5`,
            "loudnorm": `loudnorm=dual_mono=true`
        };
        let normalization_method = this.#props.volume_normalization;
        let normalization_filter = STREAM_VOLUME_NORMALIZATION_CONFIGS[normalization_method];
        if (normalization_filter) {
            af_graph.push(normalization_filter);
        }

        let vfades = [];
        let afades = [];

        if (this.#parsed_item.props.fade_in) {
            vfades.push(`fade=t=in:st=0:d=${this.#parsed_item.props.fade_in}`);
            afades.push(`afade=t=in:st=0:d=${this.#parsed_item.props.fade_in}`);
        }
        for (let [type, dir, offset, dur] of this.#parsed_item.fades) {
            offset = Math.max(0, offset);
            if (dir == "out") offset -= 0.25;
            offset = Math.max(0, offset);
            if (type.startsWith("v")) {
                vfades.push(`fade=enable='between(t\\,${offset},${offset + dur})':t=${dir}:st=${offset}:d=${dur}`);
            } else if (type.startsWith("a")) {
                afades.push(`afade=enable='between(t\\,${offset},${offset + dur})':t=${dir}:st=${offset}:d=${dur}`);
            }
        }
        if (this.#player.fading) {
            vfades.push(`fade=t=out:st=${this.#player.fading + 0.25}:d=${this.session.$.fade_out_speed}`);
            afades.push(`afade=t=out:st=${this.#player.fading + 0.25}:d=${this.session.$.fade_out_speed}`);
        } else if (this.#parsed_item.props.fade_out && this.duration) {
            vfades.push(`fade=t=out:st=${this.duration - this.#parsed_item.props.fade_out - 0.25}:d=${this.#parsed_item.props.fade_out}`);
            afades.push(`afade=t=out:st=${this.duration - this.#parsed_item.props.fade_out - 0.25}:d=${this.#parsed_item.props.fade_out}`);
        }

        for (let fade of vfades) {
            vf_graph.push(fade);
        }
        for (let fade of afades) {
            af_graph.push(fade);
        }


        if (this.session_stream.is_test) {
            if (this._features.libavfilters.drawtext) {
                let font_path = globals.app.resources.get_path("fonts/RobotoMono-Regular.ttf");
                vf_graph.push(`drawtext=text='${utils.ffmpeg_escape("%{pts:hms}")}':fontfile='${utils.ffmpeg_escape(font_path)}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`);
            }
        }

        vf_graph.push(VF_FORMAT);

        // vf_graph.push(`metadata=mode=add:key=livestreamer_aspect_ratio:value='${predicted_aspect_ratio}'`);

        /* if (this.session_stream.is_realtime) {
            vf_graph.push(`realtime=speed=2.0:limit=1.0`);
        } */

        /* if (vf_graph.length) {
            let vf = ctx.id("vf");
            ctx.stack.push(`[${ctx.vid}]${vf_graph.join(",")}[${vf}]`);
            ctx.vid = vf;
        }

        if (af_graph.length) {
            let af = ctx.id("af");
            ctx.stack.push(`[${ctx.aid}]${af_graph.join(",")}[${af}]`);
            ctx.aid = af;
        } */

        // -----------------------------------------

        // important to dynaudnorm not in lavfi-complex, this is applied last after all other filters.
        // also it mucks up EDLs if used in lavfi-complex and there is an audio format change between segments.

        // let vf = [...(this.#props.vf||[])];

        let lavfi_complex_str = ctx.toString();
        this.set_property("lavfi-complex", lavfi_complex_str);
        this.set_property("af", af_graph.map(make_lavfi_filter));
        this.set_property("vf", vf_graph.map(make_lavfi_filter));
        this.set_property("sid", sid);
    }

    #update_volume(immediate = false) {
        this.#lua_message("update_volume", [this.session.$.volume_target * this.#props.volume_multiplier, this.session.$.volume_speed, immediate]);
    }
}

class StreamMap {
    audio = new StreamCollection(this, "audio");
    video = new StreamCollection(this, "video");
    subtitle = new StreamCollection(this, "subtitle");
    /** @type {RegisterFileResult[]} */
    files = [];
    /** @type {MediaInfoStreamEx[]} */
    streams = [];

    /** @param {MediaInfoStreamEx} s @param {MediaInfoStreamType|boolean} force */
    register_stream(s, force) {
        s.id = this.streams.length + 1;
        if (!this[s.type]) this[s.type] = new StreamCollection(this, s.type);
        s.type_id = this[s.type].streams.length + 1;
        this.streams.push(s);
        if ((typeof force === "string" && s.type == force) || force) {
            this[s.type].force_id = s.type_id;
        }
        return s;
    }

    /** @param {RegisterFileResult} file */
    register_file(file) {
        this.files.push(file);
        file.streams.forEach((s, i) => {
            s = { ...s };
            s.title = [s.title, file.name].filter(s => s).join(" | ");
            if (s.type === "subtitle" && file.secondary) s.secondary = true;
            this.register_stream(s, file.type);
        });
    }

    /** @param {MediaInfoStreamEx[]} streams */
    register_default_media_streams(streams) {
        if (!streams) return;
        for (let s of streams) {
            let is_default = get_default_stream(streams, s.type) === s;
            this.register_stream(s, is_default);
        }
    }

    /** @param {MediaInfoStreamType} type */
    has(type) {
        return this[type].streams.filter(s => !s.albumart).length > 0;
    }

    calculate_auto_ids() {
        for (let k of MEDIA_INFO_STREAM_TYPES) {
            let default_stream = get_default_stream(this[k].streams, k);
            this[k].auto_id = default_stream ? default_stream.type_id : null;
        }
    }
}

class StreamCollection {
    auto_id = null;
    force_id = null;
    #map;
    #type;
    /** @param {StreamMap} map @param {MediaInfoStreamType} type */
    constructor(map, type) {
        this.#map = map;
        this.#type = type;
    }
    get files() {
        return this.#map.files.filter(f => f.type == this.#type);
    }
    get streams() {
        return this.#map.streams.filter(s => s.type == this.#type);
    }
}

async function create_file(filename, generator) {
    if (!CACHE.has(filename)) {
        var exists = await utils.file_exists(filename)
        CACHE.set(filename, exists ? true : generator());
    }
    return CACHE.get(filename);
}

async function separate_albumart_from_audio_file(filename, format) {
    var mi = await globals.app.get_media_info(filename);
    var v_streams = mi.streams.filter(s=>s.type === "video");
    var a_streams = mi.streams.filter(s=>s.type === "audio");
    var audio_stream = a_streams[0];
    var audio_stream_id = 0;
    var albumart_stream = v_streams.find(s=>s.albumart);
    var albumart_stream_id = v_streams.indexOf(albumart_stream);
    var audio_ext = codec_to_ext(audio_stream.codec);
    var albumart_ext = codec_to_ext(albumart_stream.codec);
    var albumart_filename = path.resolve(globals.app.tmp_dir, `${utils.md5(filename)}-${albumart_stream_id}-albumart${albumart_ext}`);
    var audio_filename = path.resolve(globals.app.tmp_dir, `${utils.md5(filename)}-${audio_stream_id}-audio${audio_ext}`);
    var doing_job = false;
    var job = async () => {
        if (doing_job) return;
        doing_job = true;
        return new FFMPEGWrapper().start([
            `-i`, filename,
            `-map`, `0:a:${audio_stream_id}`,
            `-c`, `copy`,
            `-f`, audio_stream.codec,
            audio_filename,
            `-map`, `0:v:${albumart_stream_id}`,
            `-c`, `copy`,
            `-f`, albumart_stream.codec,
            albumart_filename,
            `-y`
        ]);
    }

    return Promise.all([
        create_file(albumart_filename, job), 
        create_file(audio_filename, job), 
    ]).then(()=>{
        return [audio_filename, albumart_filename];
    })
}

async function get_ass_subtitle_as_path(ass_str) {
    var filename = path.resolve(globals.app.tmp_dir, `${utils.md5(ass_str)}.ass`);
    return create_file(filename, async (output_path) => {
        await utils.safe_write_file(output_path, ass_str);
    });
}

export class StreamFixerTransform extends BridgeTransform {
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @param {InternalSessionPlayer} player @param {stream.TransformOptions} options */
    constructor(player, options) {
        var ffmpeg_args = [
            "-err_detect", "ignore_err",
            "-fflags", "+genpts+igndts", // +discardcorrupt // +nobuffer FUCKS US UP and skips the first 17-ish seconds
            `-avoid_negative_ts`, `make_zero`,
            "-f", MPV_FORMAT,
            "-i", "pipe:0",
        ];
        var bsfv = []
        var bsfa = [];
        bsfv.push("h264_mp4toannexb");
        bsfa.push("aac_adtstoasc");

        if (MPV_OUTPUT_RAW) {
            var encoder = "libx264";
            var hwenc = globals.app.conf["core.ffmpeg_hwenc"];
            if (hwenc) {
                encoder = `h264_${hwenc}`;
                ffmpeg_args.unshift(
                    `-threads`, `1`,
                );
            }
            ffmpeg_args.push(
                `-c:v`, encoder,
                ...utils.get_encoder_ffmpeg_args(encoder, H264_PROFILE, H264_LEVEL),
                `-b:v`, `${player.stream.$.video_bitrate}k`,
                `-maxrate:v`, `${player.stream.$.video_bitrate}k`,
                `-minrate:v`, `${player.stream.$.video_bitrate}k`,
                `-bufsize:v`, `${player.stream.$.video_bitrate}k`,
                "-bf", "2",
                "-sc_threshold", "40",
                "-g", Math.ceil((player.parsed_item?.media_info?.fps || constants.DEFAULT_FPS) * KEYFRAMES_PER_SECOND),
                `-c:a`, `aac`,
                `-b:a`, `${player.stream.$.audio_bitrate}k`,
                `-profile:a`, `aac_low`,
                `-ar`, `${AUDIO_SAMPLERATE}`,
            )
        } else {
            // we assume h264 + aac
            let h264metadata = {
                aud: "insert",
                sample_aspect_ratio: "1/1",
                video_full_range_flag: "0",
                colour_primaries: "1",
                transfer_characteristics: "1",
                matrix_coefficients: "1",
                chroma_sample_loc_type: "0",
                level: H264_LEVEL,
                zero_new_constraint_set_flags: "1"
            };
            bsfv.push(
                `h264_metadata=${Object.entries(h264metadata).map(([k, v]) => `${k}=${v}`).join(":")}`
            );
            ffmpeg_args.push(
                "-c", "copy",
            );
            // h264_redundant_pps
        }

        ffmpeg_args.push(
            "-bsf:v", bsfv.join(","),
            "-bsf:a", bsfa.join(","),
            "-f", OUTPUT_FORMAT,
            // "-muxdelay", "0",
            // "-muxpreload", "0",
            `-fps_mode`, "passthrough",
            // `-output_ts_offset`, `${player.pts}`, // not needed any more
            `-map_metadata`, `0`,
            "pipe:1"
        );
        var ffmpeg = new FFMPEGWrapper();
        // ffmpeg.on("line", (l)=>{
        //     console.log(l);
        // })
        ffmpeg.start(ffmpeg_args).catch((e) => {
            player.logger.error(new Error(`PTSFixer error: ${e.message}`));
        });
        super(ffmpeg.stdin, ffmpeg.stdout, options);
        this.#ffmpeg = ffmpeg;
    }
    async _destroy(err, callback) {
        await this.#ffmpeg.destroy()
        callback(err);
    }
}



export class MpegTsDemuxerTransform extends stream.Transform {
    /** @type {MpegTsDemuxer} */
    #demuxer;

    /** @param {stream.TransformOptions} options */
    constructor(options) {
        super(options);
        const time_base = 90000;
        this.#demuxer = new MpegTsDemuxer();
        var last_pts = 0;
        this.#demuxer.on('data', (packet) => {
            if (packet.content_type != 2) return;
            let pts = packet.pts / time_base;
            let dts = packet.dts / time_base;
            let fps = time_base / packet.frame_ticks;
            if (pts > last_pts) {
                last_pts = pts;
                this.emit("pts", { pts, dts, fps });
            }
        });
    }

    _transform(chunk, encoding, callback) {
        this.push(chunk);
        this.#demuxer.write(chunk);
        callback();
    }
}

export class RealTimeBufferTransform extends stream.Transform {
    /** @type {InternalSessionPlayer} */
    #player;
    #total_bytes = 0;
    #elapsed_correction = 0;
    /** @param {InternalSessionPlayer} player @param {stream.TransformOptions} options */
    constructor(player, options) {
        super({
            // highWaterMark: 8 * 1024,
            ...options
        });
        this.#player = player;
    }

    async _transform(chunk, encoding, callback) {
        let elapsed = this.#player.timer.elapsed / 1000;
        let elapsed_adjusted = elapsed + this.#elapsed_correction;
        let max_buffer_duration = Math.min(this.#player.stream.$.buffer_duration, 60);
        let buffer_duration = this.#player.pts - elapsed_adjusted;
        let delay = 0;
        this.#total_bytes += chunk.length;
        if (buffer_duration < 0) {
            // this prevents the buffer from speeding up when there has been a significant pause
            this.#elapsed_correction += buffer_duration;
        }
        if (buffer_duration > max_buffer_duration) {
            delay = (buffer_duration - max_buffer_duration) * 1000;
        }
        delay = Math.max(0, delay);
        this.push(chunk);
        if (this.#player.stream.is_realtime && delay) {
            if (delay > 5000) console.log("long delay", delay);
            await utils.timeout(delay);
        }
        callback();
    }
}

var make_lavfi_filter = (graph) => ({
    name: "lavfi",
    enabled: true,
    params: { graph }
});

function edl_track_type(t) {
    if (t === "video") return "video";
    if (t === "audio") return "audio";
    if (t === "subtitle") return "sub";
}



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

// --image-display-duration=<seconds|inf>
/* When viewing images, the playback time is not tracked on the command line output, and the image frame is not duplicated when encoding. To force the player into "dumb mode" and actually count out seconds, or to duplicate the image when encoding, you need to use --demuxer=lavf --demuxer-lavf-o=loop=1, and use --length or --frames to stop after a particular time. */
/* --demuxer-lavf-o=loop=1 */