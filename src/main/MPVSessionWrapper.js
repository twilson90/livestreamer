import fs from "fs-extra";
import path from "node:path";
import * as utils from "../core/utils.js";
import MPVWrapper from "../core/MPVWrapper.js";
import globals from "./globals.js";
import InternalSessionProps from './InternalSessionProps.js';
import { stringify } from "node:querystring";
import { MPVEDL, MPVEDLEntry, MAX_EDL_REPEATS } from "./MPVEDL.js";
/** @import { InternalSession, Stream } from './types' */

// const FORCE_NEXT_ITEM_TIMEOUT = 5 * 1000;
const FORCE_NEXT_ITEM_TIMEOUT = Number.MAX_SAFE_INTEGER;
const FORCE_ABORT_TIMEOUT = 10 * 1000;
const DEFAULT_FPS = 30;
const TICK_RATE = 30;
const EDL_TRACK_TYPES = ["video", "audio", "sub"];

const ALBUMART_FILENAMES = Object.fromEntries([
    "albumart", "album", "cover", "front", "albumartsmall", "folder", ".folder", "thumb",
].map((ext)=>[ext, 1]));

const SUBTITLE_EXTS = Object.fromEntries([
    ".utf", ".utf8", ".utf-8", ".idx", ".sub", ".srt", ".rt", ".ssa", ".ass", ".mks", ".vtt", ".sup", ".scc", ".smi", ".lrc", ".pgs"
].map((ext)=>[ext, 1]));

const AUDIO_EXTS = Object.fromEntries([
    ".mp3", ".aac", ".mka", ".dts", ".flac", ".ogg", ".m4a", ".ac3", ".opus", ".wav", ".wv", ".eac3"
].map((ext)=>[ext, 1]));

const IMAGE_EXTS = Object.fromEntries([
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
].map((ext)=>[ext, 1]));

let IGNORE_MPV_REALTIME_CHANGES = {
    "time-pos": 1,
    "output-frames": 1,
    "output-pts": 1,
    "volume": 1
};

const STREAM_VOLUME_NORMALIZATION_CONFIGS = {
    "dynaudnorm1": `dynaudnorm=f=500:p=0.9:m=8.0:g=7`,
    "dynaudnorm2": `dynaudnorm=f=250:p=0.9:m=8.0:g=5`,
    "loudnorm": `loudnorm=dual_mono=true`
};

export class MPVSessionWrapper extends MPVWrapper {
    #load_id = 0;
    #mpv_last_speed_check = Date.now();
    #mpv_last_pts = 0;
    #seekable_ranges_hash = "";
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
    observer = new utils.Observer();
    #time_progressed = 0;

