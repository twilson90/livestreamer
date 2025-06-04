import fs from "fs-extra";
import path from "node:path";
import {globals, SessionTypes, MediaProps, Download, Session, InternalSessionProps, PlaylistItemProps, PlaylistItemPropsProps, Session$, DEFAULT_PROBE_MEDIA_OPTS} from "./exports.js";
import {utils, FFMPEGWrapper, MPVLoadFileError, History, History$, AccessControl} from "../core/exports.js";
/** @import {MediaInfo, Session$, ProbeMediaOpts, LoadFileOpts} from "./exports.js" */

const video_exts = ["3g2","3gp","aaf","asf","avchd","avi","drc","flv","gif","m2v","m4p","m4v","mkv","mng","mov","mp2","mp4","mpe","mpeg","mpg","mpv","mxf","nsv","ogg","ogv","qt","rm","rmvb","roq","svi","vob","webm","wmv","yuv"];


const VERSION = "3.0";

export class PlaylistInfo$ {
    /** @type {string[]} */
    filenames = [];
}

export class InternalSession$ extends Session$ {
    /** @type {History$} */
    playlist_history;
    /** @type {Record<PropertyKey,PlaylistInfo$>} */
    playlist_info = {};
    /** @type {Record<PropertyKey,MediaInfo>} */
    media_info = {};
    /** @type {string} */
    playlist_id;
    /** @type {Record<PropertyKey,PlaylistItem$>} */
    playlist = {};
    player_default_override = {};
    files_dir = "";
    rtmp_key = "";
    time_pos = 0;
    schedule_start_time = 0;
    background_mode
    background_color
    /** @type {string} */
    background_file = null;
    background_file_start = 0;
    background_file_end = 0;
    volume_target = 100;
    volume_speed = 50;
};

export class PlaylistItem$ {
    id = "";
    parent_id = "0";
    index = 0;
    track_index = 0;
    filename = "";
    /** @type {typeof PlaylistItemPropsProps} */
    props = {};
}

/** @typedef {{id:string, parent_id:string, index:number, track_index:number, filename:string, props:Record<PropertyKey,any>}} PlaylistEntry$ */
/** @typedef {Session$ & {playlist_history:History$, playlist_info:Record<PropertyKey,any>, media_info:Record<PropertyKey,MediaInfo$>, playlist_id:string, playlist:Record<PropertyKey,PlaylistEntry$>}} InternalSession$ */
/** @typedef {{register_history:boolean}} PlaylistOptions */
/** @typedef {PlaylistOptions & {insert_pos:number, parent_id:string, track_index:number}} PlaylistAddOptions */

/** @extends {Session<InternalSession$>} */
export class InternalSession extends Session {
    #last_tick = Date.now();
    #ticks = 0;
    #last_save_data;
    #autosaves = [];
    #dirty = false;
    #all_files_iterator;
    #media_refs = {};
    /** @type {Record<PropertyKey, PlaylistItem$[][]>} */
    #playlist_map = {};
    /** @type {PlaylistItem$[]} */
    #flat_playlist = [];
    /** @type {Map<PlaylistItem$, number>} */
    #flat_playlist_index_map = new Map();
    /** @type {Map<PlaylistItem$, number>} */
    #flat_playlist_playable_index_map = new Map();
    #next_parsed_playlist_item;

    get saves_dir() { return path.join(globals.app.curr_saves_dir, this.id); }
    get files_dir() { return this.$.files_dir ? this.$.files_dir : globals.app.files_dir; }
    get rtmp_key_without_args() { return this.$.rtmp_key.split("?")[0]; }
    get player() { return (this.stream||{}).player; }
    get is_running() { return !!(this.stream||{}).is_running; }
    get first_item_id() {
        var item = this.#flat_playlist[0];
        return item ? item.id : null;
    }

