import fs from "fs-extra";
import path from "node:path";
import sharp from "sharp";
import Color from 'color';
import events from "node:events";
import {globals, MPVEDL, MPVEDLEntry, FilterContext } from "./exports.js";
import {utils, MPVWrapper, DataNode, DataNode$, Logger} from "../core/exports.js";
import { get_default_stream, get_stream_by_id, get_auto_background_mode } from "./shared.js";

/** @import { InternalSession, Stream, PlaylistItem$, MediaInfo, PlaylistItemProps, MediaInfoStream, MediaInfoStreamType, FilterInput, Filter, PlaylistItemPropsProps } from './exports.js' */
/** @typedef {MediaInfoStream & {id:number, type_id:number, secondary:boolean}} MediaInfoStreamEx */
/** @typedef {{type:MediaInfoStreamType, start:number, end:number, duration:number, offset:number, loops:number, secondary:boolean, name:string}} RegisterFileOpts */
/** @typedef {RegisterFileOpts & {filename:string, original_filename:string, streams:MediaInfoStreamEx[], type:MediaInfoStreamType}} RegisterFileResult */
/** @typedef {{reload_props:boolean,pause:boolean,start:number}} LoadFileOpts */

// const FORCE_NEXT_ITEM_TIMEOUT = 5 * 1000;
const FORCE_NEXT_ITEM_TIMEOUT = Number.MAX_SAFE_INTEGER;
const FORCE_ABORT_TIMEOUT = 10 * 1000;
const EDL_TRACK_TYPES = ["video", "audio", "sub"];
/** @type {MediaInfoStreamType[]} */
const MEDIA_INFO_STREAM_TYPES = ["video", "audio", "subtitle"];
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const NULL_STREAM_DURATION = 60;
/** @type {Map<string,Promise<string>>} */
const CACHE = new Map();

let IGNORE_MPV_REALTIME_CHANGES = {
    "time-pos": 1,
    "output-frames": 1,
    "output-pts": 1,
    "volume": 1,
    "audio-pts": 1,
    "avsync": 1
};

const LOCAL_MPV_OPTIONS = {
    "start": 1,
    "end": 1,
    "interpolation": 1,
    "deinterlace": 1,
    "video-aspect-override": 1,
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
}

const STREAM_VOLUME_NORMALIZATION_CONFIGS = {
    "dynaudnorm1": `dynaudnorm=f=500:p=0.9:m=8.0:g=7`,
    "dynaudnorm2": `dynaudnorm=f=250:p=0.9:m=8.0:g=5`,
    "loudnorm": `loudnorm=dual_mono=true`
};    

export class SessionPlayer$ extends DataNode$ {
    item = {};
    seeking = false;
    internal_seeking = false;
    preloaded = false;
    loaded = false;
    seekable = true;
    time_pos = 0;
    duration = 0;
    playback_speed = 1;
    current_fps = 0;
    props = {};
}

/** @typedef {Awaited<ReturnType<SessionPlayer["parse_item"]>>} ParsedItem */

/** @extends {DataNode<SessionPlayer$>} */
export class SessionPlayer extends DataNode {
    /** @type {MPVWrapper} */
    #mpv;
    /** @type {PlaylistItemPropsProps} */
    #props = {};
    #props_hash = {};
    #mpv_load_props = {};
    #last_seek_time = 0;
    /** @type {Stream} */
    #stream;
    #ytdl_cache = new utils.Cache(1000 * 60 * 60);
    #allowed_mpv_args = {};
    #allowed_mpv_props = {};
    #width = 0;
    #height = 0;

    /** @type {ParsedItem} */
    parsed_item = {};

    get stream() { return this.#stream; }
    /** @type {InternalSession} */
    get session() { return this.#stream.session; }
    get is_encoding() { return this.#stream.is_encoding; }
    get is_paused() { return !!this.#props.pause; }
    get duration() { return this.$.duration; }
    get time_pos() { return this.$.time_pos; }
    get parsed_filename() { return this.parsed_item.filename; }
    get mpv() { return this.#mpv; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get fps() { return this.#stream.fps; }
    
    /** @param {Stream} stream @param {{width:number, height:number}} opts */
    constructor(stream, opts) {
        super(new SessionPlayer$());

        opts = {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            ...opts
        };

        this.#stream = stream;
        this.#width = opts.width;
        this.#height = opts.height;
        this.#mpv = new MPVWrapper({
            cwd: globals.app.tmp_dir,
        });
        this.logger = new Logger("player");
        this.#mpv.logger.on("log", (log)=>{
            this.logger.log({...log, prefix: log.prefix.slice(1)});
        });

        this.#stream.$.player = this.$;

        this.ready = this.#calc_allowed_mpv_args();
    }

    async #calc_allowed_mpv_args() {
        var proc = await utils.execa(globals.app.mpv_path, ["--list-options"]);
        let temp_mpv_out = proc.stdout;
        for (let line of temp_mpv_out.split("\n")) {
            let m = line.trim().match(/^--([^=\s]+)(?:\s+(.+))?$/);
            if (m) {
                this.#allowed_mpv_args[m[1]] = true;
                this.#allowed_mpv_props[m[1]] = true;
                if (m[2] && m[2].startsWith("Flag")) {
                    this.#allowed_mpv_args["no-"+m[1]] = true;
                }
            }
        }
    }