    get $() { return this.observer.$; }
    get time_pos() { return (this.$.special_start_time + (this.#props["time-pos"] || 0)) || 0; }
    
    /** @type {InternalSession} */
    get session() { return this.stream.session; }
    get is_encoding() { return this.stream.is_encode; }
    
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
            loads: 0,
            time: 0,
            duration: 0,
            is_special: false,
            special_start_time: 0,
            seekable: false, 
            seekable_ranges: [],
            loaded_item: null,
            props: {}
        });

        this.observer.on("change", c=>{
            if (c.path[0] === "time") {
                this.session.$.time = c.new_value;
            }
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
                    this.logger.warn(text);
                }
            } else if (log.level == "error") {
                this.logger.error(text);
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
            this.$.loads++;
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
        var last_time_pos_load_id;

        this.on("property-change", async (e)=>{
            let {name, data} = e;
            if (name === "eof-reached") {
                if (data) {
                    this.logger.info("eof-reached");
                    if (this.#props.loop_file) this.seek(0); // weird, should use loop-file really, suppose it's needed for special files
                    else this.load_next();
                }
            }
            if (name in this.#mpv_expected_props && this.#mpv_expected_props[name] !== data) {
                this.emit("user-property-change", e);
                this.#mpv_expected_props[name] = data;
            }
            if (!(name in IGNORE_MPV_REALTIME_CHANGES)) {
                this.$.props[name] = data;
            }
            if (name === "time-pos") {
                if (this.$.seeking) this.update_time_pos();
                if (this.#load_id == last_time_pos_load_id) {
                    var delta = Math.max(0, (data - this.#props["time-pos"]) || 0);
                    this.#time_progressed += delta;
                }
                last_time_pos_load_id = this.#load_id;
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

        this.#tick_interval = setInterval(()=>{
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
        }, 1000/TICK_RATE);

        var last_hash1, last_hash2, last_ts1, last_ts2;
        this.#long_tick_interval = setInterval(async()=>{
            let ts = Date.now();

            if (this.#props["output-pts"]) {
                let diff_pts = (this.#props["output-pts"] - this.#mpv_last_pts) * 1000;
                let diff_ts = ts - this.#mpv_last_speed_check;
                let speed = (diff_pts / diff_ts);
                if (isNaN(speed) || speed < 0) speed = 0;
                // let f = this.$["output-frames"];
                this.speed = speed;
                this.$.speed = speed;
                this.emit("speed", speed);
                this.#mpv_last_pts = this.#props["output-pts"];
                this.#mpv_last_speed_check = ts;
            }
    
            (async ()=>{
                let new_ranges;
                let demuxer_cache_state = (await this.get_property("demuxer-cache-state").catch(()=>null));
                // console.log(demuxer_cache_state);
                if (demuxer_cache_state) {
                    new_ranges = demuxer_cache_state["seekable-ranges"];
                }
                if (JSON.stringify(new_ranges) != this.#seekable_ranges_hash) {
                    this.$.seekable_ranges = new_ranges || [];
                    this.#seekable_ranges_hash = JSON>stringify(this.$.seekable_ranges);
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
    
            for (var k in IGNORE_MPV_REALTIME_CHANGES) {
                this.$.props[k] = this.#props[k];
            }
    
            this.update_time_pos();

            if (!this.#props["pause"]) {
                var hash1 = JSON.stringify([this.#load_id, this.#props["time-pos"]]);
                if (hash1 != last_hash1) last_ts1 = ts;
                if (ts > (last_ts1 + FORCE_NEXT_ITEM_TIMEOUT)) {
                    this.load_next();
                }
                last_hash1 = hash1;

                var hash2 = this.#time_progressed;
                if (hash2 != last_hash2) last_ts2 = ts;
                if (ts > (last_ts2 + FORCE_ABORT_TIMEOUT)) {
                    this.quit();
                }
                last_hash2 = hash2;
            }
        }, 1000);
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
    /** @return {{filename:string, duration:number}} */
    async #process(item, opts) {
        opts = Object.assign({}, opts);
        let is_root = item === this.loaded_item;
        item = fix_item(item);
        let duration = opts.duration || 0;
        let offset = opts.offset || 0;
        let is_playlist = item.filename && this.session.is_item_playlist(item.id);
        let mi = await this.session.get_media_info(item.filename);
        let exists = mi.exists;
        let is_image = mi.duration <= 0.04;
        let filename = item.filename;
        var duration_override = Number.MAX_SAFE_INTEGER;
        var use_duration_override = false;

        if (is_playlist && (item.props.playlist_mode || !is_root)) {
            exists = true;
            let is_2track = item.props.playlist_mode == 2;
            let edl = new MPVEDL();
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
                        track.entries.push(new MPVEDLEntry(MPVEDL.escape(tmp.filename), {
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
                            let tmp_filename = new MPVEDL(tracks[0].entries).toString();
                            track.entries.push(new MPVEDLEntry(MPVEDL.escape(tmp_filename), {
                                start: (tracks[1].duration).toFixed(3),
                                length: (tracks[0].duration - tracks[1].duration).toFixed(3)
                            }));
                        } else {
                            let tmp = await this.#process(null, {duration: pad_duration, media_type: track.type, offset});
                            track.entries.push(new MPVEDLEntry(MPVEDL.escape(tmp.filename), {
                                length: pad_duration.toFixed(3)
                            }));
                        }
                    }
                    if (track.entries.length && track.type) {
                        edl.append(
                            "!new_stream",
                            new MPVEDLEntry("!delay_open", {
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
            let edl = new MPVEDL();
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
                                ...MPVEDL.repeat(null_filename, {end:globals.app.null_stream_duration, duration:duration})
                            );
                        }
                    }
                }
                if (edl.length > 1) {
                    if (filename) {
                        edl.append("!new_stream");
                        edl.append(new MPVEDLEntry(MPVEDL.escape(filename), {
                            length:duration.toFixed(3)
                        }));
                    }
                    filename = edl.toString();
                }
            }
        }
        
        if (!duration) duration = (mi && mi.duration) || 0;

        if (!is_image) {
            if (item.props.clip_start || item.props.clip_loops || item.props.clip_end || item.props.clip_offset || !is_root) {
                let opts = {
                    start: item.props.clip_start,
                    end: item.props.clip_end || duration,
                    loops: item.props.clip_loops,
                    offset: item.props.clip_offset,
                    // duration: item.props.clip_duration,
                };
                let temp_edl = MPVEDL.repeat(filename, opts);
                duration = temp_edl.duration;
                filename = temp_edl.toString();
            }
        }

        return {filename, duration};
    }

    // /** @param {InternalSession.PlaylistItem} item */
    async loadfile(item, opts) {

        this.#load_id++;
        var load_id = this.#load_id;

        opts = Object.assign({
            reload_props: true,
        }, opts);

        let last_id = this.loaded_item && this.loaded_item.id;
        let last_props = utils.json_copy(this.#props);

        // this.$.current_item_on_load = utils.json_copy(item);
        // this.$.current_descendents_on_load = utils.json_copy(this.get_playlist_items(id, null, true));

        item = utils.json_copy(fix_item(item));
        let mi = await this.session.get_media_info(item.filename)
        this.loaded_item = item;
        item.media_info = mi;
        [item.width, item.height] = this.get_dimensions_from_stream(mi.streams ? mi.streams.find(s=>s.type == "video") : null);
        item.af_graph = [];
        item.vf_graph = [];
        item.fades = [];
        item.ignore_crop = false;

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
            duration = item.props.empty_duration || 0;
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
                filename = `rtmp://127.0.0.1:${globals.app.conf["media-server.rtmp_port"]}/session/${this.session.$.id}`;
                // if localhost port is open and accepts request but stream is not live it breaks mpv completely. Can't figure it out.
                // filename = "wss://localhost:8112/live/"..S.rtmp_key..".flv"
                // filename = "https://localhost:8112/live/"..S.rtmp_key..".m3u8"
                
                // -------- low-latency profile --------
                
                // props[audio-buffer"] = 0; // THIS FUCKS UP RTMP FILES (IF FAIL TO LOAD)
                // props["vd-lavc-threads"] = 1;
                // props["cache-pause"] = false;
                // props["demuxer-lavf-o"] = {fflags:"+nobuffer"}; // PROBLEM?
                // props["demuxer-lavf-probe-info"] = "nostreams";
                // props["demuxer-lavf-analyzeduration"] = 0.1;
                // props["analyzeduration"] = 0;
                // props["video-sync"] = "audio";
                // props["interpolation"] = false;
                // props["video-latency-hacks"] = true;
                // props["stream-buffer-size"] = "4k";

                // ------------------------------------

                // audio-buffer=0
                // vd-lavc-threads=1
                // cache-pause=no
                // demuxer-lavf-o-add=fflags=+nobuffer
                // demuxer-lavf-probe-info=nostreams
                // demuxer-lavf-analyzeduration=0.1
                // video-sync=audio
                // interpolation=no
                // video-latency-hacks=yes
                // stream-buffer-size=4k
                
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
            let mi = utils.json_copy(await this.session.get_media_info(file));
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
            let streams = utils.json_copy(mi.streams);
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

        const add_video_file = async (filename, start, end)=>{
            let mi = await this.session.get_media_info(filename, {force:true});
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
                data = [`av://lavfi:movie='${utils.ffmpeg_escape_av_file_path(filename)}':loop=0,setpts=N/FRAME_RATE/TB`, "select", video_name, "eng", "no"];
                // weird issue with gifs running way too fast with this method...
            } else {
                data = [MPVEDL.repeat(filename,  {start, end, duration}).toString(), "select", video_name, "eng", "no"];
            }
            if (mi.streams) {
                /** @type {object[]} */
                let streams = utils.json_copy(mi.streams);
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

        const add_subtitle_file = async (filename)=>{
            if (await register_file_streams(filename, "subtitle")) {
                subtitle_files.push(filename);
                sid_auto = num_subtitles;
            }
        };

        const add_audio_file = async (filename)=>{
            if (await register_file_streams(filename, "audio")) {
                audio_files.push(filename);
                aid_auto = num_audios;
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
                    await add_subtitle_file(path.join(dir, f));
                }
                if (similar_name && ext in AUDIO_EXTS) {
                    await add_audio_file(path.join(dir, f));
                }
                if (ext in IMAGE_EXTS && (similar_name || name in ALBUMART_FILENAMES)) {
                    external_artworks.push(path.join(dir, f))
                }
            }
        }

        let fix_background_file = async (f)=>{
            if (f) {
                var mi = await this.session.get_media_info(f);
                if (!mi.streams) return null;
            }
            return f;
        }
        
        let has_main_video = is_image || !!streams.find(s=>s.type==="video" && !s.albumart);
        let use_background = is_empty || is_intertitle || !!props.background_mode || !!props.background_file || !has_main_video;
        let background_mode = props.background_mode;
        let background_color = props.background_color || "#000000";
        let background_file, background_file_start, background_file_end;
        
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
        if (background_file) background_mode = "file";

        if (use_background) {
            if (background_mode == "embedded" || background_mode == "external") {
                if (background_mode == "external") {
                    for (var f of external_artworks) await add_video_file(f);
                }
                let artwork_stream;
                let embedded_artwork_stream = streams.find(s=>s.type==="video" && !s.external && s.albumart)
                let external_artwork_stream = streams.find(s=>s.type==="video" && s.externals && s.externals.albumart)
                if (background_mode == "embedded") artwork_stream = embedded_artwork_stream;
                if (background_mode == "external") artwork_stream = external_artwork_stream || embedded_artwork_stream;
                if (artwork_stream) vid_auto = artwork_stream.type_id;
                else background_mode = "logo";
            }
            if (background_mode == "file") {
                await add_video_file(background_file, background_file_start, background_file_end);
            } else if (background_mode == "logo") {
                await add_video_file(path.resolve(globals.app.conf["main.logo_path"]));
            } else if (background_mode == "color") {
                // vid_auto = 0; // ?
            }
        }

        if (props.subtitle_file) {
            await add_subtitle_file(props.subtitle_file);
        }
        if (props.audio_file) {
            await add_audio_file(props.audio_file);
        }

        if (is_intertitle || (!num_videos && num_subtitles)) {
            sid_auto = 1; // select sub if no video exists
        }

        let vid = fix_stream_id(props.vid_override ?? vid_auto, streams, "video");
        let aid = fix_stream_id(props.aid_override ?? aid_auto, streams, "audio");
        let sid = fix_stream_id(props.sid_override ?? sid_auto, streams, "subtitle");
        let secondary_sid = null;

        // -------------------------------------------------
        
        let fps = DEFAULT_FPS;
        let lavfi_complex = [];
        let vo = [];
        let ao = [];

        let show_waveform = !!(props.audio_visualization == "waveform" && aid);
        var video_stream = get_stream_by_id(vid,streams);
        let is_albumart = video_stream ? !!video_stream.albumart : false;

        if (use_background || !vid || show_waveform || is_albumart) {
            let overlay_center = "overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2";
            is_special = true;
            let [w,h] = this.get_dimensions_from_stream(video_stream);
            vo.push(`color=c=${background_color}:s=${w}x${h}:r=${fps}`);
            if (background_mode === "color") {
                item.ignore_crop = true;
            } else if (vid) {
                item.ignore_crop = true;
                vo.push(
                    `${vo.pop()}[bg1]`,
                    `[vid${vid||1}]scale=${this.width}:${this.height}:force_original_aspect_ratio=decrease[img1]`,
                    `[bg1][img1]${overlay_center}`
                );
                // vid = "generated";
            }
            if (show_waveform) {
                item.ignore_crop = true;
                let ar = this.width / this.height;
                let wave_h = Math.min(720, this.height) // cap it at 1280 or it lags.
                let wave_w = Math.ceil(wave_h * ar);
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
                var params = { start: special_start_time.toFixed(3) };
                if (seekable) {
                    params.length = (duration - special_start_time).toFixed(3);
                }
                filename = new MPVEDL([
                    new MPVEDLEntry(MPVEDL.escape(filename), params)
                ]).toString();
            }
            return filename;
        };

        filename = try_edlify(filename);

        props.pause = !!opts.pause;
        if (seekable && start_time > 0) {
            props.start = start_time
        }

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
            for (let [type,dir,offset,dur] of item.fades) {
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
                    item.af_graph.push(`afade=enable='between(t,${offset},${offset+dur})':t=${dir}:st=${offset}:d=${dur}`);
                }
            }
            if (ass) {
                subtitle_files.push({filename:"memory://"+ass, name:"__fades__", secondary: true});
                secondary_sid = num_subtitles + 1;
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
            on_load_commands.push(["sub-add", try_edlify(f.filename), f.secondary?"auto":"select", f.name]);
        }
        for (var f of audio_files) {
            on_load_commands.push(["audio-add", try_edlify(f.filename), "select", f.name]);
        }

        // props.vid_auto = vid_auto;
        // props.sid_auto = sid_auto;
        // props.aid_auto = aid_auto;

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

        var olp = {};
        if (vid != null) olp.vid = vid || false;
        if (aid != null) olp.aid = aid || false;
        if (sid != null) olp.sid = sid || false;
        if (secondary_sid != null) olp["secondary-sid"] = secondary_sid || false;
        if (this.$.seekable) olp.start = String(start_time);
        if (ls_path === "rtmp") olp.ytdl = false;
        Object.assign(this.#mpv_load_props, olp);
        
        for (var k of Object.keys(this.#mpv_load_props)) {
            if (!this.allowed_mpv_props[k]) delete this.#mpv_load_props[k];
        }

        await this.on_load_promise(this.lua_message("loadfile", filename, this.#mpv_load_props, on_load_commands)).catch((e)=>{
            this.logger.error(e);
            if (load_id == this.#load_id) {
                return this.load_next();
            }
        });
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
        } else if (key === "audio_channels" || key === "volume_normalization" || key === "crop") { // || k === "force_fps"
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
        return this.command("script-message-to", "livestreamer", name, JSON.stringify(args));
    }
    
    update_volume(immediate = false) {
        let target_volume = (this.session.$.volume_target ?? InternalSessionProps.volume_target.__default__) * this.#props.volume_multiplier;
        let curr_volume = this.#props.volume ?? 100;
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
        if (this.#props.volume != curr_volume) {
            this.set_property("volume", curr_volume);
        }
    }

    update_time_pos() {
        this.$.time = this.$.user_seeking ? this.$.seek_time : this.time_pos;
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
        
        if (!this.loaded_item.ignore_crop) {
            let left = utils.clamp(Math.abs(this.#props.crop[0] || 0));
            let top = utils.clamp(Math.abs(this.#props.crop[1] || 0));
            let right = utils.clamp(Math.abs(this.#props.crop[2] || 0));
            let bottom = utils.clamp(Math.abs(this.#props.crop[3] || 0));
            let x = left;
            let y = top;
            let w = utils.clamp(1 - right - left);
            let h = utils.clamp(1 - bottom - top);
            let min_x = 1 / this.width;
            let min_y = 1 / this.height;

            if ((w != 1 || h != 1) && w >= min_x && h >= min_y) {
                vf_graph.push(
                    `crop=w=iw*${w}:h=ih*${h}:x=iw*${x}:y=ih*${y}`
                );
            }
        }
       
        // {
        //     let left = utils.clamp(Math.abs(this.#props.crop[0] || 0));
        //     let top = utils.clamp(Math.abs(this.#props.crop[1] || 0));
        //     let right = utils.clamp(Math.abs(this.#props.crop[2] || 0));
        //     let bottom = utils.clamp(Math.abs(this.#props.crop[3] || 0));
        //     if (left || right || top || bottom) {
        //         vf_graph.push(
        //             `crop=w=iw*dar*${Math.abs(1-right-left)}:h=ih*${Math.abs(1-bottom-top)}:x=iw*dar*${left}:y=ih*${top}`
        //         );
        //     }
        // }

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
        let norm_filter_option = STREAM_VOLUME_NORMALIZATION_CONFIGS[norm_method];
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
        }

        vf_graph.push(
            // `scale=(iw*sar)*min(${w}/(iw*sar),${h}/ih):ih*min(${w}/(iw*sar),${h}/ih)`,
            // `pad=${w}:${h}:(${w}-iw*min(${w}/iw,${h}/ih))/2:(${h}-ih*min(${w}/iw,${h}/ih))/2`,
            `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
            // `setsar=sar=1`,
            `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
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

    get_dimensions_from_stream(stream) {
        if (stream && stream.width && stream.height) return [stream.width, stream.height];
        return [this.width, this.height];
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

export default MPVSessionWrapper;