    /** @param {string} id @param {string} name */
    constructor(id, name) {
        super(SessionTypes.INTERNAL, new InternalSession$(id), utils.get_defaults(InternalSessionProps));

        this.$.name = name;
        
        /** @type {Record<PropertyKey,string[]>} */
        var playlist_assoc_files_map = {};
        
        fs.mkdirSync(this.saves_dir, {recursive:true});
        fs.mkdirSync(this.files_dir, {recursive:true});
        
        var dirty_ids = new Set();
        var media_props = new Set(["background_file", "files_dir"]);
        var on_playlist_update = utils.debounce(()=>{
            for (var id of dirty_ids) {
                var deleted = !(id in this.$.playlist);
                if (deleted) {
                    this.unregister_media_refs([...playlist_assoc_files_map[id]]);
                    delete playlist_assoc_files_map[id];
                    delete this.$.playlist_info[id];
                } else {
                    var item = this.$.playlist[id];
                    var old_filenames = playlist_assoc_files_map[id] || [];
                    var new_filenames = [];
                    new_filenames.push(item.filename);
                    new_filenames.push(item.props.video_file);
                    new_filenames.push(item.props.audio_file);
                    new_filenames.push(item.props.subtitle_file);
                    new_filenames = [...new Set(new_filenames.filter(f=>f))];
                    var removed = utils.set_difference(old_filenames, new_filenames);
                    var added = utils.set_difference(new_filenames, old_filenames);
                    this.unregister_media_refs([...removed]);
                    this.register_media_refs([...added]);
                    if (!this.$.playlist_info[id]) this.$.playlist_info[id] = {};
                    this.$.playlist_info[id].filenames = new_filenames;
                    playlist_assoc_files_map[id] = new_filenames;
                }
            }
            dirty_ids.clear();
        }, 0);

        this.observer.on("change", (c)=>{
            if (c.path[0] in InternalSessionProps) this.#dirty = true;
            if (media_props.has(c.path[0])) {
                this.unregister_media_refs([c.old_value].filter(f=>f));
                this.register_media_refs([c.new_value].filter(f=>f));
            } else if (c.path[0] == "playlist" && c.path.length>1) {
                let id = c.path[1];
                dirty_ids.add(id);
                on_playlist_update();
            }
        });

        this.#all_files_iterator = utils.infinite_iterator(()=>utils.iterate_keys(this.#media_refs));
    }

    reset() {
        super.reset();

        this.playlist_history = new History(utils.Observer.resolve(this.$.playlist));
        this.$.playlist_history = this.playlist_history.$;
    }

    async move_autosave_dir() {
        await fs.rename(this.saves_dir, path.join(globals.app.old_saves_dir, this.id));
    }

    /** @param {string[]} filenames */
    register_media_refs(filenames) {
        for (var filename of filenames) {
            if (!this.#media_refs[filename]) {
                this.#media_refs[filename] = 0;
            }
            this.#media_refs[filename]++;
            this.update_media_info(filename);
        }
        globals.app.register_media_refs(filenames);
    }

    /** @param {string[]} filenames */
    unregister_media_refs(filenames) {
        for (var filename of filenames) {
            this.#media_refs[filename]--;
            if (this.#media_refs[filename] <= 0) {
                delete this.#media_refs[filename];
                delete this.$.media_info[filename];
            }
        }
        globals.app.unregister_media_refs(filenames);
    }

    /** @param {string} filename @param {ProbeMediaOpts} opts */
    update_media_info(filename, opts) {
        opts = {
            ...DEFAULT_PROBE_MEDIA_OPTS,
            ...opts
        };
        if (filename) {
            if (!opts.silent) {
                utils.deep_merge(this.$.media_info, {[filename]:{processing:1}});
            }
        }
        return globals.app.get_media_info(filename, opts).then((data)=>{
            if (filename) {
                if (!opts.silent && this.$.media_info[filename]) {
                    delete this.$.media_info[filename].processing;
                }
                if (data && this.#media_refs[filename]) {
                    if (!this.$.media_info[filename]) this.$.media_info[filename] = {};
                    var ts = Date.now();
                    utils.deep_sync(this.$.media_info[filename], {...data, ts});
                }
            }
            return data;
        });
    }
    
    /** @param {string[]} ids */
    async update_media_info_from_ids(ids) {
        ids = new Set(ids.flatMap(id=>[id, ...[...this.iterate_playlist_items(id, null, true)].map(i=>i.id)]));
        var filenames = [];
        for (var id of ids) {
            if (this.$.playlist_info[id] && this.$.playlist_info[id].filenames) {
                filenames.push(...this.$.playlist_info[id].filenames);
            }
        }
        return Promise.all([...new Set(filenames)].map(f=>this.update_media_info(f, {force:true})));
    }

    /** updates all indices and rebuilds the flat playlist */
    #playlist_update() {
        var playlist = this.$.playlist;
        var grouped = utils.group_by(Object.values(playlist), item=>item.parent_id);
        
