import fs from "fs-extra";
import path from "node:path";
import {globals, utils, SessionTypes, FFMPEGWrapper, AccessControl, MediaProps, Download, Session, InternalSessionProps, Session$, History, History$, DEFAULT_PROBE_MEDIA_OPTS} from "./exports.js";
/** @import {MediaInfo, Session$, MainApp$, ProbeMediaOpts, PlaylistItemProps} from "./exports.js" */

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
};

export class PlaylistItem$ {
    id = "";
    parent_id = "0";
    index = 0;
    track_index = 0;
    filename = "";
    /** @type {Record<keyof typeof PlaylistItemProps.props, any>} */
    props = {};
}

/** @typedef {{id:string, parent_id:string, index:number, track_index:number, filename:string, props:Record<PropertyKey,any>}} PlaylistEntry$ */
/** @typedef {Session$ & {playlist_history:History$, playlist_info:Record<PropertyKey,any>, media_info:Record<PropertyKey,MediaInfo$>, playlist_id:string, playlist:Record<PropertyKey,PlaylistEntry$>}} InternalSession$ */
/** @extends {Session<InternalSession$>} */
export class InternalSession extends Session {
    #last_tick = Date.now();
    #ticks = 0;
    #last_save_data;
    #autosaves = [];
    #dirty = false;
    #all_files_iterator;
    #media_refs = {};

    get saves_dir() { return path.join(globals.app.curr_saves_dir, this.id); }
    get files_dir() { return this.$.files_dir ? this.$.files_dir : globals.app.files_dir; }
    get rtmp_key_without_args() { return this.$.rtmp_key.split("?")[0]; }
    get mpv() { return (this.stream||{}).mpv; }
    get is_running() { return !!(this.stream||{}).is_running; }

    /** @param {string} id @param {string} name */
    constructor(id, name) {
        super(SessionTypes.INTERNAL, new InternalSession$(), utils.get_defaults(InternalSessionProps), id, name);

        /** @type {Record<PropertyKey,string[]>} */
        var playlist_assoc_files_map = {};
        var on_reset = ()=>{
            this.playlist_history = new History(utils.Observer.resolve(this.$.playlist));
            this.$.playlist_history = this.playlist_history.$;
        };
        on_reset();
        this.on("reset", on_reset);
        
        fs.mkdirSync(this.saves_dir, {recursive:true});
        fs.mkdirSync(this.files_dir, {recursive:true});
        
        var dirty_ids = new Set();
        var media_props = new Set(["background_file", "files_dir"]);
        var update_media_refs = utils.debounce(()=>{
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
                update_media_refs();
            }
        });

