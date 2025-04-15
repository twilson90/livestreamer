import fs from "fs-extra";
import path from "node:path";
import sharp from "sharp";
import Color from 'color';
import {globals, utils, MPVWrapper, InternalSessionProps, MPVEDL, MPVEDLEntry, MAX_EDL_REPEATS, DataNode, DataNode$, Logger, FilterContext} from "./exports.js";
import { get_default_stream, get_stream_by_id, get_auto_background_mode } from "./shared.js";

/** @import { InternalSession, Stream, PlaylistItem$, MediaInfo, PlaylistItemProps, MediaInfoStream, MediaInfoStreamType, FilterInput, Filter } from './exports.js' */
/** @typedef {Record<keyof typeof PlaylistItemProps.props, any>} PlaylistItemPropsProps */
/** @typedef {MediaInfoStream & {id:number, type_id:number, secondary:boolean}} MediaInfoStreamEx */
/** @typedef {{type:MediaInfoStreamType, start:number, end:number, duration:number, offset:number, loops:number, secondary:boolean, name:string}} RegisterFileOpts */
/** @typedef {RegisterFileOpts & {filename:string, original_filename:string, streams:MediaInfoStreamEx[], type:MediaInfoStreamType}} RegisterFileResult */

// const FORCE_NEXT_ITEM_TIMEOUT = 5 * 1000;
const FORCE_NEXT_ITEM_TIMEOUT = Number.MAX_SAFE_INTEGER;
const FORCE_ABORT_TIMEOUT = 10 * 1000;
const DEFAULT_FPS = 30;
const TICK_RATE = 30;
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
};

const STREAM_VOLUME_NORMALIZATION_CONFIGS = {
    "dynaudnorm1": `dynaudnorm=f=500:p=0.9:m=8.0:g=7`,
    "dynaudnorm2": `dynaudnorm=f=250:p=0.9:m=8.0:g=5`,
    "loudnorm": `loudnorm=dual_mono=true`
};

export class MPVSessionWrapper$ extends DataNode$ {
    ctx = new MPVContext$();
}

/** @extends {DataNode<MPVSessionWrapper$>} */
export class MPVSessionWrapper extends DataNode {
    #mpv_last_speed_check = Date.now();
    #mpv_last_pts = 0;
    #tick_interval;
    #long_tick_interval;
    #time_progressed = 0;
    /** @type {Stream} */
    #stream;

