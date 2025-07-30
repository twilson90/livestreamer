import fs from "fs-extra";
import { MpegTsDemuxer } from 'mpegts-demuxer';
import path from "node:path";
import stream from "node:stream";
import readline from "node:readline";
import child_process from "node:child_process";
import {globals, MPVEDL, MPVEDLEntry, FilterContext, ass } from "./exports.js";
import {utils, MPVWrapper, DataNode, DataNode$, Logger, FFMPEGWrapper, constants, BridgeTransform, MPVLoadFileError} from "../core/exports.js";
import { get_default_stream, get_stream_by_id, get_auto_background_mode } from "./shared.js";


/** @import { InternalSession, SessionStream, PlaylistItem$, MediaInfo, PlaylistItemProps, MediaInfoStream, MediaInfoStreamType, FilterInput, Filter, PlaylistItemPropsProps } from './exports.js' */
/** @typedef {MediaInfoStream & {id:number, type_id:number, secondary:boolean}} MediaInfoStreamEx */
/** @typedef {{type:MediaInfoStreamType, start:number, end:number, duration:number, offset:number, loops:number, secondary:boolean, name:string}} RegisterFileOpts */
/** @typedef {RegisterFileOpts & {filename:string, original_filename:string, streams:MediaInfoStreamEx[], type:MediaInfoStreamType}} RegisterFileResult */


// const FORCE_NEXT_ITEM_TIMEOUT = 5 * 1000;
// const FORCE_NEXT_ITEM_TIMEOUT = Number.MAX_SAFE_INTEGER;
// const FORCE_ABORT_TIMEOUT = 10 * 1000;
const EDL_TRACK_TYPES = ["video", "audio", "sub"];
/** @type {MediaInfoStreamType[]} */
const MEDIA_INFO_STREAM_TYPES = ["video", "audio", "subtitle"];
// const DEFAULT_WIDTH = 1280;
// const DEFAULT_HEIGHT = 720;
const NULL_STREAM_DURATION = 60;
const NULL_STREAM_FPS = constants.DEFAULT_FPS;
/** @type {Map<string,Promise<string>>} */
const CACHE = new Map();
const KEYFRAMES_PER_SECOND = 2;
const AUDIO_SAMPLERATE = 44100;
const SINGLE_MPV = true;
const VF_FORMAT = "colorspace=all=bt709:format=yuv420p:fast=1";

export const MPV_OUTPUT_FORMAT = "mpegts";
export const FFMPEG_OUTPUT_FORMAT = "mpegts";

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
    loop: false,
    root: undefined,
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
}

const ytdl_cache = new utils.SimpleCache(1000 * 60 * 60);
const mpv_info_cache = {};