        /** @type {Record<PropertyKey, PlaylistItem$[][]>} */
        var playlist_map = {"0":[[]]};
        for (var [parent_id, items] of grouped) {
            if (items.length == 0) continue;
            var parent = playlist[parent_id];
            var is_multi_track = parent_id == "0" ? false : parent.props.playlist_mode == 2;
            var track_map = utils.group_by(items, item=>is_multi_track ? item.track_index : 0);
            for (let items of track_map.values()) {
                items.sort((a,b)=>a.index-b.index);
                for (let i=0; i<items.length; i++) {
                    items[i].index = i;
                }
            }
            let tracks = [];
            if (is_multi_track) {
                for (let i=0; i<2; i++) {
                    tracks.push(track_map.get(i) || []);
                }
            } else {
                tracks.push([...track_map.values()].flat())
            }
            playlist_map[parent_id] = tracks;
        }
        this.#playlist_map = playlist_map;

        var flat_playlist = [];
        var flat_playlist_playable = [];
        var seen = new Set();
        var process = (id, playable=true)=> {
            if (seen.has(id)) return;
            seen.add(id); // protection against infinite loops.
            var item = playlist[id];
            var tracks = playlist_map[id];
            var is_playlist = !!tracks;
            var is_merged = !!(item && item.props.playlist_mode);
            var playable_children = is_playlist && !is_merged;
            if (playable && !playable_children) {
                flat_playlist_playable.push(item);
            }
            if (tracks) {
                for (var track of tracks) {
                    for (var c of track) {
                        flat_playlist.push(c);
                        process(c.id, playable && playable_children);
                    }
                }
            }
        }

        process("0");
        
        this.#flat_playlist = flat_playlist;
        this.#flat_playlist_index_map = new Map(flat_playlist.map((c,i)=>[c, i]));
        this.#flat_playlist_playable_index_map = new Map(flat_playlist_playable.map((c,i)=>[c, i]));
        