    async start(args) {

        let mpv_args = [];
        for (var arg of args) {
            if (!arg) continue;
            let m = arg.match(/^--([^=]+)/);
            if (!m) {
                mpv_args.push(arg);
                continue;
            }
            let prop = m[1]
            if (this.#allowed_mpv_args[prop]) mpv_args.push(arg);
            else this.logger.error("Bad mpv arg:", prop);
        }

        let success = await this.#mpv.start(mpv_args).catch((e)=>{
            this.logger.error(e);
        });
        if (!success) return;

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
            ["avsync"]: 0,
            ["container-fps"]: 0,
            ["estimated-vf-fps"]: 0,
            ["display-fps"]: 0,
            ["estimated-display-fps"]: 0,
            ["estimated-frame-number"]: 0,
            ["file-format"]: null,
            ["track-list"]: [],
            ["aid"]: null,
            ["vid"]: null,
            ["sid"]: null,
            // if false actually means source is live (e.g. youtube live-stream)
            ["seekable"]: null,
            ["demuxer-via-network"]: false,
            ["eof-reached"]: false,
            ["cache"]: false,
            ["cache-buffering-state"]: 0,
            ["paused-for-cache"]: false,
            ["audio-pts"]: 0,
            ["video-bitrate"]: 0,
            ["audio-bitrate"]: 0,
            // these are new props that I added...
            // ["output-pts"]: 0,
            // ["output-frames"]: 0,
        }

        await Promise.all(Object.keys(mpv_props).map(k=>{
            this.#props[k] = mpv_props[k];
            this.$.props[k] = mpv_props[k];
            this.#mpv.observe_property(k);
        }));
        
        // let log_history = {};

        this.#mpv.on("before-quit", ()=>{
            clearInterval(tick_interval);
        });
        
        this.#mpv.on("log-message", (log)=>{
            // this.logger.debug(log.text);
            let text = `[${log.prefix}] ${log.text.trim()}`;
            if (globals.app.debug && log.prefix == "livestreamer" && log.level == "fatal") {
                throw new Error(text);
            } else if (log.level == "warn") {
                this.logger.warn(text);
            } else if (log.level == "error" || log.level == "fatal") {
                this.logger.error(text);
            }
        });

        this.#mpv.on("seek", (e)=>{
            this.$.internal_seeking = true;
        });

        this.#mpv.on("playback-restart", (e)=>{
            this.$.internal_seeking = false;
            this.$.seeking = false;
        });
        var last_load_id, last_time_pos=0;
        var pts = 0;

        this.#mpv.on("property-change", async (e)=>{
            let {name, data} = e;
            /* if (name === "path" && data == "null://eof") {
                this.next();
            } */
            if (name === "eof-reached" && data) {
                if (this.#props.loop_file) {
                    this.reload();
                } else {
                    this.next();
                }
            }
            if (!(name in IGNORE_MPV_REALTIME_CHANGES)) {
                this.$.props[name] = data;
            }
            if (name === "time-pos") {
                if (this.#mpv.load_id == last_load_id && this.$.loaded && !this.$.internal_seeking) {
                    var delta = Math.max(0, (data - last_time_pos) || 0);
                    if (Math.abs(delta) > 5) {
                        this.logger.warn(`pts jumped ${delta}`);
                    }
                    pts += delta;
                }
                last_time_pos = data;
            }
            last_load_id = this.#mpv.load_id;
            this.#props[name] = data;
        });

        /* this.#mpv.on("end-file", (e)=>{
            if (e.reason == "eof") {
                this.next();
            }
        }); */

        this.#mpv.on("idle", ()=>{
            // if encoding then idle  = re-initialize, breaks stream.
            if (this.is_encoding) this.#mpv.quit();
            this.logger.info("MPV idle.");
        });

        this.#mpv.request_log_messages("info");

        var seekable_ranges_hash;
        var last_pts = 0;
        var last_speed_check = Date.now();
        
        var tick_interval = setInterval(async()=>{
            let ts = Date.now();

            {
                let diff_pts = (pts - last_pts) * 1000;
                let diff_ts = ts - last_speed_check;
                let speed = Math.max(0, (diff_pts / diff_ts) || 0);
                this.$.playback_speed = speed;
                this.emit("speed", speed);
                last_pts = pts;
                last_speed_check = ts;
            }
            
            if (this.#props.cache) {
                let new_ranges;
                let demuxer_cache_state = (await this.#mpv.get_property("demuxer-cache-state").catch(()=>null));
                if (demuxer_cache_state) {
                    new_ranges = demuxer_cache_state["seekable-ranges"];
                }
                var new_hash = JSON.stringify(new_ranges);
                if (new_hash != seekable_ranges_hash) {
                    seekable_ranges_hash = new_hash;
                    this.$.seekable_ranges = new_ranges || [];
                }
            }
    
            for (var k in IGNORE_MPV_REALTIME_CHANGES) {
                this.$.props[k] = this.#props[k];
            }

            this.$.bitrate = this.#props["video-bitrate"] + this.#props["audio-bitrate"];
    
            this.update_time_pos();

            // if (!this.props["pause"]) {
            //     var hash1 = JSON.stringify([this.load_id, this.props["time-pos"]]);
            //     if (hash1 != last_hash1) last_ts1 = ts;
            //     if (ts > (last_ts1 + FORCE_NEXT_ITEM_TIMEOUT)) {
            //         if (!globals.app.debug) this.load_next();
            //     }
            //     last_hash1 = hash1;

            //     //detects if stream has frozen
            //     if (this.$.loaded) {
            //         var hash2 = pts;
            //         if (hash2 != last_hash2) last_ts2 = ts;
            //         if (ts > (last_ts2 + FORCE_ABORT_TIMEOUT)) {
            //             if (!globals.app.debug) this.#mpv.quit();
            //         }
            //         last_hash2 = hash2;
            //     }
            // }
        }, 1000);

        return true;
    }

    /** @param {PlaylistItem$} item @param {LoadFileOpts} opts */
    async loadfile(item, opts) {
        this.$.preloaded = false;
        this.$.loaded = false;
        
        opts = {
            pause: false,
            start: 0,
            reload_props: true,
            ...opts,
        };
        let start = +(opts.start||0);
        let on_load_commands = [];

        let props = item && item.props;
        if (!opts.reload_props) props = utils.json_copy(this.#props);
        let parsed_item = this.parsed_item = await this.parse_item({...item, props});
        let {duration, is_unknown_duration} = parsed_item;
        parsed_item.loops = opts.loops;

        if (!is_unknown_duration && !duration) {
            throw `Duration is 0, skipping '${item.filename}'...`;
        }

        props = {...parsed_item.props};
        props.pause = !!opts.pause;
        if (!parsed_item.seekable) start = 0;
        if (start > 0) props.start = start;
        if (duration) props.end = duration;
        
        for (var f of parsed_item.map.video.files) {
            on_load_commands.push(["video-add", f.filename, "select", f.name]);
        }
        for (var f of parsed_item.map.subtitle.files) {
            on_load_commands.push(["sub-add", f.filename, f.secondary?"auto":"select", f.name]);
        }
        for (var f of parsed_item.map.audio.files) {
            on_load_commands.push(["audio-add", f.filename, "select", f.name]);
        }

        this.$.item = utils.json_copy(parsed_item);
        this.$.time_pos = start;
        this.$.duration = duration;
        this.$.seekable = parsed_item.seekable;

        let secondary_sid = (parsed_item.map.subtitle.streams.find(s=>s.secondary)||{}).type_id ?? false;
        props["secondary-sid"] = secondary_sid;
        if (!duration) props.loop_file = true;
        
        this.#props = {};
        this.#props_hash = {};
        this.#mpv_load_props = {};
        this.$.props = {};
        for (var k in props) {
            this.set_property(k, props[k]);
        }

        this.rebuild_filters();
        this.update_volume(true);
        
        this.$.preloaded = true;

        this.update_time_pos();

        var load_opts = {
            filename: parsed_item.parsed_filename,
            props: this.#mpv_load_props,
            commands: on_load_commands,
            width: this.#width,
            height: this.#height,
            fps: this.fps
        }
        this.lua_message("setup_loadfile", [load_opts]);
        
        this.logger.info("loading file:", parsed_item.filename);
        var res = await this.#mpv.loadfile(parsed_item.parsed_filename)
        
        this.$.loaded = true;

        return res;
    }
    
    /** @typedef {{start:number, offset:number, duration:number, media_type:string, loop:boolean, root:PlaylistItem$}} ParseItemOpts */
    /** @param {PlaylistItem$} _item @param {ParseItemOpts} opts */
    async parse_item(_item, opts) {
        
        let t0 = Date.now();
        if (typeof _item !== "object" || _item === null) _item = { filename: _item || null };
        let item = this.session.evaluate_playlist_item(_item);

        opts = {
            clip_start: item.props.clip_start || 0,
            clip_end: item.props.clip_end || undefined,
            clip_offset: item.props.clip_offset || 0,
            clip_loops: item.props.clip_loops || 1,
            offset: 0,
            duration: 0,
            media_type: null,
            loop: false,
            root: undefined,
            fade_in: +item.props.fade_in || 0,
            fade_out: +item.props.fade_out || 0,
            ...opts,
        };

        let media_info = await this.session.update_media_info(item.filename, {silent:true});

        if (!item.fades) item.fades = [];
        let {filename, id, props} = item;
        let {clip_start, clip_end, clip_offset, clip_loops, offset, duration, media_type, loop, root, fade_in, fade_out} = opts;
        duration = duration || props.duration || 0;
        let is_clipped = clip_start || clip_end || clip_offset || clip_loops != 1;
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
        
        /** @type {MPVEDL} */
        let edl;
                
        /** @param {string} filename @param {MediaInfoStreamType} type @param {RegisterFileOpts} opts */
        const add_file = async (filename, type, opts)=>{
            var original_filename = filename;
            if (!type) throw new Error("type is required");
            opts = {
                name: filename ? path.basename(filename) : "None",
                ...opts,
            };
            let tmp = (await this.parse_item(filename, {media_type:type, duration, root, loop:(type === "video")}));
            map.register_file({filename: tmp.parsed_filename, original_filename, streams:tmp.map.streams, ...opts, type});
        }

        if ((filename||"").startsWith("livestreamer://")) {
            let ls_path = new URL(filename).host;
            filename = "null://";
            if (ls_path == "intertitle") {
                let ass_str = ass_create(undefined, [{
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
                    text: ass_fade(props.fade_in || 0, props.fade_out || 0) + (ass_rotate(...(Array.from(props.title_rotation)||[0,0,0]))) + ass_text(props.title_text),
                }]);
                // filename = is_root ? `memory://${ass_str}` : await get_ass_subtitle(ass_str);
                filename = await get_ass_subtitle(ass_str);
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
            filename = await get_image_as_video(filename, this.#width, this.#height, background_color);
            map.register_stream({type:"video", codec:"h264", duration:NULL_STREAM_DURATION, fps:1}, true);
            media_duration = NULL_STREAM_DURATION;
        }
        
        let is_rtmp = !!filename.match(/^rtmps?:/);
        if (is_rtmp) {
            map.register_stream({type:"video"}, true);
            map.register_stream({type:"audio"}, true);
        }

        if (media_info.ytdl && (!is_root || is_clipped)) {
            filename = await this.youtube_url_to_edl(filename);
            /* for (var entry of edl.entries) {
                if (entry.header == "!delay_open") {
                    map.register_stream({type:entry.header.split(" ")[1]}, true);
                }
            } */
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
        
        // !! CHECK THIS WORKS::::
        // let is_unknown_duration = !duration && (is_empty || is_image || is_rtmp);
        let is_unknown_duration = !duration && !media_info.duration && !is_playlist;
        duration = duration || media_duration;
        let fix_low_fps_duration = (is_image || is_empty) && !is_unknown_duration && media_type == "video";
        if (fix_low_fps_duration) duration++;

        // this only works for jpg and webp... what's the point?
        /* if (is_image && is_root) {
            filename = await this.get_image_as_mf_sequence(filename, NULL_STREAM_DURATION);
            media_duration = NULL_STREAM_DURATION;
        } else { */

        if (is_playlist && (props.playlist_mode || !is_root)) {

            let is_2track = props.playlist_mode == 2;
            edl = new MPVEDL();
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
                                track.entries.push(new MPVEDLEntry(tmp.parsed_filename, {
                                    length: (pad_duration).toFixed(3)
                                }));
                            }
                        }
                    }
                }
                if (track.entries.length && track.type) {
                    if (edl.length) edl.append("!new_stream");
                    edl.append(new MPVEDLEntry("!delay_open", {media_type: track.type}));
                }
                edl.append(...track.entries);
            }

        } else if (!is_root) {

            let pad_duration = Math.max(0, duration - media_duration);
            let duration_mismatch = (pad_duration > 0.04);
            if (duration_mismatch || media_type_mismatch) {
                edl = new MPVEDL();
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
                    if (t === "audio") null_filename = await get_null_audio();
                    else if (t === "video") null_filename = await get_color_as_video(this.#width, this.#height, background_color);
                    else if (t === "subtitle") null_filename = await get_null_subtitle();
                    if (!is_empty) edl.append("!new_stream");
                    edl.append(...MPVEDL.repeat(null_filename, {end:NULL_STREAM_DURATION, duration}));
                }
            }
        }
        
        if (is_root) {

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
                    await add_file(await extract_albumart(filename, map.streams.indexOf(s), s.codec), "video");
                    break embed;
                }
            } else if (background_mode == "logo") {
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

        }
        
        if (is_clipped) {
            let repeat_opts = {
                start: clip_start || 0,
                end: clip_end || duration,
                loops: clip_loops || 1,
                offset: clip_offset || 0,
            };
            edl = new MPVEDL(MPVEDL.repeat(edl ? edl.toString() : filename, repeat_opts));
        }
        // }

        fade_in = utils.round_precise(fade_in || 0, 3);
        if (fade_in>0) {
            if (needs_video) root.fades.push(["v", "in", offset, fade_in])
            if (needs_audio) root.fades.push(["a", "in", offset, fade_in])
        }

        if (duration) {
            fade_out = utils.round_precise(fade_out || 0, 3);
            if (fade_out>0) {
                if (needs_video) root.fades.push(["v", "out", offset + duration - fade_out, fade_out])
                if (needs_audio) root.fades.push(["a", "out", offset + duration - fade_out, fade_out])
            }
        }
        
        if (edl) {
            duration = edl.duration;
            filename = edl.toString();
            map = new StreamMap();
            if (!media_type || media_type == "video") map.register_stream({type:"video"}, true);
            if (!media_type || media_type == "audio") map.register_stream({type:"audio"}, true);
            if (media_type == "subtitle") map.register_stream({type:"subtitle"}, true);
        }

        if (fix_low_fps_duration) duration--;
        if (is_unknown_duration) duration = 0;

        let seekable = !!duration;
        let internal_seekable = !is_rtmp;

        let t1 = Date.now();

        if (is_root) {
            this.logger.debug(`parse_item ${item.filename} took ${t1 - t0}ms`);
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
            edl,
            map,
        };
    }
    
    async set_property(key, value) {
        var hash = JSON.stringify(value);
        if (this.#props_hash[key] === hash) return;
        this.#props[key] = value;
        this.#props_hash[key] = hash;
        this.$.props[key] = value;
        let mpv_key = key, mpv_value = value;

        switch (key) {
            case "start":
            case "end":
                mpv_value = String(value);
                break;
            case "aspect_ratio":
                mpv_key = "video-aspect-override";
                break;
            case "audio_delay":
                if (!this.is_encoding) mpv_key = "audio-delay";
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
                // mpv_key = "loop-file";
                break;
            case "audio_pitch_correction":
                mpv_key = "audio-pitch-correction";
                break;
        }

        if (this.$.preloaded) {
            switch (key) {
                case "fade_in":
                case "fade_out":
                case "video_file":
                case "audio_file":
                case "subtitle_file":
                    this.debounced_reload();
                    break;
                case "deinterlace_mode":
                case "interpolation_mode":
                case "audio_delay":
                case "audio_channels":
                case "volume_normalization":
                case "crop":
                case "filters":
                case "pre_filters":
                case "vid_override":
                case "aid_override":
                case "sid_override":
                    this.debounced_rebuild_filters();
                    break;
                case "volume_multiplier":
                    this.debounced_update_volume();
                    break;
            }
        }
        
        var mpv_opt = mpv_key.split("/")[0];
        if (mpv_key in LOCAL_MPV_OPTIONS) {
            mpv_key = `file-local-options/${mpv_key}`;
        }
        if (this.#allowed_mpv_props[mpv_opt]) {
            if (this.$.preloaded) {
                return this.#mpv.set_property(mpv_key, mpv_value);
            } else {
                this.#mpv_load_props[mpv_key] = mpv_value;
            }
        }
    }

    async reload(remember_time_pos=false) {
        await this.session.reload(remember_time_pos);
    }

    seek(t) {
        if (!this.parsed_item.internal_seekable) return;
        this.#last_seek_time = t;
        this.$.seeking = true;
        this.update_time_pos();
        return this.#mpv.seek(t);
    }

    lua_message(name, args) {
        if (!Array.isArray(args)) args = [args];
        return this.#mpv.command("script-message-to", "livestreamer", name, JSON.stringify(args));
    }

    /** @param {number|undefined} time_pos @description time_pos is the time position to set the video to (according to the user). */
    update_time_pos(time_pos) {
        if (this.#mpv.quitting) return;
        if (!this.$.loaded) return;
        if (time_pos === undefined) {
            if (this.$.seeking) {
                time_pos = this.#last_seek_time;
            } else {
                time_pos = Math.max(0, +(this.#props["time-pos"] ?? this.#props["start"] ?? 0));
            }
        }
        this.session.$.time_pos = this.$.time_pos = time_pos;
    }

    rebuild_filters() {

        let [w, h] = [this.#width, this.#height];
        let fps = this.fps;

        let vid_auto = this.parsed_item.map.video.force_id ?? this.parsed_item.map.video.auto_id ?? 1;
        let aid_auto = this.parsed_item.map.audio.force_id ?? this.parsed_item.map.audio.auto_id ?? 1;
        let sid_auto = this.parsed_item.map.subtitle.force_id ?? this.parsed_item.map.subtitle.auto_id ?? false;

        let vid = this.#props.vid_override == "auto" ? vid_auto : this.#props.vid_override;
        let aid = this.#props.aid_override == "auto" ? aid_auto : this.#props.aid_override;
        let sid = this.#props.sid_override == "auto" ? sid_auto : this.#props.sid_override;

        // so confusing...
        if (vid == false) vid = vid_auto;
        if (aid == false) aid = aid_auto;
        
        let v_stream = this.parsed_item.map.video.streams[vid-1];
        let reason;
        if (!v_stream) reason = "no stream";
        else if (v_stream.albumart) reason = "albumart";

        if (reason) {
            this.logger.error(`Bad video stream selected [${reason}]...`);
            v_stream = this.parsed_item.map.video.streams.find(s=>s.type == "video" && !s.albumart);
            if (v_stream) {
                vid = v_stream.type_id;
                this.logger.error(`Setting to a safe fallback [${vid}]...`);
            } else {
                throw `Stream selection failed.`;
            }
        }

        let a_stream = this.parsed_item.map.audio.streams[aid-1];
        let s_stream = this.parsed_item.map.subtitle.streams[sid-1];

        let deinterlace = this.#props.deinterlace_mode;
        if (deinterlace == "auto") {
            deinterlace = !!v_stream.interlaced;
        }

        let interpolation;
        {
            let dfps = (this.stream.is_encoding ? this.stream.fps : this.#props["display-fps"]) || 30;
            let vfps = v_stream.fps || v_stream.avg_fps || fps || 30;
            this.$.current_fps = vfps;
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

        var ctx = new FilterContext({
            aid: `aid${aid}`,
            vid: `vid${vid}`,
            sid: `sid${sid}`,
            fps: fps,
            width: w,
            height: h,
            color: this.parsed_item.background_color,
        });

        // -----------------------------------------

        let pre_vf_graph = [];
        // let fps = +(this.props.force_fps || this.stream.fps);

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

        let scale_filter = `scale=width=(iw*sar)*min(${w}/(iw*sar)\\,${h}/ih):height=ih*min(${w}/(iw*sar)\\,${h}/ih):force_divisible_by=2`;
        
        pre_vf_graph.push(scale_filter);

        if (this.is_encoding) {
            if (fps) {
                // it appears interpolation is not applied in encoding mode so we have to use filters:
                if (interpolation) {
                    // works incredibly well but slow as fuck
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
        }

        {
            let pre_vf = ctx.id("pre_vf");
            ctx.stack.push(`[${ctx.vid}]${pre_vf_graph.join(",")}[${pre_vf}]`);
            ctx.vid = pre_vf;
        }

        ctx.apply([...this.#props.pre_filters, ...this.#props.filters]);

        // -----------------------------------------


        let vf_graph = [];
        let af_graph = [];
       
        // {
        //     let left = utils.clamp(Math.abs(this.props.crop[0] || 0));
        //     let top = utils.clamp(Math.abs(this.props.crop[1] || 0));
        //     let right = utils.clamp(Math.abs(this.props.crop[2] || 0));
        //     let bottom = utils.clamp(Math.abs(this.props.crop[3] || 0));
        //     if (left || right || top || bottom) {
        //         vf_graph.push(
        //             `crop=w=iw*dar*${Math.abs(1-right-left)}:h=ih*${Math.abs(1-bottom-top)}:x=iw*dar*${left}:y=ih*${top}`
        //         );
        //     }
        // }

        let audio_stream = get_stream_by_id(this.#props.aid, this.parsed_item.map.audio.streams);
        let has_2_channels = audio_stream ? audio_stream.channels >= 2 : false;

        let ac = this.#props.audio_channels;
        if (has_2_channels && ac == "mix") {
            af_graph.push(
                "pan=stereo|c0=.5*c0+.5*c1|c1=.5*c0+.5*c1"
            );
        } else if (has_2_channels && ac == "left") {
            af_graph.push(
                "pan=stereo|c0=c0|c1=c0"
            );
        } else if (has_2_channels && ac == "right") {
            af_graph.push(
                "pan=stereo|c0=c1|c1=c1"
            ); // if mono this may break as c1 does not exist?
        } else {
            af_graph.push(
                `pan=stereo|FL<1.0*FL+0.707*FC+0.707*BL|FR<1.0*FR+0.707*FC+0.707*BR`,
            );
        }

        if (this.is_encoding && this.#props.audio_delay) {
            af_graph.push(
                `asetpts=PTS+${this.#props.audio_delay}/TB`,
            );
        }

        af_graph.push(
            `aresample=async=1`
        );

        var pad_filter = `pad=width=${w}:height=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=${this.parsed_item.background_color}`;

        vf_graph.push(
            pad_filter,
            `format=yuv420p`
        );
        
        if (this.duration) {
            for (let [type, dir, offset, dur] of this.parsed_item.fades) {
                offset = Math.max(0, offset);
                let is_final_out = dir == "out" && Math.abs((offset + dur) - this.duration) < 0.25;
                let edur = is_final_out ? dur + 1 : dur;
                if (dir == "out") offset -= 0.25;
                offset = Math.max(0, offset);
                if (type.startsWith("v")) {
                    vf_graph.push(`fade=enable='between(t\\,${offset},${offset+edur})':t=${dir}:st=${offset}:d=${dur}`);
                } else if (type.startsWith("a")) {
                    af_graph.push(`afade=enable='between(t\\,${offset},${offset+edur})':t=${dir}:st=${offset}:d=${dur}`);
                }
            }
        }

        if (this.stream.is_test) {
            vf_graph.push(
                `drawtext=text='%{pts\\:hms}':fontfile='${utils.ffmpeg_escape_file_path(path.resolve(globals.app.resources_dir,"fonts", "RobotoMono-Regular.ttf"))}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`,
            );
        }

        let norm_method = this.#props.volume_normalization;
        let norm_filter_option = STREAM_VOLUME_NORMALIZATION_CONFIGS[norm_method];
        if (norm_filter_option) {
            af_graph.push(norm_filter_option);
        }

        if (vf_graph.length) {
            let vf = ctx.id("vf");
            ctx.stack.push(`[${ctx.vid}]${vf_graph.join(",")}[${vf}]`);
            ctx.vid = vf;
        }

        if (af_graph.length) {
            let af = ctx.id("af");
            ctx.stack.push(`[${ctx.aid}]${af_graph.join(",")}[${af}]`);
            ctx.aid = af;
        }
    
        let lavfi_complex_str = ctx.toString();
        this.set_property("lavfi-complex", lavfi_complex_str);
        this.set_property("deinterlace", deinterlace); // apparently doesnt need a filter to work in encoding mode
        this.set_property("interpolation", interpolation);
    }

    update_volume(immediate=false) {
        this.lua_message("update_volume", [this.session.$.volume_target * this.#props.volume_multiplier, this.session.$.volume_speed, immediate]);
    }
    
    debounced_reload = utils.debounce(()=>this.reload(true), 10);
    debounced_rebuild_filters = utils.debounce(()=>this.rebuild_filters(), 10);
    debounced_update_volume = utils.debounce(()=>this.update_volume(), 10);

    next() {
        return this.session.playlist_next();
    }

    /** @param {string} url @returns {Promise<string>} */
    async youtube_url_to_edl(url) {
        if (!this.#ytdl_cache.has(url)) this.#ytdl_cache.set(url, globals.app.youtube_url_to_edl(url));
        return this.#ytdl_cache.get(url);
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
            if (s.type === "subtitle" && opts.secondary) s.secondary = true;
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

async function get_null_audio() {
    var filename = `na`;
    if (!CACHE.get(filename)) {
        CACHE.set(filename, (async ()=>{
            var output_path = path.resolve(globals.app.tmp_dir, filename);
            await utils.execa(globals.app.ffmpeg_path, [
                "-f", "lavfi",
                "-i", "anullsrc,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo",
                "-c:a", "flac",
                "-f", "flac",
                "-t", `${NULL_STREAM_DURATION}`,
                `-y`,
                output_path
            ]);
            return output_path;
        })());
    }
    return CACHE.get(filename);
}

async function get_ass_subtitle(ass) {
    var filename = utils.md5(ass);
    if (!CACHE.get(filename)) {
        CACHE.set(filename, (async ()=>{
            var output_path = path.resolve(globals.app.tmp_dir, filename);
            await fs.writeFile(output_path, ass);
            return output_path;
        })());
    }
    return CACHE.get(filename);
}

async function get_null_subtitle() {
    await get_ass_subtitle(ass_create({}, [], [{end:NULL_STREAM_DURATION, text:""}]));
}

/** @param {number} color */
async function get_color_as_video(w, h, color) {
    var color_str = Color(color || 0x000000).hex();
    var filename = `${color_str}-${w}x${h}`;
    if (!CACHE.get(filename)) {
        CACHE.set(filename, (async ()=>{
            var output_path = path.resolve(globals.app.tmp_dir, filename);
            await utils.execa(globals.app.ffmpeg_path, [
                `-r`, `1`,
                "-f", "lavfi",
                "-i", `color=c=${color_str}:s=${w}x${h}:r=1`,
                `-crf`, `0`,
                `-tune`, `stillimage,zerolatency`,
                `-c:v`, `libx264`,
                "-preset:v", "ultrafast",
                "-pix_fmt", "yuv420p",
                `-f`, `matroska`,
                `-g`, `${NULL_STREAM_DURATION+1}`,
                "-t", `${NULL_STREAM_DURATION+1}`,
                `-y`,
                output_path
            ]);
            return output_path;
        })());
    }
    return CACHE.get(filename);
}

async function get_image_as_video(image_filename, w=1280, h=720, color=0x000000) {
    var color_str = Color(color).hex();
    image_filename = path.resolve(image_filename);
    var hash = utils.md5(image_filename);
    var filename = `${hash}-${color_str}-${w}x${h}`;
    if (!CACHE.get(filename)) {
        CACHE.set(filename, (async ()=>{
            var t0 = Date.now();
            var img = sharp(image_filename);
            if ((await img.metadata()).channels == 4) {
                var flat_path = path.resolve(globals.app.tmp_dir, `${hash}-${color_str}.png`);
                if (!await fs.exists(flat_path)) {
                    await img.flatten({ background: color_str }).toFile(flat_path);
                    image_filename = flat_path;
                }
            }
            var output_path = path.resolve(globals.app.tmp_dir, filename);
            await utils.execa(globals.app.ffmpeg_path, [
                `-r`, `1`,
                `-loop`, `1`,
                `-i`, image_filename,
                // `-vf`, `scale=ceil((iw*sar)*min(${w}/(iw*sar)/2)*2\\,${h}/ih):ih*min(${w}/(iw*sar)\\,${h}/ih)`,
                `-vf`, `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
                `-tune`, `stillimage,zerolatency`,
                `-crf`, `0`,
                // `-b:v`, `10m`,
                `-c:v`, `libx264`,
                "-preset:v", "ultrafast",
                "-pix_fmt", "yuv420p",
                `-f`, `matroska`,
                `-g`, `${NULL_STREAM_DURATION+1}`,
                `-t`, `${NULL_STREAM_DURATION+1}`,
                `-y`,
                output_path
            ]);
            var t1 = Date.now();
            globals.app.logger.info(`get_image_as_video '${image_filename}' ${t1-t0}ms`);
            return output_path;
        })());
    }
    return CACHE.get(filename);
}

async function extract_albumart(media_filename, stream_id, format) {
    var filename = `${utils.md5(media_filename)}-${stream_id}-${format}`;
    if (!CACHE.get(filename)) {
        CACHE.set(filename, (async ()=>{
            var output_path = path.resolve(globals.app.tmp_dir, filename);
            await utils.execa(globals.app.ffmpeg_path, [
                `-i`, media_filename,
                `-map`, `0:${stream_id}`,
                `-an`,
                `-sn`,
                `-c:v`, `copy`,
                `-f`, format,
                `-y`,
                output_path
            ]);
            return output_path;
        })());
    }
    return CACHE.get(filename);
}

/* async function get_image_as_mf_sequence(image_filename, duration=NULL_STREAM_DURATION) {
    duration = Math.ceil(duration);
    var hash = utils.md5(image_filename);
    var filename = path.resolve(globals.app.tmp_dir, `${hash}-${duration}`);
    if (!await fs.exists(filename)) {
        await fs.writeFile(filename, new Array(duration).fill(image_filename).join("\n"));
    }
    return `mf://@${filename.replace(/\\/g, "/")}`;
} */

/** @param {width:number, height:number} meta @param {(AssStyle|AssStyle[])} styles @param {(AssEvent|AssEvent[])} events */
function ass_create(meta, styles, events) {
    meta = {...meta};
    if (!Array.isArray(events)) events = [events||{}];
    if (!Array.isArray(styles)) styles = [styles||{}];
    return `[Script Info]
ScriptType: v4.00+
WrapStyle: ${meta.wrap_style??2}
ScaledBorderAndShadow: ${(meta.scaled_border_and_shadow??true)?"yes":"no"}
YCbCr Matrix: ${meta.ycbcr_matrix??"None"}
PlayResX: ${meta.width||384}
PlayResY: ${meta.height||288}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles.map(s=>ass_style(s)).join("\n")}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.map(l=>ass_event({style: styles[0].name, ...l})).join("\n")}`;
}

/** @typedef {{style:string, fade_in: number, fade_out: number, rotation: [number,number,number], start: number, end: number, text: string}} AssEvent */
/** @param {AssEvent} o */
function ass_event(o) {
    var props = [
        o.layer||0,
        ass_time(o.start||0),
        ass_time(o.end||0),
        o.style||"Default",
        o.name||"",
        o.margin_l||0,
        o.margin_r||0,
        o.margin_v||0,
        o.effect||"",
        o.text||""
    ]
    return `Dialogue: ${props.join(",")}`;
}

/** @typedef {{style: string, font: string, size: number, color: number, secondary_color: number, outline_color: number, shadow_color: number, bold: number, italic: number, underline: number, spacing: number, outline_thickness: number, shadow_depth: number, alignment: number, margin_l: number, margin_r: number, margin_v: number, encoding: number, border_style: number, angle: number, scale_x: number, scale_y: number, strike_out: number}} AssStyle */
/** @param {AssStyle} o */
function ass_style(o) {
    var props = [
        o.style||"Default",
        o.font||"Arial",
        o.size||24,
        ass_color(o.color||0xffffff),
        ass_color(o.secondary_color||o.color||0xffffff),
        ass_color(o.outline_color||0x000000),
        ass_color(o.shadow_color||0x000000),
        (+o.bold||0)*-1,
        (+o.italic||0)*-1,
        (+o.underline||0)*-1,
        (+o.strike_out||0)*-1,
        (o.scale_x||1)*100,
        (o.scale_y||1)*100,
        o.spacing||0,
        o.angle||0,
        o.border_style||1,
        o.outline_thickness||1,
        o.shadow_depth||0,
        o.alignment||2,
        o.margin_l||10,
        o.margin_r||10,
        o.margin_v||10,
        o.encoding||1
    ]
    return `Style: ${props.join(", ")}`;
}
function ass_text(text) {
    return (text||"").replace(/\r?\n/g, "\\N");
}
function ass_fade(fade_in=0, fade_out=0) {
    fade_in = +(fade_in || 0);
    fade_out = +(fade_out || 0);
    if (fade_in || fade_out) return `{\\fad(${fade_in*1000},${fade_out*1000})}`;
    return "";
}
function ass_rotate(x=0, y=0, z=0) {
    if (x || y || z) return `{\\frx${x||0}}{\\fry${y||0}}{\\frz${-(z||0)}}`;
    return "";
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
    var c = Color(color);
    // ass color is in BBGGRR or AABBGGRR format
    // (1-c.alpha())*255, 
    return  `&H${[c.blue(), c.green(), c.red()].map(n=>n.toString(16).padStart(2,"0").toUpperCase()).join("")}`;
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