async function __get_mpv_info() {
    /** @type {Record<string,boolean>} */
    var allowed_args = {};
    /** @type {Record<string,boolean>} */
    var allowed_props = {};
    /** @type {Record<string,boolean>} */
    var allowed_filters = {};
    var get_options = async()=>{
        var str = (await utils.execa(globals.app.mpv_path, ["--list-options"])).stdout;
        for (let line of str.split("\n")) {
            let m = line.trim().match(/^--([^=\s]+)(?:\s+(.+))?$/);
            if (m) {
                allowed_args[m[1]] = true;
                allowed_props[m[1]] = true;
                if (m[2] && m[2].startsWith("Flag")) {
                    allowed_args["no-"+m[1]] = true;
                }
            }
        }
    }
    var get_filters = async(type)=>{
        var str = (await utils.execa(globals.app.mpv_path, [`--${type}=help`])).stdout;
        var list = [...str.matchAll(/^  ([^\s]+)/gm)].map(m=>m[1]);
        for (let filter of list) {
            allowed_filters[filter] = true;
        }
    }
    await Promise.all([
        get_options(),
        get_filters("vf"),
        get_filters("af"),
    ]);
    return {
        allowed_args,
        allowed_props,
        allowed_filters,
    };
}
/** @typedef {Awaited<ReturnType<typeof __get_mpv_info>>} MpvInfo */
/** @returns {MpvInfo} */
async function get_mpv_info() {
    var version_str = (await utils.execa(globals.app.mpv_path, ["--version"])).stdout;
    if (!mpv_info_cache[version_str]) {
        mpv_info_cache[version_str] = __get_mpv_info()
    }
    return mpv_info_cache[version_str];
}

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
    #width = 0;
    #height = 0;
    /** @type {stream.PassThrough} */
    #out;
    #timer = new utils.StopWatchHR();
    /** @type {ParsedItem} */
    parsed_item = {};
    #paused = false;
    #load_promise;
    pts = 0;
    dts = 0;
    fps = 0;

    get stream() { return this.#stream; }
    /** @type {InternalSession} */
    get session() { return this.#stream.session; }
    get duration() { return this.$.duration; }
    get time_pos() { return this.$.time_pos; }
    get paused() { return this.$.paused; }
    get parsed_filename() { return this.parsed_item.filename; }
    get mpv() { return this.#mpv; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get out() { return this.#out; }
    get timer() { return this.#timer; }
    
    /** @param {SessionStream} _stream */
    constructor(_stream) {
        super(new InternalSessionPlayer$());

        this.#stream = _stream;
        var res = this.stream.$.resolution.split("x");
        this.#width = +res[0];
        this.#height = +res[1];
        this.#stream.$.player = this.$;
        this.logger = new Logger("player");
        this.#out = new stream.PassThrough();
    }

    tick() {
        this.$.pts = this.pts;
        this.$.dts = this.dts;
        this.$.fps = this.fps;
        this.#mpv?.tick();
    }

    /** @param {PlaylistItem$} item @param {LoadFileOpts} opts */
    async loadfile(item, opts) {
        
        this.$.loaded = false;

        opts = {
            ...default_load_file_opts,
            ...opts,
        };
        
        item = utils.json_copy(item);
        // reload_props
        if (!opts.reload_props) item.props = {...item.props, ...this.parsed_item.props};
        if (this.#mpv?.fading) {
            item.props.fade_in = this.session.$.fade_in_speed;
            this.#mpv.fading = false;
        }

        let start = +(opts.start||0);

        let parsed_item = this.parsed_item = await this.parse_item(item, {
            start,
        });
        let {duration, is_unknown_duration} = parsed_item;
        
        this.logger.info("loading file:", parsed_item.filename);

        if (!is_unknown_duration && !duration) {
            this.logger.warn(`Duration is 0, skipping '${item.filename}'...`);
            return;
        }

        if (!this.#mpv || !SINGLE_MPV) {
            this.#mpv?.destroy();
            await this.#mpv?.done;
            this.#mpv = new InternalSessionMPV(this, SINGLE_MPV ? null : parsed_item);
            this.#mpv.start();
        }

        if (opts.pause) this.pause();
        else this.resume();

        return this.#load_promise = this.#mpv.loadfile(parsed_item)
            .then(()=>{
                this.$.item = utils.json_copy(parsed_item);
                this.$.duration = parsed_item.duration;
                this.$.seekable = parsed_item.seekable;
                this.$.loaded = true;
                return true;
            })
            .catch(e=>{
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
            .then((wait_for_end)=>{
                if (!wait_for_end) return;
                return new Promise((resolve)=>{
                    var resolve_wrapper = ()=>{
                        resolve();
                        this.#mpv.off("idle", resolve_wrapper);
                        this.#mpv.off("eof-reached", resolve_wrapper);
                    };
                    this.#mpv.on("idle", resolve_wrapper);
                    this.#mpv.on("eof-reached", resolve_wrapper);
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

        let media_info = await this.session.update_media_info(item.filename, {silent:true});

        if (!item.fades) item.fades = [];
        let {filename, id, props} = item;
        let {offset, duration, media_type, loop, root} = opts;
        duration = duration || props.duration || 0;
        let is_clipped = props.clip_start || props.clip_end || props.clip_offset || props.clip_loops != 1;
        let map = new StreamMap();
        let is_empty = filename === "livestreamer://empty";
        let is_playlist = this.session.is_item_playlist(item.id);
        let is_image = !!(media_info.streams && media_info.streams.filter((s)=>s.type == "video").length > 0 && media_info.duration <= 0.04);
        let background_color = (root && root.props && root.props.background_color) || props.background_color || this.session.$.background_color || "#000000";
        /** @type {PlaylistItem$[]} */
        let children = [];

        root = root || item;
        let is_root = (root === item);
        let media_duration = media_info.duration || (is_empty ? NULL_STREAM_DURATION : 0);
        let needs_video = !media_type || media_type == "video";
        let needs_audio = !media_type || media_type == "audio";
        let needs_subtitle = media_type == "subtitle";
        let exists = (media_info.exists && !media_info.ytdl);
        let background_mode_default = this.session.$.background_mode || "logo";
        let background_mode = props.background_mode;
        if (background_mode == "auto") background_mode = get_auto_background_mode(item, media_info);
        if (background_mode == "default") background_mode = background_mode_default;

        const generate_map = ()=>{
            let map = new StreamMap();
            if (needs_video) map.register_stream({type:"video", title:"EDL Video"}, true);
            if (needs_audio) map.register_stream({type:"audio", title:"EDL Audio"}, true);
            if (needs_subtitle) map.register_stream({type:"subtitle", title:"EDL Subtitle"}, true);
            return map;
        }

        if ((filename||"").startsWith("livestreamer://")) {
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
                    end: (Math.max(0, (duration || Number.MAX_SAFE_INTEGER) - 0.5))*1000,
                    text: ass.fade(props.fade_in || 0, props.fade_out || 0) + (ass.rotate(...(Array.from(props.title_rotation)||[0,0,0]))) + ass.text(props.title_text),
                }]);
                filename = await get_ass_subtitle_as_path(ass_str);
                map.register_stream({type:"subtitle"}, true);
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
                width: this.#width,
                height: this.#height,
                background: background_color,
                fps: NULL_STREAM_FPS,
                filename,
            });
            map.register_stream({
                type: "video",
                codec: "h264",
                duration: NULL_STREAM_DURATION,
                fps: NULL_STREAM_FPS,
                title: path.basename(filename)
            }, true);
            media_duration = NULL_STREAM_DURATION;

            if (duration != media_duration) {
                let edl = new MPVEDL(MPVEDL.repeat(filename, {end:media_duration, duration}));
                filename = edl.toString();
            }
        }
        
        let is_rtmp = !!filename.match(/^rtmps?:/);
        if (is_rtmp) {
            map.register_stream({type:"video", title:"RTMP Video"}, true);
            map.register_stream({type:"audio", title:"RTMP Audio"}, true);
        }

        if (media_info.ytdl && (!is_root || is_clipped)) {
            filename = await this.youtube_url_to_edl(filename);
        }

        if (!map.streams.length) {
            if (media_info.streams) {
                for (let s of media_info.streams) {
                    let is_default = get_default_stream(media_info.streams, s.type) === s;
                    map.register_stream(s, is_default);
                }
            }
        }

        map.calculate_auto_ids();
        
        let media_type_mismatch = (needs_audio != map.has("audio") || needs_video != map.has("video") || (needs_subtitle && !map.has("subtitle")));
        let missing_stream_types = [];
        if (needs_video && !map.has("video")) missing_stream_types.push("video");
        if (needs_audio && !map.has("audio")) missing_stream_types.push("audio");
        if (needs_subtitle && !map.has("subtitle")) missing_stream_types.push("subtitle");
        
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
                    let tmp = await this.parse_item(item, {offset:o, media_type: type, root});
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
            
            for (var i=0; i < playlist_tracks.length; i++) {
                tracks.push(await parse_track(playlist_tracks[i], is_2track ? EDL_TRACK_TYPES[i]: null));
            }

            let min_duration = Math.min(...tracks.map((t)=>t.duration));
            let max_duration = Math.max(...tracks.map((t)=>t.duration));
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
                        } else{
                            // add padding to track if necessary
                            let tmp = await this.parse_item(null, {duration: pad_duration, media_type: track.type, offset, root});
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
                    edl.append(new MPVEDLEntry("!delay_open", {media_type: track.type}));
                }
                edl.append(...track.entries);
            }
            filename = edl.toString();
            map = generate_map();

        } else if (!is_root) {

            let pad_duration = Math.max(0, duration - media_duration);
            let duration_mismatch = (pad_duration > 0.04);
            if (duration_mismatch || media_type_mismatch) {
                let edl = new MPVEDL();
                edl.append("!new_stream");
                edl.append("!no_chapters");
                if (media_type) edl.append(new MPVEDLEntry("!delay_open", {media_type}));
                if (exists) {
                    if (duration_mismatch) {
                        if (loop) {
                            // loop the file...
                            edl.append(
                                ...MPVEDL.repeat(filename, {end:media_duration, duration})
                            );
                        } else {
                            // add the file...
                            edl.append(new MPVEDLEntry(filename, {
                                length: Math.min(duration, media_duration).toFixed(3)
                            }));
                            // pad the file with null streams
                            let tmp = await this.parse_item(null, {duration: pad_duration, media_type, offset, root});
                            if (tmp.duration) {
                                edl.append(new MPVEDLEntry(tmp.parsed_filename, {
                                    length: (pad_duration).toFixed(3)
                                }));
                            }
                        }
                    } else {
                        // if duration is the same as detected duration, just append the file
                        edl.append(new MPVEDLEntry(filename, {
                            length: duration.toFixed(3)
                        }));
                    }
                }
                for (let t of missing_stream_types) {
                    let null_filename;
                    if (t === "audio") {
                        null_filename = await globals.app.generate_media({
                            type:"audio",
                            duration:NULL_STREAM_DURATION
                        });
                    } else if (t === "video") {
                        null_filename = await globals.app.generate_media({
                            type:"video",
                            duration: NULL_STREAM_DURATION,
                            width: this.#width,
                            height: this.#height,
                            background: background_color,
                            fps: NULL_STREAM_FPS
                        });
                    } else if (t === "subtitle") {
                        null_filename = await globals.app.generate_media({
                            type:"subtitle",
                            duration:NULL_STREAM_DURATION
                        });
                    }
                    edl.append(...MPVEDL.repeat(null_filename, {end:NULL_STREAM_DURATION, duration}));
                }
                filename = edl.toString();
                map = generate_map();
            }
        }
        
        if (is_root) {
                
            /** @param {string} filename @param {MediaInfoStreamType} type @param {RegisterFileOpts} opts */
            const add_file = async (filename, type, opts)=>{
                var original_filename = filename;
                if (!type) throw new Error("type is required");
                opts = {
                    name: filename ? path.basename(filename) : "None",
                    ...opts,
                };
                let tmp_duration = type === "subtitle" ? null : duration;
                let tmp = (await this.parse_item(filename, {media_type:type, duration:tmp_duration, root, loop:(type === "video")}));
                await map.register_file({filename: tmp.parsed_filename, original_filename, streams:tmp.map.streams, ...opts, type});
            }

            if (background_mode == "external" || background_mode == "embedded") embed: {
                if (background_mode == "external") {
                    let f = media_info.external_files.find(s=>s.type == "video");
                    if (f) {
                        await add_file(f.filename, "video");
                        break embed;
                    }
                }
                let s = map.video.streams.find(s=>s.albumart);
                if (s) {
                    let albumart_file = await extract_albumart(filename, map.streams.indexOf(s), s.codec).catch((e)=>{
                        this.logger.error(new Error(`Failed to extract albumart: ${e.message}`));
                    });
                    if (albumart_file) {
                        await add_file(albumart_file, "video");
                        break embed;
                    }
                }
            }

            if (background_mode == "file") {
                await add_file(this.session.$.background_file, "video", {start:this.session.$.background_file_start, end:this.session.$.background_file_end});
            } else if (background_mode == "logo") {
                await add_file(path.resolve(globals.app.conf["main.logo_path"]), "video");
            }
            if (props.video_file) {
                await add_file(props.video_file, "video", {start:props.video_file_start, end:props.video_file_end});
            }
            if (background_mode === "none" || !map.has("video")) {
                await add_file(null, "video");
            }

            if (props.audio_file) {
                await add_file(props.audio_file, "audio");
            }
            if (!map.has("audio")) {
                await add_file(null, "audio");
            }
            
            if (props.subtitle_file) {
                await add_file(props.subtitle_file, "subtitle");
            }

        } else {
            let fade_in = utils.round_precise(props.fade_in || 0, 3);
            if (fade_in>0) {
                if (needs_video) root.fades.push(["v", "in", offset, fade_in])
                if (needs_audio) root.fades.push(["a", "in", offset, fade_in])
            }
    
            if (duration) {
                let fade_out = utils.round_precise(props.fade_out || 0, 3);
                if (fade_out>0) {
                    if (needs_video) root.fades.push(["v", "out", offset + duration - fade_out, fade_out])
                    if (needs_audio) root.fades.push(["a", "out", offset + duration - fade_out, fade_out])
                }
            }
        }
        
        if (is_clipped) {
            let repeat_opts = {
                start: props.clip_start || 0,
                end: props.clip_end || duration,
                loops: props.clip_loops || 1,
                offset: props.clip_offset || 0,
            };
            let edl = new MPVEDL(MPVEDL.repeat(filename, repeat_opts));
            filename = edl.toString();
            duration = edl.duration;
        }

        if (is_unknown_duration) duration = 0;

        let seekable = !!duration;
        let internal_seekable = !is_rtmp;

        let t1 = Date.now();

        if (is_root) {
            this.logger.debug(`parse_item ${item.filename} took ${t1 - t0}ms`);

            let secondary_sid = (map.subtitle?.streams.find(s=>s.secondary))?.type_id ?? false;
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

    seek(time){
        this.#mpv?.seek(time).catch(e=>{
            this.logger.error(new Error(`Failed to seek to ${time}ms: ${e.message}`));
        });
    }

    set_property(key, value) {
        this.#mpv?.set_property(key, value);
    }

    async fade_out_in() {
        this.#mpv?.fade_out();
    }

    /** @param {string} url @returns {Promise<string>} */
    async youtube_url_to_edl(url) {
        if (!ytdl_cache.has(url)) ytdl_cache.set(url, globals.app.youtube_url_to_edl(url));
        return ytdl_cache.get(url);
    }

    async _destroy() {
        await this.#mpv.destroy();
        return super._destroy();
    }
}

class InternalSessionMPV extends MPVWrapper {
    /** @type {typeof PlaylistItemPropsProps} */
    #props = {};
    #props_hashed = {};
    #last_seek_time = 0;
    /** @type {InternalSessionPlayer} */
    #player;
    /** @type {ParsedItem} */
    #parsed_item;
    #fading;
    #preloaded = false;
    #playing = false;
    #seeking = false;
    #mpv_log_file;
    #mpv_props_on_load = {};
    #ticks = 0;
    #pts = 0;
    #dts = 0;
    #single = false;
    #last_session_stream_fps = 0;
    
    get loaded() { return this.#preloaded; }
    get fading() { return this.#fading; }
    get session() { return this.#player.session; }
    get session_stream() { return this.#player.session.stream; }
    get parsed_item() { return this.#parsed_item; }
    get player() { return this.#player; }
    get pts() { return this.#pts; }
    get dts() { return this.#dts; }
    // get done() { return this.#done; }

    /** @param {InternalSessionPlayer} player @param {ParsedItem} parsed_item */
    constructor(player, parsed_item) {
        super({ipc: true});
        this.#player = player;
        this.#single = !!parsed_item;
        this.#parsed_item = parsed_item;
        this.#last_session_stream_fps = this.session_stream.$.fps;

        this.on("log-message", (log)=>{
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
        this.on("seek", (e)=>{
            if (this.destroyed) return;
            this.#player.$.internal_seeking = true;
        });
        this.on("playback-restart", (e)=>{
            if (this.destroyed) return;
            this.#playing = true;
            this.#seeking = false;
            this.#player.$.internal_seeking = false;
            this.#player.$.seeking = false;
        });
        this.on("end-file", (e)=>{
            if (this.destroyed) return;
            this.#playing = false;
        });
        this.on("property-change", async (e)=>{
            if (this.destroyed) return;
            let {name, data} = e;
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

    async start() {
        this.#props = utils.json_copy(observed_mpv_props);
        
        this.#mpv_log_file = path.join(globals.app.logs_dir, `mpv-${utils.date_to_string()}-${this.id}.log`);

        var x264opts = {
            "nal-hrd": `cbr`, // VERY IMPORTANT, maintains constant bitrate
        };
        
        Object.assign(x264opts, {
            // "force-cfr": `1`, // not necessary?
            // "scenecut": `0`,
            "keyint": Math.ceil((this.#parsed_item?.media_info?.fps || constants.DEFAULT_FPS) * KEYFRAMES_PER_SECOND),
            "min-keyint": Math.ceil((this.#parsed_item?.media_info?.fps || constants.DEFAULT_FPS) * KEYFRAMES_PER_SECOND),
        });

        var mpv_args = [
            "--no-config",
            "--cache=no",
            `--demuxer-thread=no`,
            "--demuxer-readahead-secs=0.1",
            "--demuxer-hysteresis-secs=0.1",
            // `--demuxer-max-bytes=1`,
            // `--demuxer-max-back-bytes=0`,
            // `--demuxer-lavf-probesize=32`,
            // `--demuxer-lavf-analyzeduration=0.1`,

            "--sub-font-size=66",
            `--sub-margin-x=50`,
            "--sub-margin-y=30",
            `--sub-fix-timing=yes`,
            // `--sub-ass-vsfilter-aspect-compat=no`, // fixes fucked up sub scaling on ass files for anamorphic vids (vids with embedded aspect ratio)
            `--autoload-files=no`,
            `--idle=${SINGLE_MPV ? "yes" : "once"}`,

            "--audio-buffer=0",
            // "--vd-lavc-threads=1",
            "--demuxer-lavf-o-add=fflags=+flush_packets", // +nobuffer // +igndts+genpts
            "--demuxer-lavf-o-add=flush_packets=1",
            // "--demuxer-lavf-probe-info=nostreams",
            // "--demuxer-lavf-analyzeduration=0.1",
            // "--demuxer-lavf-buffersize=1024",
            // "--demuxer-readahead-secs=0.1",

            "--video-sync=audio",
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
            "--ovc=libx264",
            `--ovcopts-add=profile=main`,
            `--ovcopts-add=preset=${this.session_stream.$.h264_preset}`,
            `--ovcopts-add=level=4`,
            `--ovcopts-add=b=${this.session_stream.$.video_bitrate}k`,
            `--ovcopts-add=maxrate=${this.session_stream.$.video_bitrate}k`,
            `--ovcopts-add=minrate=${Math.floor(this.session_stream.$.video_bitrate)}k`,
            `--ovcopts-add=bufsize=${Math.floor(this.session_stream.$.video_bitrate)}k`, // *2
            // `--ovcopts-add=tune=fastdecode`, // this reduces quality to big wet arses
            // `--ovcopts-add=tune=zerolatency`, // <-- new
            `--ovcopts-add=strict=+experimental`,
            ...(Object.keys(x264opts).length ? [`--ovcopts-add=x264opts=${Object.entries(x264opts).map(([k,v])=>`${k}=${v}`).join(":")}`] : []),
            `--oac=aac`,
            `--oacopts-add=b=${this.session_stream.$.audio_bitrate}k`,
            // `--oacopts-add=aac_coder=twoloop`,
            `--oacopts-add=profile=aac_low`,
            `--oacopts-add=ar=${AUDIO_SAMPLERATE}`,
            // `--oacopts=export_side_data=prft`,
            // `--force-seekable=yes`, // important for generated media urls / piped input, don't support range requests
            `--of=${MPV_OUTPUT_FORMAT}`,
            // `--ofopts-add=muxrate=${(this.session_stream.$.video_bitrate+this.session_stream.$.audio_bitrate)*1000}`,
            // `--ofopts-add=preload=${100000}`, // 0.1 seconds

            // none of this appears to do jack shit
            `--ofopts-add=fflags=+flush_packets+igndts+genpts`, // +autobsf
            `--ofopts-add=avoid_negative_ts=make_zero`,
            `--ofopts-add=mpegts_copyts=1`,
            `--ofopts-add=flush_packets=1`,
            // `--orawts`,
            // `--ofopts-add=output_ts_offset=${pts}`,
            // `--ofopts-add=strict=+experimental`,
            // `--ofopts-add=mpegts_flags=+initial_discontinuity`, // +resend_headers
            `--o=-`,
        ];

        if (this.session_stream.$.use_hardware && globals.app.conf["core.mpv_hwdec"]) {
            mpv_args.push(`--hwdec=${globals.app.conf["core.mpv_hwdec"]}-copy`);
            // mpv_args.push(`--correct-pts=no`); // files like billy joel get PTS errors and breaks encoder unless we disable correct-pts
        }
        this.logger.on("log", (log)=>{
            this.#player.logger.log({...log, prefix: log.prefix.slice(1)});
        });

        var res = super.start(mpv_args);
        this.process.stdout._handle.setBlocking(true);
        stream.promises.pipeline(
            this.process.stdout,
            new Demuxer(this.#player),
            new RealTimeBuffer(this.#player),
            ...((SINGLE_MPV) ? [] : [new PTSFixer(this)]),
            // new PTSFixer(this),
            this.#player.out,
            {end:false}
        ).catch(utils.pipe_error_handler(this.logger, "mpv.stdout -> ... -> out"));

        this.ipc_ready.then(()=>{

            this.request_log_messages("info");

            this.#lua_message("init", [{
                keep_open: !this.#single,
                default_vf: get_default_vf(),
                fix_discontinuities: true, // this actually works brilliantly with the billy joel broken.mkv music video! Without i
                width: this.#player.width,
                height: this.#player.height,
                fps: this.#player.stream.fps || constants.DEFAULT_FPS,
                handle_load_fail: true,
            }]);

            for (var k in observed_mpv_props) {
                this.observe_property(k);
            }
        })

        // return res.then(()=>this.#done);
        return res;
    }

    /** @param {ParsedItem} parsed_item */
    async loadfile(parsed_item) {

        this.#parsed_item = parsed_item;
        this.#preloaded = false;

        await this.ipc_ready;

        var on_load_commands = [];
        for (var f of this.#parsed_item.map.video.files) {
            on_load_commands.push(["video-add", f.filename, "select", f.name]);
        }
        for (var f of this.#parsed_item.map.subtitle.files) {
            on_load_commands.push(["sub-add", f.filename, f.secondary?"auto":"select", f.name]);
        }
        for (var f of this.#parsed_item.map.audio.files) {
            on_load_commands.push(["audio-add", f.filename, "select", f.name]);
        }

        this.#mpv_props_on_load = {};
        for (var k in this.#parsed_item.props) {
            this.set_property(k, this.#parsed_item.props[k]); // important to use force!
        }

        // this.#update_aspect_ratio();
        this.#rebuild_filters();
        this.#update_volume(true);

        this.#lua_message("setup_loadfile", [{
            commands: on_load_commands,
            props: this.#mpv_props_on_load,
        }]);

        this.#preloaded = true;
        
        return super.loadfile(this.#parsed_item.parsed_filename);
    }

    fade_out() {
        this.set_property("end", String(this.time + this.session.$.fade_out_speed + 0.5));
        this.#fading = { time: this.time };
        this.#rebuild_filters();
    }
    
    async set_property(key, value, force=false) {
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
            case "audio_file":
            case "subtitle_file":
            case "video_file_end":
            case "video_file_start":
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
            case "aspect_ratio":
            case "pre_filters":
            case "vid_override":
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
            // case "aspect_ratio":
            //     mpv_key = null;
            //     this.#update_aspect_ratio();
            //     break;
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

    reload = utils.debounce(()=>this.#reload(), 10);
    rebuild_filters = utils.debounce(()=>this.#rebuild_filters(), 10);
    update_volume = utils.debounce(()=>this.#update_volume(), 10);

    #reload(remember_time_pos=true) {
        if (remember_time_pos) this.#update_time_pos();
        return this.session.reload(remember_time_pos);
    }
    
    // #update_aspect_ratio() {
    //     let aspect_ratio = this.#props.aspect_ratio;
    //     if (this.version[0] == 0 && this.version[1] < 40) {
    //         if (aspect_ratio == "auto") {
    //             this.set_property("video-aspect-override", -1);
    //         } else {
    //             this.set_property("video-aspect-override", String(aspect_ratio));
    //         }
    //     } else {
    //         if (aspect_ratio == "auto") {
    //             this.set_property("video-aspect-override", -2);
    //             this.set_property("video-aspect-method", "container");
    //         } else {
    //             this.set_property("video-aspect-override", aspect_ratio);
    //             this.set_property("video-aspect-method", "ignore");
    //         }
    //     }
    //     // if (this.#preloaded) {
    //     //     this.seek().catch(utils.noop); // weird quirk / bug, seek() is required to apply the aspect ratio change when encoding apparently. Didn't used to but now it does.
    //     // }
    // }

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
        if (!this.#preloaded) return;
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

        let [w, h] = [this.#player.width, this.#player.height];
        let fps = this.session_stream.fps;

        let vid_auto = this.#parsed_item.map.video.force_id ?? this.#parsed_item.map.video.auto_id ?? 1;
        let aid_auto = this.#parsed_item.map.audio.force_id ?? this.#parsed_item.map.audio.auto_id ?? 1;
        let sid_auto = this.#parsed_item.map.subtitle.force_id ?? this.#parsed_item.map.subtitle.auto_id ?? false;

        let vid = this.#props.vid_override == "auto" ? vid_auto : this.#props.vid_override;
        let aid = this.#props.aid_override == "auto" ? aid_auto : this.#props.aid_override;
        let sid = this.#props.sid_override == "auto" ? sid_auto : this.#props.sid_override;

        // so confusing...
        if (vid == false) vid = vid_auto;
        if (aid == false) aid = aid_auto;
        
        let v_stream = this.#parsed_item.map.video.streams[vid-1];
        let reason;
        if (!v_stream) reason = "no stream";
        else if (v_stream.albumart) reason = "albumart";

        if (reason) {
            this.logger.error(`Bad video stream selected [${reason}]...`);
            v_stream = this.#parsed_item.map.video.streams.find(s=>s.type == "video" && !s.albumart);
            if (v_stream) {
                vid = v_stream.type_id;
                this.logger.error(`Setting to a safe fallback [${vid}]...`);
            } else {
                throw `Stream selection failed.`;
            }
        }

        let a_stream = this.#parsed_item.map.audio.streams[aid-1];
        let s_stream = this.#parsed_item.map.subtitle.streams[sid-1];

        let interpolation;
        {
            let dfps = this.session_stream.fps || constants.DEFAULT_FPS;
            let vfps = v_stream.fps || v_stream.avg_fps || fps || constants.DEFAULT_FPS;
            if (this.#props.interpolation_mode == "auto") {
                if (vfps) {
                    if (vfps < dfps) {
                        let r =  dfps % vfps;
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
            width: w,
            height: h,
            color: this.#parsed_item.background_color,
        });

        let is_filter_allowed = (filter)=>{
            // var name = String(filter).match(/\w+/i)[0];
            // var allowed = name in this.#mpv_info.allowed_filters;
            // if (!allowed) this.logger.warn(`Filter '${name}' not allowed.`);
            // return allowed;
            return true;
        }

        // -----------------------------------------

        let pre_vf_graph = [];
        let pre_af_graph = [];

        // pre_vf_graph.push(`setpts=N/FRAME_RATE/TB`); // fixes bad PTS for MPEG-TS
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
            let min_x = 1 / w;
            let min_y = 1 / h;

            if ((cw != 1 || ch != 1) && cw >= min_x && ch >= min_y) {
                pre_vf_graph.push(
                    `crop=w=iw*${cw}:h=ih*${ch}:x=iw*${cx}:y=ih*${cy}`
                );
            }
        }

        if (this.#props.aspect_ratio != "auto") {
            let ar = this.#props.aspect_ratio;
            let parts = ar.split(":");
            let w = parts[0];
            let h = parts[1];
            pre_vf_graph.push(`setdar=${w}/${h}`);
        }

        pre_vf_graph.push(`scale=width=(iw*sar)*min(${w}/(iw*sar)\\,${h}/ih):height=ih*min(${w}/(iw*sar)\\,${h}/ih):force_divisible_by=2:reset_sar=1`);

        {
            let c = this.#props.contrast;
            let b = this.#props.brightness;
            let s = this.#props.saturation;
            let g = this.#props.gamma;
            let h = this.#props.hue;
            if (b || s || g || c) {
                pre_vf_graph.push(`eq=${[b && `brightness=${utils.map_range(b, -100, 100, -1, 1)}`, c && `contrast=${utils.map_range(c, -100, 100, 0, 2)}`, s && `saturation=${utils.map_range(s, -100, 100, 0, 2)}`, g && `gamma=${utils.map_range(g, -100, 100, 0, 2)}`].filter(s=>s).join(":")}`);
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

        var get_filters = (p)=>Object.values(p).sort((a,b)=>a.index - b.index).filter(f=>is_filter_allowed(f.name));
        
        var props_pre_filters = get_filters(this.#props.pre_filters);
        var props_filters = get_filters(this.#props.filters);

        ctx.apply([...props_pre_filters, ...props_filters]);

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

        vf_graph.push(`pad=width=${w}:height=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=${this.#parsed_item.background_color}`);

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
                vfades.push(`fade=enable='between(t\\,${offset},${offset+dur})':t=${dir}:st=${offset}:d=${dur}`);
            } else if (type.startsWith("a")) {
                afades.push(`afade=enable='between(t\\,${offset},${offset+dur})':t=${dir}:st=${offset}:d=${dur}`);
            }
        }
        if (this.#fading) {
            vfades.push(`fade=t=out:st=${this.#fading.time+0.25}:d=${this.session.$.fade_out_speed}`);
            afades.push(`afade=t=out:st=${this.#fading.time+0.25}:d=${this.session.$.fade_out_speed}`);
        } else if (this.#parsed_item.props.fade_out && this.duration) {
            vfades.push(`fade=t=out:st=${this.duration-this.#parsed_item.props.fade_out-0.25}:d=${this.#parsed_item.props.fade_out}`);
            afades.push(`afade=t=out:st=${this.duration-this.#parsed_item.props.fade_out-0.25}:d=${this.#parsed_item.props.fade_out}`);
        }

        for (let fade of vfades) {
            vf_graph.push(fade);
        }
        for (let fade of afades) {
            af_graph.push(fade);
        }


        if (this.session_stream.is_test) {
            let font_path = globals.app.resources.get_path("fonts/RobotoMono-Regular.ttf");
            vf_graph.push(`drawtext=text='${utils.ffmpeg_escape("%{pts:hms}")}':fontfile='${utils.ffmpeg_escape(font_path)}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`);
        }
        
        vf_graph.push(VF_FORMAT);

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

        let af = af_graph.filter(is_filter_allowed).map(make_lavfi_filter);
        let vf = vf_graph.filter(is_filter_allowed).map(make_lavfi_filter);
    
        let lavfi_complex_str = ctx.toString();
        this.set_property("lavfi-complex", lavfi_complex_str);
        this.set_property("af", af);
        this.set_property("vf", vf);
        this.set_property("sid", sid);
    }

    #update_volume(immediate=false) {
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
        file.streams.forEach((s,i)=>{
            s = {...s};
            s.title = [s.title, file.name].filter(s=>s).join(" | ");
            if (s.type === "subtitle" && file.secondary) s.secondary = true;
            this.register_stream(s, file.type);
        });
    }

    /** @param {MediaInfoStreamType} type */
    has(type) {
        return this[type].streams.filter(s=>!s.albumart).length > 0;
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
        return this.#map.files.filter(f=>f.type == this.#type);
    }
    get streams() {
        return this.#map.streams.filter(s=>s.type == this.#type);
    }
}

async function create_file(filename, generator) {
    var dir = path.resolve(globals.app.tmp_dir, "0");
    await fs.mkdir(dir, { recursive: true });
    var fullpath = path.resolve(dir, filename);
    if (!CACHE.has(fullpath)) {
        CACHE.set(fullpath, fs.existsSync(fullpath) ? fullpath : Promise.resolve(generator(fullpath)).then(()=>fullpath));
    }
    return CACHE.get(fullpath);
}

async function extract_albumart(media_filename, stream_id, format) {
    var filename = `${utils.md5(media_filename)}-${stream_id}-${format}`;
    return create_file(filename, (fullpath)=>{
        return new FFMPEGWrapper().start([
            `-i`, media_filename,
            `-map`, `0:${stream_id}`,
            `-an`,
            `-sn`,
            `-c:v`, `copy`,
            `-f`, format,
            `-y`,
            fullpath
        ]);
    });
}

async function get_ass_subtitle_as_path(ass_str) {
    var filename = `${utils.md5(ass_str)}.ass`;
    return create_file(filename, async (output_path)=>{
        await globals.app.safe_write_file(output_path, ass_str);
    });
}

class PTSFixer extends BridgeTransform {
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @param {InternalSessionPlayer} player @param {stream.TransformOptions} options */
    constructor(player, options) {
        var ffmpeg = new FFMPEGWrapper();
        ffmpeg.start([
            "-err_detect", "ignore_err",
            "-fflags", "autobsf+flush_packets", // +discardcorrupt+genpts // +nobuffer FUCKS US UP and skips the first 17-ish seconds
            //+igndts+genpts+
            "-flush_packets", "1",
            // `-avoid_negative_ts`, `make_zero`,
            "-f", MPV_OUTPUT_FORMAT,
            "-i", "pipe:0",
            "-c", "copy",
            "-f", MPV_OUTPUT_FORMAT,
            "-muxdelay", "0",
            "-muxpreload", "0",
            // `-fps_mode`, "vfr",
            `-fps_mode`, "passthrough",
            // `-async`, `1`,
            `-output_ts_offset`, `${player.pts}`,
            "pipe:1",
        ]).catch((e)=>{
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
class Demuxer extends stream.Transform {
    /** @type {MpegTsDemuxer} */
    #demuxer;
    #pts = 0;
    #dts = 0;
    #fps = 0;
    get pts() { return this.#pts; }
    get dts() { return this.#dts; }
    get fps() { return this.#fps; }

    /** @param {InternalSessionPlayer} player @param {stream.TransformOptions} options */
    constructor(player, options) {
        super(options);
        var last_pts = 0;
        var last_dts = 0;
        const time_base = 90000;
        this.#demuxer = new MpegTsDemuxer();
        this.#demuxer.on('data', (packet) => {
            if (packet.content_type != 2) return;
            this.#pts = packet.pts / time_base;
            this.#dts = packet.dts / time_base;
            this.#fps = time_base / packet.frame_ticks;
            var delta_pts = Math.max(0, this.#pts - last_pts);
            var delta_dts = Math.max(0, this.#dts - last_dts);
            player.pts += delta_pts;
            player.dts += delta_dts;
            player.fps = this.#fps;
            last_pts = this.#pts;
            last_dts = this.#dts;
        });
    }
    
    _transform(chunk, encoding, callback) {
        this.push(chunk);
        this.#demuxer.write(chunk);
        callback();
    }
}

class RealTimeBuffer extends stream.Transform {
    /** @type {InternalSessionPlayer} */
    #player;
    #total_bytes = 0;
    #is_realtime = false;
    #elapsed_correction = 0;
    // #min_delay = 100;
    /** @param {InternalSessionPlayer} player @param {stream.TransformOptions} options */
    constructor(player, options) {
        super({
            highWaterMark: 8 * 1024,
            ...options
        });
        this.#player = player;
        this.#is_realtime = player.stream.is_realtime;
    }

    async _transform(chunk, encoding, callback) {
        // console.log({chunk:chunk.length, elapsed:this.#player.timer.elapsed / 1000, pts:this.#player.pts});
        let elapsed = this.#player.timer.elapsed / 1000;
        let elapsed_adjusted = elapsed + this.#elapsed_correction;
        let max_buffer_duration = Math.min(this.#player.stream.$.buffer_duration, 60);
        // let max_bps = (this.#player.stream.$.audio_bitrate + this.#player.stream.$.video_bitrate) * 1000 / 8;
        // let max_total_bytes = max_bps * elapsed;
        let buffer_duration = this.#player.pts - elapsed_adjusted;
        let delay = 0;
        this.#total_bytes += chunk.length;

        if (this.#is_realtime && buffer_duration < 0) { // fucks up on billy joel broken.mkv
            // this prevents the buffer from speeding up when there has been a significant pause
            this.#elapsed_correction += buffer_duration;
        }
        
        if (this.#is_realtime && buffer_duration > max_buffer_duration) {
            delay = (buffer_duration - max_buffer_duration) * 1000;
        }
        /* else if (this.#is_realtime && this.#total_bytes > max_total_bytes) {
            delay = (max_total_bytes - this.#total_bytes) / max_bps * 1000;
        } */

        delay = Math.max(0, delay);
        this.push(chunk);
        if (delay) await utils.timeout(delay);
        callback();
    }
}

var make_lavfi_filter = (graph) => ({
    name: "lavfi",
    enabled: true,
    params: { graph }
});

function get_default_vf() {
    let font_path = globals.app.resources.get_path("fonts/RobotoMono-Regular.ttf");
    let vf_graph = [
        `drawtext=text='Invalid Media':fontfile='${utils.ffmpeg_escape(font_path)}':fontsize=20:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2`,
        VF_FORMAT
    ];
    return vf_graph.map(make_lavfi_filter);
}



/* class FFprobePassThrough extends stream.Transform {
    pts_time = 0;
    dts_time = 0;
    pts = 0;
    dts = 0;
    #ffprobe;
    #rl;

    constructor() {
        super({ highWaterMark: 1 });
        // super();

        this.#ffprobe = child_process.spawn('ffprobe', [
            "-f", FFMPEG_OUTPUT_FORMAT,
            "-i", "pipe:0",
            "-show_packets",
            "-select_streams", "v:0",
            "-analyzeduration", "500k",
            "-probesize", "100k",
            "-v", "quiet"
        ]);
        
        // Setup readline interface for FFprobe output
        this.#rl = readline.createInterface(this.#ffprobe.stdout);
        // Process each line of FFprobe output
        this.#rl.on('line', (line) => {
            let m;
            if (m = line.match(/^pts_time=(.+)$/)) {
                this.pts_time = Math.max(this.pts_time, +m[1]);
            } else if (m = line.match(/^dts_time=(.+)$/)) {
                this.dts_time = Math.max(this.dts_time, +m[1]);
            } else if (m = line.match(/^pts=(.+)$/)) {
                this.pts = Math.max(this.pts, +m[1]);
            } else if (m = line.match(/^dts=(.+)$/)) {
                this.dts = Math.max(this.dts, +m[1]);
            }
            debounced_update();
        });

        var debounced_update = utils.debounce(()=>{
            this.emit("update", this);
        }, 10);
        
        // Handle process errors
        this.#ffprobe.on('error', (err) => this.emit('error', err));
        this.#ffprobe.stdin.on('error', (err) => this.emit('error', err));
        this.on("data", (chunk)=>{
            this.#ffprobe.stdin.write(chunk);
        });
    }

    _final(callback) {
        this.#ffprobe.stdin.end();
        this.#ffprobe.on('close', ()=>callback());
    }

    _destroy(err, callback) {
        this.#ffprobe.kill();
        this.#rl.close();
        callback(err);
    }
} */

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