        this.#next_parsed_playlist_item = null;
    }

    async scheduled_start_stream() {
        this.logger.info(`Scheduled to start streaming now...`);
        await this.start_stream();
        this.$.schedule_start_time = null;
    }

    async tick() {
        var now = Date.now();
        var start_time = +new Date(this.$.schedule_start_time);
        if (start_time && now >= start_time && this.#last_tick < start_time) {
            this.scheduled_start_stream();
        }
        if (this.#ticks % 5 == 0) {
            if (this.clients.length) {
                var filename = this.#all_files_iterator.next().value;
                if (filename) this.update_media_info(filename, {silent:true});
            }
            if (this.is_running) {
                if (this.player.duration && this.player.time_pos >= this.player.duration - 60) {
                    this.prepare_next_playlist_item();
                }
            }
        }
        this.#last_tick = now;
        this.#ticks++;
    }

    prepare_next_playlist_item() {
        if (this.#next_parsed_playlist_item) return;
        var next = this.get_playlist_adjacent_item(this.$.playlist_id);
        this.#next_parsed_playlist_item = this.player.parse_item(next);
    }

    /** @param {string[]} ids */
    async download_and_replace(ids) {
        var _this = this;
        /** @return {AsyncGenerator<Download, void>} */
        var process = async function*(id) {
            var item = _this.$.playlist[id];
            var filename = item.filename;
            var mi = (await _this.update_media_info(filename)) || {};
            if (mi.name || mi.filename) item.props.label = mi.name || mi.filename;
            if (_this.is_item_playlist(id)) {
                item.filename = "livestreamer://playlist";
                var children = [..._this.iterate_playlist_items(id)];
                for (var c of children) {
                    yield* await process(c.id);
                }
                return;
            }
            if (!utils.urlify(filename).protocol.match(/^https?:$/)) {
                return;
            }
            yield new Download(id, _this);
        };

        for (let id of ids) {
            for await (let download of process(id)) {
                download.on("error", (msg)=>this.logger.error(msg));
                download.on("info", (msg)=>this.logger.info(msg));
                await download.start()
                    .then((new_filename)=>{
                        if (download.item) download.item.filename = new_filename;
                    })
                    .catch((e)=>{
                        if (download.destroyed) return; // aka cancelled.
                        if (e) this.logger.warn(`Download failed: ${e.stderr || e}`);
                    })
                    .finally(()=>{
                        download.destroy();
                    })
            }
        }
    }

    async cancel_download(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (var id of ids) {
            var download = globals.app.downloads[id];
            if (download) download.destroy();
            if (this.is_item_playlist(id)) {
                var children = [...this.iterate_playlist_items(id)];
                await this.cancel_download(children.map(c=>c.id));
            }
        }
    }

    async cancel_upload(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (var id of ids) {
            var upload = globals.app.uploads[id];
            if (upload) upload.cancel();
        }
    }

    /* async create_playlist(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        var items = ids.map(id=>this.$.playlist[id]);
        items.sort((a,b)=>a.index-b.index);
        var new_item = this.playlist_add("livestreamer://playlist", items[0].index, items[0].parent_id, items[0].track_index);
        items.forEach((item,i)=>{
            item.parent_id = new_item.parent_id;
            item.index = i;
            item.track_index = 0;
        })
        this.update_playlist_indices();
        return new_item;
    } */

    get_playlist_item(id) {
        return this.$.playlist[id];
    }

    get_current_playlist_item() {
        return this.$.playlist[this.$.playlist_id];
    }

    /** @param {PlaylistItem$} item @returns {PlaylistItem$} */
    evaluate_playlist_item(item) {
        item = item ? {...item} : {};
        if (!item.id) item.id = "";
        if (!item.parent_id) item.parent_id = "";
        if (!item.index) item.index = -1;
        if (!item.filename) item.filename = "livestreamer://empty";
        if (!item.index) item.index = -1;
        if (!item.track_index) item.track_index = 0;
        item.props = utils.json_copy({
            ...utils.get_defaults(PlaylistItemPropsProps),
            ...this.$.player_default_override,
            ...item.props,
        });
        return item;
    }

    /** @returns {Generator<PlaylistItem$, void>} */
    *iterate_playlist_items(parent_id, track_index, recursive=false) {
        var tracks = this.get_playlist_tracks(parent_id);
        if (typeof track_index == "number") tracks = tracks.filter((t,i)=>i == track_index);
        for (var track of tracks) {
            for (var item of track) {
                yield item;
                if (recursive) yield* this.iterate_playlist_items(item.id, null, true);
            }
        }
    }

    has_playlist_items(id) {
        return !this.iterate_playlist_items(id).next().done;
    }

    /** @returns {Generator<PlaylistItem$, void>} */
    *iterate_playlist_parents(id) {
        var item = this.$.playlist[id];
        while(true) {
            item = this.$.playlist[item.parent_id];
            if (!item) return;
            yield item;
        }
    }

    get_playlist_adjacent_item(id, direction=1) {
        var item = this.$.playlist[id];
        var i = this.#flat_playlist_index_map.get(item)+direction;
        for (; i < this.#flat_playlist.length; i+=direction) {
            item = this.#flat_playlist[i];
            if (this.#flat_playlist_playable_index_map.has(item)) {
                return item;
            }
        }
    }

    /** @param {PlaylistOptions} opts */
    playlist_clear(opts) {
        this.playlist_remove(Object.keys(this.$.playlist), opts);
    }

    async detect_crop(id) {
        var item = this.$.playlist[id];
        if (!item) return;
        
        var filename = item.filename;
        var mi = await this.update_media_info(filename) || {};
        if (utils.urlify(filename).protocol !== "file:") return;
        var v_stream = mi.streams.find(c=>c.type==="video");
        if (!v_stream) return;
        var [w, h] = [+v_stream.width, +v_stream.height];
        var ar = w/h;
        var oh = Math.round(Math.min(h, 480));
        var ow = Math.round(oh * ar);
        this.logger.info(`Running crop detection on '${filename}'...`);
        var t0 = Date.now();
        var n = 5; // num keyframes to sample.
        var props = item.props || {};
        var start = props.clip_start || 0;
        // var duration = mi.duration;
        // start = utils.clamp(start, 0, Math.max(0,duration - 60));
        // var interval = utils.clamp((duration-1)/n, 0, 10);
        var filepath = utils.pathify(filename);
        var dir = path.join(globals.app.screenshots_dir, id);
        await fs.mkdir(dir, {recursive:true});
        var vfs = [
            `cropdetect=limit=24:round=2:reset_count=1:skip=0`,
            // `scale=trunc(ih*dar/2)*2:trunc(ih/2)*2`,
            `scale=${ow}:${oh}`,
            `setsar=1/1`,
            `drawtext=text='%{pts\\:hms}':fontfile='${utils.ffmpeg_escape_file_path(path.resolve(globals.app.resources_dir, "fonts", "RobotoMono-Regular.ttf"))}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`,
        ];
        /** @type {({pts:number, rect:utils.Rectangle})[]} */
        var rects = [];
        var ffmpeg = new FFMPEGWrapper();
        ffmpeg.on("line", (line)=>{
            console.log(line);
            var m = String(line).match(/crop=(.+?):(.+?):(.+?):(.+?)$/);
            if (m) {
                var pts = +line.match(/pts:(\d+)/)[1];
                var rect = new utils.Rectangle(+m[3], +m[4], +m[1], +m[2]);
                rect.scale(1/w,1/h);
                if (rect.width < 0.2 || rect.height < 0.2) rect = new utils.Rectangle();
                rects.push({pts, rect});
            }
        });
        ffmpeg.on("error", (e)=>this.logger.error(e));
        await ffmpeg.start([
            "-threads", "1",
            "-skip_frame", "nokey",
            '-noaccurate_seek',
            "-ss", start,
            "-i", filepath,
            // ...(interval ? ["-r", 1/interval] : []),
            `-f`, "image2",
            // "-max_muxing_queue_size", "9999",
            "-vf", vfs.join(","),
            "-vsync", "0",
            "-vframes", String(n+2),
            "-y",
            `%d.jpg`,
        ], {cwd: dir});
        var files = await fs.readdir(dir);
        rects = rects.slice(-n);
        var t1 = Date.now();
        var r = rects.length ? utils.Rectangle.union(...rects.map(r=>r.rect)) : null;
        var crops = rects.map((r,i)=>{
            var f = files[files.length-rects.length+i];
            if (!f) return;
            var url = `/screenshots/${id}/${f}`;
            return {url, ...r}
        }).filter(c=>c);
        utils.sort(crops, c=>c.pts);
        var result = {
            crops,
            combined: r,
            width: w,
            height: h,
        };
        globals.app.detected_crops_cache.set(id, result);
        this.logger.info(`Crop detection ${r} in ${(t1-t0)/1000} secs`);
        return result;
    }
    
    #playlist_add(item) {
        item = fix_playlist_item(item, this.$.playlist);
        this.$.playlist[item.id] = item;
        return item;
    }

    async #playlist_add_children(item) {
        var {id} = item;
        var filename = item.filename;
        var mi = (await this.update_media_info(filename)) || {};

        // if playlist is already full of items, ignore.
        if (!mi.playlist || this.has_playlist_items(id)) return;

        // handles mediainfo playlists
        var index = 0;
        var all = new Set([...mi.playlist]);
        for (let filename of mi.playlist) {
            if (typeof filename !== "string") continue;
            all.delete(filename);
            this.#playlist_add({filename, index:index++, parent_id:id})
        }
        if (all.size) {
            var add_children = (items, new_parent_id)=>{
                items.sort((a,b)=>a.index-b.index);
                for (var item of items) {
                    all.delete(item);
                    item.index = index++;
                    item.parent_id = new_parent_id;
                    var new_item = this.#playlist_add(item);
                    var children = [];
                    if (item.id) children.push(...[...all].filter(f=>f.parent_id == item.id));
                    if (item.children) children.push(...item.children); // for json playlists with children variable tree-like structure.
                    if (children.length) {
                        add_children(children, new_item.id);
                    }
                }
            }
            add_children([...all].filter(f=>!f.parent_id || f.parent_id == "0"), id);
            // add any leftovers if there was a fuck up:
            if (all.size) {
                this.logger.warn(`Leftover playlist items detected and added: ${JSON.stringify([...all])}`);
                add_children([...all], id);
            }
        }
    }

    /** @param {PlaylistAddOptions} opts */
    playlist_add(items, opts) {
        if (!Array.isArray(items)) items = [items];
        opts = {
            insert_pos: undefined,
            parent_id: "0",
            track_index: 0,
            ...opts,
        };
        let {insert_pos, parent_id, track_index, register_history} = opts;
        if (register_history != false) this.playlist_history.push(`Playlist Added ${items.length} items`);
        if (!this.$.playlist[parent_id]) parent_id = "0";
        var old_playlist = [...this.iterate_playlist_items(parent_id, track_index)];
        
        items = items.map(f=>(!f || typeof f == "string") ? {filename:f} : {...f})
        var playlist_map = Object.fromEntries(utils.group_by(items, f=>f.parent_id || parent_id));
        for (var k in playlist_map) playlist_map[k].sort((a,b)=>a.index-b.index)

        var results = [];
        var walk = (map_key, parent_id, start_index)=>{
            if (!playlist_map[map_key]) return;
            playlist_map[map_key].forEach((f,i)=>{
                f.index = start_index + i;
                f.parent_id = parent_id;
                var new_item = this.#playlist_add(f);
                this.#playlist_add_children(new_item);
                results.push(new_item);
                walk(f.id, new_item.id, 0);
            });
            delete playlist_map[map_key];
        };
        var num_added = (playlist_map[parent_id] || []).length;

        insert_pos = insert_pos ?? old_playlist.length;
        insert_pos = utils.clamp(insert_pos, 0, old_playlist.length);
        var playlist_after = old_playlist.slice(insert_pos);
        var i = insert_pos;
        walk(parent_id, parent_id, i);
        i += num_added;
        Object.keys(playlist_map).forEach(id=>walk(id, "0", i++));
        playlist_after.forEach((item)=>{
            item.index = i++;
        });
        this.#playlist_update();

        return results;
    }

    /** @param {PlaylistOptions} opts */
    playlist_remove(ids, opts) {
        let {register_history} = opts ?? {};
        if (register_history != false) this.playlist_history.push(`Playlist Removed ${ids.length} items`);
        if (!Array.isArray(ids)) ids = [ids];

        var curr_index = this.#flat_playlist_index_map.get(this.$.playlist[this.$.playlist_id])
        var next_items = this.#flat_playlist.slice(curr_index);

        for (var id of ids) this.#playlist_remove(id);
        this.#playlist_update();

        if (this.is_running) {
            var next_item = next_items.find(i=>i.id in this.$.playlist);
            this.playlist_play(next_item ? next_item.id : null);
        }
    }

    #playlist_update_item(id, changes, opts) {
        let {replace_props} = opts ?? {};
        var item = this.$.playlist[id];
        if (!item) return;
        changes = {...changes};
        var props = changes.props;
        delete changes.props;
        Object.assign(item, changes);
        if (replace_props && props) item.props = props;
        else Object.assign(item.props, props);
        fix_playlist_item(item, this.$.playlist);
        if (this.is_running && this.$.playlist_id == id) {
            this.#update_player_properties();
        }
    }

    /** @param {PlaylistOptions} opts */
    playlist_update(data, opts) {
        let {register_history, replace_props} = opts ?? {};
        if (register_history != false) this.playlist_history.push(`Playlist Updated ${Object.keys(data).length} items`);
        fix_circular_playlist_items(data, (e)=>this.logger.error(e));
        for (var id in data) {
            this.#playlist_update_item(id, data[id], {replace_props});
        }
        this.#playlist_update();
    }

    playlist_undo() {
        this.playlist_history.undo();
        this.#playlist_update();
    }

    playlist_redo() {
        this.playlist_history.redo();
        this.#playlist_update();
    }
    
    #playlist_remove(id) {
        this.cancel_download(id);
        this.cancel_upload(id);
        for (var c of [...this.iterate_playlist_items(id)]) this.#playlist_remove(c.id);
        delete this.$.playlist[id];
    }

    /* async get_merged_playlist_root(id) {
        for (var p of this.get_playlist_parents(id)) {
            if (p.props["playlist-mode"]) return p;
        }
    } */

    get_user_save_data() {
        this.autosave();
        return fix_session(this.$);
    }

    async load_autosave(filename) {
        // this.autosave();
        var data = JSON.parse(await fs.readFile(path.join(this.saves_dir,filename),"utf8"));
        await this.load(data);
    }

    /** @param {InternalSession$} $ */
    async load($, full=false) { // full aka init (only true when App is loading)
        this.logger.info(`Loading... [full=${full}]`);
        $ = fix_session($, (e)=>this.logger.warn(e));
        var playlist = $.playlist;
        delete $.playlist;
        delete $.id;
        if (!full) {
            delete $.index;
            delete $.name;
            delete $.access_control;
            delete $.stream_id;
        }
        this.#last_save_data = utils.json_copy($);
        
        this.reset();
        Object.assign(this.$, $);

        this.playlist_clear({register_history:false});
        this.playlist_add(Object.values(playlist), {register_history:false});
        this.playlist_history.clear();

        if (full) {
            this.#autosaves = (await utils.readdir_stats(this.saves_dir).catch(()=>[])).sort((a,b)=>a.stat.mtime-b.stat.mtime).map(f=>f.filename);
            // await this.autosave(); // to fix any issues and save
        }
        // this.autosave();
    }
    
    async autosave() {
        if (!this.#dirty) return;
        this.#dirty = false;
        
        var $ = fix_session(this.$);
        var diff = utils.deep_diff($, this.#last_save_data);
        this.#last_save_data = $;
        if (utils.is_empty(diff)) return;
        
        $.version = VERSION;
        
        var filename = `${utils.sanitize_filename(this.name)}-${utils.date_to_string()}`;
        
        delete diff.time;
        delete diff.playlist_id;

        if (utils.is_empty(diff) && this.#autosaves.length) {
            // if diff only included playlist_id and time, just replace previous save file...
            filename = this.#autosaves[this.#autosaves.length-1];
        } else {
            this.logger.info(`Autosaving...`);
            this.#autosaves.push(filename);
        }

        var json = JSON.stringify($, null, "  ");
        var fullpath = path.join(this.saves_dir, filename);
        await fs.writeFile(fullpath, json);
        
        while (this.#autosaves.length > globals.app.conf["main.autosaves_limit"]) {
            var filename = this.#autosaves.shift();
            var f = path.join(this.saves_dir, filename);
            try { await fs.unlink(f); } catch { }
        }

        return $;
    }

    async get_autosave_history() {
        await this.autosave();
        var curr = fix_session(this.$);
        var prev;
        var history = [];
        var files = (await utils.readdir_stats(this.saves_dir).catch(()=>[])).sort((a,b)=>b.stat.mtime-a.stat.mtime);
        for (var f of files) {
            var data;
            var fullpath = path.join(this.saves_dir, f.filename);
            try {
                data = JSON.parse(await fs.readFile(fullpath, "utf8"));
            } catch (e) {
                this.logger.error(`malformed json: '${fullpath}'`);
                continue;
            }
            data = fix_session(data);
            var curr_diff = utils.deep_diff(curr, data);
            var prev_diff = prev ? utils.deep_diff(prev, data) : null;
            [curr_diff, prev_diff].forEach(diff_tree=>{
                utils.walk(diff_tree, function(k,v,path){
                    if (v instanceof utils.Diff) {
                        this[k] = [v.type, v.old_value, v.new_value];
                        return false;
                    }
                    // return true;
                })
            })
            curr_diff = diff_tree_to_list(curr_diff);
            prev_diff = prev_diff ? diff_tree_to_list(prev_diff) : null;
            if (prev_diff && prev_diff.length == 0 || (!prev_diff && curr_diff.length == 0)) continue;
            history.push({
                filename: f.filename,
                mtime: +f.stat.mtime,
                curr: curr_diff,
                prev: prev_diff,
            });
            prev = data;
        }
        return history;
    }

    async seek(time) {
        time = Math.max(0, +time);
        if (isNaN(time)) time = 0;
        if (this.is_running) {
            this.player.seek(time)
        } else {
            this.$.time_pos = time;
        }
    }

    async reload(remember_time_pos=false) {
        return this.playlist_play(this.$.playlist_id, { start: remember_time_pos ? this.$.time_pos : 0, pause: this.player.is_paused });
    }

    /** @param {string} id @param {LoadFileOpts} opts */
    async playlist_play(id, opts) {
        this.#next_parsed_playlist_item = null;
        
        opts = {
            start: 0,
            pause: false,
            ...opts,
        };

        let item = fix_playlist_item(this.$.playlist[id]); // fixes nulls or 'fake' items

        this.$.time_pos = opts.start || 0;

        if (!this.is_running) {
            this.$.playlist_id = id;
            return;
        }
        if (this.is_item_playlist(id) && !item.props.playlist_mode) {
            item = this.get_playlist_adjacent_item(id);
        }
        if (item.filename === "livestreamer://exit") {
            item = this.get_playlist_adjacent_item(item.parent_id);
        }

        let macro = item.filename === "livestreamer://macro" && item.props.function;
        if (macro === "handover") {
            let session_id = item.props.function_handover_session;
            this.$.playlist_id = null;
            return this.stream.attach(session_id);
        }
        if (macro === "stop") {
            this.$.playlist_id = null;
            return await this.stop_stream();
        }

        this.$.playlist_id = item.id;
        var t0 = Date.now();

        await this.player.loadfile(item, opts)
            .then((success)=>{
                var d = Date.now()-t0;
                if (d > 1000) this.logger.warn(`loadfile '${item.filename}' took ${d}ms`);
            })
            .catch(e=>{
                this.logger.warn("loadfile failed:", e);
                // if loadfile was overridden, we don't want to play the next item, we can assume it's just been called and triggered the override.
                if (e instanceof MPVLoadFileError && e.name == "override") {
                    return;
                }
                return this.playlist_next();
            });
    }

    playlist_next() {
        var item = this.get_playlist_adjacent_item(this.$.playlist_id);
        return this.playlist_play(item ? item.id : null);
    }

    is_item_playlist(id) {
        return this.has_playlist_items(id) || (id in this.$.playlist && this.$.playlist[id].filename === "livestreamer://playlist");
    }
    
    /** @param {string} id */
    get_playlist_tracks(id) {
        return this.#playlist_map[id] || [[]];
    }

    async clear_playlist_props(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (var id of ids) {
            this.$.playlist[id].props = {};
        }
    }
    
    /** @param {string} name */
    async set_player_default_override(name, value) {
        if (!(name in MediaProps)) return;
        this.$.player_default_override[name] = value;
        if (this.is_running) {
            this.#update_player_properties();
        }
    }

    #update_player_properties() {
        var item = this.get_current_playlist_item() || {props:{}};
        for (var name in PlaylistItemPropsProps) {
            this.player.set_property(name, item.props[name] ?? this.$.player_default_override[name] ?? PlaylistItemPropsProps[name].__default__);
        }
    }

    /** @param {number|{volume_target: number, volume_speed: number}} opts */
    update_volume(opts) {
        if (typeof opts === "number") opts = {volume_target: opts};
        if (opts.volume_target !== undefined) this.$.volume_target = opts.volume_target;
        if (opts.volume_speed !== undefined) this.$.volume_speed = opts.volume_speed;
        if (this.is_running) {
            this.player.debounced_update_volume();
        }
    }

    update_stream_settings(data) {
        utils.merge(this.$.stream_settings, data, {delete_nulls:true});
    }

    handover(session) {
        this.stream.attach(session); // , false
    }
}