    allowed_mpv_args = {};
    allowed_mpv_props = {};
    width = 0;
    height = 0;
    ctx = new MPVContext(this);
    get stream() { return this.#stream; }
    /** @type {InternalSession} */
    get session() { return this.#stream.session; }
    get is_encoding() { return this.#stream.is_encode; }
    
    /** @param {Stream} stream @param {{width:number, height:number}} opts */
    constructor(stream, opts) {
        opts = {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            ...opts
        };
        
        super(new MPVSessionWrapper$());

        this.#stream = stream;
        this.width = opts.width;
        this.height = opts.height;
        this.mpv = new MPVWrapper({
            cwd: globals.app.tmp_dir,
        });
        this.logger = new Logger("mpv");
        this.mpv.logger.on("log", (log)=>{
            this.logger.log({...log, prefix: log.prefix.slice(1)});
        });
        stream.$.mpv = this.$;

        this.ready = this.#calc_allowed_mpv_args();
    }

    async #calc_allowed_mpv_args() {
        var proc = await utils.execa(globals.app.mpv_path, ["--list-options"]);
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
    }

    async start(_mpv_args) {

        let mpv_args = [];
        for (var arg of _mpv_args) {
            if (!arg) continue;
            let m = arg.match(/^--([^=]+)/);
            if (!m) {
                mpv_args.push(arg);
                continue;
            }
            let prop = m[1]
            if (this.allowed_mpv_args[prop]) mpv_args.push(arg);
            else this.logger.error("Bad mpv arg:", prop);
        }

        let success = await this.mpv.start(mpv_args).catch((e)=>{
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
            ["audio-pts"]: 0,
            // these are new props that I added...
            ["output-pts"]: 0,
            ["output-frames"]: 0,
        }

        for (let k in mpv_props) {
            this.ctx.props[k] = mpv_props[k];
            this.ctx.$.props[k] = mpv_props[k];
            this.mpv.observe_property(k);
        }
        
        // let log_history = {};

        this.mpv.on("before-quit", ()=>{
            clearInterval(this.#tick_interval);
            clearInterval(this.#long_tick_interval);
        });
        
        let last_discontinuity_pts;
        this.mpv.on("log-message", (log)=>{
            // this.logger.debug(log.text);
            let text = log.text.trim();
            if (log.level == "warn") {
                /* let pattern = utils.escape_regex(text).replace(/\d+/g, "\\d+");
                let last = log_history[pattern] || 0;
                let now = Date.now();
                // prevents fast, numerous messages like 'Invalid audio PTS' or 'Correcting Video PTS'
                if ((now-last) > 2000) {
                    log_history[pattern] = now;
                    this.logger.warn(text);
                } */
                this.logger.warn(text);
                /* var m = text.match(/^Invalid audio PTS: ([\d.]+) -> ([\d.]+)/);
                if (m) {
                    if (this.ctx.$.loaded && this.ctx.props["audio-pts"] == undefined) {
                        this.logger.warn(`audio-pts is null, discontinuity detected, attempting seek to ${m[2]}...`);
                        this.mpv.seek(+m[2], "absolute");
                    }
                } */
            } else if (log.level == "error") {
                this.logger.error(text);
            }
        })
        
        this.mpv.on("start-file", (e)=>{
        });

        let eof_reason;
        let valid_eof_reasons = new Set(["eof","error","unknown"]);
        this.mpv.on("end-file", (e)=>{
            eof_reason = e.reason;
            var fn1 = this.ctx.props["path"]
            var fn2 = this.ctx.props["stream-open-filename"]
            var fn3 = this.ctx.props["stream-path"];
            if (fn1 != "null://eof" && valid_eof_reasons.has(eof_reason)) {
                this.load_next();
            }
        });
        
        this.mpv.on("file-loaded", async (e)=>{
            Object.assign(this.ctx.mpv_expected_props, this.ctx.mpv_load_props);
        });

        this.mpv.on("seek", (e)=>{
            // this.ctx.$.playing = false;
            this.ctx.$.internal_seeking = true;
            // this.ctx.update_time_pos();
        });

        this.mpv.on("playback-restart", (e)=>{
            this.ctx.$.loaded = true;
            // this.ctx.$.playing = true;
            this.ctx.$.internal_seeking = false;
            this.ctx.$.seeking = false;
            last_discontinuity_pts = null;
            // this.ctx.update_time_pos();
        });

        /* this.on("on_after_end_file", (e)=>{
            if (valid_eof_reasons.has(eof_reason)) {
                this.session.playlist_next();
            }
        }); */
        var last_time_pos_ctx;

        this.mpv.on("property-change", async (e)=>{
            let {name, data} = e;
            if (name === "eof-reached") {
                if (this.ctx.$.loaded && data) {
                    this.logger.info("eof-reached");
                    if (this.ctx.props.loop_file || !this.ctx.$.duration) {
                        this.ctx.loop();
                    } else {
                        this.load_next();
                    }
                }
            }
            if (name in this.ctx.mpv_expected_props && this.ctx.mpv_expected_props[name] !== data) {
                this.emit("user-property-change", e);
                this.ctx.mpv_expected_props[name] = data;
            }
            if (!(name in IGNORE_MPV_REALTIME_CHANGES)) {
                this.ctx.$.props[name] = data;
            }
            if (name === "time-pos") {
                // this.ctx.update_time_pos();
                if (this.ctx === last_time_pos_ctx) {
                    var delta = Math.max(0, (data - this.ctx.props["time-pos"]) || 0);
                    this.#time_progressed += delta;
                }
                last_time_pos_ctx = this.ctx;
            }
            /* if (name === "audio-pts") {
                console.log("audio-pts:", this.$.loaded, data);
                if (this.ctx.$.loaded && data == undefined) {
                    if (last_discontinuity_pts) {
                        this.logger.warn("audio-pts is null, discontinuity detected");
                        this.mpv.seek(last_discontinuity_pts, "absolute");
                        last_discontinuity_pts = null;
                    } else {
                        // audio has ended, move on.
                        this.load_next();
                    }
                }
            } */
            this.ctx.props[name] = data;
        });

        this.mpv.on("idle", ()=>{
            this.logger.info("MPV idle.");
        });

        this.mpv.request_log_messages("info");

        this.#mpv_last_pts = 0;
        this.#mpv_last_speed_check = Date.now();

        this.#tick_interval = setInterval(()=>this.ctx.tick(), 1000/TICK_RATE);

        var last_hash1, last_hash2, last_ts1, last_ts2, seekable_ranges_hash;
        
        this.#long_tick_interval = setInterval(async()=>{
            let ts = Date.now();

            if (this.ctx.props["output-pts"]) {
                let diff_pts = (this.ctx.props["output-pts"] - this.#mpv_last_pts) * 1000;
                let diff_ts = ts - this.#mpv_last_speed_check;
                let speed = Math.max(0, (diff_pts / diff_ts) || 0);
                this.ctx.$.playback_speed = speed;
                this.emit("speed", speed);
                this.#mpv_last_pts = this.ctx.props["output-pts"];
                this.#mpv_last_speed_check = ts;
            }
    
            (async ()=>{
                let new_ranges;
                let demuxer_cache_state = (await this.mpv.get_property("demuxer-cache-state").catch(()=>null));
                // console.log(demuxer_cache_state);
                if (demuxer_cache_state) {
                    new_ranges = demuxer_cache_state["seekable-ranges"];
                    if (new_ranges) {
                        [...new_ranges].forEach((r)=>{
                            r.start -= this.ctx.$.start_offset;
                            r.end -= this.ctx.$.start_offset;
                        });
                    }
                }
                var new_hash = JSON.stringify(new_ranges);
                if (new_hash != seekable_ranges_hash) {
                    seekable_ranges_hash = new_hash;
                    this.ctx.$.seekable_ranges = new_ranges || [];
                }
            })();
    
            if (!this.is_encoding) {
                let interpolation_mode = this.session.$.interpolation_mode || false;
                let curr_val = this.ctx.props.interpolation;
                let new_val = curr_val;
                if (interpolation_mode == "auto") {
                    let df = this.session.$.auto_interpolation_rate || 30;
                    let vf = this.ctx.props["estimated-vf-fps"];
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
    
            for (var k in IGNORE_MPV_REALTIME_CHANGES) {
                this.ctx.$.props[k] = this.ctx.props[k];
            }
    
            this.ctx.update_time_pos();

            if (!this.ctx.props["pause"]) {
                var hash1 = JSON.stringify([this.load_id, this.ctx.props["time-pos"]]);
                if (hash1 != last_hash1) last_ts1 = ts;
                if (ts > (last_ts1 + FORCE_NEXT_ITEM_TIMEOUT)) {
                    if (!globals.app.debug) this.load_next();
                }
                last_hash1 = hash1;

                var hash2 = this.#time_progressed;
                if (hash2 != last_hash2) last_ts2 = ts;
                if (ts > (last_ts2 + FORCE_ABORT_TIMEOUT)) {
                    if (!globals.app.debug) this.mpv.quit();
                }
                last_hash2 = hash2;
            }

            /* if (this.mpv.get_property("audio-pts") == null) {
                this.load_next();
            } */
        }, 1000);

        return true;
    }

    /** @param {PlaylistItem$} item @param {LoadFileOpts} opts */
    async loadfile(item, opts) {
        this.ctx = new MPVContext(this);
        var res = await this.ctx.loadfile(item, opts);
        // if (!res) return this.load_next()
        return res;
    }

    load_next() {
        return this.session.playlist_next();
    }

    seek(t) {
        return this.ctx.seek(t);
    }

    reload(reload_props=true) {
        return this.loadfile(this.session.get_playlist_item(this.ctx.item.id), { start: this.ctx.$.time_pos, reload_props, pause:this.ctx.props.pause });
    }

    set_property(property, value) {
        return this.ctx.set_property(property, value);
    }
}

export default MPVSessionWrapper;

export class MPVContext$ extends DataNode$ {
    item = {};
    seeking = false;
    internal_seeking = false;
    preloaded = false;
    loaded = false;
    seekable = true;
    time_pos = 0;
    duration = 0;
    loops = 0;
    real_duration = 0;
    playback_speed = 1;
    start_offset = 0;
    seek_time = 0;
    seekable_ranges = [];
    props = {};
}

/** @extends {DataNode<MPVContext$>} */
export class MPVContext extends DataNode {
    /** @type {MPVSessionWrapper} */
    #mpv;
    af_graph = [];
    vf_graph = [];
    fades = [];
    ignore_crop = false;
    /** @type {MediaInfo} */
    #media_info;
    /** @type {MPVContext} */
    #last_ctx;
    /** @type {PlaylistItemPropsProps} */
    props = {};
    mpv_expected_props = {};
    mpv_load_props = {};
    /** @type {PlaylistItemPropsProps} */
    
    #stream_selection_dirty = false;
    #filters_dirty = false;
    #deinterlace_dirty = false;
    #last_seek_time = 0;

    /** @type {number|null} */
    vid = null;
    /** @type {number|null} */
    aid = null;
    /** @type {number|null} */
    sid = null;
    
    get stream() { return this.#mpv.stream; }
    get session() { return this.#mpv.session; }
    get filename() { return this.item.filename; }
    get media_info() { return this.#media_info; }
    get logger() { return this.#mpv.logger; }
    get expired() { return this.#mpv.ctx !== this; }
    get is_encoding() { return this.#mpv.is_encoding; }
    get width() { return this.#mpv.width; }
    get height() { return this.#mpv.height; }

    /** @param {MPVSessionWrapper} mpv */
    constructor(mpv) {
        super(new MPVContext$());
        mpv.$.ctx = this.$;
        this.#mpv = mpv;
        this.#last_ctx = mpv.ctx;
    }

    /** @typedef {{reload_props:boolean,pause:boolean,start:number}} LoadFileOpts */
    /** @param {PlaylistItem$} item @param {LoadFileOpts} opts */
    async loadfile(item, opts) {
        if (this.item) {
            throw new Error("item already loaded, create new context");
        }
        opts = {
            pause: false,
            start: 0,
            reload_props: true,
            ...opts,
        };
        let start = +(opts.start||0);
        let on_load_commands = [];

        let original_item = item;
        item = this.item = await this.#parse_item({...item, props: {...((opts.reload_props) ? (item && item.props) : utils.json_copy(this.#last_ctx.props))}});
        this.$.item = utils.json_copy(item);

        // this is stupid, when mpv ends it continues listening.
        /* if (original_item && original_item.props) {
            let changed_props = new Set();
            let debounced_update_props = utils.debounce(()=>{
                for (var k of changed_props) {
                    this.set_property(k, original_item.props[k] ?? item.props[k]);
                }
                changed_props.clear();
            },0);
            utils.Observer.get_observer(original_item.props).on("change", (c)=>{
                let k = c.path[0];
                if (k in item.props) {
                    changed_props.add(k);
                    debounced_update_props();
                }
            });
        } */
        
        start += item.start_offset;

        // -------------------------------------------------

        let props = {...item.props};
        props.pause = !!opts.pause;
        if (item.seekable && start > 0) props.start = start;
        if (item.duration) props.end = item.duration + item.start_offset;

        // edl fades
        {
            // ---------------------
    //         {
    //             let [w,h] = [this.width, this.height];
    //             let ass;
    //             for (let [type, dir, offset, dur] of this.ctx.fades) {
    //                 offset = Math.max(0, offset);
    //                 if (type.startsWith("v")) {
    //                     this.ctx.vf_graph.push.push(`fade=enable='between(t,${offset},${offset+duration})':t=${dir}:st=${offset}:d=${duration}`);
                        
    // //                     if (!ass) {
    // //                         ass =
    // // `[Script Info]
    // // PlayResX: ${w}
    // // PlayResY: ${h}

    // // [V4+ Styles]
    // // Format: Name,PrimaryColour,Alignment,Encoding
    // // Style: F1,&H000000,7,0

    // // [Events]
    // // Format: Start,End,Style,Text`+"\n";
    // //                     }
    // //                     let fade, alphas, o = 0;
    // //                     if (dir === "out") {
    // //                         o = 0.25;
    // //                         alphas = "0,255,0";
    // //                     } else {
    // //                         alphas = "255,0,255";
    // //                     }
    // //                     fade = [0, 0, 0, dur];
    // //                     let start = offset - o;
    // //                     let end = offset + dur;
    // //                     let f = `{\\fade(${alphas},${fade.map(f=>Math.round(f*1000)).join(",")})}`;
    // //                     let c = `{\\p1}m 0 0 l ${w} 0 ${w} ${h} 0 ${h}{\\p0}`;
    // //                     ass += `Dialogue: ${ass_time(start*1000)},${ass_time(end*1000)},F1,${f+c}\n`;
    //                 } else if (type.startsWith("a")) {
    //                     this.ctx.af_graph.push(`afade=enable='between(t,${offset},${offset+dur})':t=${dir}:st=${offset}:d=${dur}`);
    //                 }
    //             }
    //             /* if (ass) {
    //                 register_file("memory://"+ass, "subtitle", {secondary: true, name:"__fades__"});
    //             } */
    //         }

            // -------------------
        }
        
        for (var f of item.map.video.files) {
            on_load_commands.push(["video-add", f.filename, "select", f.name]);
        }
        for (var f of item.map.subtitle.files) {
            on_load_commands.push(["sub-add", f.filename, f.secondary?"auto":"select", f.name]);
        }
        for (var f of item.map.audio.files) {
            on_load_commands.push(["audio-add", f.filename, "select", f.name]);
        }

        this.$.real_duration = item.duration;
        this.$.duration = item.duration - item.start_offset;
        this.$.start_offset = item.start_offset;
        this.$.seekable = item.seekable;

        let secondary_sid = (item.map.subtitle.streams.find(s=>s.secondary)||{}).type_id ?? false;
        props["secondary-sid"] = secondary_sid;
        // props.ytdl = !!item.media_info.ytdl; // this messes up because ytdl needs to be set before loadfile, not necessary anyway.

        for (var k in props) {
            this.set_property(k, props[k]);
        }

        this.rebuild_stream_selection();
        this.rebuild_filters();
        this.rebuild_deinterlace();
        this.update_volume(true);
        
        this.$.preloaded = true;
        this.update_time_pos();

        this.lua_message("setup_loadfile", this.mpv_load_props, on_load_commands);
        return this.#mpv.mpv.loadfile(item.filename)
            .catch((e)=>{
                this.logger.error(e);
            });
    }
    
    /** @typedef {{start:number, offset:number, duration:number, media_type:string, loop:boolean, root:PlaylistItem$}} ParseItemOpts */
    /** @param {PlaylistItem$} _item @param {ParseItemOpts} opts */
    async #parse_item(_item, opts) {
        if (typeof _item !== "object" || _item === null) _item = { filename: _item || null };
        let item = {
            filename: null,
            original_filename: _item.filename,
            id: utils.uuidb64(),
            /** @type {PlaylistItemPropsProps} */
            props: {},
            fades: [],
            start_offset: 0,
            duration: 0,
            media_info: null,
            ...utils.json_copy(_item),
        }
        
        let props = utils.json_copy({
            ...utils.get_defaults(InternalSessionProps.playlist.__enumerable__.props),
            ...this.session.$.player_default_override,
            ...item.props,
        });

        opts = {
            clip_start: props.clip_start || 0,
            clip_end: props.clip_end || undefined,
            clip_offset: props.clip_offset || 0,
            clip_loops: props.clip_loops || 1,
            offset: 0,
            duration: 0,
            media_type: null,
            loop: false,
            root: undefined,
            fade_in: +props.fade_in || 0,
            fade_out: +props.fade_out || 0,
            ...opts,
        };
        
        let {filename} = item;
        if (!filename) filename = "livestreamer://empty";
        let {clip_start, clip_end, clip_offset, clip_loops, offset, duration, media_type, loop, root, fade_in, fade_out} = opts;
        duration = duration || props.duration || 0;
        let map = new StreamMap();
        let is_empty = filename === "livestreamer://empty";
        let is_playlist = this.session.is_item_playlist(item.id);
        let media_info = await this.session.update_media_info(filename, {silent:true});
        let is_image = !!(media_info.streams && media_info.streams.filter((s)=>s.type == "video").length > 0 && media_info.duration <= 0.04);
        let background_color = (root && root.props) ? root.props.background_color : props.background_color || this.session.$.background_color || "#000000";

        /** @type {number|false} */
        let start_offset = 0;
        root = root || item;
        let is_root = (root === item);
        let media_duration = media_info.duration || (is_empty ? NULL_STREAM_DURATION : 0);
        let clip_duration = (clip_end - clip_start) || media_duration;
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
            let tmp = (await this.#parse_item(filename, {media_type:type, duration, root, loop:(type === "video")}));
            map.register_file({filename: tmp.filename, original_filename, streams:tmp.map.streams, ...opts, type});
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
                    text: ass_fade(props.fade_in || 0, props.fade_out || 0) + (ass_rotate(...(props.title_rotation||[0,0,0]))) + ass_text(props.title_text),
                }]);
                // filename = is_root ? `memory://${ass_str}` : await get_ass_subtitle(ass_str);
                filename = await get_ass_subtitle(ass_str);
                map.register_stream({type:"subtitle"}, true);
            } else if (ls_path == "rtmp") {
                filename = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}/session/${this.session.$.id}`;
            }
        }

        if (is_image) {
            // let title = `Image (${path.basename(filename)})`;
            filename = await get_image_as_video(filename, this.width, this.height, background_color);
            map.register_stream({type:"video", codec:"h264", duration:NULL_STREAM_DURATION}, true);
            media_duration = NULL_STREAM_DURATION;
        }
        
        let is_rtmp = !!filename.match(/^rtmps?:/);
        if (is_rtmp) {
            map.register_stream({type:"video"}, true);
            map.register_stream({type:"audio"}, true);
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
        
        let is_unknown_duration = !duration && (!media_info.duration || (is_empty || is_image || is_rtmp));
        duration = duration || media_duration;
        let fix_low_fps_duration = (is_image || is_empty) && !is_unknown_duration && media_type == "video";
        if (fix_low_fps_duration) duration++;

        if (is_root && media_info.ytdl) {
            start_offset = clip_start || 0;
            duration = clip_end || duration;
        } else {
            // this only works for jpg and webp... what's the point?
            /* if (is_image && is_root) {
                filename = await this.get_image_as_mf_sequence(filename, NULL_STREAM_DURATION);
                media_duration = NULL_STREAM_DURATION;
            } else { */

            if (is_playlist && (props.playlist_mode || !is_root)) {

                let is_2track = props.playlist_mode == 2;
                edl = new MPVEDL();
                let tracks = [];
                let playlist_tracks = this.session.get_playlist_tracks(item.id);
                let duration_override = false;
                
                for (var i = 0; i < playlist_tracks.length; i++) {
                    let track = {
                        entries: [],
                        duration: 0,
                        type: is_2track ? EDL_TRACK_TYPES[i]: null,
                    };
                    let o = offset;
                    for (let item of playlist_tracks[i]) {
                        if (item.filename == "livestreamer://exit") {
                            if (duration_override === false) duration_override = track.duration;
                            else duration_override = Math.min(duration_override, track.duration);
                        }
                        let tmp = await this.#parse_item(item, {offset:o, media_type: track.type, root});

                        track.duration += tmp.duration;
                        o += tmp.duration;

                        if (tmp.duration > 0) {
                            track.entries.push(new MPVEDLEntry(tmp.edl || tmp.filename, {
                                length: tmp.duration.toFixed(3)
                            }));
                        }
                    }
                    tracks.push(track);
                }

                let min_duration = Math.min(...tracks.map((t)=>t.duration));
                let max_duration = Math.max(...tracks.map((t)=>t.duration));
                if (duration_override) {
                    duration = duration_override;
                } else {
                    if (props.playlist_end_on_shortest_track) {
                        duration = min_duration;
                    } else {
                        duration = max_duration;
                    }
                }

                offset += duration;

                for (let track of tracks) {
                    let pad_duration = Math.max(0, max_duration - track.duration);
                    if (is_2track && pad_duration > 0.04) {
                        if (track.type == "audio" && props.playlist_revert_to_video_track_audio) {
                            // if audio track is longer than video track, revert to video track after audio track ends
                            let tmp = new MPVEDL(tracks[0].entries);
                            track.entries.push(new MPVEDLEntry(tmp, {
                                start: (tracks[1].duration).toFixed(3),
                                length: (tracks[0].duration - tracks[1].duration).toFixed(3)
                            }));
                        } else {
                            // add padding to track if necessary
                            let tmp = await this.#parse_item(null, {duration: pad_duration, media_type: track.type, offset, root});
                            track.entries.push(new MPVEDLEntry(tmp.edl || tmp.filename, {
                                length: (pad_duration).toFixed(3)
                            }));
                        }
                        if (track.entries.length && track.type) {
                            if (edl.length) edl.append("!new_stream");
                            edl.append(new MPVEDLEntry("!delay_open", {media_type: track.type}));
                        }
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
                                let tmp = await this.#parse_item(null, {duration: pad_duration, media_type, offset, root});
                                edl.append(new MPVEDLEntry(tmp.edl || tmp.filename, {
                                    length: (pad_duration).toFixed(3)
                                }));
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
                        else if (t === "video") null_filename = await get_color_as_video(this.width, this.height, background_color);
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
                    background_mode = background_mode_default;
                }

                if (background_mode == "file") {
                    await add_file(this.session.$.background_file, "video", {start:this.session.$.background_file_start, end:this.session.$.background_file_end});
                } else if (background_mode == "logo") {
                    await add_file(path.resolve(globals.app.conf["main.logo_path"]), "video");
                }
                if (props.video_file) {
                    await add_file(props.video_file, "video", {start:props.video_file_start, end:props.video_file_end});
                }
                if (background_mode === "none" ||!map.has("video")) {
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

            if (clip_start || clip_end || clip_offset || clip_loops != 1) {
                let repeat_opts = {
                    start: clip_start || 0,
                    end: clip_end || duration,
                    loops: clip_loops || 1,
                    offset: clip_offset || 0,
                };
                edl = new MPVEDL(MPVEDL.repeat(edl || filename, repeat_opts));
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
        }
        
        if (edl) {
            duration = edl.duration;
            filename = edl.toString();
            map = new StreamMap();
            if (!media_type || media_type == "video") map.register_stream({type:"video"}, true);
            if (!media_type || media_type == "audio") map.register_stream({type:"audio"}, true);
        }

        if (fix_low_fps_duration) duration--;
        if (is_unknown_duration) duration = 0;

        let seekable = !!duration;
        let internal_seekable = !is_rtmp;
        
        return {
            ...item,
            filename,
            props,
            start_offset,
            duration,
            media_info,
            background_color,
            seekable,
            internal_seekable,
            edl,
            map,
        };
    }

    async set_property(key, value) {
        // let changed = this.props[key] != value;
        this.props[key] = value;
        this.$.props[key] = value;
        let mpv_key = key, mpv_value = value;
        if (key === "start" || key === "end") {
            mpv_value = String(value);
        } else if (key === "deinterlace_mode") {
            this.#deinterlace_dirty = true;
        } else if (key === "audio_channels" || key === "volume_normalization" || key === "crop" || key === "filters" || key === "pre_filters") { // || k === "force_fps"
            this.#filters_dirty = true;
        } else if (key === "aspect_ratio") {
            mpv_key = "video-aspect-override";
        } else if (key === "audio_delay") {
            if (this.is_encoding) this.#filters_dirty = true;
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
            this.#stream_selection_dirty = true;
        }
        
        if (this.#mpv.allowed_mpv_props[mpv_key]) {
            this.mpv_expected_props[mpv_key] = mpv_value;
        }
        if (this.#mpv.allowed_mpv_props[mpv_key]) {
            if (this.$.preloaded) {
                return this.#mpv.mpv.set_property(mpv_key, mpv_value);
            } else {
                this.mpv_load_props[mpv_key] = mpv_value;
            }
        }
    }

    seek(t) {
        if (!this.item.internal_seekable) return;
        this.#last_seek_time = t;
        this.$.seeking = true;
        this.update_time_pos();
        return this.#mpv.mpv.seek(t + this.$.start_offset);
    }

    lua_message(name, ...args) {
        return this.#mpv.mpv.command("script-message-to", "livestreamer", name, JSON.stringify(args));
    }

    rebuild_stream_selection() {
        this.#stream_selection_dirty = false;
        let vid_auto = this.item.map.video.force_id ?? this.item.map.video.auto_id ?? 1;
        let aid_auto = this.item.map.audio.force_id ?? this.item.map.audio.auto_id ?? 1;
        let sid_auto = this.item.map.subtitle.force_id ?? this.item.map.subtitle.auto_id ?? false;

        let vid = this.props.vid_override == "auto" ? vid_auto : this.props.vid_override;
        let aid = this.props.aid_override == "auto" ? aid_auto : this.props.aid_override;
        let sid = this.props.sid_override == "auto" ? sid_auto : this.props.sid_override;
        let v_stream = this.item.map.video.streams[vid-1];
        if (!v_stream || v_stream.albumart) {
            let reason = v_stream.albumart ? "albumart" : "no stream";
            this.logger.error(`bad video stream selected [${reason}]...`);
            let safe_v_stream = this.item.map.video.streams.find(s=>s.type == "video" && !s.albumart);
            if (safe_v_stream) {
                vid = safe_v_stream.type_id;
                this.logger.error(`setting to a safe fallback [${vid}]...`);
            } else {
                this.logger.error(`no safe fallback found, skipping file...`);
                this.#mpv.load_next();
                return;
            }
        }
        this.set_property("vid", vid);
        this.set_property("aid", aid);
        this.set_property("sid", sid);
        this.vid = vid;
        this.aid = aid;
        this.sid = sid;
    }
    
    update_volume(immediate = false) {
        let target_volume = (this.session.$.volume_target ?? InternalSessionProps.volume_target.__default__) * this.props.volume_multiplier;
        let curr_volume = this.props.volume ?? 100;
        this.set_property("volume_target", target_volume);
        let inc = this.session.$.volume_speed ?? InternalSessionProps.volume_speed.__default__;
        if (inc == 0 || immediate) {
            curr_volume = target_volume;
        } else {
            if (curr_volume < target_volume) {
                curr_volume = Math.min(curr_volume + inc, target_volume);
            } else if (curr_volume > target_volume) {
                curr_volume = Math.max(curr_volume - inc, target_volume);
            }
        }
        if (this.props.volume != curr_volume) {
            this.set_property("volume", curr_volume);
        }
    }

    /** @param {number|undefined} time_pos @description time_pos is the time position to set the video to (according to the user). */
    update_time_pos(time_pos) {
        if (this.#mpv.mpv.quitting) return;
        if (time_pos === undefined) {
            if (this.$.seeking) {
                time_pos = this.#last_seek_time;
            } else {
                time_pos = Math.max(0, +(this.props["time-pos"] ?? this.props["start"] ?? 0) - this.$.start_offset) + ((this.$.duration || NULL_STREAM_DURATION) * this.$.loops);
            }
        }
        this.session.$.time_pos = this.$.time_pos = time_pos;
    }

    rebuild_deinterlace() {
        this.#deinterlace_dirty = false;
        let deint = this.props.deinterlace_mode;
        if (deint == "auto") {
            deint = false;
            if (this.media_info) deint = !!this.media_info.interlaced;
        }
        this.logger.info(`deint:`, deint)
        this.set_property("deinterlace", deint);
    }

    rebuild_filters() {
        this.#filters_dirty = false;
        let [w, h] = [this.width, this.height];

        let pre_vf_graph = [];
        let vf_graph = [];
        let af_graph = [];

        // let fps = +(this.props.force_fps || this.stream.fps);
        let fps = +this.stream.fps;
        
        if (!this.ignore_crop) {
            let left = utils.clamp(Math.abs(this.props.crop[0] || 0));
            let top = utils.clamp(Math.abs(this.props.crop[1] || 0));
            let right = utils.clamp(Math.abs(this.props.crop[2] || 0));
            let bottom = utils.clamp(Math.abs(this.props.crop[3] || 0));
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

        let audio_stream = get_stream_by_id(this.props.aid, this.item.map.audio.streams);
        let has_2_channels = audio_stream ? audio_stream.channels >= 2 : false;

        let ac = this.props.audio_channels;
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

        if (this.is_encoding && this.props.audio_delay) {
            af_graph.push(
                `asetpts=PTS+${this.props.audio_delay}/TB`,
            );
        }

        af_graph.push(
            `aresample=async=1`
        );

        var scale_filter = `scale=width=(iw*sar)*min(${w}/(iw*sar)\\,${h}/ih):height=ih*min(${w}/(iw*sar)\\,${h}/ih):force_divisible_by=2`;

        var pad_filter = `pad=width=${w}:height=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=${this.item.background_color}`;
        
        pre_vf_graph.push(scale_filter);

        vf_graph.push(
            pad_filter,
            `format=yuv420p`
        );

        if (fps) {
            pre_vf_graph.push(
                `fps=${fps}`
            );
        }
        
        if (!this.$.loops) {
            for (let [type, dir, offset, dur] of this.item.fades) {
                offset = Math.max(0, offset);
                let is_final_out = dir == "out" && Math.abs((offset + dur) - this.item.duration) < 0.25;
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
                `drawtext=text='%{pts\\:hms}':fontfile='${utils.ffmpeg_escape_file_path(path.resolve(globals.app.resources_dir, "Arial.ttf"))}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`,
            );
        }

        let norm_method = this.props.volume_normalization;
        let norm_filter_option = STREAM_VOLUME_NORMALIZATION_CONFIGS[norm_method];
        if (norm_filter_option) {
            af_graph.push(norm_filter_option);
        }

        var ctx = new FilterContext({
            aid: `aid${this.aid}`,
            vid: `vid${this.vid}`,
            fps: fps,
            width: this.width,
            height: this.height,
            color: this.item.background_color,
        });

        {
            let pre_vf = ctx.id("pre_vf");
            ctx.stack.push(`[${ctx.vid}]${pre_vf_graph.join(",")}[${pre_vf}]`);
            ctx.vid = pre_vf;
        }

        ctx.apply([...this.props.pre_filters, ...this.props.filters]);

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

        // /** @param {str[]} graph */
        // var fix = (graph,lavfi=false) => {
        //     if (graph.length == 0) return "";
        //     var s = graph.filter(f=>f).map(f=>f.replace(/,/g, m=>`\\${m}`)).join(",");
        //     if (lavfi) s = `lavfi=[${s.replace(/[\[\]]/g, m=>`\\${m}`)}]`;
        //     return s;
        // }
        // let af = fix(af_graph, true);
        // let vf = fix(vf_graph, true);

        // this.set_property("af", af);
        // this.set_property("vf", vf);
    }

    tick() {
        if (!this.$.loaded) return;
        if (this.#stream_selection_dirty) this.rebuild_stream_selection();
        if (this.#filters_dirty) this.rebuild_filters();
        if (this.#deinterlace_dirty) this.rebuild_deinterlace();
        this.update_volume();
    }
    
    loop() {
        this.$.loops++;
        this.seek(0);
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