        this.#all_files_iterator = utils.infinite_iterator(()=>utils.iterate_keys(this.#media_refs));
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
                if (!opts.silent) {
                    delete this.$.media_info[filename].processing;
                }
                if (data && this.#media_refs[filename]) {
                    if (!this.$.media_info[filename]) this.$.media_info[filename] = {};
                    utils.deep_sync(this.$.media_info[filename], data);
                }
            }
            return data;
        });
    }
    
    /** @param {string[]} ids */
    async update_media_info_from_ids(ids) {
        ids = new Set(ids.flatMap(id=>[id, ...this.get_playlist_items(id, null, true).map(i=>i.id)]));
        var filenames = [];
        for (var id of ids) {
            if (this.$.playlist_info[id] && this.$.playlist_info[id].filenames) {
                filenames.push(...this.$.playlist_info[id].filenames);
            }
        }
        return Promise.all([...new Set(filenames)].map(f=>this.update_media_info(f, {force:true})));
    }

    async #playlist_update_indices() {
        [...utils.group_by(Object.values(this.$.playlist), i=>`${i.parent_id},${i.track_index}`).values()].forEach(items=>{
            utils.sort(items, item=>item.index).forEach((item,i)=>item.index = i);
        });
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
        // if (this.#ticks % 60 == 0) {
        //     // this.prepare_next_playlist_item();
        // }
        if (this.#ticks % 5 == 0) {
            if (this.clients.length) {
                var filename = this.#all_files_iterator.next().value;
                if (filename) this.update_media_info(filename, {force:false, silent:true});
            }
        }
        this.#last_tick = now;
        this.#ticks++;
    }
    
    /* prepare_next_playlist_item() {
        var next = this.get_playlist_next_item();
        if (next && next.filename) {
            return globals.app.prepare(next.filename);
        }
    } */

    async destroy(move_autosave_dir=false) {
        await this.stop_stream();
        if (move_autosave_dir) {
            await fs.rename(this.saves_dir, path.join(globals.app.old_saves_dir, this.id)).catch(utils.noop);
        }
        return super.destroy();
    }

    async download_and_replace(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        var playlist_ids = [];
        
        ids = ids.map(id=>{
            var playlist = this.get_playlist_items(id);
            if (playlist.length) playlist_ids.push(id);
            return playlist.length ? playlist.map(item=>item.id) : id;
        }).flat();
        
        for (var id of playlist_ids) {
            var filename = this.$.playlist[id].filename;
            var mi = (await this.update_media_info(filename)) || {};
            this.$.playlist[id].filename = "livestreamer://playlist";
            if (mi.name) this.$.playlist[id].props["name"] = mi.name;
        }
        
        for (let id of ids) {
            var filename = (this.get_playlist_item(id) || {}).filename;
            if (!utils.urlify(filename).protocol.match(/^https?:$/)) continue;
            var download = new Download(id, this);
            download.on("error", (msg)=>this.logger.error(msg));
            download.on("info", (msg)=>this.logger.info(msg));
            var filename = await download.start().catch((e)=>{
                if (!e) this.logger.warn(`Download '${filename}}' was cancelled.`);
                else if (e.message && e.message.startsWith("Command failed with exit code 1")) this.logger.warn(`Download '${filename}}' was cancelled.`)
                else if (e.stderr) this.logger.error(e.stderr);
                else this.logger.error(e);
            });
            if (filename) {
                var item = this.$.playlist[id];
                if (item) item.filename = filename;
            }
        }
    }

    async cancel_download(ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (var id of ids) {
            var download = globals.app.downloads[id];
            if (download) download.cancel();
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

    get_current_playlist_item() {
        return this.$.playlist[this.$.playlist_id];
    }

    get_playlist_next_item(id) {
        id = id ?? this.$.playlist_id;
        var curr = this.get_playlist_item(id);
        var playlist = this.get_flat_playlist();
        var next = curr;
        var i = playlist.indexOf(curr);
        while (true) {
            i++;
            next = playlist[i];
            if (!next) break;
            if (!this.is_item_playlist(next.id) || next.props.playlist_mode) break;
        }
        return next;
    }

    get_playlist_items(parent_id="0", track_index=null, recursive=false) {
        /** @type {PlaylistItem[]} */
        var items = [];
        var children = Object.values(this.$.playlist).filter(i=>i.parent_id == parent_id && (track_index == null || i.track_index == track_index));
        children.sort((a,b)=>a.track_index-b.track_index || a.index-b.index);
        for (var item of children) {
            items.push(item);
            if (recursive) items.push(...this.get_playlist_items(item.id, null, true));
        }
        return items;
    }

    get_playlist_tracks(parent_id="0") {
        var item = this.get_playlist_item(parent_id);
        var tracks = [];
        if (item.props.playlist_mode == 2) {
            for (var i = 0; i<2; i++) tracks.push([...this.get_playlist_items(parent_id, i)]);
        } else {
            tracks[0] = [...this.get_playlist_items(parent_id)];
        }
        return tracks;
    }

    get_playlist_parents(id) {
        var item = this.$.playlist[id];
        var parents = [];
        while(item) {
            item = this.$.playlist[item.parent_id];
            if (item) parents.push(item);
        }
        return parents;
    }

    get_playlist_item(id) {
        return this.$.playlist[id];
    }

    playlist_clear() {
        this.playlist_remove(Object.keys(this.$.playlist));
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
            `drawtext=text='%{pts\\:hms}':fontfile='${utils.ffmpeg_escape_file_path(path.resolve(globals.app.resources_dir, "Arial.ttf"))}':fontsize=18:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w-10):y=(h-text_h-10)`,
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
        item = fix_item(item, this.$.playlist);
        this.$.playlist[item.id] = item;
        return item;
    }

    async #playlist_add_children(item) {
        var {id} = item;
        var filename = item.filename;
        var mi = (await this.update_media_info(filename)) || {};

        // if playlist is already full of items, ignore.
        if (!mi.playlist || this.get_playlist_items(id).length) return;

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

    /** @typedef {{insert_pos:number, parent_id:string, track_index:number, register_history:boolean}} PlaylistInsertOptions */
    /** @param {PlaylistInsertOptions} opts */
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
        var old_playlist = this.get_playlist_items(parent_id, track_index);
        
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
        this.#playlist_update_indices(); // <-- shouldn't be necessary but calling it just in case...   

        return results;
    }

    playlist_remove(ids, opts) {
        let {register_history} = opts ?? {};
        if (register_history != false) this.playlist_history.push(`Playlist Removed ${ids.length} items`);
        if (!Array.isArray(ids)) ids = [ids];
        for (var id of ids) this.#playlist_remove(id);
        this.#playlist_update_indices();
    }

    #playlist_update_item(id, changes, opts) {
        let {replace_props} = opts ?? {};
        var d = this.$.playlist[id];
        if (!d) return;
        changes = {...changes};
        if (replace_props) d.props = changes.props;
        else Object.assign(d.props, changes.props);
        delete changes.props;
        Object.assign(d, changes);
        fix_item(d, this.$.playlist);
    }

    playlist_update(data, opts) {
        let {register_history, replace_props} = opts ?? {};
        if (register_history != false) this.playlist_history.push(`Playlist Updated ${Object.keys(data).length} items`);
        fix_circular_playlist_items(data, (e)=>this.logger.error(e));
        for (var id in data) {
            this.#playlist_update_item(id, data[id], {replace_props});
        }
        this.#playlist_update_indices();
    }

    playlist_undo() {
        this.playlist_history.undo();
    }

    playlist_redo() {
        this.playlist_history.redo();
    }
    
    #playlist_remove(id) {
        this.cancel_download(id);
        this.cancel_upload(id);
        this.get_playlist_items(id).forEach(c=>this.#playlist_remove(c.id));
        delete this.$.playlist[id];
    }
    
    get_flat_playlist(id="0") {
        var items = [];
        for (var c of this.get_playlist_items(id)) {
            items.push(c);
            if (!c.props.playlist_mode) {
                items.push(...this.get_flat_playlist(c.id));
            }
        }
        return items;
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

    async client_load_autosave(filename) {
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

        this.playlist_clear();
        this.playlist_add(Object.values(playlist));
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
            this.mpv.seek(time)
        } else {
            this.$.time_pos = time;
        }
    }

    async reload() {
        if (this.is_running) await this.mpv.reload(true);
    }

    async playlist_play(id, opts) {
        opts = Object.assign({
            start: 0,
        }, opts);

        let item = this.get_playlist_item(id);

        this.$.time_pos = opts.start || 0;

        if (this.is_running) {
            if (item && this.is_item_playlist(id) && !item.props.playlist_mode) {
                item = this.get_playlist_next_item(id)
            }
            if (item && item.filename === "livestreamer://exit") {
                var parent = this.get_playlist_item(item.parent_id)
                var parent_items = this.get_playlist_items(parent.parent_id);
                var next_item = parent_items[parent_items.findIndex(s=>s.id == parent.id)+1];
                item = next_item || item;
            }
            let macro = item && item.filename === "livestreamer://macro" && item.props.function
            if (macro === "handover") {
                let session_id = item.props.function_handover_session;
                this.$.playlist_id = null;
                this.stream.attach(session_id);
            } else if (macro === "stop") {
                this.$.playlist_id = null;
                await this.stop_stream();
            } else {
                this.$.playlist_id = item ? item.id : null;
                await this.mpv.loadfile(item, opts);
            }
            // var filename = await globals.app.prepare(item && item.filename);
            // if (filename !== item.filename) {
            //     this.logger.info(`Using '${filename}' in place of '${item.filename}'.`);
            // }
            // this.prepare_next_playlist_item();
            // item = {...item, filename};
            
        } else {
            this.$.playlist_id = item ? item.id : null;
        }
    }

    playlist_next() {
        var next = this.get_playlist_next_item();
        return this.playlist_play(next ? next.id : null);
    }

    is_item_playlist(id) {
        return this.get_playlist_items(id).length > 0 || (this.get_playlist_item(id) || {}).filename === "livestreamer://playlist";
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
    }

    handover(session) {
        this.stream.attach(session, false);
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
    $.access_control = new AccessControl($.access_control);
    var items = Object.values($.playlist);
    $.playlist = {};
    for (var item of items) {
        item = fix_item(item, $.playlist);
        $.playlist[item.id] = item;
    }
    if (!$.stream_settings) $.stream_settings = {};
    utils.cleanup_prop($, InternalSessionProps, true, warn);
    fix_circular_playlist_items($.playlist, warn);
    return $;
}

export default InternalSession;

function fix_item(item, $) {
    if (typeof item !== "object") item = {filename: String(item)};
    var {id, filename, props, index, parent_id, track_index} = item; // , upload_id
    id = String(id ?? utils.uuidb64());
    filename = filename || "livestreamer://empty";
    props = props || {};
    utils.remove_nulls(props);
    parent_id = String(parent_id || "0");
    if (!(parent_id in $)) parent_id = "0";
    index = index || 0;
    track_index = track_index || 0;
    while ($[id]) id = utils.uuidb64();
    return {id, filename, index, parent_id, track_index, props};
}