function diff_tree_to_list(t) {
    return utils.deep_entries(t, true, (k,v)=>Array.isArray(v)?false:true);
}

/* function replace_prop($, old_names, new_name){
    if (!Array.isArray(old_names)) old_names = [old_names];
    for (var old_name of old_names) {
        if (old_name in $) {
            $[new_name] = $[old_name];
            delete $[old_name];
        }
    }
} */

/* function modify_prop($, names, modifier){
    if (!Array.isArray(names)) names = [names];
    for (var name of names) {
        if (name in $) {
            $[name] = modifier($[name]);
        }
    }
} */

function fix_circular_playlist_items($, warn) {
    if (!warn) warn = utils.noop;
    var ids = utils.detect_circular_structure(Object.values($).filter(d=>d && d.parent_id).map(({id,parent_id:parent})=>({id,parent})));
    if (ids.length) {
        warn(`Found circular parent-child loops in playlist, attempting to fix:`, ids.join(", "))
        for (var id of ids) $[id].parent_id = "0";
    }
}

/** @param {InternalSession$} $ */
function fix_session($, warn) {
    $ = utils.json_copy($);
    delete $.id;
    $.access_control = new AccessControl($.access_control);
    var items = Object.values($.playlist);
    $.playlist = {};
    for (var item of items) $.playlist[item.id] = fix_playlist_item(item, $.playlist);
    for (var item of Object.values($.playlist)) {
        if (!(item.parent_id in $.playlist)) item.parent_id = "0";
    }
    if (!$.stream_settings) $.stream_settings = {};
    utils.cleanup_prop($, InternalSessionProps, true, warn);
    fix_circular_playlist_items($.playlist, warn);
    return $;
}

export default InternalSession;

function fix_playlist_item(item, $) {
    if (typeof item !== "object" || item === null) item = {filename: item ? String(item) : "livestreamer://empty"};
    var {id, filename, props, index, parent_id, track_index} = item;
    id = String(id ?? utils.uuidb64());
    filename = filename || "livestreamer://empty";
    props = props || {};
    utils.remove_nulls(props);
    parent_id = String(parent_id || "0");
    index = index || 0;
    track_index = track_index || 0;
    while ($ && $[id]) id = utils.uuidb64();
    return {id, filename, index, parent_id, track_index, props};
}