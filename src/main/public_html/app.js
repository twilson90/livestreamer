import * as utils from "../../utils/utils.js";
import * as dom_utils from "../../utils/dom.js";
import "../../utils/style.scss";
import { jQuery, $ } from '../../../jquery-global.js';
import 'jquery-ui/dist/jquery-ui.js';
import 'jquery-ui/dist/themes/base/jquery-ui.css';
import { Fancybox as _Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox.css";
import noUiSlider from 'nouislider';
import "nouislider/dist/nouislider.css";
import flvjs from 'flv.js';
import {Chart} from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import Hammer from 'hammerjs';
import {Sortable, MultiDrag} from 'sortablejs';
import "./app.scss";
export { utils, dom_utils, jQuery, $, Fancybox, noUiSlider, flvjs, Chart, Hammer, Sortable, MultiDrag }
export const { UI, add_class, remove_class, toggle_attribute, set_inner_html, set_children, set_attribute, set_select_options, set_text, set_value, set_style_property, update_style_properties, remove_style_property, toggle_class } = dom_utils;
const { Observer } = utils;

/** @import InternalSessionProps from "../InternalSessionProps.js" */

Chart.register(zoomPlugin);
// Chart.register(annotationPlugin);

Sortable.mount(new MultiDrag());

const SessionTypes = {
    EXTERNAL: "ExternalSession",
    INTERNAL: "InternalSession",
}

// if (window.videojs) window.videojs.options.autoplay = true;
// export const WS_MIN_WAIT = 1000;
export const WS_MIN_WAIT = 0;
export const MIN_VIDEO_BUFFER_TIME = 1000; // 1 second

export const IMAGE_DURATION = 0.040;
export const CROP_LIMIT = 0.4;
export const IS_ELECTRON = /electron/i.test(navigator.userAgent);
// console.log("IS_ELECTRON:", IS_ELECTRON);

export const logs_max_length = 512;
export const ZERO_DURATION = 60;
export const VOLUME_STEP = 5;
export const MAX_CLIP_SEGMENTS = 128;
export const ELFINDER_USE_FILE_PROTOCOL = false;
export const EMPTY_OBJECT = Object.freeze({});
export const EMPTY_ARRAY = Object.freeze([]);
export const ALL_XHRS = new Set();

window.onbeforeunload = (e)=>{
    if (ALL_XHRS.size) return `Uploads are in progress, leaving will abort the uploads.`;
    // return "";
};
export const YES_OR_NO = [[false,"No"], [true,"Yes"]];

export const ignore_logging_session_$ = new Set([
    "time",
    "player/time-pos",
    "player/estimated-display-fps",
    "player/estimated-vf-fps",
    "player/output-frames",
    "player/output-pts",
]);

export const UPLOAD_STATUS = { STARTED:1, FINISHED:2, CANCELED:3, ERROR:4 };
export const PLAYLIST_VIEW = { LIST: "list", TIMELINE: "timeline" };
export const PLAYLIST_MODE = { NORMAL: 0, MERGED: 1, DUAL_TRACK: 2 };

// --------------------------------------------------------------------

export function time_to_minutes(s) {
    return Math.round(s / (60*1000));
}

export function moving_average(points, windowSize) {
    const smoothedPoints = [];
    for (let i = 0; i < points.length; i++) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        // Calculate the average within the window
        for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
            sumX += points[j].x;
            sumY += points[j].y;
            count++;
        }
        // Calculate the average point
        const averageX = sumX / count;
        const averageY = sumY / count;
        // Push the average point to the smoothed points array
        smoothedPoints.push({ x: averageX, y: averageY });
    }
    return smoothedPoints;
}

// --------------------------------------------------------------------

{
    let media_type = function(type) {
        var v = this.value;
        if (!v) return true;
        var mi = app.$.media_info[v];
        if (!mi || !mi.exists) return "Media does not exist.";
        if (type && mi && mi.streams && !mi.streams.find(s=>s.type === type)) return `No ${type} streams detected.`
        return true;
    };
    Object.assign(UI.VALIDATORS, {
        media_exists: function() { return media_type.apply(this, []); },
        media_video: function() { return media_type.apply(this, ["video"]); },
        media_audio: function() { return media_type.apply(this, ["audio"]); },
        media_subtitle: function() { return media_type.apply(this, ["subtitle"]); },
    });
}

export var windows = {};

// returns selected file paths
export var default_file_manager_options = {
    files: false,
    folders: false,
    multiple: false,
}
export var mime_ext_map = {
    "image": ["jpeg", "jpg", "png", "bmp", "webp", "tif", "tiff", "svg", "ico", "gif"],
    "video": ["mp4", "mkv", "mov", "m4v", "avi", "mpeg", "ogv", "ts", "webm", "3gp", "3g2", "gif"],
    "audio": ["mp3", "wav", "flac", "m4a", "aac", "oga", "opus", "weba", "3gp", "3g2"],
    "text": ["idx", "sup", "srt", "ass", "txt", "sub"],
}

export var graph_colors = [
    '#e6194B',
    '#3cb44b',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#42d4f4',
    '#ffe119',
    '#f032e6',
    '#bfef45',
    '#fabed4',
    '#469990',
    '#dcbeff',
    '#9A6324',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#a9a9a9',
    // '#ffffff',
    // '#000000'
];

export var item_colors = {
    "none":"",
    "red":"#d76262",
    "orange":"#fc8d62",
    "yellow":"#ffd92f",
    "green":"#a6d854",
    "blue":"#8da0cb",
    "turquoise":"#66c2a5",
    "magenta":"#e78ac3",
    "beige":"#e5c494",
};
(()=>{
    for (var k in item_colors) {
        if (!item_colors[k]) continue;
        item_colors[k] = new utils.Color(item_colors[k]).rgb_mix("#fff",0.5).to_rgb_hex();
    }
})();

/* var children_map = new Map();
export var parent_map = new Map();
export function toggle_parent(elem, v) {
    if (v && !elem.parentElement) {
        var p = parent_map[elem];
        var new_children = children_map[p].filter(e=>!!e.parentElement || e === elem);
        dom_utils.insert_at(p, elem, new_children.indexOf(elem));
        delete parent_map[elem];
        if (children_map[p].every(e=>!!e.parentElement)) delete children_map[p];
    } else if (!v && elem.parentElement) {
        if (!children_map[elem.parentElement]) children_map[elem.parentElement] = Array.from(elem.parentElement.children);
        parent_map[elem] = elem.parentElement;
        elem.remove();
    }
} */

export const CHUNK_SIZE = 2 * 1024 * 1024;
export const UploadStatus = {
    STARTED: 1,
    FINISHED: 2,
    CANCELED: 3,
    // ERROR: 4,
}

export class UploadFileChunk {
    constructor() {
        /** @type {Blob} */
        this._blob = null;
        this.id = null;
        this.path = "";
        this.last_modified = 0;
        this.start = 0;
        this.length = 0;
    }
    get end() { return this.start + this.length; }
    get blob() { return this._blob.slice(this.start, this.end); }
    split(chunk_size, first_and_last_pieces_first=false) {
        var chunks = [];
        var length = this.length;
        var start = this.start;
        var end = this.end;
        var num_chunks = Math.ceil(length/chunk_size);
        if (num_chunks > 2 && first_and_last_pieces_first) {
            chunks.push(Object.assign(this.clone(), {start, length: chunk_size}));
            chunks.push(Object.assign(this.clone(), {start: end - chunk_size, length: chunk_size}));
            start += chunk_size;
            end -= chunk_size;
        }
        for (var b=start; b<end; b+=chunk_size) {
            chunks.push(Object.assign(this.clone(), {start:b, length: Math.min(end-b, chunk_size)}));
        }
        return chunks;
    }
    clone() {
        return Object.assign(new UploadFileChunk(), this);
    }
}

UploadFileChunk.create = function(blob, path=undefined) {
    var ufc = new UploadFileChunk();
    ufc._blob = blob;
    ufc.id = blob.id || dom_utils.uuid4();
    ufc.path = path || blob.path || blob.name;
    ufc.last_modified = +blob.lastModified || 0;
    ufc.start = 0;
    ufc.length = blob.size;
    return ufc;
}

/** @typedef {{concurrency_limit:number, chunk_size:number}} UploadQueueOptions */
/** @typedef {{first_and_last_pieces_first:boolean, dir:string, media:boolean}} UploadOptions */
export class UploadQueue {
    /** @param {UploadQueueOptions} opts */
    constructor(opts) {
        this.opts = Object.assign({
            concurrency_limit: 4,
            chunk_size: CHUNK_SIZE,
        }, opts);
        /** @type {UploadFileChunk[]} */
        this.chunks = [];
        /** @type {Set<XMLHttpRequest>} */
        this.xhrs = new Set();
        this.ci = 0;
    }

    /** @param {string} dest @param {File[]} files @param {UploadOptions} opts */
    add(files, opts) {
        if (!Array.isArray(files)) files = [files];
        let chunks = files.map(f=>UploadFileChunk.create(f));
        for (var c of chunks) {
            if (opts.dir) c.path = utils.join_paths(opts.dir, c.path);
            if (opts.media) c.media = true;
            if (opts.session) c.session = opts.session;
        }
        chunks = chunks.map(f=>f.split(this.opts.chunk_size, opts.first_and_last_pieces_first)).flat()
        this.chunks.push(...chunks);
        setTimeout(()=>{
            for (var i = 0; i < this.opts.concurrency_limit; i++) this.next_chunk();
        }, 0);
    }

    async next_chunk() {
        if (this.xhrs.size >= this.opts.concurrency_limit) return;
        if (!this.chunks.length) return;

        let done = false;
        let form_data = new FormData();
        let c = this.chunks.shift();
        var ci = this.ci++;
        
        form_data.append('files[]', c.blob, JSON.stringify({
            filename: c.path, 
            start: c.start, 
            filesize: c._blob.size, 
            mtime: c.last_modified, 
            id: c.id, 
            session_id: c.session || 0,
        }));

        while (!done) {
            let ts = Date.now();
            let xhr = new XMLHttpRequest();
            xhr.id = c.id;
            xhr.progress = 0;
            this.xhrs.add(xhr);
            ALL_XHRS.add(xhr);
            let response = await new Promise((resolve) => {
                xhr.upload.addEventListener("progress", (e)=>{
                    if (e.lengthComputable) {
                        xhr.progress = e.loaded;
                    }
                });
                xhr.addEventListener("loadend", (e) => {
                    resolve(xhr.readyState == 4 && utils.try(()=>JSON.parse(xhr.responseText)));
                });
                let url = new URL(location.origin+"/main/");
                if (c.media) url.searchParams.set("media", "1");
                xhr.open("PUT", url.toString(), true);
                xhr.send(form_data);
            });
            this.xhrs.delete(xhr);
            ALL_XHRS.delete(xhr);
            let msg = `Chunk ${ci} [${Date.now()-ts}ms]`;
            done = true;
            if (xhr.canceled || utils.try(()=>response.uploads[c.id].status === UploadStatus.CANCELED)) {
                console.warn(`${msg} failed. Canceled.`);
            } else if (response && !response.err) {
                console.log(`${msg} succeeded.`);
            } else {
                done = false;
            }
            if (!done) {
                console.warn(`${msg} failed for some reason. Retrying in 5 seconds..."}`);
                await utils.timeout(5000);
            }
        }
        this.next_chunk();
    }

    cancel(id) {
        this.chunks = this.chunks.filter(c=>c.id !== id);
        for (let xhr of this.xhrs) {
            if (xhr.id === id) {
                xhr.canceled = true;
                xhr.abort();
            }
        }
    }
}

export class FileDrop extends utils.EventEmitter{
    /** @param {HTMLElement} elem */
    constructor(elem) {
        super();
        var i = 0;
        var is_files = (e)=>{
            return [...e.dataTransfer.items].some(i=>i.kind === "file");
        }
        add_class(elem, "drop-area");
        elem.addEventListener("drop", async (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
            remove_class(elem, "file-over");
            i--;
            let entries = [...e.dataTransfer.items].map(i=>i.webkitGetAsEntry());
            this.emit("drop", entries);
        });
        elem.addEventListener("dragover", (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
        });
        elem.addEventListener("dragenter", (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
            i++;
            add_class(elem, "file-over");
        });
        elem.addEventListener("dragleave", (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
            i--;
            if (i == 0) remove_class(elem, "file-over")
        });
    }
}

export function round_ms(num) {
    return +num.toFixed(3)
}

// removes properties from o1 if o2 has exact same property (recursive). If both identical returns null.
export function cull(o1,o2) {
    if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
        var empty = true;
        for (var k in o1) {
            if (cull(o1[k], o2[k]) === null) delete o1[k];
            else empty = false;
        }
        if (empty) return null;
        return o1;
    } else {
        if (o1 === o2 || (o1 === null && o2 === undefined)) return null
    }
}

export function remove_empty_objects_from_tree(obj) {
    var deletes = 0;
    var keys = Object.keys(obj);
    for (var k of keys) {
        if (obj[k] !== null && typeof obj[k] === "object" && remove_empty_objects_from_tree(obj[k])) {
            deletes++;
            delete obj[k];
        }
    }
    return (deletes === keys.length)
}

export function get_scrollbar_width(el) {
    return [el.offsetWidth - el.clientWidth, el.offsetHeight - el.clientHeight];
}

export function pretty_uri_basename(uri) {
    if (uri.match(/^https?:/)) {
        return uri;
    } else {
        var name = utils.basename(uri);
        try { name = decodeURI(name); } catch {}
        return name;
    }
}
export function rect_clamp_point(rect, pt) {
    return {x:utils.clamp(pt.x, rect.x, rect.x+rect.width), y:utils.clamp(pt.y, rect.y, rect.y+rect.height)};
}

export function ondrag(elem, handler) {
    elem.draggable = false;
    // elem.onpointerdown = ()=>false;
    elem.addEventListener("pointerdown", (e)=>{
        var onmove = handler(e);
        var onup = ()=>{
            elem.removeEventListener("lostpointercapture", onup);
            window.removeEventListener("pointermove", onmove);
        };
        if (onmove) {
            elem.setPointerCapture(e.pointerId);
            window.addEventListener("pointermove", onmove);
            elem.addEventListener('lostpointercapture', onup);
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}
export function get_clip_segments(start, end, duration, offset=0) {
    if (typeof start == "object") {
        var o = start;
        start = o.start;
        end = o.end;
        duration = o.duration;
        offset = o.offset;
    }
    var segments = [];
    var length = Math.max(0,end-start);
    var t = utils.loop(start + offset, start, end);
    var n = duration / length;
    // console.log(n)
    if (length != 0 && n < MAX_CLIP_SEGMENTS) {
        while (duration > 1e-6) {
            var e = Math.min(t + length, t + duration, end);
            var d = e-t;
            segments.push({start:t, end:e, duration:d});
            duration -= d;
            if (e == end) t = 0;
        }
    }
    return segments;
}

async function read_file(file, encoding="utf-8") {
    if (file instanceof File) {
        return dom_utils.read_file(file, {encoding})
    } else if (IS_ELECTRON) {
        return fs.readFileSync(file.path, encoding);
    }
    throw new Error(`Cannot read file '${file}'`);
}
async function open_file_dialog(options) {
    if (IS_ELECTRON)  {
        var paths = await open_file_manager(options);
        return paths.map(p=>({path:p, name:utils.basename(p)}));
    } else {
        var dialog_opts = {};
        if (options.filter) dialog_opts.accept = options.filter.join(", ");
        if (options.multiple) dialog_opts.multiple = !!options.multiple;
        return await dom_utils.open_file_dialog(dialog_opts);
    }
}
async function save_local_file(filename, text) {
    if (IS_ELECTRON)  {
        var result = await electron.dialog.showSaveDialog({
            defaultPath: filename,
        });
        if (result.filePath) {
            fs.writeFileSync(result.filePath, text);
            return true;
        }
        return false;
    } else {
        dom_utils.download(filename, text);
        return true;
    }
}


export function get_video_size(w,h,interlaced) {
    var ratio = w / h;
    var height = Math.round(ratio <= (16/9) ? h : w / (16/9));
    var text;
    if (height == 1440) text = "2K";
    else if (height == 2160) text = "4K";
    else text = `${height}${interlaced?"i":"p"}`;
    return {
        width: height * ratio,
        height: height,
        text: text
    }
}

export function hash(str) {
    var hash = 0,
        i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

export function create_background_properties(options, is_session) {
    options = Object.assign({
        "name": "background",
        "label": "Background",
        "default": "",
    },options)
    var name = options["name"];

    var background_mode = new UI.Property(`${name}_mode`, null, `<select></select>`, {
        "info": ()=>{
            if (background_mode.value == "embedded") return `Shows the currently playing audio file's embedded artwork.`;
            if (background_mode.value == "external") return `Shows the external artwork relative to the audio file (a file named AlbumArt.jpg, Cover.jpg, etc.)`;
        },
        "label": options["label"],
        "options": options["options"],
        "default": options["default"],
    });

    var background_color = new UI.Property(`${name}_color`, "Color", `<input type="color">`, {
        "default": "#000000",
        "hidden": ()=>background_mode.value !== "color"
    });

    var get_file_duration = ()=>app.$.media_info[background_file.value] ? app.$.media_info[background_file.value].duration : 0;
    var is_file_image = ()=>get_file_duration()<=IMAGE_DURATION;

    var background_file = new FileProperty(`${name}_file`, is_session ? "Logo File" : "Replace Video File", {
        "file.options": { files: true, filter: ["image/*", "video/*"] },
        "info": is_session ? "An image or video file." : "Select a video or an image file to loop and repeat for the duration of the base media item."
        // "hidden": ()=>background_mode.value !== "file",
    });
    background_file.add_validator(UI.VALIDATORS.media_video);
    /* background_file.on("change", (e=>{
        if (e.trigger && e.value) {
            background_mode.set_value("file");
        }
    })) */

    var background_file_start = new UI.TimeSpanProperty(`${name}_file_start`, "Loop Start Time", {
        "timespan.format": "h:mm:ss.SSS",
        "min":0,
        "default": 0,
        "hidden": ()=>is_file_image(),
    });
    
    var background_file_end = new UI.TimeSpanProperty(`${name}_file_end`, "Loop End Time", {
        "timespan.format": "h:mm:ss.SSS",
        "min":0,
        "default": ()=>get_file_duration(),
        "hidden": ()=>is_file_image(),
    });

    return [background_mode, background_color, background_file, background_file_start, background_file_end]
}

export class TicksBar {
    get duration() { return this.end - this.start; }
    constructor(elem, opts) {
        opts = Object.assign({
            hover_elem: null,
            placement: "bottom",
            show_numbers: true,
            modifier: (html)=>html,
        }, opts)
        this.opts = opts;
        this.start = 0;
        this.end = 0;
        this.elem = elem || $(`<div></div>`)[0];
        add_class(this.elem, "ticks-bar");
        this.elem.dataset.placement = opts.placement;
        if (!opts.hover_elem) opts.hover_elem = elem;

        this.ticks_elem = $(`<div class="ticks"></div>`)[0];
        var cursor_elem = $(`<div class="cursor"></div>`)[0];
        var seek_time = $(`<div class="seek-time"></div>`)[0];
        
        this.elem.append(this.ticks_elem, cursor_elem, seek_time);

        var update_seek_time = (e)=>{
            var data = this.parse_event(e);
            seek_time.style.left = `${data.pt.x}px`;
            seek_time.style.top = `${data.rect.y}px`;
            cursor_elem.style.left = `${data.pt.x-data.rect.x}px`;
            var html = `<div>${utils.seconds_to_timespan_str(data.time, app.user_time_format)}</div>`;
            set_inner_html(seek_time, `<div>${opts.modifier(html, data.time)}</div>`);
        }

        this.hover_listener = new dom_utils.TouchListener(opts.hover_elem, {
            mode: "hover",
            start: (e)=>{
                // console.log("in")
                toggle_class(this.elem, "hover", true);
                update_seek_time(e);
            },
            move: (e)=>{
                // console.log("move")
                update_seek_time(e);
            },
            end: (e)=>{
                // console.log("end")
                toggle_class(this.elem, "hover", false);
            }
        });
    }
    
    parse_event(e) {
        var rect = new utils.Rectangle(this.elem.getBoundingClientRect());
        var pt = {x:e.clientX,y:e.clientY}
        if (e.touches) pt = {x:e.touches[0].clientX,y:e.touches[0].clientY};
        var pt = rect_clamp_point(rect, pt);
        var time = this.start + (pt.x-rect.x)/rect.width * this.duration;
        return { time, pt, rect };
    };

    update(start, end) {
        if (this.start == start && this.end == end) return;
        this.start = start;
        this.end = end;

        toggle_class(this.elem, "no-duration", this.duration == 0);

        var ticks = [];
        var duration = end-start;

        if (duration != 0 && duration < TicksBar.max_tick_time) {
            var min_i, num_ticks, min_divisor;
            for (min_i = 0; min_i < TicksBar.tick_times.length; min_i++) {
                var min_divisor = TicksBar.tick_times[min_i];
                num_ticks = duration / min_divisor;
                if (num_ticks < TicksBar.max_ticks) break;
            }
            var max_i = utils.clamp(min_i + TicksBar.tick_heights.length-1, 0, TicksBar.tick_times.length-1);
            // var tis = [];
            for (var t = start; t <= end; t += min_divisor) {
                var t_offset = t % min_divisor;
                var tr = t - t_offset;
                var tx = ((tr - start)/duration*100).toFixed(3);
                var ti;
                for (ti = max_i; ti > min_i; ti--) {
                    if ((Math.floor(tr/min_divisor)*min_divisor)%TicksBar.tick_times[ti]==0) break;
                }
                // tis.push(ti);
                var ti0 = ti-min_i;
                var th = TicksBar.tick_heights[ti0];
                var text = "";
                if (this.opts.show_numbers) {
                    if ((ti >= min_i+2) || (num_ticks < TicksBar.max_ticks*0.25 && ti >= min_i+1)) {
                        text = `<span>${utils.ms_to_shorthand_str(tr*1000, utils.log(Math.ceil(1/TicksBar.tick_times[ti]), 10)).replace(/\s+/g,"")}</span>`;
                    }
                }
                ticks.push(`<div class="tick" style="left:${tx}%;height:${th}">${text}</div>`);
            }
        }
        set_inner_html(this.ticks_elem, ticks.join(""));
    }
}
TicksBar.tick_times = [0.1, 0.5, 1, 5, 15, 60, 5*60, 15*60, 60*60, 4*60*60, 12*60*60, 24*60*60];
TicksBar.tick_heights = ["2px", "4px", "6px", "8px"];
TicksBar.max_tick_time = 8 * TicksBar.tick_times[TicksBar.tick_times.length-1];
TicksBar.max_ticks = 100;



function get_file_manager_url(id) {
    var url = new URL("/file-manager/index.html", window.location.origin);
    if (id !== undefined) url.searchParams.append("id", id);
    return url.toString();
}

/**
 * @param {{id:any, hidden_id:any, folders:boolean, files:boolean, multiple:boolean, filter:string[], start:string}} options 
 */
async function open_file_manager(options) {
    options = Object.assign({
        "new_window" : app.settings.get("open_file_manager_in_new_window")
    }, default_file_manager_options, options);
    if (!options.standalone && options.id === undefined) options.id = dom_utils.uuidb64();
    // if ("start" in options && !Array.isArray(options.start)) options.start = [options.start];
    
    var getfile = !!(options.multiple || options.files || options.folders)

    if (IS_ELECTRON) {
        var electron_options = {
            properties: []
        };
        if (options.start) electron_options.defaultPath = utils.try_file_uri_to_path(options.start); // utils.dirname(options.start[0]);
        if (options.folders) electron_options.properties.push("openDirectory");
        if (options.files) electron_options.properties.push("openFile");
        if (options.multiple) electron_options.properties.push("multiSelections");
        if (options.filter) {
            electron_options.filters = [];
            electron_options.filters.push({name:"All Files", extensions:["*"]});
            var custom_ext = [];
            let mime_filters = [];
            for (var f of options.filter) {
                var m;
                if (m = f.match(/^(.+?)\/\*$/)) {
                    mime_filters.push({name:utils.capitalize(m[1]), extensions:mime_ext_map[m[1]]||["*"]});
                } else if (m = f.match(/^\.(\w+)$/)) {
                    custom_ext.push(m[1]);
                }
            }
            if (mime_filters.length>1) {
                let names = [];
                let extensions = [];
                for (var f of mime_filters) {
                    names.push(f.name);
                    extensions.push(...f.extensions);
                }
                electron_options.filters.push({name: names.join("/"), extensions:[...new Set(extensions)]})
            }
            electron_options.filters.push(...mime_filters);
            if (custom_ext.length) {
                custom_ext = utils.array_unique(custom_ext);
                electron_options.filters.push({ name: "Custom File Type", extensions: custom_ext});
            }
        }
        var results = await electron.dialog.showOpenDialog(electron_options);
        if (results.canceled) return null;
        return results.filePaths;
    } else if (app.$.processes["file-manager"]) {
        /** @type {Window} */
        var win;
        var win_id = options.hidden_id || options.id;
        var use_window = options.new_window;
        var on_message;
        var messenger = new dom_utils.WindowCommunicator();
        return new Promise((resolve,reject)=>{
            var elfinder_options = {
                commandsOptions: {
                    getfile: {
                        multiple: !!options.multiple,
                        // files: !!options.files,
                        folders: !!options.folders,
                    }
                }
            };
            if (options.folders) {
                elfinder_options.onlyMimes = ["directory"];
            }
            if (options.start) {
                var dir = options.start.split("/").slice(0,-1).join("/");
                elfinder_options.startPathHash = app.filename_to_elfinder_hash(dir);
                elfinder_options.selectHashes = [app.filename_to_elfinder_hash(options.start)];
            }
            if (options.filter) {
                elfinder_options.fileFilter = options.filter
            }
            if (getfile) {
                elfinder_options.getFileCallback = true;
            }

            messenger.on("elfinder_options", (id)=>{
                if (id == options.id) return elfinder_options;
            });
            messenger.on("files", ({files,id})=>{
                if (id != options.id) return;
                var paths = files.map(f=>ELFINDER_USE_FILE_PROTOCOL ? f.uri : utils.try_file_uri_to_path(f.uri));
                resolve(paths);
            });

            var url = get_file_manager_url(options.id);
            if (use_window) {
                win = windows[win_id];
                if (!win || win.closed) {
                    win = window.open(url, `_blank`);
                    if (win_id) windows[win_id] = win;
                }
                win.focus();
                win.addEventListener("beforeunload", (e)=>{
                    e.preventDefault();
                    delete windows[win_id];
                    resolve();
                });
            } else {
                app.file_manager_menu.show(url);
                win = app.file_manager_menu.iframe.contentWindow;
                app.file_manager_menu.once("hide", ()=>{
                    resolve();
                });
            }
        }).finally(()=>{
            messenger.destroy();
            window.removeEventListener("message", on_message);
            if (use_window) win.close();
            else app.file_manager_menu.hide();
        })
    } else {
        console.error("File Manager not present")
    }
}

export function create_context_menu(parent, elem, e) {
    var on_click;
    var t = dom_utils.tippy(parent, {
        appendTo: app.elem,
        content: elem,
        onHide: (instance) =>{
            app.root_elem.removeEventListener("click", on_click);
        },
        getReferenceClientRect: () => ({
            width: 0,
            height: 0,
            top: e.clientY,
            bottom: e.clientY,
            left: e.clientX,
            right: e.clientX,
        }),
        placement: "right-start",
        trigger: "manual",
        hideOnClick: true,
        interactive: true,
        arrow: false,
        offset: [0, 0],
        theme:"list",
    });
    t.show();
    setTimeout(()=>{
        app.root_elem.addEventListener("click", on_click = (e)=>{
            if (!dom_utils.closest(e.target, el=>el==t.popper)) t.hide();
        })
    },0)
    return t;
}

export function create_menu(items, o={}) {
    var opts = {
        params: [],
        click: NOOP,
    };
    Object.assign(opts, o);
    var list = $(`<ul class="list-menu"></ul>`)[0];


    var process_item = (item, list)=>{
        let elem;
        var is_separator = (typeof item === "string" && item.slice(0,3) === "---");
        if (is_separator) {
            elem = $(`<li class="separator"><hr></li>`)[0];
        } else if (Array.isArray(item)) {
            elem = $(`<li class="group"><ul></ul></li>`)[0];
            item.forEach(i=>process_item(i, elem.children[0]));
        } else {
            elem = $(`<li class="item"></li>`)[0];
            var get = (p) => (typeof item[p] === "function") ? item[p].apply(item, [...opts.params, elem]) : item[p];
            var title = get("title");
            if (title) set_attribute(elem, "title", title);
            var icon = get("icon");
            var name = get("name");
            var disabled = get("disabled");
            var shortcut = get("shortcut");
            var visible = get("visible");

            if (icon) elem.append(...$(`<span class="icon">${icon}</span>`));
            if (name) elem.append(...$(`<span class="name">${name}</span>`));
            if (shortcut) {
                shortcut = shortcut.replace("ArrowUp","↑").replace("ArrowDown","↓").replace("ArrowLeft","←").replace("ArrowRight","→")
                elem.append(...$(`<span class="shortcut"><span>${shortcut}</span></span>`));
            }
            if (disabled) {
                elem.disabled = true;
                add_class(elem, "disabled");
            } else {
                elem.addEventListener("click", (e)=>{
                    get("click");
                    opts.click();
                });
            }
            if (visible === false) add_class(elem, "d-none");
            get("render");
        }
        list.appendChild(elem);
    }
    items.forEach(i=>process_item(i, list));
    list.addEventListener("mousedown", (e)=>e.preventDefault());
    list.addEventListener("mouseup", (e)=>e.preventDefault());
    return list;
}

export function fancybox_prompt(title, inputs, settings) {
    settings = Object.assign({
        ok:"OK",
        cancel:"Cancel",
        valid:()=>true
    }, settings);

    var modal = new ModalPropertyContainer({
        "modal.title": title,
        "modal.footer": true,
    });

    if (!Array.isArray(inputs)) inputs = [inputs];
    var props = inputs.map(input=>{
        var prop;
        if (input instanceof UI.Property) {
            prop = input;
        } else if (dom_utils.is_html(input)) {
            prop = new UI.Property(null, null, input, { reset: false });
        } else if (typeof input === "number") {
            prop = new UI.Property(null, null, `<input type="number"></input>`, { default: input, reset: false });
        } else if (typeof input === "boolean") {
            prop = new UI.Property(null, null, `<input type="checkbox"></input>`, { default: input, reset: false });
        } else {
            prop = new UI.Property(null, null, `<input type="text"></input>`, { default: input, reset: false });
        }
        return prop;
    });
    modal.content.append(...props);
    
    modal.show();
    if (props[0]) props[0].input.focus();

    return new Promise((resolve,reject)=>{
        if (settings.ok) {
            var ok_button = new UI.Button(settings.ok, {
                disabled: ()=>!settings.valid(),
                click: ()=>{
                    var result = {length:0}
                    props.forEach((prop, i)=>{
                        var value = prop.value;
                        result[i] = value;
                        result.length++;
                        // if (input.id) result[input.id] = value
                    })
                    if (result.length == 1) result = result[0];
                    resolve(result);
                }
            })
            modal.footer_elem.append(ok_button)
        }
        if (settings.cancel) {
            var cancel_button = new UI.Button(settings.cancel, {
                click: ()=>resolve(null)
            })
            modal.footer_elem.append(cancel_button)
        }
        modal.on("hide", ()=>resolve(null))
    }).finally(()=>{
        modal.hide();
    });
}

// -----------------------------
// Sortable bullshit.
// -----------------------------
export class CancelSortPlugin {
    constructor(){
        this.defaults = {
            cancelSort: true,
            revertOnSpill: true
        };
    }
    drop({ cancel, dispatchSortableEvent, originalEvent, dragEl, cloneEl }) {
        // In case the 'ESC' key was hit,
        // the origEvent is of type 'dragEnd'.
        if (originalEvent && originalEvent.type === 'dragend') {
            // Call revert on spill, to revert the drag
            // using the existing algorithm.
            this.sortable.revertOnSpill.onSpill(...arguments);
            // Undo changes on the drag element.
            if (dragEl) {
                // Remove ghost & chosen class.
                remove_class(dragEl, this.options.ghostClass);
                remove_class(dragEl, this.options.chosenClass);
                dragEl.removeAttribute('draggable');
            }
            // In case of a copy, the cloneEl
            // has to be removed again.
            if (cloneEl) {
                cloneEl.remove();
            }
            // Dispatch 'end' event.
            dispatchSortableEvent('end');
        }
    }
}
CancelSortPlugin.pluginName = "cancelSort";
Sortable.mount(CancelSortPlugin);

export var Orientation = {
    VERTICAL: "vertical",
    HORIZONTAL: "horizontal"
}
export class ResponsiveSortable extends Sortable {
    constructor(el, options) {
        options = Object.assign({
            lastSelectedClass: "sortable-last-selected",
            lastActiveClass: "sortable-last-active",
        }, options);
        
        super(el, options);

        this.orientation = Orientation.VERTICAL
        
        // $(this.el).disableSelection();
        add_class(this.el, "sortable");

        ResponsiveSortable.instances.push(this);

        this.option("multiDragKey", "Control");
        this.el.addEventListener("pointerdown", this._on_pointer_down = (e)=>{
            if (this.options.multiDrag) this.option("multiDragKey", e.pointerType === "touch" ? "" : "Control");
        });

        // !! fixes multidrag on touch devices !!
        if (this.options.multiDrag && !this.options.handle) {
            var moved;
            var old_triggerDragStart = this._triggerDragStart;
            var on_touch_move = (e)=>moved=true;
            var has_touch;
            this._triggerDragStart = (evt, touch)=>{
                var item = this.get_item(evt.target);
                moved = false;
                has_touch = !!touch;
                if (touch && !this.is_selected(item)) {
                    Sortable.utils.on(this.el.getRootNode(), 'touchmove', on_touch_move);
                    return;
                }
                old_triggerDragStart.apply(this, [evt, touch]);
            }
            var old_onDrop = this._onDrop;
            this._onDrop = (evt)=>{
                Sortable.utils.off(this.el.getRootNode(), 'touchmove', on_touch_move);
                old_onDrop.apply(this, moved ? [] : [evt]);
            }
        }
        // --------------------------------------
        
        window.addEventListener("keydown", this._on_key_down = (e)=>{
            if (!dom_utils.has_focus(this.el, true)) return;
            if (!this.options.multiDrag) return;
            if (!this.is_active_sortable_in_group()) return;
            var items = this.get_items();
            var last = this.get_last_active(true);
            var last_index = items.indexOf(last);
            var is_last_selected = this.is_selected(last);
            var next_index;
            var is_vertical = this.orientation === Orientation.VERTICAL;
            if (e.key === "Home") {
                next_index = 0;
            } else if (e.key === "End") {
                next_index = items.length - 1;
            } else if (e.key === "PageUp") {
                next_index = last_index - 10;
            } else if (e.key === "PageDown") {
                next_index = last_index + 10;
            } else if ((e.key === "ArrowUp" && is_vertical) || (e.key === "ArrowLeft" && !is_vertical)) {
                if (last_index == -1) next_index = 0;
                else if (!is_last_selected) next_index = last_index;
                else next_index = last_index - 1;
            } else if ((e.key === "ArrowDown" && is_vertical) || (e.key === "ArrowRight" && !is_vertical)) {
                if (last_index == -1) next_index = items.length - 1;
                else if (!is_last_selected) next_index = last_index;
                else next_index = last_index + 1;
            } else if (e.ctrlKey && e.key === "a") {
                this.select_all();
            } else if (e.ctrlKey && e.key === "d") {
                this.deselect_all();
            } else {
                return;
            }
            if (next_index !== undefined) {
                next_index = utils.clamp(next_index, 0, items.length-1);
                this.click(items[next_index], e.shiftKey, false);
            }
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.el.addEventListener("contextmenu", this._on_contextmenu = (e) => {
            e.preventDefault();
            if (this.get_item(e.target) && !this.is_selected(e.target)) {
                this.simulate_click(e.target, {
                    screenX: e.screenX,
                    screenY: e.screenY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    metaKey: e.metaKey,
                    button: 0,
                });
            }
        });
        this.el.addEventListener("click", this._on_click = (e)=>{
            this.set_active_sortable_in_group();
        });
        this.el.addEventListener("start", this._on_start = ()=>{
            this.last_drag = new Promise((resolve)=>{
                var r = ()=> {
                    this.el.removeEventListener("end", r);
                    resolve();
                }
                this.el.addEventListener("end", r);
            });
        })
        this.el.addEventListener("unchoose", this._on_unchoose = (e)=>{
            if (!this.options.multiDrag) return;
            if (!e.item.parentElement) return;
            var items = e.items.length ? e.items : [e.item];
            var selected_items = items.filter(i=>Sortable.utils.get(i).is_selected(i));
            for (var s of this.get_sortables_in_group()) {
                if (s !== this) s.deselect_all();
            }
            var dest = Sortable.get(e.to);
            dest.set_active_sortable_in_group();
            if (dest != this) {
                dest.set_selection(selected_items);
            }
            dest.set_last_active(e.item);
            e.item.scrollIntoView({block:"nearest", inline:"nearest"});
        });
        /* sortable.el.addEventListener("choose", (evt)=>{
        }); */
    }

    _dispatchEvent(name, props) {
        var ev = new Event(name);
        Object.assign(ev, {
            name: name,
            sortable: this,
            rootEl: this.el,
        }, props);
        this.el.dispatchEvent(ev);
    }

    simulate_click(target, e) {
        var old_drag_key = this.multiDrag.multiDragKeyDown;
        if (e.ctrlKey) this.multiDrag.multiDragKeyDown = true;
        // this.options.delay = 10;
        this.el.focus();
        [this.options.supportPointer ? "pointerdown" : "mousedown", "mouseup"].forEach((type,i)=>{
            var evt = new MouseEvent(type, {
                bubbles:true,
                cancelable:true,
                view: target.ownerDocument.defaultView,
                detail: 0,
                screenX: e.screenX || 0,
                screenY: e.screenY || 0,
                clientX: e.clientX || 0,
                clientY: e.clientY || 0,
                ctrlKey: e.ctrlKey || false,
                altKey: e.altKey || false,
                shiftKey: e.shiftKey || false,
                metaKey: e.metaKey || false,
                button: e.button || 0,
                relatedTarget: null
            });
            var prop = {get:()=>target, set:(v)=>{}};
            Object.defineProperty(evt, "target", prop);
            Object.defineProperty(evt, "currentTarget", prop);
            if (i == 0) this._onTapStart(evt);
            else this._onDrop(evt);
        });
        if (e.ctrlKey) this.multiDrag.multiDragKeyDown = old_drag_key;
    }

    get_sortables_in_group() {
        return ResponsiveSortable.instances.filter(s=>s.options.group.name === this.options.group.name);
    }

    set_active_sortable_in_group() {
        var old = ResponsiveSortable.active[this.options.group.name];
        if (old === this) return;
        ResponsiveSortable.active[this.options.group.name] = this;
        if (old) old.deselect_all();
        for (var s of [old, this]) {
            if (!s) continue;
            toggle_class(s.el, "active", s===this);
            s._dispatchEvent("active-change", {active:s===this});
        }
    }

    get_active_sortable_in_group() {
        return ResponsiveSortable.active[this.options.group.name];
    }

    get_group_index() {
        return this.get_sortables_in_group().indexOf(this);
    }

    is_active_sortable_in_group() {
        return this.get_active_sortable_in_group() === this;
    }

    get_last_active(use_fallback=false) {
        var last_active = this.get_item(this.last_active);
        if (last_active || !use_fallback) return last_active;
        var items = this.get_items();
        return items[utils.clamp(this.last_active_index || 0, 0, items.length-1)];
    }

    set_last_active(e) {
        e = this.get_item(e);
        this.get_items().forEach(i=>toggle_class(i, this.options.lastActiveClass, i === e));
        this.last_active = e;
        this.last_active_index = this.get_item_index(e);
    }

    forget_last_active() {
        this.last_active = null;
        this.last_active_index = null;
    }

    get_items(filter=null) {
        var items = Array.from(this.el.children).filter(e=>Sortable.utils.closest(e, this.options.draggable, this.el, false));
        if (filter) {
            filter = new Set(filter);
            items = items.filter(item=>filter.has(item));
        }
        return items;
    }

    get_selection() {
        return this.get_items().filter(e=>this.is_selected(e));
    }

    deselect_all() {
        this.get_items().forEach(item=>this.deselect(item));
        this.set_last_active(null);
    }

    select_all() {
        this.get_items().forEach(item=>this.select(item));
    }

    select(item) {
        item = this.get_item(item);
        if (!item || this.is_selected(item)) return;
        Sortable.utils.select(item);
        this._dispatchEvent("select", {targetEl:item});
    }

    deselect(item) {
        item = this.get_item(item);
        if (!item || !this.is_selected(item)) return;
        Sortable.utils.deselect(item);
        this._dispatchEvent("deselect", {targetEl:item});
    }

    set_selection(items) {
        var selection = new Set(items.map(i=>this.get_item(i)));
        this.get_items().forEach((item,i)=>{
            if (selection.has(item)) this.select(item);
            else this.deselect(item);
        });
    }

    click(item, shiftKey, ctrlKey) {
        item = this.get_item(item);
        if (!item) return;
        var rect = item.getBoundingClientRect();
        this.simulate_click(item, {
            clientX: rect.x + rect.width/2,
            clientY: rect.y + rect.height/2,
            ctrlKey: !!ctrlKey,
            shiftKey: !!shiftKey,
            button: 0,
        });
    }

    /* toggle_select: function(e, value) {
        e = this.get_item(e);
        if (!e) return;
        toggle_class(e, this.options.selectedClass, value);
        toggle_class(e, this.options.lastSelectedClass, value);
    }, */
    /* select: function(e) {
        this.toggle_select(e, true);
    },
    deselect: function(e) {
        this.toggle_select(e, false);
    }, */

    is_selected(e) {
        e = this.get_item(e);
        return e ? e.classList.contains(this.options.selectedClass) : false;
    }

    get_item(e) {
        e = Sortable.utils.closest(e, this.options.draggable, this.el, false);
        return (e && e.parentElement === this.el) ? e : undefined;
    }

    get_item_index(e) {
        return this.get_items().indexOf(this.get_item(e));
    }

    /* dragStartGlobal(e){
        var item = this.get_item(e.dragEl);
        if (this.options.multiDrag && !this.options.handle && !this.is_selected(item)) {
            e.cancel();
        }
    } */
    destroy() {
        delete ResponsiveSortable.active[this.options.group.name];
        utils.array_remove(ResponsiveSortable.instances, this);
        window.removeEventListener("keydown", this._on_key_down);
        this.el.removeEventListener("click", this._on_click);
        this.el.removeEventListener("unchoose", this._on_unchoose);
        this.el.removeEventListener("contextmenu", this._on_contextmenu);
        this.el.removeEventListener("pointerdown", this._on_pointer_down)
        super.destroy();
    }
}
ResponsiveSortable.instances = [];
ResponsiveSortable.active = {};
// Sortable.mount(ResponsiveSortable);

Sortable.utils.get = function(e) {
    if (!e) return null;
    if (e instanceof Sortable) return e;
    var el = dom_utils.closest(e, c=>Sortable.get(c));
    return el ? Sortable.get(el) : null;
}

export const NOOP = ()=>{};
export var get_or_call = (f, context, params)=>{ return typeof f === "function" ? f.apply(context, params) : f; };

/**
* @typedef {{
* name: string | function(PlaylistItem[]):string,
* icon: string | function(PlaylistItem[]):string,
* visible: string | function(PlaylistItem[]):boolean,
* disabled: string | function(PlaylistItem[]):boolean,
* click: function(PlaylistItem[]):void,
* shortcut: string | function(PlaylistItem[]):string,
* mode: string | function(PlaylistItem[]):string,
* }} PlaylistCommandOptions
*/
export class PlaylistCommand {
    /** @param {PlaylistCommandOptions} options */
    constructor(options) {
        this.options = {
            name: "",
            icon: null,
            visible: true,
            disabled: false,
            click: NOOP,
            shortcut: null,
            view: "list",
            color: null,
            title: null
        }
        Object.assign(this.options, options);
    }
    /** @type {String} */
    name(items) { return get_or_call(this.options.name, null, [items]); }
    title(items) { return get_or_call(this.options.title, null, [items]); }
    color(items) { return get_or_call(this.options.color, null, [items]); }
    /** @type {String} */
    description_or_name(items) { return get_or_call(this.options.description || this.options.name, null, [items]); }
    /** @type {String} */
    icon(items) { return get_or_call(this.options.icon, null, [items]); }
    /** @type {boolean} */
    visible(items) { return get_or_call(this.options.visible, null, [items]); }
    render(items, elem) { return get_or_call(this.options.render, null, [items, elem]); }
    /** @type {boolean} */
    disabled(items) { return get_or_call(this.options.disabled, null, [items]); }
    click(items) { return get_or_call(this.options.click, null, [items]); }
    /** @type {String} */
    shortcut(items) { return get_or_call(this.options.shortcut, null, [items]); }
    shortcut_alt(items) {
        var shortcut = this.shortcut(items);
        return shortcut && shortcut.replace(/\|/g," / ").replace(/\w+/g, (m)=>`[${m}]`).replace(/\s*([\+\|])\s*/g, (_,m)=>` ${m} `).split(/([A-Z][a-z]+)/).filter(a=>a).join(" ");
    }
}

// -----------------------------

/** @typedef {{username:string, access:string, suspended:boolean, password:string}} User */
export class AccessControl {
    constructor(data) {
        Object.assign(this, data);
    }
    get _users() {
        var users = Object.entries(this).map(([username,data])=>{
            delete data.username; // incase username was accidentally saved
            return {username, ...data};
        });
        return utils.sort(users, v=>(v.username=="*")?0:1, v=>v.access=="owner"?0:1, v=>AccessControl.ACCESS_ORDER[v.access], v=>v.username.toLowerCase());
    }
    get _owners() { return this._users.filter(d=>d.access==="owner"); }
    _edit(username, data) {
        var user = this[username];
        if (data == null) {
            if (user && user.access === "owner" && username === app.$._client.username && this._owners.length > 1) {
                if (!confirm("Deleting your ownership may revoke your access. Are you sure?")) return false;
            }
            delete this[username];
        } else {
            if (!this[username]) this[username] = {};
            Object.assign(this[username], data);
        }
        if (this._owners.length == 0) {
            utils.clear(this);
            Object.assign(this, { "*": {"access":"allow"} });
        }
        return true;
    }
    get _self_can_edit() { return this._owners.length == 0 || this._self_is_owner_or_admin; }
    get _self_is_owner() { return this._has_ownership(app.$._client.username); }
    get _self_is_owner_or_admin() { return this._self_is_owner || app.$._client.is_admin; }
    get _self_requires_password() { return this._requires_password(app.$._client.username); }
    _self_has_access(password) { return app.$._client.is_admin || this._has_access(app.$._client.username, password); }
    _requires_password(username) { return this._has_ownership(username) || !!(this["*"] || EMPTY_OBJECT).password; }
    _has_ownership(username) { return (this[username] || EMPTY_OBJECT).access === "owner"; }
    _has_access(username, password) {
        if (this[username] && (this[username].access === "allow" || this._has_ownership(username))) return true;
        if (this["*"] && this["*"].access === "allow" && (!this["*"].password || this["*"].password == password)) return true;
        return false;
    }
    _claim() {
        utils.clear(this);
        Object.assign(this, AccessControl.DEFAULT_ACCESS_FOR_SELF);
    }
    static get DEFAULT_ACCESS_FOR_SELF() {
        return {
            "*": { access: "allow" },
            [app.$._client.username] : { access: "owner" },
        }
    }
    static ACCESS_ORDER = {"owner":1,"allow":2,"deny":3};
}




// --------------------------------------------


/** @template T @param {new () => T} clazz @return {Record<PropertyKey,T>} */
export function create_proxy(clazz) {
    return new Proxy({}, {
        set(target, prop, value) {
            target[prop] = new clazz();
            Object.assign(target[prop], value);
            return true;
        }
    });
}

const EMPTY_CHAPTERS = [];
export class Media {
    time = 0;
    duration = 0;
    chapters = [];
    seekable = false;
    seeking = false;
    buffering = false;
    loaded;
    #cache = {};
    constructor() {
        this.update();
    }
    update() {
        var item = app.$._session._current_playing_item;
        var running = app.$._session._is_running;
        var loaded = !running || !!app.$._stream.mpv.loaded;
        var seeking = running ? (loaded && !!app.$._stream.mpv.seeking) : false;
        var special_seeking = (running && app.$._stream.mpv.is_special && (seeking || !app.$._stream.mpv.playing));
        // console.log("special_seeking", special_seeking)
        var buffering = (seeking || !loaded || !!app.$._stream.mpv.props["paused-for-cache"]);
        var seekable = !running || !!app.$._stream.mpv.seekable;
        
        this.buffering = buffering;
        this.seeking = seeking;

        if (special_seeking) return;

        this.time = app.$._session._current_time;
        this.duration = app.$._session._current_duration;
        this.chapters = loaded ? app.$._session._current_chapters : EMPTY_CHAPTERS;
        this.seekable = loaded ? this.duration != 0 && seekable && item.filename !== "livestreamer://empty" : false;
        this.loaded = loaded;
        this.status = running ? (loaded ? "Playing" : "Loading") : "Pending";
        this.stats = {};
        this.stats["V-FPS"] = (+app.$._stream.mpv.props["estimated-vf-fps"] || 0).toFixed(2);
        if (!app.$._stream._is_encoding) this.stats["D-FPS"] = (+app.$._stream.mpv.props["estimated-display-fps"] || 0).toFixed(2);
        this.stats["INTRP"] = app.$._stream.mpv.interpolation ? "On" : "Off";
        this.stats["DEINT"] = app.$._stream.mpv.deinterlace ? "On" : "Off";
        this.ranges = app.$._session._current_seekable_ranges;
        // this.#last_seeks = app.$._stream.mpv.seeks;
        this.#cache = {};
    }
    get curr_chapters() {
        return this.#cache["curr_chapters"] = this.#cache["curr_chapters"] ?? app.$._session._get_current_chapters_at_time(this.time);
    }
    get time_left() { return Math.max(0, this.duration - this.time); }
    get do_live_seek(){ return app.$._stream._is_running && !app.$._stream._is_encoding && !app.$._stream.mpv.is_special; }
}

export class Remote extends utils.EventEmitter {
    constructor() {
        super();
        this._changes = [];

        this.client_id = null;
        this.clients = create_proxy(Client);
        this.sessions = create_proxy(Session);
        this.targets = create_proxy(Target);
        this.volumes = {};
        this.change_log = {};
        this.plugins = {};
        this.logs = {};
        this.nms_sessions = {};
        /** @type {InternalSessionProps} */
        this.properties = {};
        this.fonts = {};
        this.uploads = {};
        this.downloads = {};
        this.media_info = {};
        this.processes = {};
        this.sysinfo = {};
        this.process_info = {};
        this.conf = {};
        this._pending_requests = new Set();
        /** @type {Session} */
        this._last_session = null;
        this.ts = this._ts = Date.now();
    }

    _debounced_update = dom_utils.debounce_next_frame(()=>this._update());
    _update() {
        var changes = utils.tree_from_entries(this._changes);
        utils.clear(this._changes);
        // !! IMPORTANT FOR DATES AND THINGS LIKE THAT.
        utils.deep_walk(changes, function(k,v) {
            if (v && typeof v === "object" && v.toJSON && typeof v.toJSON === "function") {
                this[k] = v.toJSON();
            }
        });
        // !!
        // var a = utils.try(()=>changes.sessions["hedgehog90"].stream.id)
        // if (a) debugger;
        Observer.apply_changes(this, changes);
        this.emit("update", changes);
    }
    _push(...items) {
        this._changes.push(...items.map(i=>utils.deep_copy(i)));
        this._debounced_update();
    }
    /** @type {Session} */
    get _session() { return this.sessions[this._client.session_id] || NULL_SESSION; }
    /** @type {Client} */
    get _client() { return this.clients[this.client_id] || NULL_CLIENT; }
    get _stream() { return this._session.stream; }
    get _streams() { return Object.values(this.sessions).map(s=>s.stream).filter(s=>s); }
    _now() { return Date.now() - (this._ts - this.ts) }
}

export class DataNode {
    constructor() {
        this[Observer.RESET_KEY]();
    }
    [Observer.RESET_KEY]() { throw new Error("Not implemented") }
}

export class Client extends DataNode {
    [Observer.RESET_KEY]() {
        this.id = "";
        this.session_id = undefined;
        this.is_admin = false;
        this.username = null;
        this.email = null;
    }
}

export class Target extends DataNode {
    [Observer.RESET_KEY]() {
        this.id = "";
        this.name = ""
        this.description = ""
        this.rtmp_host = ""
        this.rtmp_key = ""
        this.url = ""
        this.access_control = new AccessControl();
        this.ts = 0
        this.limit = 0
        this.locked = false
    }
    get _streams() { return app.$._streams.filter(s=>s.targets.find(t=>t.id == this.id)); }
    get _active_streams() { return this._streams.filter(s=>s._is_running); }
}

/** @typedef {{index:number,start:number,end:number,id:string}} Chapter */
/** @typedef {{filenames:string[],modified:boolean}} PlaylistInfo */
/** @typedef {{duration:Number,media_duration:Number,children_duration:Number}} PlaylistItemDurations */
/** @typedef {{start:Number,end:Number,duration:Number,offset:Number}} PlaylistItemClipping */
/** @typedef {{download:Download,is_processing:boolean,color:string,modified:boolean,clipping:PlaylistItemClipping,is_playlist:boolean, is_merged:boolean,display_name:string,chapters:Chapter[],timeline_duration:Number,start:Number,end:Number,timeline_start:Number,timeline_end:Number,parent_ids:string[]} & PlaylistItemDurations} PlaylistUserData */
/** @typedef {{evaluated_target:any[]}} StreamTarget */

export class Stream extends DataNode {
    [Observer.RESET_KEY]() {
        this.id = "";
        this.start_time = 0;
        this.state = "stopped";
        this.graphs = {};
        this.session_id = 0;
        this.mpv = new MPV();
        /** @type {StreamTarget[]} */
        this.targets = [];
        this.test = false;
        this.bitrate = 0;
    }
    get _session() {
        return app.$.sessions[this.session_id];
    }
    get _is_running() {
        return this.state !== "stopped";
    }
    get _is_encoding() {
        return !!this.mpv.is_encoding && this._is_running;
    }
    get _live_nms_session() {
        return Object.values(app.$.nms_sessions).filter(s=>s.publishStreamPath.split("/").pop() === this.id)[0];
    }
    get _run_time() {
        return app.$._now() - this.start_time;
    }
}
export class MPV extends DataNode {
    [Observer.RESET_KEY]() {
        this.is_encoding = false;
        this.seeks = 0;
        this.loaded = false;
        this.seeking = false;
        this.is_special = false;
        this.seekable = false;
        this.interpolation = false;
        this.deinterlace = false;
        this.duration = 0;
        this.time = 0;
        this.seekable_ranges = [];
        this.props = {};
        this.streams = [];
    }
}
export class Session extends DataNode {
    [Observer.RESET_KEY]() {
        this.id = "";
        this.type;
        this.index = 0;
        this.playlist_id = -1;
        this.time = 0;
        this.logs = {};
        this.downloads = {};
        this.access_control = new AccessControl();
        this.detected_crops = {};
        this.player = {};
        this.player_default_override = {};
        this.stream_settings = {};
        this.stream = new Stream();
        // this.current_item_on_load = null;
        // this.current_descendents_on_load = null;
        this.target_configs = {};
        this.playlist_info = {};
        this.name = "";
        /** @type {Record<PropertyKey,PlaylistItem>} */
        this.playlist = new Proxy({}, {
            /** @param {Record<PropertyKey,PlaylistItem>} target */
            get: (target, prop)=>{
                if (prop == "0") return this._root_playlist_item;
                return target[prop];
            },
            /** @param {Record<PropertyKey,PlaylistItem>} target */
            set:(target, prop, value)=>{
                // if (!(value instanceof PlaylistItem)) {
                target[prop] = new PlaylistItem(value, this);
                // }
                return true;
            },
            /** @param {Record<PropertyKey,PlaylistItem>} target */
            deleteProperty: (target, prop)=>{
                if (prop == "0") return true;
                if (prop in target) {
                    this._deleted_playlist_items[prop] = target[prop];
                    delete target[prop];
                }
                return true;
            }
        });
        this._root_playlist_item = new PlaylistItem({id:"0"}, this);
        /** @type {Record<PropertyKey,PlaylistItem>} */
        this._deleted_playlist_items = {};
    }
    get _connected_nms_sessions() {
        return Object.values(app.$.nms_sessions).filter(s=>s.publishStreamPath.split("/").pop() === this.id);
    }
    /** @return {PlaylistItem} */
    get _current_playing_item() {
        return this.playlist[this.playlist_id] || NULL_PLAYLIST_ITEM;
    }
    get _is_running() {
        return !!this.stream._is_running;
    }
    /** @return {Chapter[]} */
    get _current_chapters() {
        return this._current_playing_item._userdata.chapters;
    }
    get _current_duration() {
        var d;
        if (this.stream._is_running && this.stream.mpv.playing) {
            d = this.stream.mpv.duration || 0;
        } else {
            d = 0;
            var item = this._current_playing_item;
            if (item._is_playlist && !item._is_merged_playlist) d = 0;
            else d = item._userdata.duration;
        }
        return round_ms(d || 0);
    }
    get _current_time() {
        return (this.stream._is_running && this.stream.mpv.loaded) ? this.stream.mpv.time : this.time;
    }
    get _current_seekable_ranges() {
        if (this.stream._is_running) return this.stream.mpv.seekable_ranges;
        return [];
    }
    _get_connected_nms_session_with_appname(appname) {
        return this._connected_nms_sessions.find(s=>s.appname === appname);
    }
    _get_items_with_media(filename) {
        return Object.values(this.playlist).filter(i=>i._userdata.filenames.includes(filename));
    }
    _get_current_chapters_at_time(t) {
        return this._current_chapters.filter(c=>t>=c.start && t<c.end);
    }
    _get_current_chapter_at_time(t) {
        return this._get_current_chapters_at_time(t).pop();
    }
}
/** @typedef {{session:Session,num_updates:number,userdata:object,children:Set<PlaylistItem>,children_ordered:PlaylistItem[],parent:PlaylistItem}} PlaylistItemPrivate */

export class PlaylistItem extends DataNode {
    id = "";
    /** @param {Session} session */
    constructor(data, session) {
        super();
        if (!session) session = NULL_SESSION;
        /** @type {PlaylistItemPrivate} */
        this.__private;
        Object.defineProperty(this, "__private", {
            value: {
                session: session,
                num_updates: 0,
                userdata: null,
                children: new Set(),
                children_ordered: null,
                parent: null,
            },
            enumerable: false,
        });
        Object.assign(this, data);
        // session.playlist[this.id] = this;
    }
    [Observer.RESET_KEY]() {
        this.id = "-1";
        this.parent_id = null;
        this.filename = "";
        this.index = 0;
        this.track_index = 0;
        this.upload = undefined;
        this.props = {};
    }
    /** @return {Session} */
    get _session() {
        return this.__private.session;
    }
    /** @return {PlaylistUserData} */
    get _userdata() {
        if (!this.__private.userdata) {
            this._update_userdata();
            this.__private.num_updates++;
        }
        return this.__private.userdata;
    }
    get _num_updates() {
        return this.__private.num_updates;
    }
    get _hash() {
        return this.__private.num_updates;
    }
    get _parent() {
        return this._session.playlist[this.parent_id];
    }
    get _info() {
        return this._session.playlist_info[this.id];
    }
    get _media_info() {
        return app.$.media_info[this.filename];
    }
    get _is_deleted() {
        return !this._session.playlist[this.id];
    }
    get _is_playlist() {
        return this._is_root || this.filename === "livestreamer://playlist" || this._has_children;
    }
    get _is_current_playing_item() {
        return this === this._session._current_playing_item;
    }
    get _is_root() {
        return this.id == "0";
    }
    get _is_null() {
        return this === NULL_PLAYLIST_ITEM;
    }
    get _detected_crops() {
        return this._session.detected_crops[this.id]
    }
    get _is_mergable() {
        if (this._is_playlist) return true;
        if (this.filename == "livestreamer://empty" || this.filename == "livestreamer://exit") return true;
        if (this._url.protocol === "file:") {
            if ((this._media_info||EMPTY_OBJECT).exists) return true;
        }
        return false;
    }
    get _is_merged() {
        return this._is_merged_playlist || !!this._root_merged_playlist;
    }
    get _has_children() {
        return this.__private.children.size != 0;
    }
    _calculate_contents_hash() {
        return hash(JSON.stringify([this.id,this.parent_id,this.filename,this.index,this.track_index,this.props,this._children.map(c=>c._calculate_contents_hash())]))
        // return hash(JSON.stringify({self:this.props, children:this.children.map(c=>c.calculate_contents_hash())}));
    }
    /** @return {Iterable<PlaylistItem>} */
    *_get_children(track_index=null, recursive=false) {
        var children = this._children;
        if (track_index != null) children = children.filter(i=>track_index == null || i.track_index == track_index);
        for (var item of children) {
            yield item;
            if (recursive) {
                for (var c of item._get_children(null, true)) yield c;
            }
        }
    }
    _update_userdata() {
        /** @type {PlaylistUserData} */
        let ud = this.__private.userdata = {};
        let media_info = this._media_info || EMPTY_OBJECT;
        let download = this._download;
        let upload = this._upload;
        let children = this._children;
        var is_playlist = this._is_playlist;
        let is_processing = this._is_processing;

        let filenames = new Set();
        filenames.add(this.filename);
        if (this.props.background_file) filenames.add(this.props.background_file);
        if (this.props.audio_file) filenames.add(this.props.audio_file);
        if (this.props.subtitle_file) filenames.add(this.props.subtitle_file);
        ud.filenames = [...filenames];

        ud.name = this._get_pretty_name();
        
        let media_duration = round_ms(media_info.duration || 0);
        if (media_duration <= IMAGE_DURATION) media_duration = 0;
        let children_duration = 0;
        let timeline_duration = media_duration;
        if (children.length) {
            /** @param {PlaylistItem[]} t */
            var get_track_duration = (t, tl=false)=>{
                var total = 0;
                var key = tl ? "timeline_duration" : "duration";
                for (var i of t) {
                    if (i.filename === "livestreamer://exit") break;
                    total += i._userdata[key];
                }
                return total;
            }
            var track_durations = this._tracks.map((t)=>get_track_duration(t));
            var track_timeline_durations = this._tracks.map((t)=>get_track_duration(t, true));
            if (this.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK && this.props.playlist_end_on_shortest_track && track_durations.every(t=>t>0)){
                children_duration = Math.min(...track_durations);
                timeline_duration = Math.min(...track_timeline_durations);
            } else {
                children_duration = Math.max(...track_durations);
                timeline_duration = Math.max(...track_timeline_durations);
            }
            media_duration = children_duration;
        } else if (this.filename === "livestreamer://intertitle") {
            media_duration = this.props.title_duration || app.playlist_item_props_class.title_duration.default;
        } else if (this.filename === "livestreamer://empty") {
            media_duration = this.props.empty_duration || app.playlist_item_props_class.empty_duration.default;
        }

        let start = this.props.clip_start || 0;
        let end = this.props.clip_end || media_duration;
        let clip_length = Math.max(0, (end - start));
        let clip_loops = this.props.clip_loops || 1;
        let duration = round_ms(Math.max(0, (this.props.clip_duration || clip_length) * clip_loops));
        timeline_duration = round_ms(Math.max(ZERO_DURATION, (this.props.clip_duration || timeline_duration) * clip_loops));
        
        if (download) ud.download = download;
        if (upload) ud.upload = upload;
        if (is_processing) ud.is_processing = true;

        var props = new Set(Object.keys(this.props));
        props.delete("label");
        props.delete("color");
        if (props.size) {
            ud.modified = true;
        }
        if ("clip_start" in this.props || "clip_end" in this.props || "clip_loops" in this.props || "clip_duration" in this.props || "clip_offset" in this.props) {
            let start = this.props.clip_start || 0;
            let end = this.props.clip_end || media_duration;
            let length = end-start;
            let duration = this.props.clip_duration || length;
            let offset = ((this.props.clip_offset || 0) % length) || 0;
            let loops = duration / length;
            ud.clipping = { start, end, length, duration, offset, loops };
        }

        ud.is_merged = this._is_merged;
        ud.duration = duration;
        ud.media_duration = media_duration;
        ud.children_duration = children_duration;
        ud.timeline_duration = timeline_duration;
        ud.num_updates = this._num_updates;
        /* ud.pending_changes = (()=>{
            if (!this.session.is_running || !this.is_current_playing_item) return false;
            if (!this.session.current_item_on_load) return false;
            var props_on_load = this.session.current_item_on_load.props;
            if (props_on_load.playlist_mode && !utils.deep_equals(this.descendents, this.session.current_descendents_on_load)) {
                return true;
            }
            var filter = (k,v)=>k !== "label" && k !== "color";
            var e1 = utils.filter_object(this.props, filter);
            var e2 = utils.filter_object(props_on_load, filter);
            if (!utils.deep_equals(e1, e2)) {
                return true;
            }
            return false;
        })(); */
        
        var chapters;
        if (is_playlist) {
            chapters = [];
            for (var items of this._tracks) {
                var t = 0;
                var tt = 0;
                for (var c of items) {
                    var cud = c._userdata;
                    cud.start = t;
                    cud.timeline_start = tt;
                    t += cud.duration;
                    tt += cud.timeline_duration;
                    cud.end = t;
                    cud.timeline_end = tt;
                    if (ud.is_merged) {
                        chapters.push({ id: c.id, start: cud.start, end: cud.end });
                    }
                }
            }
        } else {
            chapters = utils.deep_copy(media_info.chapters || EMPTY_ARRAY);
        }
        if (chapters) {
            var min = 0
            var max = Number.POSITIVE_INFINITY;
            if (ud.clipping) {
                var segments = get_clip_segments(ud.clipping);
                if (segments.length == 1) {
                    min = segments[0].start;
                    max = segments[0].end;
                } else {
                    var t = 0;
                    chapters = segments.map((s,index)=>{
                        var start = t;
                        t += s.duration;
                        return {start, end:t, title:`${ud.name}`}
                        // return {start, end:t, title:`Segment ${index+1}`}
                    });
                }
            }
            chapters = chapters.filter((c)=>c.end >= min && c.start <= max);
            chapters.sort((a,b)=>a.start-b.start);
            chapters.forEach((c,i)=>{
                c.index = i;
                c.start = Math.max(0, c.start-min);
                c.end = Math.min(max-min, c.end-min);
                if (!c.id && !c.title) set_attribute(c, "title", `Chapter ${i+1}`);
            });
            ud.chapters = chapters;
        }
    }
    /** @return {PlaylistItem[]} */
    get _children() {
        if (!this.__private.children_ordered) this.__private.children_ordered = [...this.__private.children].sort((a,b)=>a.track_index-b.track_index || a.index-b.index);
        return [...this.__private.children_ordered];
    }
    get _descendents() {
        return [...this._get_children(null, true)];
    }
    get _is_rtmp() {
        return this.filename === "livestreamer://rtmp";
    }
    get _is_rtmp_live() {
        return !!(this._is_rtmp && this._session._get_connected_nms_session_with_appname("private"));
    }
    get _related_media_infos() {
        return this._info.filenames.map(f=>app.$.media_info[f]).filter(mi=>mi);
    }
    get _is_processing() {
        var info = this._info;
        if (!info) return false;
        return this._related_media_infos.some(mi=>mi.processing) || this._children.some(i=>i._is_processing);
    }
    get _parents() {
        return [...this._get_parents()].filter(p=>p);
    }
    get _parent_track() {
        return this._parent._get_track(this.track_index);
    }
    _get_track(t) {
        return [...this._get_children(t)];
    }
    /** @return {PlaylistItem[][]} */
    get _tracks() {
        var tracks = [];
        if (this.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK) {
            for (var i = 0; i<2; i++) tracks.push([...this._get_children(i)]);
        } else {
            tracks[0] = [...this._get_children()];
        }
        return tracks;
    }
    get _num_tracks() {
        if (this.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK) return 2;
        return 1;
    }
    get _is_merged_playlist() {
        return !!this.props.playlist_mode;
    }
    get _is_normal_playlist() {
        return this._is_playlist && !this.props.playlist_mode;
    }
    get _root_merged_playlist() {
        for (var p of this._parents.reverse()) {
            if (p._is_merged_playlist) return p;
        }
    }
    get _is_navigatable() {
        if (this.filename.match(/^https?:/)) return true;
        if (this._elfinder_hash) return true;
        if ((!utils.is_uri(this.filename) || this.filename.startsWith("file://")) && IS_ELECTRON) return true;
        return false;
    }
    get _url() {
        return utils.is_uri(this.filename) ? new URL(this.filename) : new URL("file://"+this.filename);
    }
    get _download() {
        return app.$.downloads[this.id];
    }
    get _upload() {
        return this.upload && app.$.uploads[this.upload.id];
    }
    get _is_downloadable() {
        return !this._download && (this._media_info||EMPTY_OBJECT).downloadable && !this._is_playlist;
    }
    get _is_splittable() {
        return this._userdata.media_duration > 0 && !this._is_playlist;
    }
    get _is_scannable() {
        return !this.filename.startsWith("livestreamer://") || this._is_playlist;
    }
    get _elfinder_hash() {
        return app.filename_to_elfinder_hash(this.filename);
    }
    _get_adjacent_sibling(a=1) {
        a = a>0?1:-1;
        var parent = this._parent;
        return parent && parent._children[this.index+a];
    }
    _get_adjacent(a=1, skip_playlists=true) {
        var next;
        if (a>0) {
            if (this._has_children && !this._is_merged_playlist) {
                next = this._children[0];
            } else {
                next = this._get_adjacent_sibling(1);
                if (!next) next = this._parents.map(p=>p._get_adjacent_sibling(1)).find(p=>p);
            }
        } else {
            next = this._get_adjacent_sibling(-1);
            var parent = this._parent;
            if (!next && parent) next = parent;
            else if (next && next._has_children && !next._is_merged_playlist) {
                next = next._descendents.pop();
            }
        }
        if (skip_playlists && next && next._is_playlist && !next._is_merged_playlist) {
            next = next._get_adjacent(a, true);
        }
        if (next && next.is_root) return;
        return next;
    }
    get _next() { return this._get_adjacent(1, false); }
    get _previous() { return this._get_adjacent(-1, false); }
    get _next_sibling() { return this._get_adjacent_sibling(1); }
    get _previous_sibling() { return this._get_adjacent_sibling(-1); }

    _get_pretty_name(opts) {
        opts = Object.assign({
            label:true,
            ext:true
        }, opts);
        if (opts.label && this.props.label) {
            return this.props.label;
        }
        if (this._is_root) return "[Root]";
        if (this._is_null) return "[Nothing]";
        var mi = this._media_info || EMPTY_OBJECT;
        if (mi.name) return mi.name;
        var filename = this.filename;
        if (filename.match(/^livestreamer:/)) {
            var type = filename.replace("livestreamer://", "");
            if (type === "intertitle" && this.props.title_text) return (this.props.title_text || "").replace(/\n+/g, " • ");
            if (type === "macro") {
                return `[${["macro", this.props.function].filter(p=>p).join(":")}]`;
            }
            return `[${type}]`;
        }
        filename = pretty_uri_basename(filename);
        if (!opts.ext) {
            filename = utils.split_ext(filename)[0];
        }
        return filename;
    }
    _reveal() {
        if (this._is_null) return;
        var next = this._parent;
        if (this._is_root) next = this;
        app.playlist.open(next, [this]);
    }
    /** @return {Iterable<PlaylistItem>} */
    *_get_parents(until=null) {
        var item = this;
        while (item && item.parent_id && until !== item._parent) {
            yield item._parent;
            item = item._parent;
        }
    }
    _copy(include_non_enumerable=false) {
        if (include_non_enumerable) return Object.fromEntries((utils.get_property_keys(this).map(k=>[k,utils.deep_copy(this[k])])));
        return utils.deep_copy(this);
    }
    /** @param {PlaylistItem[]} items */
    static get_items_title(items) {
        var items = items.filter(i=>i);
        if (items.length > 1) return `${items.length} Files`;
        if (items.length == 1) {
            return `${items[0]._get_pretty_name()}`;
        }
        return `[No Item]`;
    }
}

export const NULL_CLIENT = Object.freeze(new Client());
export const NULL_SESSION = Object.freeze(new Session());
export const NULL_PLAYLIST_ITEM = Object.freeze(new PlaylistItem());
export const NULL_STREAM = Object.freeze(new Stream());

export class CropPreview extends utils.EventEmitter {
    add_legend(name, clazz) {
        var elem = $(`<div><div class="${clazz}" style="width:15px;height:15px"></div><span>${name}</span></div>`)[0]
        this.legend_elem.appendChild(elem)
    }
    constructor(url, rect, rect2, editable) {
        super();
        this.corners = {}
        this.edges = {}

        this.elem = $(`<div class="crop-preview-wrapper"><div class="crop-preview"><div class="crop-edges"></div><div class="detected-crop-border"></div><div class="crop-border"></div><img src="${url}" draggable="false"></div></div>`)[0];
        this.crop_border_elem = this.elem.querySelector(".crop-border");
        toggle_class(this.crop_border_elem, "d-none", !rect2);
        this.detected_crop_border_elem = this.elem.querySelector(".detected-crop-border");
        this.content_elem = this.elem.querySelector(".crop-preview");
        this.edges_elem = this.elem.querySelector(".crop-edges");
        this.img_elem = this.elem.querySelector("img");
        this.orig_rect = rect;
        this.orig_crop_rect = rect2;
        this.legend_elem = $(`<div class="legend"></div>`)[0];
        if (editable) {
            if (rect2) {
                this.add_legend("Detected Crop Area", "detected-crop-border")
                this.elem.append(this.legend_elem);
            }
            var corners = ["top-right","bottom-right","bottom-left","top-left"];
            var corner_cursors = ["ne-resize","se-resize","sw-resize","nw-resize"]
            // var edges = ["top","right","bottom","left"];
            // var edge_cursors = ["n-resize","e-resize","s-resize","w-resize"]
            /* edges.forEach((key,i)=>{
                var edge_elem = $(`<div class="drag-edge ${key}"></div>`)[0];
                corner_elem.style.cursor = edge_cursors[i];
                this.edges[key] = corner_elem;
                this.content_elem.appendChild(corner_elem);
            }); */
            corners.forEach((key,i)=>{
                var corner_elem = $(`<div class="drag-corner ${key}"></div>`)[0];
                corner_elem.style.cursor = corner_cursors[i];
                this.corners[key] = corner_elem;
                this.content_elem.appendChild(corner_elem);
                var parts = key.split("-");
                
                $(corner_elem).on("mousedown", ()=>{
                    var onmousemove = (e)=>{
                        var client_rect = this.content_elem.getBoundingClientRect();
                        var [min_y, max_y] = (parts[0]=="top") ? [0,CROP_LIMIT] : [1-CROP_LIMIT,1]
                        var [min_x, max_x] = (parts[1]=="left") ? [0,CROP_LIMIT] : [1-CROP_LIMIT,1]
                        $(corner_elem).css({
                            left: `${utils.clamp((e.clientX-client_rect.left)/this.content_elem.offsetWidth,min_x, max_x)*100}%`,
                            top: `${utils.clamp((e.clientY-client_rect.top)/this.content_elem.offsetHeight,min_y, max_y)*100}%`,
                        });
                        var sibling_corner_key = corners[(i+2)%4];
                        // var sibling_corner_elem = this.corners[sibling_corner_key];
                        var get_pos = (elem)=>({x:+elem.style.left.slice(0,-1)/100,y:+elem.style.top.slice(0,-1)/100});
                        var o = {};
                        for (var k of [key, sibling_corner_key]) {
                            var p = k.split("-");
                            var pt = get_pos(this.corners[k]);
                            o[p[0]]=pt.y;
                            o[p[1]]=pt.x;
                        }
                        var rect = new utils.Rectangle(o);
                        this.update(rect);
                    }
                    $(document).on("mousemove", onmousemove);
                    $(document).one("mouseup", (e)=>{
                        $(document).off("mousemove", onmousemove);
                        this.update(this.rect.clone().fix());
                        this.elem.dispatchEvent(new Event("change"));
                    });
                });
            });
            this.info_elem = $(`<div class="info"></div>`)[0];
            this.elem.appendChild(this.info_elem)
            var button_container = $(`<div style="display:flex; flex-direction:row"></div>`)[0];

            var reset_button = $(`<button class="button" style="flex:1">Set to Detected Crop</button>`)[0];
            reset_button.addEventListener("click", ()=>{
                this.update(this.orig_rect);
            })
            button_container.appendChild(reset_button);
            var reset_button2 = $(`<button class="button" style="flex:1">Set to Current Crop</button>`)[0];
            reset_button2.addEventListener("click", ()=>{
                this.update(this.orig_crop_rect);
            })
            button_container.appendChild(reset_button2);

            this.save_button = $(`<button class="button" style="flex:1">Apply Crop</button>`)[0];
            this.save_button.addEventListener("click", ()=>{
                this.emit("save", this.rect);
            })
            button_container.appendChild(this.save_button);

            this.add_legend("Crop Area", "crop-border");

            this.elem.appendChild(button_container);
            /* ["left", "top", "right", "bottom"].forEach((e,i)=>{
                var elem = $(`<div><label>Crop ${utils.capitalize(e)[0]}</label><input type="number" min="0"></div>`);
                var input = elem.querySelector("input");
                input.value = (i<2) ? d.rect[e] : 1.0-d.rect[e];
                $(input).on("input change",()=>{
                    
                });
                container.appendChild(elem);
            }); */
        }
        if (rect2) this.update(rect2);
        this.set_crop_border(this.detected_crop_border_elem, rect);
    }
    set_crop_border(elem, rect){
        $(elem).css({
            left:`${rect.x*100}%`,
            top:`${rect.y*100}%`,
            width:`${rect.width*100}%`,
            height:`${rect.height*100}%`,
        });
    }
    update(r){
        r = new utils.Rectangle(r);
        this.rect = r;
        this.fixed_rect = r.clone().fix();
        for (var k in this.corners) {
            var parts = k.split("-");
            $(this.corners[k]).css({
                top:`${r[parts[0]]*100}%`,
                left:`${r[parts[1]]*100}%`,
            })
        }
        if (this.save_button) toggle_attribute(this.save_button, "disabled",this.rect.equals(this.orig_crop_rect));
        /* $(this.edges["top"]).css({
            top:`${r.y*100}%`,
            left:`${r.x*100}%`,
            width:`${r.width*100}%`
        })
        $(this.edges["bottom"]).css({
            top:`${r.bottom*100}%`,
            left:`${r.x*100}%`,
            width:`${r.width*100}%`
        })
        $(this.edges["left"]).css({
            top:`${r.y*100}%`,
            left:`${r.x*100}%`,
            height:`${r.height*100}%`
        })
        $(this.edges["right"]).css({
            top:`${r.y*100}%`,
            left:`${r.right*100}%`,
            height:`${r.height*100}%`
        }) */
        set_inner_html(this.edges_elem, "");
        set_inner_html(this.edges_elem, [
            `<div style="left:0;width:${r.left*100}%;top:0;bottom:0"></div>`,
            `<div style="right:0;left:${r.right*100}%;top:0;bottom:0"></div>`,
            `<div style="left:${r.left*100}%;width:${r.width*100}%;top:0;height:${r.top*100}%"></div>`,
            `<div style="left:${r.left*100}%;width:${r.width*100}%;top:${r.bottom*100}%;height:${(1-r.bottom)*100}%;"></div>`,
        ].join(""));

        if (this.crop_border_elem) {
            this.set_crop_border(this.crop_border_elem, this.fixed_rect);
        }
        if (this.info_elem) {
            let html = ["left","top","right","bottom","width","height"].map((e,i)=>{
                var v = (i!=2 && i!=3) ? this.fixed_rect[e] : 1-this.fixed_rect[e];
                return `<span>${e}=${(v*100).toFixed(2)}%</span>`;
            }).join("");
            set_inner_html(this.info_elem, html);
        }
    }
}
export class SelectableList extends utils.EventEmitter {
    get selected() { return this._selected; }
    get selected_index() { return this.items.indexOf(this._selected); }
    constructor(elem, options) {
        super();
        /** @type {HTMLElement} */
        this.elem = elem || $("<div></div>")[0];
        add_class(elem, "selectable-list");
        set_attribute(elem, "tabindex", "-1");
        $(elem).disableSelection();
        this.options = Object.assign({
            "selector":"*",
            "selectedClass":"selected",
        }, options);
        
        elem.addEventListener("click",(e)=>{
            var tr = this.items.find(elem=>elem.contains(e.target));
            if (!tr) return;
            this.toggle(tr);
        });
        window.addEventListener("keydown", this.on_keydown = (e)=>{
            if (!dom_utils.has_focus(this.elem)) return;
            e.preventDefault();
            var items = this.items;
            var index = items.indexOf(this._selected);
            if (e.key === "ArrowUp") {
                index--;
            } else if (e.key === "ArrowDown") {
                index++;
            } else {
                return;
            }
            index = utils.clamp(index, 0, items.length-1);
            this.select(items[index]);
        });
    }
    get_item(i) {
        return this.items[i];
    }
    get items() {
        return Array.from(this.elem.children).filter(e=>e.matches(this.options.selector));
    }
    toggle(item) {
        if (this._selected === item) this.select(null);
        else this.select(item);
    }
    select(item) {
        this.elem.focus();
        if (this._selected === item) return;
        if (this._selected) {
            remove_class(this._selected, this.options.selectedClass);
            this.emit("deselect", this._selected);
        }
        this._selected = item;
        if (this._selected) {
            add_class(this._selected, this.options.selectedClass);
            this._selected.scrollIntoView({block:"nearest", inline:"nearest"})
            this.emit("select", this._selected);
        }
        this.emit("change", this._selected, this.selected_index);
    }

    destroy() {
        window.removeEventListener("keydown", this.on_keydown);
    }
}

/* class Chapter {
    constructor(c,i) {
        Object.assign(this, c);
        this.index = i;
    }
    toString(with_time=false) {
        return `${String(this.index+1).padStart(2,"0")}. ${this.title}` + (with_time?` [${utils.ms_to_timespan_str(this.time*1000)}]`:"");
    }
} */


//---------------------------------------------------------------------------------

export function get_rect_pt_percent(rect, pt) {
    return {x:(pt.x-rect.x)/rect.width, y:(pt.y-rect.y)/rect.height};
}

// fancy box fixes (ffs so fucking many)...

class Fancybox extends _Fancybox {
    attachEvents() {
        this.original_active_element = document.activeElement;
        this.$container.focus();
        super.attachEvents();
        this.$container.addEventListener("mousedown", this._onMousedown2 = (e)=>{
            var slide = this.getSlide();
            this._content_mousedown = !!(slide && slide.$content.contains(e.target));
        }, true);
    }
    detachEvents() {
        super.detachEvents();
        if (this.original_active_element) this.original_active_element.focus({preventScroll: true});
        this.$container.removeEventListener("mousedown", this._onMousedown2);
    }
    onClick(e) {
        if (this._content_mousedown) return;
        super.onClick(e);
    }
}

Object.assign(Fancybox.defaults, {
    closeButton:"inside",
    Hash: false,
    ScrollLock: false,
    dragToClose: false,
    autoFocus: false,
    trapFocus: false,
    keyboard: false,
    click: "close",
    Carousel: {
        Panzoom: {
            touch: false
        }
    }
});

class JsonElement {
    constructor(data, key, parent) {
        this.data = data;
        this.type = typeof this.data;
        var is_array = Array.isArray(this.data);
        if (is_array) this.type = "array";
        else if (this.data === null) this.type = "null";

        this.elem = document.createElement("div");
        add_class(this.elem, "json-node");
        this.value_elem = document.createElement("div");
        add_class(this.value_elem, "json-value");
        var prefix = "";
        var suffix = "";
        if (key) prefix = key+": ";
        if (this.type == "array") {
            prefix += "[";
            suffix += "]";
        } else if (this.type == "object") {
            prefix += "{";
            suffix += "}";
        }
        var prefix_elem = document.createElement("span");
        add_class(prefix_elem, "json-prefix");
        prefix_elem.innerText = prefix;

        var suffix_elem = document.createElement("span");
        add_class(suffix_elem, "json-suffix");
        suffix_elem.innerText = suffix;

        if (this.type == "array" || this.type == "object") {
            this.children = [];
            for (var k in this.data) {
                var child = new JsonElement(data[k], is_array ? null : k, this);
                this.value_elem.append(child.elem);
                this.children.push(child);
            }
        } else {
            this.value_elem.innerText = String(this.data);
        }
        var collapsible = !!(this.children && this.children.length > 0 && !!parent);
        var empty = !!(this.children && this.children == 0);
        var placeholder_elem;
        if (collapsible) {
            placeholder_elem = document.createElement("span");
            add_class(placeholder_elem, "json-placeholder");
            placeholder_elem.innerText = `${this.children.length} items`;
            if (collapsible) {
                placeholder_elem.onclick=()=>this.toggle();
                prefix_elem.onclick=()=>this.toggle();
                suffix_elem.onclick=()=>this.toggle();
            }
        }

        this.elem.append(prefix_elem);
        this.elem.append(this.value_elem);
        if (placeholder_elem) this.elem.append(placeholder_elem);
        this.elem.append(suffix_elem);
        
        this.elem.dataset.jsonType = this.type;
        toggle_class(this.elem, "collapsible", collapsible);
        toggle_class(this.elem, "empty", empty);
        
        Object.assign(this.elem.style, {
            "font-family": "monospace",
            "font-size": "12px",
            "word-break": "break-all"
        });
    }
    toggle() {
        toggle_class(this.elem, "collapsed")
    }
}
class JsonRoot extends JsonElement {
    constructor(data, collapsed_children=false) {
        super(data);
        if (collapsed_children) {
            for (var c of this.children) {
                c.toggle();
            }
        }
    }
}
export class JSONContainer extends UI {
    constructor(data, collapsed_children=false) {
        var json_root = new JsonRoot(data, collapsed_children);
        super(json_root.elem);
    }
}

// -----------------------------------------------------------

export class ModalPropertyContainer extends UI.PropertyContainer {
    get showing() { return !!this.fb; }
    get changes() { return Object.keys(utils.deep_diff(this.property_lookup_on_show, this.property_lookup)); }
    get modal_title() { return this.get_setting("modal.title"); }

    constructor(settings) {
        settings = {
            // modal_click: "close",
            "modal.close": true,
            "modal.title": "",
            "modal.title-overflow": false,
            "modal.footer": false,
            "modal.header": true,
            "modal.width": undefined,
            ...settings
        };

        super(settings);
        
        this.header_elem = $(`<div class="modal-header"></div>`)[0];
        this.content = new UI($(`<div class="modal-content"></div>`)[0]);
        this.footer_elem = $(`<div class="modal-footer"></div>`)[0];

        this.elem.append(this.header_elem);
        this.elem.append(this.content);
        this.elem.append(this.footer_elem);
        
        update_style_properties(this.elem, {
            padding: "0",
            gap: "0"
        });
        update_style_properties(this.content.elem, {
            display: "flex",
            ["flex-direction"]: "column",
            gap: "var(--gap)",
        });

        this.on("update", ()=>{
            var width = this.get_setting("modal.width");
            var min_width = this.get_setting("modal.min-width");
            var max_width = this.get_setting("modal.max-width");
            update_style_properties(this.elem, {
                "width": typeof width === "number" ? `${width}px` : width,
                "--min-width": typeof min_width === "number" ? `${min_width}px` : min_width,
                "--max-width": typeof max_width === "number" ? `${max_width}px` : max_width,
            });
            set_inner_html(this.header_elem, this.get_setting("modal.title"));
            toggle_class(this.header_elem, "overflow", this.get_setting("modal.title-overflow"));
            toggle_class(this.header_elem, "d-none", !this.get_setting("modal.header"));
            toggle_class(this.footer_elem, "d-none", !this.get_setting("modal.footer"));
            
        });
    }
    async load() {}

    async show(datas) {
        if (this.fb) return;
        this.datas = datas;

        var close_button = this.elem.querySelector("button.carousel__button.is-close");
        if (close_button) close_button.remove();

        await this.load();

        this.fb = new Fancybox([{
            src: this.elem,
            type: "html",
        }], {
            on: {
                shouldClose:(e)=>{
                    return this.get_setting("modal.close");
                }
            }
        });
        this.fb.on("closing",()=>{
            this.fb = null;
            this.emit("hide");
        });
        this.fb.on("destroy",()=>{
            // this.items = [null];
            // this.update_properties_with_data();
        });
        this.property_lookup_on_show = this.property_lookup;
        this.on("register", ()=>{
            this.property_lookup_on_show = this.property_lookup;
        });
        this.emit("show", [...this.datas]);
        this.update();
    }

    hide() {
        if (!this.fb) return;
        this.fb.close();
        this.fb = null;
    }
}

export class LocalServerTargetConfigMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": `Configure Local Media Server`,
            "modal.title-overflow": true,
            data: ()=>utils.try(()=>app.$._session.target_configs["local"]) || {},
        });

        var row = this.content.append(new UI.FlexRow());
        row.append(`<p>Nothing here yet.</p>`);
        /* var streams = new UI.PropertyList("streams", "Streams", {
            properties:()=>{
                var container = new UI.PropertyContainer({

                });
                var passthrough = new UI.Property("passthrough", "Passthrough", `<select>`, {
                    "options": YES_OR_NO,
                    "default": false,
                });
                container.append(passthrough);
                var video_bitrate = new UI.Property("video_bitrate", "Bitrate", `<div class="input-wrapper suffix number Kbips"><input type="number" min="500" max="5000"></div>`, {
                    "default": "3000",
                });
                container.append(video_bitrate);
                var audio_bitrate = new UI.Property("audio_bitrate", "Bitrate", `<div class="input-wrapper suffix number Kbips"><input type="number" min="64" max="320"></div>`, {
                    "default": "160",
                });
                container.append(audio_bitrate);
                var resolution = new UI.Property("resolution", "Resolution", `<select>`, {
                    options: app.$.properties.stream_settings.props["resolution"].options,
                    "default": "720x1280",
                });
                container.append(resolution);
                return container;
            },
            default: []
        });
        row.append(streams); */

        /* this.on("property-change", (e)=>{
            if (e.trigger) {
                app.request({
                    call: ["session", "update_service_config"],
                    arguments: ["restream.io", e.name, e._value]
                });
            }
        }); */
    }

    async show(target) {
        super.show();
        /* this.target = target
        console.log(await app.request({
            call: ["app", "plugins", "restream.io", "get_channels"],
            arguments: [target.id]
        })); */
    }
}

export class UserConfigurationSettings extends ModalPropertyContainer {
    constructor() {
        super({
            data:()=>app.$.settings,
            "modal.title": "Client Configuration",
            "modal.footer":true,
        });

        function get_default() { return app.settings.defaults[this.name] }

        var row = this.content.append(new UI.FlexRow());
        row.append(
            new UI.Property("playlist_sticky", "[Playlist] Sticky Mode", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            }),
            new UI.Property("wrap_playlist_items", "[Playlist] Line Wrap", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            }),
            new UI.Property("show_extra_playlist_icons", "[Playlist] Show Codecs", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            }),
        );
        var row = this.content.append(new UI.FlexRow());
        row.append(
            new UI.Property("time_display_ms", "[Media Player / Timeline] Show Milliseconds", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            }),
            new UI.Property("show_chapters", "[Media Player] Show Chapters", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            })
        );
        var row = this.content.append(new UI.FlexRow());
        row.append(
            new UI.Property("sessions_display", "[Sessions] Display Mode", `<select>`, {
                "options":[["tabs","Tabs"],["select","Dropdown"]],
                "default":get_default,
            }),
            new UI.Property("open_file_manager_in_new_window", "[File Manager] Open in New Window", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            })
        );
        var row = this.content.append(new UI.FlexRow());
        row.append(
            new UI.Property("show_encoder_info", "[Encoder] Show Stats", `<select>`, {
                "options":YES_OR_NO,
                "default":get_default,
            })
        );
        
        var reset_button = new UI.Button(`Reset`, {
            click: ()=>this.reset()
        });
        this.footer_elem.append(reset_button);
        
        var reset_layout_button = new UI.Button(`Reset Layout`, {
            click: ()=>{
                app.settings.set("layout", null);
                app.update_layout();
            }
        });
        this.footer_elem.append(reset_layout_button);

        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set(e.name, e._value);
        })
    }
}
export class KeyboardShortcuts extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": "Controls",
        });
        var sections = {
            "General": [
                [`[Ctrl] + [1] ... [9]`, `Open Session`],
                [`[Ctrl] + [0]`, `Minimize Session`],
                [`[Ctrl] + [S]`, `Save Session`],
                [`[F1]`, `Toggle Help`],
            ],
            "Playlist": [
                [`[Arrow Up] / [Arrow Down]`, `Select Previous / Next item`],
                [`Click`, `Select Item`],
                [`Drag + Drop`, `Rearrange Selected Items`],
                [`[Ctrl] + Left Click`, `Toggle Select Item`],
                [`[Shift] + Left Click`, `Select Multiple Items`],
                [`[Alt] + Drag`, `Move View`],
                [`[Ctrl] + [A]`, `Select All Items`],
                [`[Ctrl] + [D]`, `Deselect All Items`],
                ...app.playlist.all_commands.filter(c=>c.options.view === PLAYLIST_VIEW.LIST && c.shortcut()).map(c=>[c.shortcut_alt(), c.description_or_name()])
            ],
            "Playlist (Timeline Mode)": [
                [`[Arrow Left] / [Arrow Right]`, `Select Previous / Next Item`],
                [`Mouse Wheel Up / Down`, `Zoom In & Out`],
                [`Left Click Tick Bar`, `Place Timeline Cursor`],
                ...app.playlist.all_commands.filter(c=>c.options.view === PLAYLIST_VIEW.TIMELINE && c.shortcut()).map(c=>[c.shortcut_alt(), c.description_or_name()])
            ]
        };
        //.replace("+", `<i class="fas fa-plus"></i>`)
        var html = Object.entries(sections).map(([name,s])=>`<table class="keyboard-shortcuts"><tr><th colspan="2">${name}</th></tr>${s.map(line=>`<tr>${line.map(l=>`<td>${l.replace(/\[(.+?)\]/g, `<span class="keyboard-key">$1</span>`)}</td>`).join("")}</tr>`).join("")}</table>`).join("");
        var tables = $(html);
        this.content.append(...tables);
    }
}

/* class AdvancedFunctionsMenu extends ModalPropertyContainer {
    constructor() {
        super({
            title: "Advanced Functions",
        });
        var row = this.append(new UI.FlexRow());
        row.append(
        )
    }

    show() {
        super.show();
    }
} */

export class FileSystemInfoMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": "Local File System Tree",
            "modal.width": "80%",
            "modal.footer": true,
        });
        var uid = 0;
        var nodes = [];
        var percent_fraction_digits=1;
        var process = (n, parent, icon)=>{
            var node = {};
            node.id = ++uid;
            nodes[node.id] = node;
            node.level = parent.level+1;
            node.parent = parent;
            // node.parent = parent;
            // node.parents = [node.id,...parent.parents];
            node.name = n[0];
            // console.log(node.level, node.name)
            if (typeof n[1] === "object") {
                node.icon = icon || "folder";
                node.isdir = true;
                node.folders = 0;
                node.files = 0;
                node.size = 0;
                node.children = [];
                var children = n[1];
                children.sort((a,b)=>(typeof b[1]==="object"?1:0)-(typeof a[1]==="object"?1:0));
                var i=0, len=children.length;
                var f = children.findIndex(c=>typeof c[1]!=="object");
                if (f < 1) f = len;
                for (;i<f;i++) {
                    node.children.push(process(children[i], node));
                }
                if (i<len) {
                    var files = children.slice(i);
                    if (files.length == 1) node.children.push(process(files[0], node));
                    else node.children.push(process([`[${files.length} Files]`, files], node, "files"));
                }
                for (var c of node.children) {
                    if (c.isdir) {
                        node.folders += c.folders + 1;
                        node.files += c.files;
                    } else {
                        node.files++;
                    }
                    node.size += c.size;
                }
            } else {
                node.icon = icon || "file";
                node.size = n[1] || 0;
            }
            return node;
        };
        var create_bar = (p)=>{
            var outer = document.createElement("div");
            add_class(outer, "percent-bar");
            var inner = document.createElement("div");
            var text = document.createElement("span");
            inner.style.width = `${p*100}%`;
            outer.append(inner, text);
            text.innerText = p === undefined ? "-" : (p*100).toLocaleString(undefined, {minimumFractionDigits:percent_fraction_digits,maximumFractionDigits:percent_fraction_digits})+"%";
            return outer;
        }
        var process2 = (node, root_node)=>{
            node.total_percent = node.size / root_node.size;
            if (node.children) {
                for (var c of node.children) {
                    c.percent = (c.size / node.size);
                    process2(c, root_node);
                }
            }
        };

        var init = async()=> {
            for (let id in app.$.volumes) {
                if (app.$.volumes[id].driver !== "LocalFileSystem") continue;
                var volume = app.$.volumes[id];
                var loading_el = $(`<tr><td colspan="6"><i class="fas fa-sync fa-spin"></i> Loading...</td></tr>`)[0];
                dom_utils.empty(tbody);
                tbody.append(loading_el);
                var r = await app.request({
                    call: ["app", "analyze_local_file_system_volume"],
                    arguments: [id]
                });
                loading_el.remove();
                var root_node = process([volume.name, r[1]], {root:volume.root,level:-1}, "drive");
                process2(root_node, root_node);
                render(root_node);
                tbody.append(root_node.el);
                root_node.toggle();
            }
        };

        var render = (node)=>{
            if (node.el) return;
            var row_el = document.createElement("tr");
            tbody.append(row_el);
            
            var name_outer_el = document.createElement("td");
            add_class(name_outer_el, "name");

            var name_inner_el = document.createElement("div");
            name_inner_el.style.display="flex"
            name_inner_el.style.alignItems="center"
            name_inner_el.style.gap="5px"
            name_inner_el.style.paddingLeft = `${node.level * 10}px`;

            var name_el = document.createElement("a");
            name_el.href="javascript:void(0)";
            name_el.innerText = node.name;

            name_el.onclick = ()=>{
                var path = [], p = node;
                while(p.parent) {
                    if (p.icon != "files") path.push(p.name);
                    p = p.parent;
                }
                var path = path.filter(p=>p).reverse();
                if (node.icon == "files") path.push("");
                path[0] = p.root;
                open_file_manager({start: path.join("/")});
            }
            var arrow_el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            set_inner_html(arrow_el, `<use href="icons.svg#chevron-right"></use>`);
            add_class(arrow_el, "arrow");
            name_inner_el.append(arrow_el);
            if (!node.isdir) arrow_el.style.visibility = "hidden";

            var icon_el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            set_inner_html(icon_el, `<use href="icons.svg#${node.icon}"></use>`);
            name_inner_el.append(icon_el, name_el);
            name_outer_el.append(name_inner_el);

            var size_el = document.createElement("td");
            add_class(size_el, "size");
            size_el.innerText = utils.format_bytes(node.size);
            var files_el = document.createElement("td");
            add_class(files_el, "files");
            files_el.innerText = node.isdir ? node.files.toLocaleString() : "-";
            var folders_el = document.createElement("td");
            add_class(folders_el, "folders");
            folders_el.innerText = node.isdir ? node.folders.toLocaleString() : "-";
            var percent_el = document.createElement("td");
            add_class(percent_el, "percent");
            percent_el.append(create_bar(node.percent));
            var percent_total_el = document.createElement("td");
            add_class(percent_total_el, "percent-total");
            percent_total_el.append(create_bar(node.total_percent));

            row_el.append(name_outer_el, size_el, files_el, folders_el, percent_total_el, percent_el);
            node.el = row_el;

            if (node.isdir) {
                node.open = false;
                node.toggle = ()=>{
                    var open = node.open = !node.open;
                    toggle_class(row_el, "open", open);
                    var next = node;
                    if (!node.sorted) {
                        node.sorted = true;
                        node.children.sort((a,b)=>b.size-a.size);
                    }
                    for (var c of node.children) {
                        render(c);
                        next.el.after(c.el);
                        next = c;
                    }
                    var update = (n)=>{
                        if (!n.isdir) return;
                        var next = n;
                        for (var c of n.children) {
                            if (!c.el) continue;
                            var o = open && n.open;
                            if (o && !c.el.parentElement) {
                                next.el.after(c.el);
                                next = c;
                            } else if (!o && c.el.parentElement) {
                                c.el.remove();
                            }
                            // c.el.style.display = (open && n.open)?"":"none";
                            update(c);
                        }
                    }
                    update(node);
                }
                arrow_el.style.cursor = "pointer";
                arrow_el.onclick = node.toggle;
            }
            return node;
        }

        // -------------------------------

        var table = document.createElement("table");
        add_class(table, "files");
        var th = document.createElement("thead");
        table.append(th);
        var tr = document.createElement("tr");
        tr.append(...["Name", "Size", "Files", "Folders", "% Total", "% Parent"].map((c)=>{
            var td = document.createElement("td");
            set_inner_html(td, c);
            return td;
        }))
        th.append(tr);
        var tbody = document.createElement("tbody");
        table.append(tbody);
        this.content.append(table);

        var refresh_button = new UI.Button("Refresh", {
            click:()=>init()
        });
        this.footer_elem.append(refresh_button)
        
        var inited;
        this.on("show", ()=>{
            if (inited) return;
            inited = true;
            init();
        })
    }
}

export class SystemManagerMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": "System Manager",
        });
        class Bar extends UI {
            constructor(settings) {
                super(null, settings);
                this.append(new UI.FlexRow()).append(this.label = new UI.Label(null, {content: ()=>this.get_setting("label")}));
                this.bar = new UI($(`<div class="bar"></div>`)[0]);
                this.append(new UI.FlexRow()).append(this.bar);
                this.on("update", ()=>{
                    var x = this.get_setting("value");
                    var n = this.get_setting("total");
                    var format = (x)=>this.get_setting("format", x);
                    var inner = $(`<div class="inner"></div>`)[0];
                    var percent = (n == undefined) ? x : x/n;
                    inner.style.width = `${Math.round(percent*1000)/10}%`;
                    var str = (n == undefined) ? format(x||0) : `${format(x||0)} / ${format(n||0)}`;
                    var text = $(`<div class="text">${str}</div>`)[0];
                    this.bar.empty().append(inner, text);
                });
            }
        }
        class Process extends UI.Column {
            constructor(name) {
                super({gap:5});

                var is_running = ()=>app.$.processes[name].status == "online"

                var row = this.append(new UI.Row());
                add_class(this.elem, "process");
                var info_ui = row.append(new UI({flex:1}));
                var name_ui = info_ui.append(new UI());
                var description_ui = info_ui.append(new UI());
                var buttons_ui = row.append(new UI.Row({gap:5}));
                var stats_ui = this.append(new UI.Row({justify:"right"}));
                var restart_button = new UI.Button("RESTART", {
                    click: ()=>{
                        app.request_no_timeout({
                            call: ["core", `module_restart`],
                            arguments: [name]
                        });
                    },
                    hidden: ()=>!is_running()
                });
                var stop_button = new UI.Button("STOP", {
                    click: ()=>{
                        app.request_no_timeout({
                            call: ["core", `module_stop`],
                            arguments: [name]
                        });
                    },
                    hidden: ()=>!is_running()
                });
                var start_button = new UI.Button("START", {
                    click: ()=>{
                        app.request_no_timeout({
                            call: ["core", `module_start`],
                            arguments: [name]
                        });
                    },
                    hidden: ()=>is_running()
                });
                var buttons = [restart_button, stop_button, start_button];
                if (name === "main" || name === "electron") buttons = [restart_button];
                buttons_ui.append(...buttons);

                this.on("update", ()=>{
                    var conf_name = app.$.processes[name]["title"];
                    var conf_desc = app.$.processes[name]["description"];
                    var p = app.$.processes[name];
                    var color = null;
                    if (p.status.match(/(online|launch)/)) color="#0a0";
                    else if (p.status.match(/stop/)) color="#666";
                    else if (p.status.match(/error/)) color="f00";
                    set_inner_html(name_ui.elem, `${conf_name} [<span class="status">${p.status.toUpperCase()}</span>]`);
                    var status_el = name_ui.elem.querySelector(".status");
                    status_el.style.color = color;
                    set_style_property(name_ui, "font-weight", "bold");
                    set_inner_html(description_ui.elem, conf_desc);
                    
                    var pinfo = app.$.process_info[p.pid] || {};
                    var cpu = Number((pinfo.cpu||0)*100).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})+"%";
                    var mem = utils.format_bytes(pinfo.memory||0);
                    var uptime = utils.ms_to_human_readable_str(pinfo.elapsed||0);
                    var s = {"CPU":cpu,"Memory":mem,"Transfer rate":`↑ ${utils.format_bytes(pinfo.sent)}ps / ↓ ${utils.format_bytes(pinfo.received)}ps`, "Uptime":uptime};
                    set_inner_html(stats_ui.elem, Object.entries(s).map(([k,v])=>`${k}: ${v}`).join(" | "));
                })
            }
        }
        var uptime = this.content.append(new UI({
            "update":()=>{
                set_inner_html(uptime.elem, `System uptime: ${utils.ms_to_human_readable_str(app.$.sysinfo.uptime*1000)}`)
            }
        }));
        var transfer = this.content.append(new UI({
            "update":()=>{
                set_inner_html(transfer.elem, `Transfer rate: ↑ ${utils.format_bytes(app.$.sysinfo.sent)}ps / ↓ ${utils.format_bytes(app.$.sysinfo.received)}ps`)
            }
        }));
        this.content.append(new Bar({
            label: "Disk",
            value: ()=>app.$.sysinfo.disk_total-app.$.sysinfo.disk_free,
            total: ()=>app.$.sysinfo.disk_total,
            format: (x)=>utils.format_bytes(x)
        }));
        this.content.append(new Bar({
            label:"Memory",
            value: ()=>app.$.sysinfo.memory_total-app.$.sysinfo.memory_free,
            total: ()=>app.$.sysinfo.memory_total,
            format: (x)=>utils.format_bytes(x)
        }));
        this.content.append(new Bar({
            label:"CPU Usage",
            value: ()=>app.$.sysinfo.cpu_avg,
            format: (x)=>Number(x*100).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})+"%"
        }));

        var process_wrapper = new UI();
        process_wrapper.append(`<label>Processes</label>`)
        var process_container = new UI.FlexColumn({gap:5});
        process_wrapper.append(process_container);
        this.content.append(process_wrapper);

        this.on("update", ()=>{
            var processes = Object.keys(app.$.processes);
            utils.sort(processes, (p)=>p==="main"?0:1)
            dom_utils.rebuild(process_container.elem, processes, {
                id_callback: (p)=>p,
                add: (p, elem, i)=>{
                    if (!elem) elem = new Process(p).elem;
                    return elem;
                }
            });
        });
        var tick_timeout;
        var tick = async ()=>{
            await app.request({
                call: ["app", "update_system_info"]
            });
            if (this.showing) next_tick();
        }
        var next_tick = ()=>tick_timeout = setTimeout(tick, 2000);
        var clear_tick = ()=>clearTimeout(tick_timeout);

        this.on("show", ()=>{
            tick();
        })
        this.on("hide", ()=>{
            clear_tick();
        })
    }
}
export class FileManagerMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.footer": false,
            "modal.header": false,
            "modal.width":"100%"
        });
        Object.assign(this.elem.style, {
            "height": "100%",
            "min-height": "200px",
        });
        Object.assign(this.content.elem.style, {
            "padding": 0,
            "height": "100%",
        });
        this.content.elem.style.height = "100%";
        /** @type {HTMLIFrameElement} */
        this.iframe = $(`<iframe allowfullscreen="allowfullscreen" allow="autoplay; fullscreen" scrolling="auto" width="100%" height="100%" frameBorder="0"></iframe>`)[0];
        this.content.elem.append(this.iframe);
    }
    show(url) {
        super.show();
        this.iframe.src = url;
    }
}


export class ScheduleGenerator extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": "Schedule Generator",
            data: ()=>app.settings.get("schedule_generator"),
            nullify_defaults: true,
        });

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.start_time = new UI.Property("start_time", "Start Time", `<input type="time">`, {
                default: ()=>"00:00" //new Date().toLocaleTimeString().slice(0,5)
            }),
            this.time_rounding = new UI.Property("time_rounding", "Time Rounding", `<select>`, {
                default: 5*60,
                options: [[1*60,"None"],[5*60,"5 mins"],[10*60,"10 mins"],[15*60,"15 mins"]],
            }),
            this.min_duration_filter = new UI.Property("min_duration_filter", "Minimum Duration Filter", `<select>`, {
                default: 0,
                options: [[0,"None"],...[10,30,1*60,2*60,5*60,10*60].map(f=>[f, utils.seconds_to_human_readable_str(f)])],
                info: "Filters out small or interstitial items that might clutter up your schedule."
            })
        )

        var row = this.content.append(new UI.FlexRow());
        row.append(
            // this.time_format = new UI.Property("time_format", "Time Format", `<select>`, {
            //     default: "24",
            //     options: [["12","12 Hour"], ["24","24 Hour"]],
            // }),
            this.remove_ext = new UI.Property("remove_ext", "Remove File Extensions", `<select>`, {
                default: true,
                options: YES_OR_NO,
            }),
            this.use_labels = new UI.Property("use_labels", "Use Labels", `<select>`, {
                default: true,
                options: YES_OR_NO,
            })
            /* this.inner_playlists = new UI.Property("inner_playlists", "Include Playlist Contents", `<select>`, {
                default: true,
                options: YES_OR_NO,
            }); */
        );

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.output = new UI.TextArea(null, "Output", {
                "textarea.rows": 12,
                "reset": false,
                "copy": true,
            })
        );

        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set("schedule_generator", this.named_property_lookup_not_null);
        });

        this.on("update", (e)=>{
            var day = 60 * 60 * 24;
            var t = this.start_time.value;
            var time = utils.timespan_str_to_seconds(t, "hh:mm");
            var r = this.time_rounding.value;
            var min = this.min_duration_filter.value;
            var rows = [];
            var add_line = (name)=>{
                var time_r = Math.round(time/r)*r;
                time_r %= day;
                var time_str = utils.seconds_to_timespan_str(time_r , "hh:mm");
                rows.push(`${time_str} - ${name}`);
            };
            /** @param {PlaylistItem} item */
            var walk = (item)=>{
                if (!item._is_normal_playlist) {
                    var t = item._userdata.duration;
                    if (t && t>=min) {
                        var name = item._get_pretty_name({ext:!this.remove_ext.value, label:this.use_labels.value});
                        add_line(name);
                    }
                    time += t;
                }
                if (!item._is_merged_playlist) {
                    for (var c of item._children) walk(c);
                }
            }
            app.$._session.playlist["0"]._children.forEach(c=>walk(c));
            add_line(`Fin`);
            this.output.set_value(rows.join("\n"));
        });
    }
}

/* function get_timespan_format_by_duration(d) {
    if (d < 60) return `s.SSS`;
    if (d < 60*60) return `m:ss.SSS`;
    return `h:mm:ss.SSS`;
} */
export class FontSettings extends ModalPropertyContainer {
    constructor() {
        super({
            data:()=>app.$.fonts,
            "modal.title": `Font Manager`,
            "modal.footer":false,
        });

        add_class(this.elem, "font-manager");

        var row = this.content.append(new UI.FlexRow());
        
        var left_elem = $(`<div class="left"></div>`)[0];
        var list = new SelectableList($(`<div class="content thin-scrollbar"></div>`)[0], {});
        var left_footer_elem = $(`<div class="footer"></div>`)[0];
        left_elem.append(list.elem, left_footer_elem);
        left_elem.style.height="300px";
        left_elem.style.display="flex";
        list.elem.style.flex = "1";

        var right_elem = $(`<div class="right"></div>`)[0];
        var info_elem = $(`<div class="content thin-scrollbar"></div>`)[0];
        var right_footer_elem = $(`<div class="footer"></div>`)[0];
        right_elem.append(info_elem, right_footer_elem);

        row.append(left_elem, right_elem);

        // app.load_font
        var fd = new FileDrop(list.elem);
        fd.on("drop", (files)=>{
            app.upload_queue.add(files, {dir:"/fonts"});
        })
        
        var add_button = new UI.Button("Add New Font", {
            click:async ()=>{
                var files = dom_utils.upload(`application/font-sfnt,application/font-sfnt`, true)
                app.upload_queue.add(files, {dir:"/fonts"});
            },
            "disabled":()=>!list.selected,
        });

        left_footer_elem.append(add_button);
        
        var delete_button = new UI.Button("Delete", {
            click:async ()=>{
                await app.request({
                    call: ["app", "delete_font"],
                    arguments: [list.selected.id]
                });
            },
            "disabled":()=>!list.selected,
        });
        var download_button = new UI.Button("Download", {
            click:async ()=>{
            },
            "disabled":()=>!list.selected,
        });
        right_footer_elem.append(delete_button, download_button);
        
        list.on("change", async (item, i)=>{
            // await app.load_font(item.id);
            // dom_utils.empty(info_elem);
        });

        this.on("show", async ()=>{
            list.select(null);
        });
    }

    destroy() {
        super.destroy();
        list.destroy();
    }
}

export class SplitSettings extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": ()=>`Split '<span>${PlaylistItem.get_items_title(this.datas)}</span>'`,
            "modal.title-overflow": true,
            "modal.footer":true,
        });

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.split_type = new UI.Property("split_type", "Split Method", `<select>`, {
                options:[["total", "# of Parts"], ["duration", "Duration"], ["time_list", "List of Time Codes"], ["every_chapter", "Every Chapter"], ["chapter_list", "List of Chapters"]],
                "default": "time_list",
            })
        );

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.total = new UI.Property("total", "# of Parts", `<input type="number" min="1"></input>`, {
                "info":`Number of pieces (evenly split)`,
                "default":1,
                "hidden":()=>this.split_type.value != "total",
            }),
            this.duration = new UI.TimeSpanProperty("duration", "Duration", {
                "timespan.format": "h:mm:ss.SSS",
                "info":`Every specified time span`,
                "default": 0,
                "min":0,
                "hidden":()=>this.split_type.value != "duration",
            }),
            this.time_list = new UI.TextArea("time_list", "List of Time Codes", {
                "info":`Comma separated list of time-codes like '1:03, 00:30:00, 1:02:57.333'`,
                "textarea.min_rows": 1,
                "textarea.return_blur": true,
                "default":[],
                "hidden":()=>this.split_type.value != "time_list",
            }),
            this.chapter_list = new UI.TextArea("chapter_list", "Chapter List", {
                "info":`Comma separated list of chapters (zero-based) like '0, 1, 5, 6'`,
                "textarea.min_rows": 1,
                "textarea.return_blur": true,
                "default":[],
                "hidden":()=>this.split_type.value != "chapter_list",
            })
        );

        var delimiter_regex = /[,;|\s]+/;
        var pos_int = v=>Math.floor(Math.abs(parseFloat(v)))||0;
        this.total.input_modifiers.push(v=>pos_int(v));
        this.total.output_modifiers.push(v=>String(v));
        var valid_time = (v)=>v && v>0 && v<this.seek.get_setting("seek.duration");
        var valid_chapter = (v)=>this.seek.get_setting("seek.chapters")[v] !== undefined;
        this.time_list.input_modifiers.push(v=>{
            return [...v.split(delimiter_regex)].map(v=>utils.timespan_str_to_seconds(v)).filter(valid_time)
        });
        this.time_list.output_modifiers.push(v=>{
            if (v.length == 1 && !v[0]) return "";
            return v.map(v=>utils.seconds_to_timespan_str(v, "h?:mm:ss.SSS")).join(", ")
        });
        this.chapter_list.input_modifiers.push(v=>[...v.split(delimiter_regex)].map(v=>pos_int(v)).filter(valid_chapter));
        this.chapter_list.output_modifiers.push(v=>v.join(", "));

        [this.split_type,this.total,this.duration,this.time_list,this.chapter_list].forEach(p=>{
            p.on("change", (e)=>{
                if (e.trigger) this.update_markers();
            })
        });

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.seek = new SeekBar({
                "label": ()=>`Timeline [${utils.seconds_to_timespan_str(this.seek.get_setting("seek.duration"), app.user_time_format)}]`,
                "info": `Add markers to the list with mouse click, click marker to remove, click & drag marker to move.`,
                "seek.add_markers": true,
                // "seek.show_times": false,
            })
        )
        this.seek.on("markers-change", ()=>{
            this.split_type.set_value("time_list");
            var times = this.seek.get_setting("seek.markers").map(m=>m.time);
            times = utils.sort(times);
            this.time_list.set_value(times);
        });
        
        this.split_button = new UI.Button(`Split`, {
            click: ()=>{
                app.playlist_split(this.datas, this.get_splits(), true)
                this.hide();
            }
        });
        this.footer_elem.append(this.split_button)
    }

    get_splits(){
        var max = 128;
        var d = this.seek.get_setting("seek.duration");
        var chapters = this.seek.get_setting("seek.chapters");
        if (this.split_type.value == "total") {
            var v = this.total.value;
            var n = v ? Math.min(max, v) : 1;
            return [...Array(n-1)].map((_,i)=>(d/n)*(i+1));
        }
        if (this.split_type.value == "duration") {
            var v = this.duration.value;
            var n = v ? Math.min(max, Math.floor(d / v)) : 0;
            return [...Array(n)].map((_,i)=>v*(i+1));
        }
        if (this.split_type.value == "time_list") {
            return this.time_list.value;
        }
        if (this.split_type.value == "every_chapter") {
            chapters = chapters.map(c=>c.start);
            chapters = chapters.filter(t=>t>1&&t<d-1);
            return chapters;
        }
        if (this.split_type.value == "chapter_list") {
            return chapters.filter((c,i)=>this.chapter_list.value.includes(i)).map(c=>c.start);
        }
    }

    update_markers(){
        this.seek.clear_markers();
        this.get_splits().forEach(t=>this.seek.add_marker(t));
    };

    show(datas) {
        /** @type {PlaylistItem} */
        this.data;
        super.show(datas);
        this.seek.update_settings({
            "seek.duration": this.data._userdata.duration,
            "seek.chapters": this.data._userdata.chapters
        });
        this.update_markers();
    }
}
export class ScheduleStreamSettings extends ModalPropertyContainer {
    constructor() {
        super({
            data: ()=>app.$._session,
            "modal.title": "Schedule Stream Start",
            "modal.footer": true,
            nullify_defaults: true,
        });

        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.schedule_start_time = new UI.DateTimeProperty("schedule_start_time", null, {
                "label": function(){
                    var n = `Start Date/Time`;
                    if (this.value) {
                        n += ` (<i>${utils.time_diff_readable(Date.now(), new Date(this.value))}</i>)`;
                    }
                    return n;
                },
                "default": null,
                "datetime.after_now":true,
            })
        )
        
        var reset_button = new UI.Button(`Reset`, {
            click: ()=>this.reset()
        });
        this.footer_elem.append(reset_button);
        
        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.$._push([`sessions/${app.$._session.id}/${e.name}`, e._value]);
            // app.$._session[e.name] = e._value;
            app.request({
                call: ["session", "update_values"],
                arguments: [[e.name, e._value]]
            });
        });
    }
}

export class SessionConfigurationSettings extends ModalPropertyContainer {
    constructor() {
        super({
            data: ()=>app.$._session,
            "modal.title":"Session Configuration",
        });

        function get_default() { return utils.try(()=>app.$.properties[this.name].__default__); }
        this.name = new UI.Property("name", "Session Name", `<input type="text">`, {
            "default": null,
            "reset": false,
        });
        this.name.add_validator(UI.VALIDATORS.not_empty);

        /* this.default_stream_title = new UI.Property("default_stream_title", "Default Stream Title", `<input type="text">`, {
            "placeholder":()=>this.name.value,
            "default": "",
            "reset": true,
        }); */
        
        this.creation_time = new UI.Property("creation_time", "Creation Date", `<input type="text" readonly>`, {
            "disabled": true,
            "reset": false,
        });
        this.creation_time.output_modifiers.push(v=>new Date(v).toLocaleString());

        this.stream_host = new UI.Property(null, "Stream Host", `<input type="text" readonly>`, {
            "default": ()=>app.get_rtmp_url(),
            "reset": false,
            "copy": true,
            "info": "Connect and stream to dynamic RTMP playlist items. Use this RTMP host and key in OBS or your streaming software of preference",
        });

        this.stream_key = new UI.Property(null, "Stream Key", `<input type="text" readonly>`, {
            "default": ()=>`private/${app.$._session.id}`,
            "reset": false,
            "copy": true,
        });

        /* var regenerate_button = new UI.Button(`<i class="fas fa-sync-alt"></i>`, {
            "click":async ()=>{
                regenerate_button.settings.disabled = true;
                await app.request({
                    call: ["session", "generate_rtmp_key"]
                });
                regenerate_button.settings.disabled = false;
            },
            "title": "Regenerate Key",
        });
        this.stream_key.group_elem.append(regenerate_button); */
        
        [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end] = create_background_properties({
            "name": "background",
            "label": "Default Background",
            "options": ()=>utils.try(()=>app.$.properties.background_mode.__options__, []),
            "default": ()=>utils.try(()=>app.$.properties.background_mode.__default__, null),
        }, true)

        this.files_dir = new FileProperty("files_dir", "Root Directory", {
            "info": "Your preferred location for storing any uploaded / downloaded files.",
            "file.options":{ folders: true },
            "default": get_default,
        });
        this.files_dir.add_validator(UI.VALIDATORS.media_exists);

        this.interpolation_mode = new UI.Property("interpolation_mode", "Interpolation Mode", `<select></select>`, {
            "options":()=>{
                return [["auto","Auto"], [false, "Off"], [true, "On"]];
            },
            "default": get_default,
        });
        this.auto_interpolation_rate = new UI.Property("auto_interpolate_rate", "Auto Interpolation Target FPS", `<select></select>`, {
            "options":()=>{
                return [24, 25, 30, 60];
            },
            "disabled":()=>this.interpolation_mode.value !== "auto",
            "default": get_default,
        });

        this.members = new AccessControlProperty("access_control", "Access Control", {
            "info": "Owners: Full access.\nAllowed: Full access but cannot edit session confugration, delete the session, load/save session files or access history.\nDenied: No access rights whatsoever.",
            default: AccessControl.DEFAULT_ACCESS_FOR_SELF
        });
        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.$._push([`sessions/${app.$._session.id}/${e.name}`, e._value]);
            // app.$._session[e.name] = e._value;
            app.request({
                call: ["session", "update_values"],
                arguments: [[e.name, e._value]]
            });
        });
        
        this.on("show", ()=>{
            var layout = [
                [this.name],
                // [this.default_stream_title],
                [this.creation_time]
            ];
            if (this.data.type === SessionTypes.INTERNAL) {
                layout.push(
                    [this.stream_host,this.stream_key],
                    [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end],
                    [this.files_dir],
                    [this.auto_reconnect, this.auto_reconnect_delay, this.auto_reconnect_max_attempts]
                );
                if (IS_ELECTRON) {
                    layout.push([this.interpolation_mode, this.auto_interpolation_rate]);
                } else {
                    layout.push([this.members]);
                }
            }
            this.content.update_layout(layout)
        });
    }
}

export class AdminSettings extends ModalPropertyContainer {
    constructor() {
        super({
            data: ()=>app.$._session,
            "modal.title":"Admin",
        });
        // var row = this.append(new UI.FlexRow());
    }
}

export class ChangeLog extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title":"Change Log",
            "modal.min-width": "750px"
        });
        this.on("show",()=>{
            Object.assign(this.content.elem.style, {
                // "font-family": "monospace",
                "font-size": "1.2rem",
            });
            app.settings.set("last_change_log", app.$.change_log.mtime);
        })
    }
    async load() {
        var html = await (await (fetch("./changes.md"))).text();
        set_inner_html(this.content.elem, `<div>${html}</div>`);
    }
}

export class UploadsDownloadsMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title":"Uploads / Downloads",
            "modal.width": "70%",
        });
        var types = ["uploads", "downloads"];
        this.on("update", ()=>{
            var content = new UI();
            var stats = types.map(t=>`Total ${t.slice(0,-1)} rate: ${utils.format_bytes(utils.sum(Object.values(app.$[t]).map(u=>u.speed)))+"ps"}`).join(" | ");
            content.append(...$(`<div>${stats}</div>`));
            Object.assign(this.content.elem.style, {"white-space": "pre-wrap", "word-break": "break-all", "font-family":"monospace" });
            for (var type of types) {
                var rows = [];
                var header = {
                    "dest_path":{
                        name: "Filename",
                    },
                    "rate":{
                        name: "Rate",
                        style: "white-space: nowrap",
                    },
                    "bytes":{
                        name: utils.capitalize(type.slice(0,-1))+"ed",
                        style: "white-space: nowrap",
                    },
                    "total":{
                        name: "Total",
                        style: "white-space: nowrap",
                    },
                    "progress":{
                        name: "Progress",
                        style: "white-space: nowrap",
                    }
                };
                for (var [id,u] of Object.entries(app.$[type])) {
                    rows.push({
                        id,
                        ...u,
                        rate: utils.format_bytes(u.speed)+"ps",
                        bytes: utils.format_bytes(u.bytes),
                        total: utils.format_bytes(u.total),
                        progress: `${((u.bytes/u.total)*100).toLocaleString(undefined, {maximumFractionDigits:2,minimumFractionDigits:2})}%`
                    });
                }
                var table = dom_utils.build_table(rows, { header, empty: `No active ${type}` });
                content.append(table);
            }
            dom_utils.sync_dom(this.content.elem, content.elem, {attrs:false});
        });
    }
}

export class JSONViewer extends ModalPropertyContainer {
    async show(title, json) {
        super.show();
        this.update_settings({"modal.title": title });
        var json = new JSONContainer(json);
        set_inner_html(this.content.elem, "");
        set_style_property(this.content.elem, "margin-bottom", 0);
        this.content.elem.append(json);
    }
}

export class InfoSettings extends JSONViewer {
    /** @param {PlaylistItem[]} items */
    async show(items) {
        var name;
        var data = items.map(d=>{
            var a = {...d};
            a._media_info = d._media_info;
            a._info = d._info;
            a._userdata = d._userdata;
            // if (app.debug) {
            // }
            return a;
        })
        if (items.length == 1) {
            name = `'<span>${items[0]._get_pretty_name()}</span>'`;
            data = data[0]
        } else {
            name = `[${items.length} Items]`
        }
        super.show(name, data);
    }
}

export class SetTimePosSettings extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title":"Precise Seek",
            "modal.footer":true,
        });
        var row = this.content.append(new UI.FlexRow());
        row.append(
            this.chapter_select = new UI.Property(null, "Chapter", `<select>`, {
                "hidden":()=>!app.settings.get("show_chapters") || app.$._session._current_chapters.length < 2,
                "options":()=>{
                    return app.$._session._current_chapters.map((c,i)=>[i, app.chapter_to_string(c, true)])
                },
                "reset":false,
            }),
            this.time_pos = new UI.TimeSpanProperty(null, "Time", {
                "timespan.format":()=>"h:mm:ss.SSS",
                "min":0,
                "reset":false,
            })
        );
        this.time_pos.on("change",(e)=>{
            if (!e.trigger) return;
            this.chapter_select.set_values((app.$._session._get_current_chapter_at_time(e._value)||EMPTY_OBJECT).index);
        })
        this.chapter_select.on("change",(e)=>{
            if (!e.trigger) return;
            var c = app.$._session._current_chapters[e._value];
            this.time_pos.set_values(c.start);
        })

        this.ok = new UI.Button("Seek", {
            click: ()=>{
                app.seek(this.time_pos.value);
                this.hide();
            }
        });
        this.cancel = new UI.Button("Cancel", {
            click: ()=>this.hide()
        });
        this.footer_elem.append(this.ok, this.cancel);

        this.on("show",()=>{
            this.time_pos.settings.default = app.$._session._current_time;
            this.time_pos.reset(true);
        })
    }
}

export class SetVolumeSettings extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title":"Precise Volume Adjustment",
            "modal.footer":true,
        });
        var row = this.content.append(new UI.FlexRow());
        //<div style="padding:0 5px; border-left: 1px solid #aaa; border-bottom: 1px solid #aaa;">
        var volume_input = new UI.Property(null, "Volume (%)", `<input type="number" min="0" max="200">`, {
            default: 100,
        });
        row.append(volume_input);
        var vol_speed = new UI.Property(null, "Volume Transition Speed", `<select>`, {
            title: "Volume Transition Speed",
            default: 2.0,
            // reset: false,
            options: [[0.5, "Very Slow"], [1.0, "Slow"], [2.0, "Medium"], [4.0, "Fast"], [8.0, "Very Fast"], [0, "Immediate"]],
        });
        row.append(vol_speed);
        
        var row = this.content.append(new UI.FlexRow());
        var volume_slider = new UI.Property(null, "Volume (%)", `<input type="range" min="0" max="200">`, { //  style="margin-right:5px"
            default: 100,
            reset_on_dblclick: true,
            reset:false,
        });
        row.append(volume_slider);
        
        volume_input.on("change", (e)=>{
            volume_slider.set_value(e._value, {trigger:false});
        });
        volume_slider.on("change", (e)=>{
            volume_input.set_value(e._value, {trigger:e.trigger})
        });
        
        volume_input.set_value(app.$._session.volume_target);
        vol_speed.set_value(app.$._session.volume_speed);

        this.ok = new UI.Button("Apply Changes", {
            disabled: ()=>this.changes.length==0,
            click: ()=>{
                app.media_player.volume.set_value(volume_input.value, {trigger:true});
                app.media_player.vol_speed.set_value(vol_speed.value, {trigger:true});
                this.hide();
            }
        });
        this.cancel = new UI.Button("Cancel", {
            click: ()=>this.hide()
        });
        this.footer_elem.append(this.ok, this.cancel);
    }
}

export class ExternalSessionConfigurationMenu extends ModalPropertyContainer {
    /** @param {UI.Property} prop */
    constructor() {
        super({
            "modal.title":"Setup External Session",
            "modal.footer":false,
        });
        
        var row = this.content.append(new UI.FlexRow());
        set_inner_html(row.elem, `Setup your streaming software to stream to cabtv and restream to multiple targets.`);
        var row = this.content.append(new UI.FlexRow());
        set_inner_html(row.elem, `<hr/>`);
        
        this.content.append(new StreamKeyGeneratorSettings());
    }
}

export const TimeLeftMode = {
    TIME_LEFT:0,
    DURATION:1,
}

export class TargetEditMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": ()=>this.data ? `Edit '<span>${this.data.name}</span>'` : "New Target",
            "modal.title-overflow": true,
            "modal.footer":true,
        });

        /* var row = this.content.append(new UI.FlexRow());
        var id = new UI.Property("id", "ID", `<input type="text" readonly>`, {
            "disabled":true,
            hidden: ()=>!this.id
        });
        row.append(id) */

        var row = this.content.append(new UI.FlexRow());
        this.name = new UI.Property("name", "Name", `<input type="text">`, {
            "reset":false,
            "default": "",
            "placeholder": "My Stream",
        });
        this.name.add_validator(UI.VALIDATORS.not_empty, (v)=>{
            return Object.values(app.$.targets).filter((t)=>t!=this.data).map(t=>t.name).includes(v) ? "Name already exists." : true
        });
        row.append(this.name)

        var row = this.content.append(new UI.FlexRow());
        this.description = new UI.TextArea("description", "Description", {
            "textarea.min_rows": 2,
            "reset":false,
            "default": "",
        });
        row.append(this.description)

        var row = this.content.append(new UI.FlexRow());
        this.rtmp_host = new UI.Property("rtmp_host", "Stream Host", `<input type="url">`, {
            "reset":false,
            "default": "",
            "placeholder": "rtmp://streaming-service.com",
        });
        this.rtmp_host.add_validator(UI.VALIDATORS.rtmp);
        this.rtmp_key = new UI.Property("rtmp_key", "Stream Key", `<input type="text">`, {
            "reset":false,
            "default": "",
            "placeholder": ""
        });
        row.append(this.rtmp_host, this.rtmp_key);

        var row = this.content.append(new UI.FlexRow());
        this.url = new UI.Property("url", "Stream URL", `<input type="url">`, {
            "reset": false,
            "info": "The public URL to view your channel's livestream.",
            "default": "",
            "placeholder": "https://streaming-service.com/my-channel",
        });
        this.url.add_validator((v)=>!v || UI.VALIDATORS.url(v));
        row.append(this.url);

        var row = this.content.append(new UI.FlexRow());
        this.access_control = new AccessControlProperty("access_control", "Access Control", {
            "info": "Owner: User can edit, delete or utilize the target (full access).\nAllowed: User can view and utilize the target.\nDenied: Users cannot view or utilize target.",
            default: AccessControl.DEFAULT_ACCESS_FOR_SELF,
            "access.allow_passwords": false,
        });
        if (!IS_ELECTRON) {
            row.append(this.access_control);
        }

        /* var row = this.append(new UI.FlexRow());
        this.custom = new UI.TextArea("custom", "Additional Properties (JSON)", {
            "default": {},
        });
        this.custom.add_validator(UI.VALIDATORS.json);
        this.custom.input_modifiers.push(v=>{ try { return JSON.parse(v) } catch {} });
        this.custom.output_modifiers.push(v=>JSON.stringify(v, null, "  "));
        row.append(this.custom); */
        
        var save_button = new UI.Button(`Save`, {
            disabled: ()=>!this.valid,
            hidden: ()=>!!this.data,
            click: ()=>{
                app.request({
                    call: ["app", "create_target"],
                    arguments: [{access_control:{[app.$._client.id]:{"access":"owner"}} , ...this.named_property_lookup}]
                });
                this.hide();
            }
        });

        var delete_button = new UI.Button(`Delete`, {
            hidden: ()=>!this.data,
            click: ()=>{
                if (confirm(`Are you sure you want to delete '${this.data.name}'?`)) {
                    app.request({
                        call: ["app", "delete_target"],
                        arguments: [this.data.id]
                    });
                    this.hide();
                }
            }
        });
        this.footer_elem.append(save_button, delete_button);
        
        this.on("property-change", (e)=>{
            if (!this.data || !e.name || !e.trigger) return;
            app.request({
                call: ["app", "update_target"],
                arguments: [this.data.id, {[e.name]:e._value}]
            });
        });
    }
    /* show(ids) {
        super.show(ids);
        if (!this.id) {
            this.access_control.claim();
        }
    } */
}

export class TargetConfigurationMenu extends ModalPropertyContainer {
    /** @type {string[]} */
    targets_selected_ids = [];

    get targets_selected() {
        return this.targets_selected_ids.map(id=>this.targets[id]).filter(t=>t);
    }
    /** @type {Record<PropertyKey,Target>} */
    get targets() { return {...app.$.targets}; };

    /** @param {TargetsProperty} parent_prop */
    // get targets_selected() { return this.parent_prop ? this.parent_prop.value.map(id=>this.targets[id]) : []; }
    get targets_remaining() {
        var targets = Object.values(this.targets);
        if (this.parent_prop) {
            targets = targets.filter(t=>!this.targets_selected_ids.includes(t.id));
        }
        targets = targets.filter(t=>t.locked?true:new AccessControl(t.access_control)._self_has_access());
        utils.sort(targets, t=>!t.locked, t=>t.ts);
        return targets;
    }
    /** @param {TargetsProperty} parent_prop */
    constructor(parent_prop, settings) {
        super({
            "modal.title": "Stream Targets",
            "show_in_use": true,
            "auto_apply": true,
            ...settings,
        });

        this.parent_prop = parent_prop;
        add_class(this.content.elem, "target-config");

        var selected_el
        if (parent_prop) {
            selected_el = new UI.Column().elem;
            add_class(selected_el, "target-list");
            this.content.append(selected_el);
            this.content.append(new UI.Separator());
            this.targets_selected_ids = this.parent_prop.value;
        }

        var list_el = new UI.Column().elem;
        add_class(list_el, "target-list");
        this.content.append(list_el);

        var new_button = new UI.Button(`New Target <i class="fas fa-plus" style="padding:0 5px"></i>`, {
            "click":()=>{
                new TargetEditMenu().show(null);
            },
            "title": "New Target",
        });
        this.content.append(new_button);

        if (!this.settings["auto_apply"]) {
            var apply_button = new UI.Button(`Apply`, {
                "click":()=>{
                    update_value(true);
                    this.hide();
                },
                "title": "Apply",
            });
            this.content.append(apply_button);
        }
        var update_value = (force)=>{
            this.targets_selected_ids = [...selected_el.children, ...list_el.children].filter(e=>e.dataset.id && e.querySelector("input").checked).map(e=>e.dataset.id);
            if (force || this.settings["auto_apply"]) {
                if (parent_prop) {
                    parent_prop.set_value(this.targets_selected_ids, {trigger:true});
                }
            }
            this.update();
        };
        var is_editable = (target)=>{
            return !target.locked && new AccessControl(target.access_control)._self_can_edit;
        };
        /** @param {Target} target */
        var add = (target, elem, i)=>{
            elem = new UI.Row().elem;

            /** @type {HTMLLabelElement} */
            var label_el = $(`<span></span>`)[0];

            var checkbox_input = $(`<input type="checkbox">`)[0];
            var text_wrapper_elem = $(`<div class="text-wrapper"></div>`)[0];
            checkbox_input.onchange = ()=>{
                update_value();
            };
            label_el.append(checkbox_input, text_wrapper_elem)

            var up_button = new UI.Button(`<i class="fas fa-arrow-up"></i>`, {
                "click":()=>{
                    dom_utils.move(elem, -1);
                    update_value();
                },
                "hidden":()=>this.targets_selected_ids.length<2 || !this.targets_selected_ids.includes(target.id),
                "disabled":()=>this.targets_selected_ids.indexOf(target.id)==0,
                "title": "Move Up",
            });

            var down_button = new UI.Button(`<i class="fas fa-arrow-down"></i>`, {
                "click":()=>{
                    dom_utils.move(elem, 1);
                    update_value();
                },
                "hidden":()=>this.targets_selected_ids.length<2 || !this.targets_selected_ids.includes(target.id),
                "disabled":()=>this.targets_selected_ids.indexOf(target.id) == this.targets_selected_ids.length-1,
                "title": "Move Down",
            });

            var get_config_menu = ()=>utils.try(()=>app.target_config_menus[target.id]);

            var config_button = new UI.Button(`<i class="fas fa-cog"></i>`, {
                "hidden": ()=>!parent_prop || !get_config_menu(),
                "click": ()=>get_config_menu().show(target),
                "title": "Configure",
            });

            /* var view_url_button = new UI.Link(`<i class="fas fa-arrow-up-right-from-square"></i>`, {
                "hidden": ()=>!target.url,
                "href": ()=>target.url,
            }); */

            var edit_button = new UI.Button(`<i class="fas fa-edit"></i>`, {
                "click":()=>{
                    new TargetEditMenu().show(target)
                },
                "hidden":()=>!is_editable(target),
                "title": "Edit",
            });

            var delete_button = new UI.Button(`<i class="fas fa-trash-can"></i>`, {
                "click":()=>{
                    if (confirm(`Are you sure you want to delete '${target.name}'?`)) {
                        app.request({
                            call: ["app", "delete_target"],
                            arguments: [target.id]
                        });
                    }
                },
                "hidden":()=>!is_editable(target),
                "title": "Delete",
            });

            elem.append(label_el, edit_button, config_button, delete_button, /*view_url_button, */ up_button, down_button);

            var in_use = !!target._active_streams.length;
            var name_elem = $(`<span class="name"></span>`)[0];
            var description_elem = $(`<div class="description"></div>`)[0];
            set_inner_html(text_wrapper_elem, "");
            text_wrapper_elem.append(name_elem, description_elem);
            var checkbox_input = elem.querySelector(`input[type="checkbox"]`);

            var parts = [target.name || target.id];
            if (in_use) parts.push(`<span class="flashing-slow">[Currently In Use]</span>`);
            if (target.locked) parts.push(` <i class="fas fa-lock"></i>`);
            if (target.url) parts.push(`<a href="${target.url}" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i></a>`);
            set_inner_html(name_elem, parts.join(" "));
            set_inner_html(description_elem, utils.convert_links_to_html(target.description || ""));
            checkbox_input.checked = this.targets_selected_ids.includes(target.id)
            checkbox_input.style.display = parent_prop ? "" : "none";
            checkbox_input.disabled = !parent_prop;

            return elem;
        };

        var old_hash;
        this.on("update", ()=>{
            if (this.parent_prop && this.settings["auto_apply"]) {
                this.targets_selected_ids = this.parent_prop.value;
            }
        });
        this.on("render", ()=>{
            var hash = JSON.stringify([this.targets, this.targets_selected_ids]);
            if (hash === old_hash) return;
            old_hash = hash;
            if (parent_prop) {
                dom_utils.rebuild(selected_el, this.targets_selected, { add });
                if (this.targets_selected.length == 0) {
                    set_inner_html(selected_el, `<span style="display: flex; justify-content: center; padding: 10px;">No Targets Selected.</span>`);
                }
            }
            dom_utils.rebuild(list_el, this.targets_remaining, { add });
            if (this.targets_remaining.length == 0) {
                set_inner_html(list_el, `<span style="display: flex; justify-content: center; padding: 10px;">No Remaining Targets.</span>`);
            }
        });
    }
}

export class TargetsProperty extends UI.Property {
    constructor(name, label, settings) {
        settings = {
            "default": [],
            "reset": false,
            "show_in_use": true,
            "auto_apply": true,
            ...settings,
        };
        
        var input = $(`<input type="text" readonly>`)[0];
        input.style.cursor = "pointer";

        super(name, label, input, settings);

        input.onclick = ()=>{
            var modal = new TargetConfigurationMenu(this, {
                "show_in_use": this.settings["show_in_use"],
                "auto_apply":this.settings["auto_apply"]
            });
            modal.show();
        }

        this.output_modifiers.push(v=>v.length ? v.length == 1 ? (app.$.targets[v[0]]||EMPTY_OBJECT).name : `${v.length} Targets` : `None`)
    }
}
export class SeekBar extends UI {
    
    get _time() { return this.get_setting("seek.time"); }
    get _duration() { return this.get_setting("seek.duration"); }
    get _ranges() { return this.get_setting("seek.ranges"); }
    get _markers() { return this.get_setting("seek.markers"); }
    get _chapters() { return this.get_setting("seek.chapters"); }
    get _buffering() { return this.get_setting("seek.buffering"); }
    get _seekable() { return this.get_setting("seek.seekable"); }
    get _show_times() { return this.get_setting("seek.show_times"); }
    get _show_markers() { return this.get_setting("seek.add_markers"); }
    get _time_left_mode() { return this.get_setting("seek.time_left_mode"); }

    constructor(settings) {
        var input = $(
`<div class="seek-wrapper">
    <span id="time">00:00:00</span>
    <div class="seek" tabindex="-1">
        <div class="bg"></div>
        <div class="buffer-bar"></div>
        <div class="bar"></div>
        <div class="ticks-bar"></div>
        <div class="ranges"></div>
        <div class="chapters"></div>
        <div class="markers"></div>
    </div>
    <span id="time-left">00:00:00</span>
</div>`
        )[0];
        // <input type="range" min="0" max="1" step="0.001" class="slider" id="seek> // after bar
        super(input, Object.assign({
            "reset": false,
            "disabled": ()=>!this.get_setting("seek.seekable"),
            //-----
            "seek.time": 0,
            "seek.seekable": true,
            "seek.duration": 0,
            "seek.chapters": [],
            "seek.ranges": [],
            "seek.markers": [],
            "seek.buffering": false,
            "seek.show_times": true,
            "seek.add_markers": false,
            "seek.time_left_mode": TimeLeftMode.TIME_LEFT,
        }, settings));
        
        this.seek_elem = this.elem.querySelector(".seek");
        this.bar_elem = this.elem.querySelector(".bar");
        this.ticks_bar_elem = this.elem.querySelector(".ticks-bar");
        this.ranges_elem = this.elem.querySelector(".ranges");
        this.chapters_elem = this.elem.querySelector(".chapters");
        this.markers_elem = this.elem.querySelector(".markers");
        this.bg_elem = this.elem.querySelector(".bg");
        
        this.time_elem = this.elem.querySelector("#time");
        set_attribute(this.time_elem, "title", "Time Position");
        this.time_left_elem = this.elem.querySelector("#time-left");
        set_attribute(this.time_left_elem, "title", "Time Left");
        this.buffer_bar_elem = this.elem.querySelector(".buffer-bar");

        var set_hover_chapters = (chapters)=>{
            var indices = new Set(chapters.map(c=>+c.index));
            [...this.chapters_elem.children].forEach(e=>{
                toggle_class(e, "hover", indices.has(+e.dataset.index));
            });
        };

        var get_current_chapters = (t)=>{
            var chapters = this.get_setting("seek.chapters");
            if (chapters.length <= 1) return [];
            return chapters.filter(c=>t>=c.start && t<c.end);
        }

        this.ticks_bar = new TicksBar(this.ticks_bar_elem, {
            hover_elem: this.seek_elem,
            placement: "bottom",
            show_numbers: false,
            modifier: (html, t)=>{
                // console.log(html, t);
                var curr_chapters = get_current_chapters(t);
                if (curr_chapters.length) {
                    html = curr_chapters.map(c=>`<div class="chapter">${app.chapter_to_string(c)}</div>`).join("") + html;
                }
                return html;
            }
        });

        var hover_listener = new dom_utils.TouchListener(this.seek_elem, {
            mode: "hover",
            start: (e)=>{
                var data = this.ticks_bar.parse_event(e);
                set_hover_chapters(get_current_chapters(data.time));
            },
            move: (e)=>{
                var data = this.ticks_bar.parse_event(e);
                set_hover_chapters(get_current_chapters(data.time));
            },
            end: (e)=>{
                set_hover_chapters([]);
            }
        });
        var seek_interval, seek_end_timeout, t;
        var seek_listener = new dom_utils.TouchListener(this.seek_elem, {
            start: (e)=>{
                t = this.ticks_bar.parse_event(e).time;
                clearTimeout(seek_end_timeout);
                this.seek_elem.focus();
                this.update_settings({ "seek.time": t });
                this.emit("seek-start", {time:t});
            },
            move: (e)=>{
                t = this.ticks_bar.parse_event(e).time;
                this.update_settings({ "seek.time": t });
                this.emit("seeking", {time:t});
            },
            end: (e)=>{
                t = this.ticks_bar.parse_event(e).time;
                this.update_settings({ "seek.time": t });
                this.emit("seek-end", {time:t});
            }
        });

        var curr_marker, moving_curr_marker, curr_marker_start_x;
        var marker_listener = new dom_utils.TouchListener(this.seek_elem, {
            start: (e)=>{
                this.seek_elem.focus();
                var data = this.ticks_bar.parse_event(e);
                curr_marker_start_x = data.pt.x;
                curr_marker = null;
                moving_curr_marker = false;
                var marker_elem = e.target.closest(".marker");
                if (marker_elem) {
                    curr_marker = this._markers.find(m=>m.id == marker_elem.dataset.id);
                }
                if (!curr_marker) {
                    curr_marker = this.add_marker(data.time);
                    if (curr_marker) {
                        moving_curr_marker = true;
                        this.emit("markers-change");
                    }
                }
            },
            move: (e)=>{
                var m = this.ticks_bar.parse_event(e);
                if (curr_marker_start_x != null && Math.abs(curr_marker_start_x-m.pt.x)>8) {
                    curr_marker_start_x = null;
                    moving_curr_marker = true;
                }
                if (moving_curr_marker) {
                    curr_marker.time = m.time;
                    this.emit("markers-change");
                    this.update();
                }
            },
            end: (e)=>{
                if (curr_marker && !moving_curr_marker) {
                    this.remove_marker(curr_marker);
                    this.emit("markers-change");
                }
                curr_marker = null;
                moving_curr_marker = false;
            }
        });
        
        this.time_left_elem.style.cursor = "pointer";
        this.time_left_elem.addEventListener("click", ()=>{
            var time_left_mode = (this.get_setting("seek.time_left_mode")+1) % 2;
            this.emit("time_left_mode", time_left_mode);
        });

        this.on("render", ()=>{
            var duration = this._duration;
            var ranges = this._ranges;
            var markers = this._markers;
            var chapters = this._chapters;
            var show_times = this._show_times;
            var show_markers = this._show_markers;
            var time_left_mode = this._time_left_mode;
            
            set_attribute(this.time_left_elem, "title", time_left_mode == 0 ? "Time Left" : "Duration");

            var time = this._time;
            var time_left = duration ? (duration - time) : 0;
            var time_percent = (time / duration) || 0;
            if (!Number.isFinite(time_percent)) time_percent = 0;
            this.bar_elem.style.width = `${time_percent*100}%`;

            this.time_elem.style.display = show_times ? "" : "none";
            this.time_left_elem.style.display = show_times ? "" : "none";

            toggle_attribute(this.seek_elem, "disabled", !this._seekable)
            this.elem.style.cursor = show_markers ? "copy" : "";
            toggle_class(this.bar_elem, "d-none", show_markers);
            this.markers_elem.style.display = show_markers ? "" : "none";
            // toggle_class(this.input, "d-none", _show_markers);

            var ranges_hash = JSON.stringify([duration, ranges]);
            if (this._ranges_hash != ranges_hash) {
                this._ranges_hash = ranges_hash;
                dom_utils.empty(this.ranges_elem);
                if (duration && ranges) {
                    for (var r of ranges) {
                        var e = $(`<div class="range"></div>`)[0];
                        e.style.left = `${r.start / duration * 100}%`;
                        e.style.width = `${(r.end - r.start) / duration * 100}%`;
                        this.ranges_elem.appendChild(e);
                    }
                }
            }

            toggle_class(this.seek_elem, "buffering", this._buffering);

            var markers_hash = JSON.stringify([markers, duration]);
            if (this._markers_hash != markers_hash) {
                this._markers_hash = markers_hash;
                dom_utils.empty(this.markers_elem);
                if (duration) {
                    for (var m of markers) {
                        var e = $(`<div class="marker"><div></div></div>`)[0];
                        e.style.left = `${m.time/duration*100}%`;
                        e.dataset.id = m.id;
                        this.markers_elem.appendChild(e);
                    }
                }
            }

            var chapters_hash = JSON.stringify([chapters, duration]);
            if (this._chapters_hash != chapters_hash) {
                this._chapters_hash = chapters_hash;
                dom_utils.empty(this.chapters_elem);
                if (duration && chapters.length > 1) {
                    chapters.forEach((c,i)=>{
                        var d = Math.max(0, c.end-c.start);
                        var e = $(`<div class="chapter"></div>`)[0];
                        e.style.left = `${c.start / duration*100}%`;
                        e.style.width = `${d / duration*100}%`;
                        set_style_property(e, "z-index", i+1);
                        e.dataset.index =  c.index;
                        this.chapters_elem.appendChild(e);
                    });
                }
            }

            this.ticks_bar.update(0, duration);

            set_text(this.time_elem, `${utils.seconds_to_timespan_str(time, app.user_time_format)}`);
            var time_left_str = "";
            if (time_left_mode === TimeLeftMode.TIME_LEFT) time_left_str = `-${utils.seconds_to_timespan_str(Math.max(0, time_left), app.user_time_format)}`;
            else if (time_left_mode === TimeLeftMode.DURATION) time_left_str = utils.seconds_to_timespan_str(Math.max(0, duration), app.user_time_format)
            set_text(this.time_left_elem, time_left_str);
        });

        this.on("destroy", ()=>{
            hover_listener.destroy();
            seek_listener.destroy();
        })
    }
    clear_markers() {
        this.update_settings({"seek.markers": []});
    }
    add_marker(t) {
        if (!this._marker_id) this._marker_id = 0;
        var markers = this.get_setting("seek.markers");
        if (markers.length > 128) return;
        var marker = {time:t, id:++this._marker_id};
        markers.push(marker);
        this.update_settings({"seek.markers": markers});
        return marker;
    }
    remove_marker(m) {
        var markers = this.get_setting("seek.markers");
        utils.array_remove(markers, m);
        this.update_settings({"seek.markers": markers});
    }
}
export class MediaSeekBar extends SeekBar {
    constructor() {
        super();
    
        var seeking = false, seek_time = 0, last_seek_time, seek_end_timeout, seeking_interval;
        this.on("seek-start", (e)=>{
            seek_time = e.time;
            clearTimeout(seek_end_timeout);
            seeking = true;
            seeking_interval = setInterval(()=>{
                if (seek_time != last_seek_time && app.media.do_live_seek) {
                    app.seek(seek_time);
                    last_seek_time = seek_time;
                }
            }, 100);
        });
        this.on("seeking", (e)=>{
            seek_time = e.time;
        });
        this.on("seek-end", (e)=>{
            seek_time = e.time;
            clearInterval(seeking_interval);
            seek_end_timeout = setTimeout(()=>{
                seeking = false;
            }, 500);
            if (seek_time != last_seek_time) {
                app.seek(seek_time)
            }
        });
        this.on("time_left_mode", (v)=>{
            app.settings.set("time_left_mode", v);
        });
        var update_time_left_mode = ()=>{
            this.update_settings({
                "seek.time_left_mode": app.settings.get("time_left_mode")
            });
        };
        app.settings.on("change", (e)=>{
            if (e.name === "time_left_mode") update_time_left_mode();
        });
        update_time_left_mode();
        this.on("pre_update", ()=>{
            Object.assign(this.settings, {
                "seek.time": seeking ? seek_time : app.media.time,
                "seek.seekable": app.media.seekable,
                "seek.duration": app.media.duration,
                "seek.chapters": app.media.chapters,
                "seek.ranges": app.media.ranges,
                "seek.buffering": app.media.buffering,
            });
        });
    }
}

export class StreamKeyGeneratorSettings extends UI.PropertyContainer {
    constructor() {
        super({});

        this.elem.style.gap = "var(--gap)";

        this.stream_name = new UI.Property(null, "Name", `<input type="text">`, {
            "default": ()=>`${app.$._client.username}'s Stream`,
            "info": "This must be a unique name to identify your stream."
        });
        // stream_name.input_modifiers.push((s)=>s.replace(/\W+/g, " ").trim().split(/\s+/).join("-"));
        this.stream_name.on("change", e=>localStorage.setItem("obs_id", String(e._value)));
        var saved_id = localStorage.getItem("obs_id");
        if (saved_id) this.stream_name.set_value(saved_id)

        /* var regenerate_button = new UI.Button(`<i class="fas fa-sync-alt"></i>`, {
            "click":()=>stream_name.set_value(dom_utils.uuidb64()),
            "title": "Generate ID",
        }); */
        // stream_name.inner.append(regenerate_button);
        this.stream_name.add_validator(UI.VALIDATORS.not_empty);
        this.append(this.stream_name);

        this.stream_targets = new TargetsProperty(null, "Stream Target(s)", {
            "show_in_use":false,
            "flex":1,
        });
        this.stream_targets.add_validator(v=>(!v || v.length == 0) ? "No targets selected" : true);
        this.append(this.stream_targets)

        this.volume_normalization = new UI.Property(null, "Volume Normalization", `<select>`, {
            "options":[[0,"Off"],[1,"On"]],
            "default": 0,
            "info": "This will enable an audio post-processor that will apply volume normalization to the stream."
        });
        this.append(this.volume_normalization);

        this.append(new UI.Separator());

        this.output_host = new UI.Property(null, "Stream Host", `<input type="text" readonly>`, {
            "default": "",
            "copy":true,
            "reset": false,
            "disabled":()=>!this.valid
        });
        this.append(this.output_host)

        this.output_key = new UI.Property(null, "Stream Key", `<input type="text" readonly>`, {
            "default": "",
            "copy":true,
            "reset": false,
            "disabled":()=>!this.valid
        });
        this.append(this.output_key)
        this.output_key.add_validator(v=>this.stream_targets.value == 0 ? "Invalid targets" : true);

        var update_output = ()=>{
            var name = this.stream_name.value.trim();
            var params = new URLSearchParams();
            params.set("targets", this.stream_targets.value.join(","));
            params.set("name", name)
            if (this.volume_normalization.value) params.set("volume-normalization", 1);
            var query_str = params.toString();
            var host = app.get_rtmp_url();
            this.output_host.set_values(host);
            var key = `livestream/${app.$._client.username}`;
            if (query_str) key += "?"+query_str;
            this.output_key.set_values(key);
        };

        var debounced_update_output = dom_utils.debounce_next_frame(()=>update_output());
        this.on("property-change",(e)=>{
            if (!e.trigger) return;
            debounced_update_output();
        });
        update_output();
    }
}
export class StreamConfigurationMenu extends ModalPropertyContainer {
    constructor(){
        super({
            "modal.title": "Stream Configuration",
            data:()=>app.$._stream,
        });
        var title_ui = new UI.Property("title", "Stream Title", `<input type="text">`, {
            // "reset": false
        });
        this.content.append(title_ui);
        
        var stream_targets = new TargetsProperty("targets", "Stream Target(s)", {
            "hidden": ()=>app.$._stream.method != "rtmp",
            "auto_apply": false,
        });
        stream_targets.add_validator(v=>(!v || v.length == 0) ? "No targets selected" : true);
        this.content.append(stream_targets);

        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.request({
                call: ["session", "stream", "update_values"],
                arguments: [[e.name, e._value]]
            });
        })
    }
}
export class HandoverSessionMenu extends ModalPropertyContainer {
    constructor(){
        super({
            "modal.title": "Handover Session",
            "modal.footer": true,
        });
        var row = this.content.append(new UI.FlexRow());
        var handover_stream_property = new UI.Property(null, "Session", `<select>`, {
            "options":()=>app.get_handover_sessions_options(),
            "reset":false,
            "info":"To seamlessly hand off to another session, select the session in the dropdown and click OK. Without interruption, the livestream will immediately start playing from the current playlist position in the selected stream."
        })
        row.append(handover_stream_property);
        this.footer_elem.append(new UI.Button("OK", {
            disabled: ()=>!handover_stream_property.value,
            click: ()=>{
                this.hide();
                app.request({
                    call: ["session", "handover"],
                    arguments: [handover_stream_property.value]
                });
            }
        }));
    }
}
export class SavePlaylistSettings extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": ()=>`Save Playlist '<span>${playlist_name}</span>'`,
            "modal.title-overflow": true,
            "modal.footer": true,
            data: ()=>app.settings.get("save_playlist_settings"),
        });
        
        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set("save_playlist_settings", this.named_property_lookup_not_null);
        });

        var playlist_name, filename;
        
        var row = this.content.append(new UI.FlexRow());
        this.playlist_save_file = new UI.Property("playlist-save-file", "Filename", `<input type="text">`,{
            flex: 2,
            "default": ()=>filename,
        });
        this.playlist_save_file.add_validator(UI.VALIDATORS.not_empty);
        row.append(this.playlist_save_file);

        this.playlist_save_format = new UI.Property("playlist-save-format", "Format", `<select></select>`,{
            "default": "json",
            "options": [["json","JSON"],["text","Simple Text"]],
            "hidden":true,
        });
        row.append(this.playlist_save_format);

        this.playlist_save_children = new UI.Property("playlist-save-children", "Include Nested Playlists", `<select></select>`,{
            "default": true,
            "options": YES_OR_NO,
        });
        row.append(this.playlist_save_children);

        this.playlist_json_spaces = new UI.Property("playlist-json-spaces", "JSON spaces", `<input type="number" min="0" max="10">`,{
            "default": 2,
            "hidden":()=>this.playlist_save_format.value!="json"
        });
        row.append(this.playlist_json_spaces);

        var row = this.content.append(new UI.FlexRow());
        this.playlist_save_dir = new FileProperty("playlist-save-dir", "Remote Save Directory", {
            "file.options": { folders: true },
            "default": "",
            "invalid_class": null,
        });
        this.playlist_save_dir.add_validator(UI.VALIDATORS.not_empty);
        row.append(this.playlist_save_dir);
        
        var save_remote_button = new UI.Button(`Save (Remote)`, {
            flex: 0,
            disabled:()=>!this.valid,
            click: ()=>{
                app.request({
                    call: ["save_file"],
                    arguments: [this.playlist_save_dir.value, this.playlist_save_file.value, serialize()]
                });
                this.hide();
            }
        });
        save_remote_button.elem.style.flex = "0"
        row.append(save_remote_button);

        var row = this.content.append(new UI.FlexRow());
        var last_hash;
        
        this.preview = new UI.Property(null, "Preview", `<div class="text-block"></div>`, {
            "update":()=>{
                var hash = JSON.stringify([app.playlist.current.id, ...[this.playlist_save_format, this.playlist_save_children, this.playlist_json_spaces].map(p=>p.value)]);
                if (hash != last_hash) render_preview();
                last_hash = hash;
            },
            "reset":false,
        });
        row.append(this.preview);

        var serialize = ()=>{
            if (this.playlist_save_format.value != "json") return;
            /** @param {PlaylistItem} item */
            var process = (item)=>{
                var o = {filename: item.filename};
                if (!utils.is_empty(item.props)) o.props = item.props;
                var children = item._children;
                if (this.playlist_save_children.value && children.length) {
                    o.children = children.map(c=>process(c));
                }
                return o;
            }
            var items = app.playlist.current._children.map(i=>process(i));
            var json = JSON.stringify(items, null, this.playlist_json_spaces.value ? " ".repeat(this.playlist_json_spaces.value) : undefined);
            return "// livestreamer playlist\n" + json;
        }

        var save_local_button = new UI.Button(`Save (Local)`, {
            click: async ()=>{
                if (await save_local_file(this.playlist_save_file.value+"."+this.playlist_save_format.value, serialize())) this.hide();
            }
        });
        this.cancel = new UI.Button("Cancel", {
            click: ()=>this.hide()
        });
        this.footer_elem.append(save_local_button, this.cancel)

        this.on("show", ()=>{
            playlist_name = app.playlist.current._get_pretty_name() || app.$._session.name;
            filename = `${utils.sanitize_filename(playlist_name)}-${utils.date_to_string()}.json`;
            render_preview();
        });

        var render_preview = ()=>{
            this.preview.content.innerText = serialize();
        }

        /* this.on("update", ()=>{
            this.playlist_save_format
        }) */
    }
}

export class HistorySettings extends ModalPropertyContainer {
    history = [];
    constructor() {
        super({
            "modal.min-width": "900px"
        });
        add_class(this.content.elem, "autosave-history");
        var table_data = {
            "Time":(data)=>{
                var mtime = new Date(data.mtime);
                var e = $(`<span>${utils.time_diff_readable(new Date(), mtime)}</span>`)[0];
                set_attribute(e, "title", mtime.toLocaleString());
                return e;
            },
            "Current Changes":(data)=>{
                return data.curr.length.toLocaleString();
            },
            "Previous Changes":(data)=>{
                if (!data.prev) return "-";
                return data.prev.length.toLocaleString();
            },
        };
        var row = this.content.append(new UI.FlexRow());
        var table_wrapper = $(`<div class="table-wrapper thin-scrollbar"></div>`)[0];
        var table = $(`<table><thead></thead><tbody></tbody></table>`)[0];
        var thead = table.querySelector("thead");
        var thead_tr = $(`<tr></tr>`)[0];
        var tbody = table.querySelector("tbody");
        Object.keys(table_data).forEach(k=>{
            $(thead_tr).append(`<th>${k}</th>`);
        });
        thead.append(thead_tr);
        var table_col = row.append(new UI.Column());
        table_wrapper.append(table);
        table_col.append(table_wrapper);
        
        var info_col = row.append(new UI.Column());
        var info_wrapper_elem = $(`<div class="info-wrapper"></div>`)[0];
        var info_elem = $(`<div class="info thin-scrollbar"></div>`)[0];
        info_wrapper_elem.append(info_elem);
        var info_footer_elem = $(`<div class="footer"></div>`)[0];
        info_wrapper_elem.append(info_footer_elem);
        info_col.append(info_wrapper_elem)
        
        var loading = false;
        this.load_button = new UI.Button("Load", {
            click:async ()=>{
                loading = true;
                await app.request({
                    call: ["session","client_load_autosave"],
                    arguments: [this.history[this.selectable_list.selected_index].filename]
                });
                loading = false;
                this.hide();
            },
            "disabled":()=>!this.selectable_list.selected && !loading,
        });
        info_footer_elem.append(this.load_button)
        this.selectable_list = new SelectableList(tbody, {
            "selector":"tr",
        });
        this.selectable_list.on("change", (item, i)=>{
            var data = this.history[i];
            dom_utils.empty(info_elem);

            if (!data) return;
            // var diff_type_to_str = ["-", "created", "deleted", "changed"]
            // ${diff_type_to_str[v[0]]}
            for (var k of ["curr", "prev"]) {
                var entries = data[k];
                var title = k == "prev" ? "Previous Changes" : "Current Changes"
                var box = $(`<div><h3>${title}</h3><ul></ul></div>`)[0];
                info_elem.append(box);
                var ul = box.querySelector("ul");
                if (!entries || entries.length == 0) {
                    $(ul).append(`<li>No changes.</li>`);
                } else {
                    entries.forEach(([path,v])=>{
                        // path = path.map(p=>p.replace(/^_+/,""));
                        if (path[0] == "player") path.shift();
                        var from = (typeof v[2] === "object" && v[2] !== null) ? "Object" : v[2];
                        var to = (typeof v[1] === "object" && v[1] !== null) ? "Object" : v[1];
                        $(ul).append(`<li><i>[${path.join("•")}]</i>\n<strong>(${from}) => (${to})</strong></li>`);
                    });
                }
            }
        });

        this.on("show", async ()=>{
            this.selectable_list.select(null);
            dom_utils.empty(tbody);

            this.update_settings({"modal.title": `History [Fetching...]`});

            this.history = await app.request({
                call: ["session","get_autosave_history"],
            });
            
            this.history.forEach((data)=>{
                var values = Object.values(table_data).map(d=>d(data));
                var tr = $(`<tr></tr>`)[0];
                tr.dataset.filename = data.filename;
                for (var v of values) {
                    var td = $(`<td></td>`)[0];
                    $(td).append(v);
                    tr.append(td);
                }
                tbody.append(tr);
            });
            this.update_settings({"modal.title": `History [${this.history.length}]`});
        });
    }

    destroy() {
        super.destroy();
        this.selectable_list.destroy();
    }
}

export class PlaylistAddURLMenu extends ModalPropertyContainer {
    constructor() {
        super({
            "modal.title": "Add URLs to Playlist",
            "modal.footer":true,
        });
        var urls = new UI.Property(null, "URLs", `<textarea style="height:180px;white-space:pre"></textarea>`, {
            "info": "To enter multiple URLs seperate each one with a new line.",
            "placeholder": [
                `https://www.youtube.com/watch?v=1234567890`,
                `https://www.youtube.com/watch?v=vJX7FPhMJPw&list=PL6C81E659279FE5DA&index=1`,
                `https://vimeo.com/123456789`,
                `https://www.bbc.co.uk/iplayer/episodes/12345678/show`,
                `https://archive.org/details/ALTVComplete/Al+Music+1.mp4`,
                `https://website.com/direct/link/to/video.mp4`,
                `etc...`,
            ].join("\n"),
            "reset":false,
        })
        var row = this.content.append(new UI.FlexRow());
        row.append(urls);

        var row = this.content.append(new UI.FlexRow());
        row.append(...$(`<span>If you're having problems downloading some media it might be due to geo-blocking in the server's locale, try <a href="https://oleksis.github.io/youtube-dl-gui/" target="_blank">yt-dlg</a> to download the media in your locale and upload to the server.</span>`));

        var ok_button = new UI.Button("OK", {
            disabled: ()=>!urls.value,
            click: ()=>{
                this.resolve(urls.value);
                urls.set_value("", {trigger:false});
                this.hide();
            }
        })
        this.footer_elem.append(ok_button)
        var cancel_button = new UI.Button("Cancel", {
            click: ()=>{
                this.resolve(null);
                this.hide();
            }
        })
        this.footer_elem.append(cancel_button)
        this.on("hide", ()=>this.resolve(null));
    }
    show(resolve) {
        this.resolve = resolve;
        super.show();
    }
};

export const MediaSettingsMode = {
    "current": "current",
    "all": "all",
}
export class PlaylistModifySettings extends ModalPropertyContainer {
    /** @param {PlaylistItem[]} items */
    show(items, new_type) {
        this._new_type = new_type;
        this._saved = false;
        super.show(items);
    }

    hide(saved=false) {
        this._saved = saved;
        super.hide();
    }

    get is_new() {
        this.data === NULL_PLAYLIST_ITEM;
    }

    get changes() {
        return super.changes.filter(k=>k!=this.interface.label.id&&k!=this.interface.color.id);
    }

    constructor() {
        super({
            nullify_defaults: true,
            "modal.close": ()=>{
                if (!this._saved && this.is_new && !IS_ELECTRON) return window.confirm("The new item will not be saved. Continue?");
                if (app.$._session._is_running && this.datas.some(d=>d === app.$._session._current_playing_item) && this.changes.length) {
                    app.prompt_for_reload_of_current_item();
                }
                return true
            },
            "modal.title": function() {
                if (this.is_new) return `Add [${this._new_type}]`;
                return `Modify '<span>${PlaylistItem.get_items_title(this.datas)}</span>'`;
            },
            "modal.title-overflow": true,
            "modal.footer":true,
        });
        
        this.datas = [NULL_PLAYLIST_ITEM];

        this.footer_elem.append(
            this.save_button = new UI.Button("Save", {
                hidden:()=>!!this.data,
                disabled:()=>!this.valid,
                click:()=>{
                    app.playlist_add({
                        filename: `livestreamer://${this._new_type}`,
                        props: this.named_property_lookup_not_null
                    });
                    this.hide(true);
                }
            }),
            this.reset_button = new UI.Button("Reset", {
                // necessary to remove possibly unused playlist_props vars (instead of running this.reset() which only removes the recognized props).
                // hidden:()=>this.is_new,
                click:()=>{
                    if (this.is_new) {
                        this.reset();
                    } else {
                        app.$._push(...this.datas.map(data=>[`sessions/${app.$._session.id}/playlist/${data.id}/props`,{[Observer.RESET_KEY]:"Object"}]));
                        // this.datas.forEach(data=>app.$._session.playlist[data.id].props = {});
                        app.request({
                            // call: ["session", "clear_playlist_props"],
                            // arguments: this.datas.map(data=>data.id)
                            call: ["session", "update_values"],
                            arguments: this.datas.map(data=>[`playlist/${data.id}/props`, {}])
                        });
                    }
                }
            })
        );

        this.on("property-change", (e)=>{
            if (this.is_new) return;
            if (e.name && e.trigger) {
                app.playlist_update(e.datas.map(data=>[`${data.id}/${e.name}`, e._value]));
                update_layout_next_frame();
            }
        });

        this.on("show", ()=>{
            update_layout();
        });

        this.interface = new MediaSettingsInterface(this);
        // this.register_properties(...Object.values(this.interface).filter(p=>p instanceof UI.Property))

        var update_layout = ()=>{
            this.content.update_layout(this.interface.get_layout());
        }
        var update_layout_next_frame = dom_utils.debounce_next_frame(()=>update_layout());
    }
}

export class MediaSettingsInterface {
    get is_parent_modify() { return this.parent instanceof PlaylistModifySettings }
    /** @param {UI.PropertyContainer} parent */
    constructor(parent) {
        this.parent = parent;
        var _this = this;

        let stream_to_text = (s,i,d)=>{
            if (!s) return "None";
            var parts = [];
            var prefix = (i === undefined) ? "" : `${i+1}. `;
            parts.push(`${prefix}${s.title||"Untitled"}`);
            if (s.language) parts.push(s.language);
            if (d) parts.push("default")
            return parts.join(" | ")
        }

        let is_item_playing = (item)=>{
            item = item ?? app.$._session._current_playing_item;
            return app.$._session._is_running && item.id == app.$._session._current_playing_item.id;
        }

        /** @param {PlaylistItem} item @param {string} type */
        let get_stream_options = (item, type)=>{
            item = item ?? app.$._session._current_playing_item;
            var is_playing = is_item_playing(item);
            var streams = get_streams(item, type);
            let stream_to_option = (s,i)=>{
                return {value: i+1, text: stream_to_text(s,i,s==default_stream) };
            };
            let default_stream = utils.get_default_stream(streams, type);
            let indeterminate_option = {value:"", text:"-", hidden:true};
            var options = []
            options.push(indeterminate_option);
            var id_key = type.slice(0,1)+"id_auto";
            /* if (is_playing && app.$._stream.mpv.props[id_key] === "generated") {
                indeterminate_option.text = "Generated";
            } else { */
            if (is_playing) {
                default_stream = streams[app.$._stream.mpv.props[id_key]-1] || default_stream;
            }
            var auto_text = "Auto";
            if (!this.is_parent_modify) auto_text = `${auto_text} [${stream_to_text(default_stream)}]`;
            options.push({value:null, text:auto_text});
            options.push({value:false, text:"None"}, ...streams.map(stream_to_option));
            // }
            if (options.length == 1 && options[0] === indeterminate_option) {
                indeterminate_option.hidden = false;
            }
            return options;
        };
        let get_streams = (item, type)=>{
            var streams;
            item = item ?? app.$._session._current_playing_item;
            let mi = item._media_info;
            streams = mi ? mi.streams : null;
            if (is_item_playing(item)) {
                streams = app.$._stream.mpv.streams;
            }
            if (!streams) streams = [];
            if (type) streams = streams.filter(s=>s.type == type);
            return streams;
        };

        let prop_name = (name)=>{
            if (this.is_parent_modify) return `props/${name}`;
            return name;
        }

        /* let get_current_streams = (type)=>{
            var streams = [];
            var track_list = app.$.stream.mpv.props["track-list"] || EMPTY_ARRAY;
            if (track_list.length > 0 && !this.is_parent_modify) {
                streams = track_list.map(t=>({
                    type: (t.type === "sub") ? "subtitle" : t.type,
                    default: t.default,
                    forced: t.forced,
                    language: t.lang,
                    title: t.title,
                }));
            }
            if (type) streams = streams.filter(s=>s.type == type);
            return streams;
        }; */
        
        // var nullify = (v)=>v===undefined?null:v;
        let get_default = function() {
            var value;
            var name = this.name.split("/").pop();
            /* if (parent._mode === MediaSettingsMode.current) {
                if (_this.is_parent_modify) {
                    value = utils.get(app.$.session.player_default_override, name);
                } else {
                    value = utils.get(app.$.session.current_playing_item.props, name);
                }
            } */
            /* if (value === undefined && parent._mode === MediaSettingsMode.current) {
                value = utils.try(()=>app.$.session.current_playing_item.props[name]);
            } */
            if (_this.is_parent_modify || parent._mode === MediaSettingsMode.current) {
                value = utils.get(app.$._session.player_default_override, name);
            }
            if (value === undefined) {
                value = utils.try(()=>app.$.properties.playlist.__enumerable__[name].__default__);
            }
            if (value === undefined) {
                // value = utils.try(()=>app.get_property("player_default_override", name).__default__);
            }
            if (value === undefined) value = null;
            return value;
        }
        
        let get_options = function(){
            var options;
            var name = this.name.split("/").pop();
            if (_this.is_parent_modify) {
                options = utils.try(()=>app.get_property(`playlist/*/props/${name}`).__options__);
            }
            if (options === undefined) {
                options = utils.try(()=>app.$.properties.player_default_override[name].__options__);
            }
            return options || [];
        };

        this.aspect_ratio = new UI.Property(prop_name("aspect_ratio"), "Aspect Ratio", `<select></select>`, {
            "options": [[-1,"Default"],  [1.777778,"16:9"], [1.333333,"4:3"], [2.35,"2.35:1"]],
            "default": get_default,
        });

        this.deinterlace = new UI.Property(prop_name("deinterlace_mode"), "Deinterlace", `<select></select>`, {
            "options": [["auto","Auto"],[false, "Off"],[true, "On"]],
            "default": get_default,
        });

        this.aid_override = new UI.Property(prop_name("aid_override"), "Audio Track", `<select></select>`, {
            // "nullify_defaults": ()=>!app.$._session._is_running,
            "options": (item)=>{
                return get_stream_options(item, "audio")
            },
            "default": get_default,
            "disabled": ()=>parent._mode === MediaSettingsMode.all,
        });
       
        this.audio_delay = new UI.TimeSpanProperty(prop_name("audio_delay"), "Audio Delay (Seconds)", {
            "step":0.05,
            "timespan.format": "s.SSS",
            "default": get_default,
        });
        
        this.audio_channels = new UI.Property(prop_name("audio_channels"), "Audio Channels", `<select></select>`, {
            "default": get_default,
            "options":()=>[["left", "Left → Mono"],["right", "Right → Mono"],["mix", "L + R → Mono"],["stereo", "Stereo"]],
        });
        
        this.sid_override = new UI.Property(prop_name("sid_override"), "Subtitle Track", `<select></select>`, {
            // "nullify_defaults": ()=>!app.$._session._is_running,
            "options": (item)=>{
                return get_stream_options(item, "subtitle")
            },
            "default": get_default,
            "disabled": ()=>parent._mode === MediaSettingsMode.all,
        });

        this.subtitle_delay = new UI.Property(prop_name("sub_delay"), "Subtitle Delay", `<div class="input-wrapper suffix number secs"><input type="number" step="0.05"></div>`, {
            "precision":3,
            "default": get_default,
        });
        this.subtitle_delay.output_modifiers.push((v)=>Number(v).toFixed(2));
        
        this.subtitle_scale = new UI.Property(prop_name("sub_scale"), "Subtitle Scale (%)", `<input type="number" step="1">`, {
            "precision":2,
            "default": get_default,
        });
        this.subtitle_scale.input_modifiers.push((v)=>+v/100);
        this.subtitle_scale.output_modifiers.push((v)=>Math.round(+v*100));

        this.subtitle_pos = new UI.Property(prop_name("sub_pos"), "Subtitle Position (%)", `<input type="number" step="1">`, {
            "precision":2,
            "default": get_default,
        });
        this.subtitle_pos.output_modifiers.push((v)=>Math.round(+v));

        this.playback_speed = new UI.Property(prop_name("speed"), "Playback Speed", `<input type="number" step="0.05">`, {
            "precision":2,
            "default": get_default,
            "hidden": ()=>!app.$._stream.method != "gui"
        });
        this.playback_speed.output_modifiers.push((v)=>Number(v).toFixed(2));
        this.pitch_correction = new UI.Property(prop_name("audio_pitch_correction"), "Audio Pitch Correction", `<select></select>`, {
            "options": [[false, "Off"],[true, "On"]],
            "default": get_default,
            "hidden": ()=>!app.$._stream.method != "gui"
        });
        
        this.volume_normalization = new UI.Property(prop_name("volume_normalization"), "Volume Normalization", `<select></select>`, {
            "options":()=>{
                return [[false,"Off"], ...(utils.try(()=>app.$.properties.player_default_override.volume_normalization.__options__)||EMPTY_ARRAY).map(([f,_])=>[f,f])]
            },
            "default": get_default,
        });
        
        this.volume_multiplier = new UI.Property(prop_name("volume_multiplier"), "Volume Multiplier (%)", `<input type="number" step="5" min="0" max="200">`, {
            "round":0.05,
            "precision":2,
            "default": 1,
        });
        this.volume_multiplier.input_modifiers.push((v)=>v/100);
        this.volume_multiplier.output_modifiers.push((v)=>Math.round(v*100).toString());
        
        this.audio_visualization = new UI.Property(prop_name("audio_visualization"), "Audio Visualization", `<select></select>`, {
            "options":()=>{
                return [[false,"None"], ["waveform","Waveform"]];
            },
            "default": get_default,
        });

        // this.fps = new UI.Property(prop_name("force_fps"), "Frame Rate", `<select></select>`, {
        //     "options": get_options,
        //     "default": get_default,
        // });

        this.loop = new UI.Property(prop_name("loop_file"), "Loop", `<select></select>`, {
            "options": [[false, "Off"],["inf", "On"]],
            "default": get_default,
        });

        if (this.is_parent_modify) {

            /** @param {PlaylistItem} item */
            let default_duration = (item)=>{
                return (item || parent.data)._userdata.media_duration;
            };
            
            this.filename = new UI.Property("filename", "File URI", `<input type="text">`, {
                default: "",
                nullify_defaults: false,
                reset: false,
                info: "A single wrong character will invalidate the file URI, edit with care."
            });
            this.filename.add_validator(UI.VALIDATORS.not_empty);
            this.filename.add_validator(UI.VALIDATORS.media_exists);

            this.playlist_mode = new UI.Property(prop_name("playlist_mode"), "Playlist Mode", `<select>`, {
                "info": `Setting to 'Merged' or '2-Track', the media player will attempt to merge the playlist's contents as if it were a single file, with each item represented as a chapter. A merged playlist may only include local files (ie, no URIs or special items).`,
                "options": get_options,
                "default": get_default,
            });

            this.playlist_end_on_shortest_track = new UI.Property(prop_name("playlist_end_on_shortest_track"), "End Playlist on Shortest Track", `<select>`, {
                "info": `Enabling sets the item to end when the track with the shortest duration ends. Disabling will pad the shortest track to match the duration of the longer track.`,
                "options": ()=>{
                    return [[false, "Off"], [true, "On"]];
                },
                "hidden": (item)=>item.props.playlist_mode != PLAYLIST_MODE.DUAL_TRACK,
                "default": get_default,
            });

            this.playlist_revert_to_video_track_audio = new UI.Property(prop_name("playlist_revert_to_video_track_audio"), "Revert to Video Track Audio", `<select>`, {
                "info": `If the audio track is shorter than the video track, revert to the audio supplied in the video track.`,
                "options": ()=>{
                    return [[false, "Off"], [true, "On"]];
                },
                "disabled": (item)=>item.props.playlist_end_on_shortest_track,
                "hidden": (item)=>item.props.playlist_mode != PLAYLIST_MODE.DUAL_TRACK,
                "default": get_default,
            });

            var clip_mode = 1;

            this.clip_start = new UI.TimeSpanProperty(prop_name("clip_start"), "Clip Start", {
                "timespan.format": "h:mm:ss.SSS",
                "min": 0,
                "max": default_duration,
                "default": 0,
            })

            this.clip_end = new UI.TimeSpanProperty(prop_name("clip_end"), null, {
                "label": ()=>dom_utils.is_visible(this.clip_start.elem) ? "Clip End" : "Duration",
                "timespan.format": "h:mm:ss.SSS",
                "min": 0,
                "max": default_duration,
                "default": default_duration,
            });

            this.clip_length = new UI.TimeSpanProperty(null, "Clip Length", {
                "timespan.format": "h:mm:ss.SSS",
                "reset": false,
                // "max":default_duration,
                "spinner": false,
                "readonly": true,
                "disabled": true,
            });

            var get_clip_length = ()=>{
                return this.clip_end.value - this.clip_start.value;
            };

            this.clip_offset = new UI.TimeSpanProperty(prop_name("clip_offset"), "Clip Offset", {
                "timespan.format": "h:mm:ss.SSS",
                "default": 0,
                "min": ()=>-get_clip_length(),
                "max": ()=>get_clip_length(),
            });

            this.clip_loops = new UI.Property(clip_mode == 0 ? prop_name("clip_loops") : null, "Clip Loops", `<input type="number">`, {
                "min": 0,
                "step": 1,
                "precision":8,
                "default": 1,
            });
            // this.clip_loops.output_modifiers.push(v=>v.toFixed(6).replace(/0+$/, ""));

            this.clip_duration = new UI.TimeSpanProperty(clip_mode == 1 ? prop_name("clip_duration") : null, "Duration", {
                "min":0,
                // "info": ()=>clip_mode==0?`${this.clip_length.input.value} × ${this.clip_loops.value.toFixed(3)}`:null,
                "timespan.zero_infinity": ()=>this.override_default_duration!=null,
                "timespan.format": "h:mm:ss.SSS",
                "default":()=>this.override_default_duration==null?(this.clip_end.value-this.clip_start.value):this.override_default_duration,
            });

            this.clip_length.on("change", (e)=>{
                if (e.trigger) {
                    this.clip_end.set_value(this.clip_start.value + e.value, {trigger:true});
                }
            });

            var update_durations = (e)=>{
                var d = get_clip_length();
                this.clip_length.set_value(d);
                // this.clip_offset.set_value(this.clip_offset.value);
                if (clip_mode == 0) {
                    this.clip_duration.set_value(d * this.clip_loops.value);
                    // this.clip_loops.update()
                } else {
                    var l = this.clip_duration.value / d;
                    this.clip_loops.set_value(Number.isFinite(l) ? l : 0);
                    this.clip_duration.update();
                }
            }

            parent.on("show", ()=>update_durations());
            this.clip_start.on("change", update_durations);
            this.clip_end.on("change", update_durations);
            if (clip_mode == 0) {
                this.clip_loops.on("change", update_durations);
                this.clip_duration.on("change", (e)=>{
                    if (e.trigger) this.clip_loops.set_value((e.value / (this.clip_end.value - this.clip_start.value)), {trigger:true});
                })
            } else {
                this.clip_duration.on("change", update_durations);
                this.clip_loops.on("change", (e)=>{
                    if (e.trigger) this.clip_duration.set_value((e.value * (this.clip_end.value - this.clip_start.value)), {trigger:true});
                })
            }

            this.start_end_time_range = new RangeProperty(null, null, {
                "min": 0,
                "max": ()=>default_duration(),
                "step": 0.001,
                "default": (item)=>[0, default_duration(item)],
                "hidden": ()=>!default_duration(),
                "reset": false,
                "title": `Clip Range`,
            });
            var on_change =(e)=>{
                // console.log("ON CHANGE", e, this.clip_start.value, this.clip_end.value);
                this.start_end_time_range.set_value([this.clip_start.value, this.clip_end.value]);
            };
            this.clip_start.on("change", on_change);
            this.clip_end.on("change", on_change);
            this.start_end_time_range.on("change", (e)=>{
                this.clip_start.set_value(e.value[0], {trigger:e.trigger});
                this.clip_end.set_value(e.value[1], {trigger:e.trigger});
            });

            // -------------------------------------

            this.fade_in_time = new UI.TimeSpanProperty(prop_name("fade_in"), "Fade In Duration (Seconds)", {
                "step":0.1,
                "timespan.format": "s.SSS",
                "default": get_default,
            })

            this.fade_out_time = new UI.TimeSpanProperty(prop_name("fade_out"), "Fade Out Duration (Seconds)", {
                "step":0.1,
                "timespan.format": "s.SSS",
                "default": get_default,
            });

            /* this.fade_in_out_time = new UI.Property(prop_name("fade_in"), "Fade In/Out", `<div class="input-wrapper suffix number secs"><input type="number" min="0" step="0.1"></div>`, {
                "default": 0,
            });
            this.fade_in_out_time.on("change", (e)=>{
                if (e.trigger) {
                    this.fade_in_time.set_value(e._value, true);
                    this.fade_out_time.set_value(e._value, true);
                }
            }) */

            var is_special = (item)=>item && item.filename.startsWith("livestreamer:");
            var is_empty = (item)=>item && item.filename == "livestreamer://empty";

            function get_background_options(item) {
                var options = utils.deep_copy(get_options.apply(this));
                if (is_special(item)) options = options.filter(o=>!["embedded","external"].includes(o[0]));
                // if (is_empty(item)) options = options.filter(o=>!["default"].includes(o[0]));
                return options
            };

            [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end] = create_background_properties({
                "name": prop_name("background"),
                "label": "Replace Video",  /* (item)=>{
                    if (is_special(item)) return "Background";
                    return "Add Video";
                } */
                "options":function(item){
                    var options = get_background_options.apply(this,[item]);
                    if (item.filename == "livestreamer://intertitle") {
                        options = options.filter(o=>o[0]=="color" || o[0]==null || o[0]=="default");
                    } else {
                        var default_opt = options.find(o=>o[0]=="default") || options.find(o=>o[0]==null);
                        var audio_display_default_opt = utils.try(()=>app.$.properties.background_mode.__options__.find(o=>o[0]==app.$._session.background_mode));
                        if (default_opt && audio_display_default_opt) {
                            default_opt[1] = `Default Background (${audio_display_default_opt[1]})`;
                        }
                    }
                    return options;
                },
                "default": null,
                /* "default": function(item) {
                    if (item.filename == "livestreamer://intertitle") return "color";
                    else return get_default.apply(this, [id]);
                }, */
            });

            this.audio_file = new FileProperty(prop_name("audio_file"), "Add Audio", {
                "file.options": { files: true, filter: ["audio/*", "video/*"] },
            });
            this.audio_file.add_validator(UI.VALIDATORS.media_audio);

            this.subtitle_file = new FileProperty(prop_name("subtitle_file"), "Add Subtitles", {
                "file.options": { files: true, filter: ["text/*"] },
            })
            this.subtitle_file.add_validator(UI.VALIDATORS.media_subtitle);
            
            var m = (v)=>+Number.parseFloat(v)/100;
            var r = (v)=>`${(+v*100).toFixed(2)}`
            var crop_html = `<input type="number" min="0" max="${CROP_LIMIT*100}" step="1">`
            var crop_props = {
                /* "step": 0.01,
                "min": 0,
                "max": CROP_LIMIT, */
                "precision":4,
                "default": get_default
            }
            this.crop_l = new UI.Property(prop_name("crop_left"), "Crop Left (%)", crop_html, crop_props);
            this.crop_t = new UI.Property(prop_name("crop_top"), "Crop Top (%)", crop_html, crop_props);
            this.crop_r = new UI.Property(prop_name("crop_right"), "Crop Right (%)", crop_html, crop_props);
            this.crop_b = new UI.Property(prop_name("crop_bottom"), "Crop Bottom (%)", crop_html, crop_props);
            [this.crop_l,this.crop_t,this.crop_r,this.crop_b].forEach(p=>{
                p.input_modifiers.push(m);
                p.output_modifiers.push(r);
                p.on("change",function(){
                    this.input.old_hash = null;
                })
            });

            var auto_cropping = false;
            this.auto_crop_button = new UI.Button(null, {
                flex: 0,
                "disabled":()=>auto_cropping,
                "content":()=>auto_cropping ? `Crop Detecting <i class="fas fa-sync fa-spin"></i>` : `Crop Detect`,
                "click":async ()=>{
                    auto_cropping = true;
                    await app.request({
                        call: ["session", "detect_crop"],
                        arguments: [parent.datas.map(data=>data.id)]
                    }, {
                        show_spinner: false,
                        timeout: 0
                    }).catch(NOOP);
                    auto_cropping = false;
                }
            });

            var get_current_crop_rect = ()=>{
                return new utils.Rectangle({left:this.crop_l.value, top:this.crop_t.value, right:1-this.crop_r.value, bottom:1-this.crop_b.value});
            };

            var old_hash;
            var last_cdi_container;
            this.crop_detection_images = new UI.Property(null, "Crop Detection Images", `<div style="position:relative;width:100%;"></div>`, {
                "reset": false,
                "hidden": function() {
                    return parent.datas.length != 1 || !parent.data.detected_crops;
                },
                "update": function() {
                    var data = parent.data.detected_crops;
                    var crop_rect = get_current_crop_rect();
                    var hash = JSON.stringify([data, crop_rect, parent.datas.map(data=>data.id)]);
                    if (hash === old_hash) return;
                    old_hash = hash;
                    // dom_utils.empty(this.content);
                    var new_container = $(`<div class="crop-image-container"></div>`)[0];
                    if (data && parent.datas.length == 1) {
                        // var scale = 1 / data.length;
                        data.forEach((d,i)=>{
                            var p = new CropPreview(d.url, d.rect, crop_rect);
                            var container = $(`<div></div>`)[0];
                            container.appendChild(p.elem);
                            new_container.appendChild(container);
                            p.elem.onclick = ()=>show_crop_edit_modal(parent.data.id, i);
                        });
                    }
                    this.content.append(new_container);
                    var prev_container = last_cdi_container;
                    if (prev_container) {
                        new_container.style.position = "absolute";
                        new_container.style.top = "0";
                    }
                    Promise.all([...new_container.querySelectorAll("img")].map(e=>{
                        return new Promise((resolve)=>{
                            e.onload = resolve;
                            e.onerror = resolve;
                        })
                    })).then(()=>{
                        if (prev_container) {
                            prev_container.remove()
                            new_container.style.position = "";
                        }
                    })
                    last_cdi_container = new_container;
                }
            });
            
            function show_crop_edit_modal(id, index) {
                var data = app.$._session.detected_crops[id];
                var fb = new Fancybox(data.map((d,i)=>{
                    var container = $(`<div></div>`)[0];
                    var cp = new CropPreview(d.url, d.rect, get_current_crop_rect(), true);
                    cp.on("save",(rect)=>{
                        fb.close();
                        app.request({
                            call: ["session", "update_values"],
                            arguments: [
                                [`playlist/${id}/props/crop_left`, rect.left],
                                [`playlist/${id}/props/crop_top`, rect.top],
                                [`playlist/${id}/props/crop_right`, 1-rect.right],
                                [`playlist/${id}/props/crop_bottom`, 1-rect.bottom],
                            ]
                        });
                    });
                    container.appendChild(cp.elem);
                    return {type:"html",src:container};
                }), {
                    startIndex:index,
                });
            }

            parent.on("show", ()=>{
                old_hash = null;
                this.crop_detection_images.update(); // otherwise fancybox fucks up.
                // really?
            });

            // -------------------------------------
            
            this.empty_duration = new UI.TimeSpanProperty(prop_name("empty_duration"), "Duration", {
                "min":0,
                "timespan.zero_infinity": true,
                "timespan.format": "h:mm:ss.SSS",
                "default":get_default,
            });

            // -------------------------------------
            
            this.title_text = new UI.TextArea(prop_name("title_text"), "Text", {
                "default":get_default,
                "placeholder":"Insert Text Here",
                "reset": false,
                "textarea.min_rows": 3,
            });
            this.title_text.add_validator(UI.VALIDATORS.not_empty);
            
            this.title_duration = new UI.TimeSpanProperty(prop_name("title_duration"), "Duration", {
                "min":0,
                "timespan.format": "h:mm:ss.SSS",
                "default": get_default
            });
            this.title_fade_in_out = new UI.Property(prop_name("title_fade"), "Fade In/Out", `<div class="input-wrapper suffix number secs"><input type="number" min="0" step="0.1"></div>`, {
                "precision":3,
                "default": get_default
            });

            //Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

            this.title_font = new UI.Property(prop_name("title_font"), "Font", `<select>`, {
                "default": get_default,
                "options": get_options,
            });
            /* this.title_font.group_elem.append(new UI.Button(`<i class="fas fa-plus"></i>`, {
                title: `Add New Font...`,
                click: ()=>{
                    app.font_menu.show()
                }
            })) */

            this.title_size = new UI.Property(prop_name("title_size"), "Size", `<input type="number" min="10" max="100">`, {
                "default": get_default,
            });
            this.title_color = new UI.Property(prop_name("title_color"), "Color", `<input type="color">`, {
                "default": get_default,
            });
            this.title_style = new UI.Property(prop_name("title_style"), "Style", `<select>`, {
                "default": get_default,
                "options": get_options,
            });
            this.title_alignment = new UI.Property(prop_name("title_alignment"), "Alignment", `<select>`, {
                "default": get_default,
                "options": get_options,
            });
            this.title_spacing = new UI.Property(prop_name("title_spacing"), "Letter Spacing", `<input type="number" min="-50" max="50">`, {
                "default": get_default,
            });
            this.title_outline_thickness = new UI.Property(prop_name("title_outline_thickness"), "Outline Thickness", `<input type="number" min="0"  step="0.5" max="50"></div>`, {
                "precision":1,
                "default": get_default
            });
            this.title_outline_color = new UI.Property(prop_name("title_outline_color"), "Outline Color", `<input type="color">`, {
                "default": get_default
            });
            this.title_shadow_depth = new UI.Property(prop_name("title_shadow_depth"), "Shadow Depth", `<input type="number" min="0" max="50" step="0.5">`, {
                "precision":1,
                "default": get_default,
            });
            this.title_shadow_color = new UI.Property(prop_name("title_shadow_color"), "Shadow Color", `<input type="color">`, {
                "default": get_default,
            });
            this.title_underline = new UI.Property(prop_name("title_underline"), "Underline", `<select>`, {
                "default": get_default,
                "options": YES_OR_NO,
            });
            this.title_rotation = new UI.MultiProperty(prop_name("title_rotation"), "3D Rotation (degrees)", `<input type="number"><input type="number"><input type="number">`, {
                "default": get_default,
            });
            this.title_margin = new UI.Property(prop_name("title_margin"), "Margin", `<input type="number" min="0" max="100">`, {
                "default": get_default,
            });
            
            var alignments = ["bottom left", "bottom center", "bottom right", "center left", "center", "center right", "top left", "top center", "top right"];
            var alignment_styles = [{"text-align":"left", bottom:0}, {"text-align":"center", bottom:0}, {"text-align":"right", bottom:0}, {top: "50%", transform: "translateY(-50%)", "text-align":"left"}, {top: "50%", transform: "translateY(-50%)", "text-align":"center"}, {top: "50%", transform: "translateY(-50%)", "text-align":"right"},{top:0, "text-align":"left"}, {top:0, "text-align":"center"}, {top:0, "text-align":"right"}];
            (()=>{
                var _title_hash, _anim_hash;
                this.title_preview = new UI.Property(null, "Preview", `<div class="title-preview"></div>`, {
                    "reset": false,
                    "update": ()=>{
                        var hash = JSON.stringify([this.title_text, this.title_size, this.title_color, this.title_style, this.title_alignment, this.title_spacing, this.title_outline_thickness, this.title_outline_color, this.title_shadow_depth, this.title_shadow_color, this.title_underline, this.title_rotation, this.title_margin, this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end].map(p=>p.value));
                        if (_title_hash != hash) {
                            _title_hash = hash;
                            update_preview();
                        }
                        var hash = JSON.stringify([this.title_duration,this.title_fade_in_out].map(p=>p.value));
                        if (_anim_hash != hash) {
                            _anim_hash = hash;
                            restart_animation();
                        }
                    }
                });
                var elem = this.title_preview.content;
                Object.assign(elem.style, {
                    "width": "100%",
                    "padding-top": "56.25%",
                    "position": "relative",
                    "overflow":"hidden",
                    "border": "1px solid #ddd",
                });
                elem.onclick=()=>{
                    restart_animation();
                }

                var timeline_elem = $(`<div class="timeline"><div></div></div>`)[0];
                Object.assign(timeline_elem.style, {
                    "z-index":10,
                    "width":"100%",
                    "bottom":0,
                    "height": "6px",
                    "background": "rgba(0,0,0,0.2)",
                    "position":"absolute",
                });
                Object.assign(timeline_elem.firstElementChild.style, {
                    "height": "100%",
                    "background": "#fff",
                    "opacity":0.8,
                });
                elem.append(timeline_elem);

                var padding = $(`<div></div>`)[0];
                Object.assign(padding.style, {
                    "position":"absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                });
                elem.append(padding);

                var black_overlay = $(`<div></div>`)[0];
                Object.assign(black_overlay.style, {
                    "position":"absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                    "background": "black",
                    "z-index": 5,
                });
                elem.append(black_overlay);

                var inner = $(`<div></div>`)[0];
                Object.assign(inner.style, {
                    "position":"relative",
                    "width": "100%",
                    "height": "100%",
                });
                padding.append(inner);

                var title_preview_style;

                var container = $(`<div class="preview-container"></div>`)[0];
                Object.assign(container.style, {
                    "position":"absolute",
                    "top":0,
                    "bottom":0,
                    "left":0,
                    "right":0,
                    "z-index":2,
                });
                inner.append(container);
                var outline_elem = $(`<div class="preview-text"></div>`)[0];
                container.append(outline_elem);
                var text_elem = $(`<div class="preview-text"></div>`)[0];
                container.append(text_elem);

                var shadow_container = container.cloneNode(true);
                Object.assign(shadow_container.style, {
                    "z-index":1,
                });
                inner.prepend(shadow_container);

                elem.onanimationend = ()=>{
                    setTimeout(()=>restart_animation(), 500);
                };

                var restart_animation = ()=>{
                    var duration = this.title_duration.value;
                    var fade_duration = this.title_fade_in_out.value;
                    if (!title_preview_style) {
                        title_preview_style = $(`<style></style>`)[0];
                        app.body_elem.append(title_preview_style);
                    }
                    let style_text = `
                    @keyframes title-preview-timeline {
                        0% { width:0; }
                        100% { width:100%; }
                    }`;

                    if (fade_duration) {
                        var fade_in_duration_percent = (fade_duration / duration)*100;
                        var fade_out_duration_percent = 100 - fade_in_duration_percent;
                        style_text += "\n" + `@keyframes title-preview-fade {
                            0% { opacity:0; }
                            ${fade_in_duration_percent}% { opacity:1; }
                            ${fade_out_duration_percent}% { opacity:1; }
                            100% { opacity:0; }
                        }
                        @keyframes black-overlay-fade {
                            0% { opacity:1; }
                            ${fade_in_duration_percent}% { opacity:0; }
                            ${fade_out_duration_percent}% { opacity:0; }
                            100% { opacity:1; }
                        }`;
                        black_overlay.style.animation = `black-overlay-fade linear ${duration}s 1 forwards`;
                    } else {
                        black_overlay.style.opacity = 0;
                    }
                    title_preview_style.textContent = style_text;
                    set_style_property(timeline_elem.firstElementChild, "animation", `title-preview-timeline linear ${duration}s 1 forwards`)
                    dom_utils.restart_animation(elem);
                }

                var update_preview = ()=>{
                    Object.assign(elem.style, {
                        "background":this.background_mode.value == "color" ? this.background_color.value : "#000000",
                    });

                    var style = (this.title_style.value||"");
                    var scale = 1.25;

                    Object.assign(padding.style, {
                        "padding":`${this.title_margin.value*scale}px`,
                    });

                    elem.querySelectorAll(".preview-text").forEach(e=>{
                        set_inner_html(e, this.title_text.value);
                        Object.assign(e.style, {
                            "white-space": "pre-wrap",
                            "transition":"all 0.5s",
                            "position": "absolute",
                            "width":"100%",
                            "user-select": "none",
                            "top":"",
                            "bottom":"",
                            "left":"",
                            "right":"",
                            "text-align":"center",
                            "transform": "",
                            "font-weight": style.includes("bold") ? "bold" : "normal",
                            "font-style": style.includes("italic") ? "italic" : "normal",
                            "font-family": this.title_font.value,
                            "font-size": `${this.title_size.value*scale}px`,
                            "letter-spacing": `${this.title_spacing.value*scale}px`,
                            "color":this.title_color.value,
                            "text-decoration": this.title_underline.value ? "underline" : "",
                        }, alignment_styles[this.title_alignment.value-1],
                        );
                    });
                    
                    var rotation = this.title_rotation.value || [0,0,0];
                    elem.querySelectorAll(".preview-container").forEach(e=>{
                        Object.assign(e.style, {
                            "transition":"all 0.5s",
                            "transform-origin": alignments[this.title_alignment.value-1],
                            "transform-style": "preserve-3d",
                            "transform": `perspective(100px) rotateY(${rotation[1]}deg) rotateX(${rotation[0]}deg) rotateZ(${rotation[2]}deg)`,
                        });
                    })
                    Object.assign(outline_elem.style, {
                        "opacity":this.title_outline_thickness.value?1:0,
                        "color": "transparent",
                        "-webkit-text-stroke-width": `${this.title_outline_thickness.value*scale*2}px`,
                        "-webkit-text-stroke-color": this.title_outline_color.value,
                    });
                    var shadow_offset = this.title_shadow_depth.value*scale*1.25;
                    set_style_property(shadow_container, "transform", `translate(${shadow_offset}px,${shadow_offset}px) `+shadow_container.style["transform"]);
                    Object.assign(shadow_container.style, {
                        "opacity":this.title_shadow_depth.value?1:0,
                    });
                    [...shadow_container.children].forEach(e=>{
                        Object.assign(e.style, {
                            "-webkit-text-stroke-width": `${this.title_outline_thickness.value*scale*2}px`,
                            "-webkit-text-stroke-color": this.title_shadow_color.value,
                            "color": this.title_shadow_color.value,
                        });
                    })
                }
            })();

            // -------------------------------------

            this.macro_function = new UI.Property(prop_name("function"), "Function", `<select>`, {
                "options":get_options,
                "default":get_default,
            });
            // this.macro_function.add_validator(UI.VALIDATORS.not_empty);

            this.macro_handover_session = new UI.Property(prop_name("function_handover_session"), "Handover Session", `<select>`, {
                "options":()=>app.get_handover_sessions_options(),
                "default":get_default,
                "reset":true,
                "hidden":()=>this.macro_function.value != "handover"
            });
            this.macro_handover_session.add_validator(UI.VALIDATORS.not_empty);

            // -------------------------------------

            this.label = new UI.Property(prop_name("label"), "Label", `<input type="text">`, {
                /** @param {PlaylistItem} item */
                "default": (item)=>{
                    return item._get_pretty_name({label:false}) || "";return item._get_pretty_name({label:false}) || "";
                },
            });

            this.color = new UI.Property(prop_name("color"), "Item Color", `<select></select>`,{
                "options": Object.keys(item_colors).map(k=>{
                    return {value:k, text:utils.capitalize(k), style:{"background-color":item_colors[k]||"#fff"}};
                }),
                "update":function() {
                    set_style_property(this.input, "background-color", item_colors[this.value || "none"]);
                },
                "default": "none",
            });
        }
    }

    get_default_layout(is_empty) {
        var rows = [[this.loop, this.aspect_ratio, this.deinterlace]];
        if (is_empty) rows.push([this.audio_delay, this.audio_channels])
        else rows.push([this.aid_override, this.audio_delay, this.audio_channels]);
        if (!is_empty) rows.push([this.sid_override, this.subtitle_delay, this.subtitle_scale, this.subtitle_pos]);
        // if (IS_ELECTRON)
        rows.push([this.playback_speed, this.pitch_correction]);
        rows.push([this.volume_normalization, this.volume_multiplier, this.audio_visualization]);
        return rows;
    }

    get_layout() {
        if (!this.is_parent_modify) return this.get_default_layout();
        
        /** @type {Playlistitem[]} */
        var items = this.parent.datas.filter(d=>d);
        var background_layout = [
            [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end]
        ];
        var clip_layout = [
            [this.clip_start, this.clip_end, ...(this.clip_length ? [this.clip_length] : [])],
            [this.start_end_time_range],
            [this.clip_offset, this.clip_loops, this.clip_duration],
        ];
        var types = {};
        /** @param {PlaylistItem} item */
        var get_type = (item)=>{
            if (item._is_playlist) return "playlist";
            if (item.filename === "livestreamer://empty") return "empty";
            if (item.filename === "livestreamer://macro") return "macro";
            if (item.filename === "livestreamer://exit") return "exit";
            if (item.filename === "livestreamer://intertitle") return "intertitle";
            if (item.filename === "livestreamer://rtmp") return "rtmp";
            return "normal";
        }
        var types = items.map(get_type);
        
        var is_playlist = this.parent._new_type === "playlist" || types.every(t=>t==="playlist");
        var is_empty = this.parent._new_type === "empty" || types.every(t=>t==="empty");
        var is_macro = this.parent._new_type === "macro" || types.every(t=>t==="macro");
        var is_intertitle = this.parent._new_type === "intertitle" || types.every(t=>t==="intertitle");
        var is_rtmp = this.parent._new_type === "rtmp" || types.every(t=>t==="rtmp");
        var is_normal = !this.parent._new_type && types.every(t=>t==="normal");
        
        var is_2_track_playlist = items.every(i=>i.num_tracks == 2);
        var is_merged_playlist = items.every(i=>i.is_merged_playlist);
        var is_parent_merged = items.every(i=>i.root_merged_playlist);
        var is_youtube = items.every(i=>utils.try(()=>i._media_info.probe_method === "youtube-dl"));
        var is_image = items.every(i=>utils.try(()=>i._media_info.duration <= IMAGE_DURATION));
        var exists = items.every(i=>utils.try(()=>i._media_info.exists));

        var crop_layout = [
            [this.crop_l, this.crop_t, this.crop_r, this.crop_b]
        ];
        if (is_normal && !is_youtube) {
            crop_layout[0].push(this.auto_crop_button);
            crop_layout.push(this.crop_detection_images);
        }

        var layout = [];
        this.override_default_duration = null;
        if (is_normal || is_empty) {
            if (!is_empty) {
                layout.push([this.filename]);
                layout.push("---");
            }
            if (is_empty) {
                layout.push([this.empty_duration]);
            } else if (is_image) {
                this.override_default_duration = 0; // infinity
                layout.push([this.clip_duration]);
                layout.push("---");
            } else {
                layout.push(...clip_layout);
                layout.push("---");
            }
            layout.push([this.fade_in_time, this.fade_out_time]);
            if (!is_parent_merged) {
                layout.push(...background_layout);
                layout.push([this.audio_file, this.subtitle_file]);
                layout.push(...crop_layout);
                layout.push("---");
                layout.push(...this.get_default_layout(is_empty))
            }
        } else if (is_playlist) {
            // layout.push([this.filename]);
            layout.push([this.playlist_mode, this.playlist_end_on_shortest_track, this.playlist_revert_to_video_track_audio]);
            if (is_merged_playlist) {
                layout.push("---");
                layout.push(...clip_layout);
                layout.push("---");
                layout.push([this.fade_in_time, this.fade_out_time]);
                layout.push(...background_layout);
                layout.push([this.audio_file, this.subtitle_file]);
                layout.push(...crop_layout);
                layout.push("---");
                layout.push(...this.get_default_layout());
            }
        } else if (is_intertitle) {
            this.override_default_duration = 5;
            layout.push([this.title_text]);
            layout.push([this.title_size, this.title_duration, this.title_fade_in_out]);
            layout.push([this.title_font, this.title_size, this.title_color]);
            layout.push([this.title_style, this.title_alignment, this.title_spacing]);
            layout.push([this.title_underline,this.title_margin,this.title_rotation]);
            layout.push([this.title_outline_thickness, this.title_outline_color, this.title_shadow_depth, this.title_shadow_color]);
            layout.push(...background_layout);
            layout.push([this.title_preview]);
            layout.push("---");
            layout.push([this.audio_file]);
        } else if (is_macro) {
            layout.push([this.macro_function]);
            layout.push([this.macro_handover_session]);
        } else if (is_rtmp) {

        }
        if (layout.length) layout.push("---");
        layout.push([this.label, this.color]);
        return layout;
    }
}

export class FileProperty extends UI.Property {
    constructor(name, label, settings = {}) {
        var input = $(`<input type="text" class="file" readonly>`)[0];
        super(name, label, input, Object.assign({
            "setup": ()=>{
                input.addEventListener("click", async (e)=>{
                    var file_options = Object.assign({},this.get_setting("file.options"));
                    if (!file_options.start && this.value) file_options.start = this.value;
                    file_options.id = name;
                    var paths = await open_file_manager(file_options);
                    if (!paths) return;
                    this.set_values(paths[0], {trigger:true});
                });
                return input;
            },
            "title": ()=>this.value,
            "placeholder": ()=>`Choose a ${this.get_setting("file.options").folders ? "directory" : "file"}...`
        }, settings));
        this.output_modifiers.push((v)=>v?pretty_uri_basename(v):"");
    }
}


export class EditAccessControlMemberMenu extends ModalPropertyContainer {
    /** @param {AccessControlProperty} prop */
    constructor(prop) {
        var is_new = ()=>utils.is_empty(this.data);
        super({
            "modal.title": "Edit Access Control",
            "modal.footer": ()=>this.data.username != "*",
        });

        var row = this.content.append(new UI.FlexRow());
        this.username = new UI.Property("username", "Username", `<input type="text">`,{
            "default": "",
            "disabled": ()=>!is_new(),
            "reset": false,
        });
        this.username.add_validator(UI.VALIDATORS.not_empty);
        this.username.add_validator((v)=>(is_new() && prop.access_control[v]) ? "Username already registered" : true);
        this.access = new UI.Property("access", "Access", `<select>`, {
            "default": "allow",
            "options": ()=>{
                return [["owner",{disabled:this.data.username == "*"}],"allow","deny"]
            },
        });
        this.password = new UI.Property("password", "Password", `<input type="text">`, {
            "default": "",
            "hidden": ()=>this.access.value!=="allow" || this.data.username != "*",
        });
        this.suspended = new UI.Property("suspended", "Suspended", `<select>`, {
            "default": false,
            "options": YES_OR_NO,
            "disabled": ()=>this.data.username != "*" && this.access.value === "owner" && this.data.username === app.$._client.username,
            "hidden": ()=>this.data.username == "*",
        });
        
        row.append(this.username, this.access);
        
        if (prop.get_setting("access.allow_passwords")) row.append(this.password);
        row.append(this.suspended);
        
        this.save_button = new UI.Button(`Save`, {
            disabled:()=>!this.valid,
            hidden: ()=>!is_new(),
            click: ()=>{
                if (!this.valid) return; // insurance
                prop.access_control._edit(this.username.value, {access:this.access.value, password:this.password.value, suspended:this.suspended.value});
                prop.debounced_update_value();
                this.hide();
            },
        });
        var delete_button = new UI.Button(`Delete`, {
            hidden: ()=>is_new() || this.data.username == "*",
            disabled: ()=>this.data.username == "*",
            click: ()=>{
                if (prop.access_control._edit(this.data.username, null)) {
                    prop.debounced_update_value();
                    this.hide();
                }
            },
        });
        this.footer_elem.append(this.save_button, delete_button)

        this.on("property-change", (e)=>{
            if (is_new() || !e.name || !e.trigger) return;
            if (e.name == "username") return;
            if (prop.access_control._edit(this.data.username, {[e.name]:e.value})) {
                prop.debounced_update_value();
            }
        });
    }
}

export class AccessControlProperty extends UI.Property {
    constructor(name, label, settings = {}) {
        var elem = $(`<div class="access-control"></div>`)[0];
        super(name, label, elem, {
            "default": {
                "*": { access: "allow" }
            },
            "reset": false,
            "hidden": ()=>!this.access_control._self_can_edit,
            "access.allow_passwords": true,
            ...settings
        });
        
        this.access_control = new AccessControl();
        this.debounced_update_value = dom_utils.debounce_next_frame(()=>this.update_value());

        var columns = {
            "Username": (data)=>$(`<span>${data.username}</span>`)[0],
            "Access": (data)=>(data.access === "allow" && data.password) ? "allow [password protected]" : data.access,
            // "Password": (data)=>data.password ? ("*".repeat(data.password ? data.password.length : 0)) : "-",
            "Controls": (data)=>{
                var edit_button, delete_button, suspend_button;
                if (this.access_control._owners.length == 0) return;
                if (this.access_control._self_is_owner_or_admin) {
                    edit_button = $(`<button title="Edit"><i class="fas fa-wrench"></i></button>`)[0];
                    edit_button.onclick = ()=>{
                        new EditAccessControlMemberMenu(this).show(data);
                    };
                    edit_button.disabled = data.access == "owner" && this.access_control._owners.length < 2;
                    if (data.username !== "*" && data.access !== "owner") {
                        suspend_button = $(`<button title="${data.suspended ? "Unsuspend" : "Suspend"}"><i style="opacity:${data.suspended?0.5:1.0};"class="far fa-pause-circle"></i></button>`)[0];
                        suspend_button.onclick = ()=>{
                            this.access_control._edit(data.username, {suspended: !data.suspended});
                            this.debounced_update_value();
                        };
                    }
                    if (data.username !== "*") {
                        delete_button = $(`<button title="Delete"><i class="fas fa-trash-alt"></i></button>`)[0];
                        delete_button.onclick = ()=>{
                            this.access_control._edit(data.username, null);
                            this.debounced_update_value();
                        };
                    }
                }
                var $buttons = $(`<div class="control-buttons"></div>`);
                $buttons.append([edit_button, suspend_button, delete_button].filter(e=>!!e));
                return $buttons[0];
            }
        };
        var table_elem = $(`<table></table>`)[0];
        var thead_elem = $(`<thead></thead>`)[0];
        var tbody_elem = $(`<tbody></tbody>`)[0];
        var tfoot_elem = $(`<tfoot><tr><td></td></tr></tfoot>`)[0];
        var add_button = $(`<button class="button" style="width:100%"></button>`)[0];
        table_elem.append(thead_elem);
        table_elem.append(tbody_elem);
        table_elem.append(tfoot_elem);
        elem.append(table_elem);
        var footer_cell = tfoot_elem.querySelector("td");
        set_attribute(footer_cell, "colspan", Object.keys(columns).length);
        footer_cell.style.padding = 0;
        footer_cell.append(add_button);
        add_button.addEventListener("click", async ()=>{
            if (this.access_control._owners.length == 0) {
                this.access_control._claim();
                this.debounced_update_value();
            } else {
                new EditAccessControlMemberMenu(this).show({});
            }
        });
        thead_elem.append($(`<tr>${Object.keys(columns).map(c=>`<th>${c}</th>`)}</tr>`)[0]);
        var old_hash;
        this.on("render", ()=>{
            var hash = JSON.stringify(this.value)
            if (hash === old_hash) return;
            old_hash = hash;

            dom_utils.empty(tbody_elem);
            add_button.innerText = add_button.title = this.access_control._owners.length == 0 ? "Claim Ownership" : "Add User";
            toggle_attribute(add_button, "disabled", !this.access_control._self_can_edit);
            for (let user of this.access_control._users) {
                var tr = $(`<tr></tr>`)[0];
                if (user.suspended) tr.style.color = "rgba(0,0,0,0.4)";
                tbody_elem.append(tr);
                $(Object.values(columns).map(column_cb=>column_cb(user))).toArray().forEach(c=>{
                    var td = $(`<td></td>`)[0];
                    $(td).append(c);
                    tr.append(td);
                });
            }
        });
        this.on("change", (e)=>{
            utils.clear(this.access_control);
            Object.assign(this.access_control, utils.deep_copy(e._value));
        });
    }

    update_value() {
        this.set_values(utils.deep_copy(this.access_control), {trigger:true});
    }
}

export class RangeProperty extends UI.Property {
    constructor(name, label, settings = {}) {
        var input = $(`<div class="ui-slider-range"></div>`)[0];
        input.style.width = "100%";
        input.style.padding = "0 10px";
        var value;

        super(name, label, input, Object.assign({
            "min": 0,
            "max": 100,
            "step": 1,
            "default": [0, 100],
            "spinner": false,
            "setup": ()=>{
                noUiSlider.create(input, {
                    start: [0, 1],
                    connect: true,
                    behaviour: 'drag',
                    range: {'min': 0, 'max': 1},
                    step: 0,
                    animate: false,
                    format: {
                        to: function (value) {
                            return value.toFixed(3)
                        },
                        from: function (value) {
                            return +value;
                        }
                    }
                });
                input.noUiSlider.on("slide", (_values)=>{
                    value = _values.map(v=>+v);
                    // this.emit("slide", { value });
                    this.set_value(value);
                });
                input.noUiSlider.on("end", (_values)=>{
                    value = _values.map(v=>+v);
                    this.set_value(value, {trigger_if_changed:true});
                });
                return input;
            },
        }, settings));

        var last_hash;
        this.on("update", (e)=>{
            var disabled = this.get_setting("disabled");
            var range =  disabled ? {'min':0, 'max':1} : {'min':this.get_setting("min"), 'max':this.get_setting("max")};
            var step = this.get_setting("step");
            var value = this.value;
            var hash = JSON.stringify([value, step, range]);
            if (last_hash !== hash) {
                last_hash = hash;
                // console.log("..........", step, range)
                input.noUiSlider.updateOptions({ step, range });
                input.noUiSlider.set(value, false, false);
            }
        })

        /* this.on("change", (e)=>{
        }); */
    }
}

/* if (!Element.prototype.scrollIntoViewIfNeeded) {
    Element.prototype.scrollIntoViewIfNeeded = function (centerIfNeeded) {
    centerIfNeeded = arguments.length === 0 ? true : !!centerIfNeeded;

        var parent = this.parentNode,
            parentComputedStyle = window.getComputedStyle(parent, null),
            parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width')),
            parentBorderLeftWidth = parseInt(parentComputedStyle.getPropertyValue('border-left-width')),
            overTop = this.offsetTop - parent.offsetTop < parent.scrollTop,
            overBottom = (this.offsetTop - parent.offsetTop + this.clientHeight - parentBorderTopWidth) > (parent.scrollTop + parent.clientHeight),
            overLeft = this.offsetLeft - parent.offsetLeft < parent.scrollLeft,
            overRight = (this.offsetLeft - parent.offsetLeft + this.clientWidth - parentBorderLeftWidth) > (parent.scrollLeft + parent.clientWidth),
            alignWithTop = overTop && !overBottom;

        if ((overTop || overBottom) && centerIfNeeded) {
            parent.scrollTop = this.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + this.clientHeight / 2;
        }
    
        if ((overLeft || overRight) && centerIfNeeded) {
            parent.scrollLeft = this.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 - parentBorderLeftWidth + this.clientWidth / 2;
        }
    
        if ((overTop || overBottom || overLeft || overRight) && !centerIfNeeded) {
            this.scrollIntoView(alignWithTop);
        }
    };
} */



export class Panel extends UI.PropertyContainer {
    get collapsible() { return !!this.elem.dataset.collapsible; }
    set collapsible(value) {
        if (value) {
            this.elem.dataset.collapsible = 1;
        } else {
            delete this.elem.dataset.collapsible;
        }
    }
    constructor(title, settings) {
        super({gap:0, ...settings});
        this.panel_id = title.toLowerCase().replace(/[^\w]+/, "-");
        app.panels[this.panel_id] = this;

        add_class(this.elem, "drawer");
        this.elem.dataset.id = this.panel_id;
        var header_container_elem = $(`<div class="header"><div class="inner"></div><div class="collapse-arrow"><i class="fas fa-chevron-down"></i></div></div>`)[0];
        this.body_elem = $(`<div class="body"></div>`)[0];
        this.body = new UI(this.body_elem);
        this.header = new UI(header_container_elem);
        this.header_elem = header_container_elem.querySelector(".inner");
        this.collapse_arrow_elem = header_container_elem.querySelector(".collapse-arrow");

        var title_elem = $(`<span></span>`)[0];
        set_inner_html(title_elem, title);
        this.header_elem.append(title_elem);

        this.elem.append(header_container_elem, this.body_elem);
        
        this.collapsible = true;
        
        header_container_elem.addEventListener("click", (e)=>{
            if (!this.elem.dataset.collapsible) return;
            var button = e.target.closest("button");
            if (button) return;
            var setting_id = `drawer:${this.panel_id}`;
            if (app.settings.get(setting_id) === undefined) app.settings.set(setting_id, false);
            else app.settings.toggle(setting_id);
        });
    }

    toggle(value) {
        toggle_class(this.elem, "hide", value)
    }
}

export class StreamSettings extends Panel {
    constructor() {
        super(
            "Stream Settings",
            {
                data: ()=>app.$._session.stream_settings,
                // disabled: ()=>app.$.session.is_running,
            }
        );
        var left = new UI.Row({flex:1});
        var right = new UI.Row({flex:0, gap:0});
        var inner = new UI();
        inner.append(left, right);
        add_class(inner.elem, "stream-settings");
        this.body_elem.append(inner);
        
        this.properties_ui = new UI.Row({
            "class":"stream-properties",
            gap: 5,
            "align":"end",
            "hidden": ()=>app.$._session._is_running || app.$._session.type !== SessionTypes.INTERNAL
        })
        this.info_ui = new UI({
            "class":"stream-info",
            "hidden": ()=>!app.$._session._is_running
        });
        left.append(this.properties_ui, this.info_ui);
        
        this.button_group_ui = new UI.FlexRow({gap:0, class:"border"});
        right.append(this.button_group_ui);

        this.toggle_streaming_button = new UI.Button(null, {
            id: "toggle-streaming",
            content: ()=>{
                var state = app.$._session.stream.state;
                if (state === "stopped") state = `START`;
                else if (state === "started") state = `STOP`;
                else if (state === "stopping") state = `Stopping...`;
                else if (state === "starting") state = `Starting...`;
                return state;
            },
            disabled: ()=>{
                return !app.$._session._is_running && !this.valid;
            },
            // update:()=>{
            //     this.toggle_streaming_button.update_settings({"disabled": !app.$._session._is_running && !this.valid_visible})
            // },
            click: (e)=>{
                if (app.$._session._is_running) {
                    app.request({
                        call: ["session", "stop_stream"],
                        arguments: [true]
                    });
                } else {
                    var msg = "Another stream is already running, playback of all streams may by slower than realtime.\nAre you sure you want to start streaming?";
                    if (Object.values(app.$._streams).filter(s=>s._is_running).length == 0 || confirm(msg)) {
                        app.request({
                            call: ["session", "start_stream"],
                        });
                        // app.$.push([`sessions/${app.$.session.id}/core/state`, "starting"]);
                    }
                    // app.$.push([`sessions/${app.$.session.id}/core/state`, "stopping"]);
                }
            }
        });
        this.schedule_stream_button = new UI.Button("Schedule", {
            id: "schedule-stream",
            click: (e)=>{
                app.schedule_stream_menu.show();
            },
            disabled:()=>app.$._session._is_running,
            hidden:()=>app.$._session._is_running
        });
        this.handover_button = new UI.Button("Handover", {
            id: "handover-button",
            click: async (e)=>{
                var modal = new HandoverSessionMenu();
                modal.show();
            },
            hidden:()=>!app.$._session._is_running || app.$._session.type != SessionTypes.INTERNAL || app.$._stream.test
        });
        this.config_button = new UI.Button(`<i class="fas fa-cog"></i>`, {
            "id": "config-button",
            "title": "Stream Configuration",
            "click": async (e)=>{
                var modal = new StreamConfigurationMenu();
                modal.show();
            },
            hidden:()=>!app.$._session._is_running || app.$._stream.test
        });
        var row = new UI.FlexRow({gap:0});
        set_style_property(row.elem, "flex-wrap", "nowrap");
        row.append(this.schedule_stream_button, this.handover_button, this.config_button);
        this.button_group_ui.append(this.toggle_streaming_button, row);

        function get_default() { return utils.try(()=>app.$.properties.stream_settings[this.name].__default__); }
        function get_options() {
            return utils.try(()=>app.$.properties.stream_settings[this.name].__options__) ?? (utils.try(()=>typeof app.$.properties.stream_settings[this.name].__default__) === "boolean" ? YES_OR_NO : []);
        }

        this.stream_method = new UI.Property("method", "Stream Method", `<select></select>`, {
            "options": function() {
                var options = dom_utils.fix_options(get_options.apply(this));
                if (!app.$._client.is_admin) options = options.filter(o=>o.value === "rtmp");
                if (!app.dev_mode) options = options.filter(o=>o.value !== "ffplay");
                if (!IS_ELECTRON) {
                    var gui_option = options.find(o=>o.value === "gui");
                    if (gui_option) {
                        gui_option["disabled"] = true;
                        gui_option["hidden"] = true;
                    }
                }
                return options;
            },
            // "hidden": !app.dev_mode,
            "default": get_default,
            "reset": false,
        });
        this.properties_ui.append(this.stream_method)

        this.stream_targets = new TargetsProperty("targets", "Stream Target(s)", {
            "hidden": ()=>this.stream_method.value != "rtmp",
        });
        this.stream_targets.add_validator(v=>(!v || v.length == 0) ? "No targets selected" : true);
        this.properties_ui.append(this.stream_targets)

        this.stream_title = new UI.Property("title", "Stream Title", `<input type="text">`, {
            "default": "",
            "placeholder": ()=>/* app.$.session.default_stream_title || */ app.$._session.name,
            "hidden": ()=>this.stream_method.value != "rtmp",
        });
        this.properties_ui.append(this.stream_title)

        this.stream_file = new UI.Property("filename", "Filename", `<input type="text">`, {
            "default": get_default,
            "hidden": ()=>this.stream_method.value != "file",
            "info": "Special keywords: %date% | %unix%",
        });
        this.stream_file.add_validator(UI.VALIDATORS.not_empty)
        this.properties_ui.append(this.stream_file)
        
        this.stream_re = new UI.Property("re", "Encoding Speed", `<select></select>`, {
            "options": [[1,"Realtime"],[0,"Fastest"]],
            "default": get_default,
            "hidden": ()=>this.stream_method.value != "file"
        });
        this.properties_ui.append(this.stream_re)

        this.h264_preset = new UI.Property("h264_preset", "h264 Preset", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.h264_preset)

        this.video_bitrate = new UI.Property("video_bitrate", "Video Bitrate", `<div class="input-wrapper suffix number Kbips"><input type="number" min="500" max="8000" step="100"></div>`, {
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.video_bitrate)

        this.audio_bitrate = new UI.Property("audio_bitrate", "Audio Bitrate", `<div class="input-wrapper suffix number Kbips"><input type="number" min="64" max="320" step="10"></div>`, {
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.audio_bitrate)

        this.stream_resolution = new UI.Property("resolution", "Resolution", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.stream_resolution)

        this.frame_rate = new UI.Property("frame_rate", "Frame Rate", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.frame_rate)

        this.legacy_mode = new UI.Property("legacy_mode", "Legacy Mode", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui"
        });
        this.properties_ui.append(this.legacy_mode)

        this.use_hardware = new UI.Property("use_hardware", "Hardware Transcoding", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value == "gui" || this.legacy_mode.value
        });
        this.properties_ui.append(this.use_hardware)

        this.test_button = new UI.Button("Test", {
            "hidden": ()=>this.stream_method.value != "rtmp",
            "disabled": ()=>!app.$.processes["media-server"],
            "click": ()=> {
                app.request({
                    call: ["session", "start_stream"],
                    arguments: [{ "test": true }],
                })
            },
        })
        this.properties_ui.append(this.test_button)

        this.osc = new UI.Property("osc", "Show OSC", `<select></select>`, {
            "options": get_options,
            "default": get_default,
            "hidden": ()=>this.stream_method.value != "gui",
            "info":()=>"Show On-Screen-Controller"
        });
        this.properties_ui.append(this.osc)

        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.$._push([`sessions/${app.$._session.id}/stream_settings/${e.name}`, e._value]);
            app.request({
                call: ["session", "update_values"],
                arguments: [[`stream_settings/${e.name}`, e._value]]
            });
        });

        var last_stream_info_hash;
        this.on("post_update", ()=>{
            var session = app.$._session || EMPTY_OBJECT;
            var stream = session.stream;

            toggle_class(this.properties_ui.elem, "d-none", session._is_running);
            toggle_class(this.info_ui.elem, "d-none", !session._is_running);
            toggle_class(this.properties_ui.elem, "d-none", session._is_running);
            toggle_class(this.info_ui.elem, "d-none", !session._is_running);
    
            var state;
            if (stream.state === "stopped") state = `Start`;
            else if (stream.state === "started") state = `Stop`;
            else if (stream.state === "stopping") state = `Stopping...`;
            else if (stream.state === "starting") state = `Starting...`;
            set_text(this.toggle_streaming_button, state);

            var stream_info = {};
            stream_info["Stream Method"] = stream["method"];
            if (app.$._session.type === SessionTypes.INTERNAL) {
                if (stream["method"] !== "gui") {
                    let parts = {
                        "h264 Preset": `${stream["h264_preset"]}`,
                        "Video Bitrate": `${stream["video_bitrate"]}Kbps`,
                        "Audio Bitrate": `${stream["audio_bitrate"]}Kbps`,
                        "Resolution": `${stream["resolution"]}`,
                    };
                    if (stream["legacy_mode"]) {
                        parts["Legacy Mode"] = `${stream["legacy_mode"]?"Yes":"No"}`;
                    } else {
                        parts["Use Hardware"] = `${stream["use_hardware"]?"Yes":"No"}`;
                    }
                    stream_info["Encoder Settings"] = Object.entries(parts).map(([k,v])=>`${k}: ${v}`).join(", ");
                }
                if (stream["method"] === "file") {
                    stream_info["Realtime"] =`${stream["re"]?"Yes":"No"}`;
                    stream_info["Output Path"] = stream["filename_evaluated"] || "-";
                }
                stream_info["Frame Rate"] = `${stream["frame_rate"]}`;
            } else {
                var nms_session = app.$._session._get_connected_nms_session_with_appname("livestream");
                if (nms_session) {
                    stream_info["Resolution"] = `${nms_session.videoWidth}x${nms_session.videoHeight}`;
                    stream_info["Frame Rate"] = `${nms_session["videoFps"]}`;
                }
            }
            if (stream["method"] === "rtmp") {
                if (!stream["test"]) {
                    stream_info["Stream Target(s)"] = stream["targets"].map((t,i)=>`${t} <span style="color:${app.$.targets[t]?"#00f":"f00"}">[${app.$.targets[t]?"OK":"NOT EXIST"}]</span>`).join(", ");
                    stream_info["Stream Title"] = stream.title;
                }
            }
            var live_nms_session = stream._live_nms_session;
            if (live_nms_session) {
                var {live} = live_nms_session;
                if (live && live.url) {
                    stream_info["Video URL"] = `<a href="${live.url}" target="_blank">${live.url}</a>`;
                }
                /* if (live.thumbnail_url) {
                    stream_info["Thumbnail"] = `<a href="${live.thumbnail_url}" target="_blank">${new URL(live.thumbnail_url).pathname}</a>`;
                } */
            }
            stream_info["Bit Rate"] = utils.format_bitrate(session.stream.bitrate, "k");
            stream_info["Run Time"] = session._is_running ? utils.ms_to_timespan_str(session.stream._run_time) : 0;

            var hash = JSON.stringify(stream_info);
            if (hash !== last_stream_info_hash) {
                last_stream_info_hash = hash;
                dom_utils.rebuild(this.info_ui.elem, Object.keys(stream_info), {
                    id_callback: (k)=>utils.sanitize_filename(k),
                    add: (k, elem, index)=>{
                        if (!elem) elem = $(`<span></span>`)[0];
                        var v = stream_info[k];
                        if (elem.__hash !== v) {
                            elem.__hash = v;
                            elem.innerHTML = `${k}: ${v}`;
                        }
                        return elem;
                    }
                });
            }
        })
    }
}

export class MediaPlayerPanel extends Panel {

    get video_buffer_length() {
        return utils.try(()=>(this.flv_player._mediaElement.buffered.end(0)-this.flv_player.currentTime));
    }

    constructor() {
        super("Media Player", {
            data: ()=>app.$._session
        });

        add_class(this.elem, "player-interface-wrapper");

        var bg = $(`<div class="buttons border-group">
            <button class="time_display_ms" title="Show/Hide Millisecconds"><i class="ms"></i></button>
        </div>`)[0];
        this.header_elem.append(bg);

        var tsc = $(`<div class="test-stream-container">
            <div class="test-stream">
                <div class="video-wrapper"></div>
                <div class="overlay">
                    <div class="buttons">
                        <button class="reload" title="Reload"><i class="fas fa-sync"></i></button>
                        <button class="popout" title="Pop-out Player"><i class="fas fa-external-link-alt"></i></button>
                        <button class="toggle-info" title="Toggle Player Info"><i class="fas fa-circle-info"></i></button>
                    </div>
                    <span class="info"></span>
                </div>
            </div>
        </div>`)[0];
        this.body_elem.append(tsc);

        this.test_stream_container_elem = this.elem.querySelector(".test-stream-container");
        this.test_stream_elem = this.elem.querySelector(".test-stream");
        this.test_stream_video_wrapper = this.test_stream_elem.querySelector(".video-wrapper");
        this.test_stream_overlay_elem = this.test_stream_elem.querySelector(".overlay");
        this.test_stream_info_elem = this.test_stream_elem.querySelector(".info");
        this.test_stream_reload_button = this.test_stream_elem.querySelector("button.reload");
        this.test_stream_popout_button = this.test_stream_elem.querySelector("button.popout");
        this.test_stream_info_button = this.test_stream_elem.querySelector("button.toggle-info");
        this.test_stream_info_button.onclick = ()=>{
            toggle_class(this.test_stream_info_elem, "d-none");
            toggle_attribute(this.test_stream_info_button, "data-toggled");
        }

        this.test_stream_popout_button.addEventListener("click", async (e)=>{
            var id = app.$._session.id;
            var w = windows["test-"+id];
            if (w && !w.closed) {
                w.focus();
            } else {
                var [width,height] = app.$._session.stream["resolution"].split("x").map(i=>parseInt(i));
                var ratio = width / height;
                height = Math.min(720, height);
                width = height * ratio;
                // yay this works well.
                w = windows["test-"+id] = window.open(window.location.origin+"/main/blank.html", id, `width=${width},height=${height},scrollbars=1,resizable=1`);
                w.onload=()=>{
                    w.document.head.append($(`<title>Test Stream ${id}</title>`)[0]);
                    /* await */ dom_utils.clone_document_head(app.root_elem, w.document.head);
                    var style = w.document.createElement("style");
                    style.textContent =
`body {
    padding: 0;
    margin: 0;
}
body > * {
    width: 100% !important;
    height: 100% !important;
}
video {
    width: 100% !important;
    height: 100% !important;
}`;
                    //+"\n"+dom_utils.get_all_css(document, true);
                    w.document.head.append(style);
                    w.document.body.append(this.test_stream_elem);
                    this.refresh_player(true);
                    
                    w.addEventListener("unload", (e)=>{
                        delete windows["test-"+id];
                        this.test_stream_container_elem.append(this.test_stream_elem);
                        this.refresh_player(true);
                    });
                }
            }
        });
        this.test_stream_reload_button.addEventListener("click", (e)=>{
            this.refresh_player(true);
        })
        
        this.status_elem = $(`<div class="player-status"><div class="currently-playing"><span class="prefix"></span><span class="path"></span></div></div>`)[0];
        this.chapters_elem = $(`<div class="player-chapters"></div>`)[0];
        this.status_prefix_elem = this.status_elem.querySelector(".prefix");
        this.status_path_elem = this.status_elem.querySelector(".path");
        this.body_elem.append(this.status_elem, this.chapters_elem);
        
        this.seek_controls_elem = $(`<div class="seek-controls"></div>`)[0];
        this.body_elem.append(this.seek_controls_elem);

        this.seek = new MediaSeekBar();
        this.seek_controls_elem.append(this.seek.elem);

        this.player_inline_elem = new UI.Row({class:"player-inline"}).elem;
        this.body_elem.append(this.player_inline_elem)
        
        this.player_controls_elem = new UI(`<div class="player-button-wrapper"></div>`);
        this.player_inline_elem.append(this.player_controls_elem);
        
        this.player_controls_elem.append(
            this.prev_button = new UI.Button(`<i class="fas fa-step-backward"></i>`, {
                title:"Previous Playlist Item",
                click: (e)=>{
                    app.playlist_play(app.$._session._current_playing_item._previous);
                },
                disabled:()=>!app.$._session._current_playing_item._previous
            }),
            this.backward_button = new UI.Button(`<i class="fas fa-backward"></i>`, {
                title:"-30 Seconds",
                click: (e)=>{
                    app.seek(-30,true);
                },
                disabled:()=>!app.media.seekable || app.media.time <= 0,
            }),
            this.toggle_play_pause_button = new UI.Button(null, {
                title:"Play/Pause",
                content: ()=>app.$._stream.mpv.props.pause ? `<i class="fas fa-play"></i>` : `<i class="fas fa-pause"></i>`,
                click: (e)=>{
                    var new_pause = !app.$._stream.mpv.props.pause;
                    app.$._push([`streams/${app.$._stream.id}/mpv/props/pause`, new_pause]);
                    app.request({
                        call: ["session", "mpv", "set_property"],
                        arguments: ["pause", new_pause]
                    });
                },
                disabled:()=>!app.$._session._is_running,
            }),
            this.stop_button = new UI.Button(`<i class="fas fa-stop"></i>`, {
                title:"Stop",
                hidden:true,
                click: (e)=>{
                    app.request({
                        call: ["session", "stop"],
                    });
                },
                disabled: ()=>!app.$._session._is_running,
            }),
            this.forward_button = new UI.Button(`<i class="fas fa-forward"></i>`, {
                title:"+30 Seconds",
                click: (e)=>{
                    app.seek(30,true);
                },
                disabled:()=>!app.media.seekable || app.media.time_left <= 0,
            }),
            this.next_button = new UI.Button(`<i class="fas fa-step-forward"></i>`, {
                title:"Next Playlist Item",
                click: (e)=>{
                    app.playlist_play(app.$._session._current_playing_item._next);
                },
                disabled:()=>!app.$._session._current_playing_item._next
            }),
            this.prev_chapter_button = new UI.Button(`<i class="fas fa-fast-backward"></i>`, {
                title:"Previous Chapter",
                click: (e)=>{
                    app.seek_chapter(-1,true)
                },
                disabled: ()=>!app.settings.get("show_chapters") || app.media.chapters.length == 0 || app.media.time <= app.media.chapters[0].start,
                // hidden: ()=>!app.settings.get("show_chapters") || this.chapters.length == 0
            }),
            this.next_chapter_button = new UI.Button(`<i class="fas fa-fast-forward"></i>`, {
                title:"Next Chapter",
                click: (e)=>{
                    app.seek_chapter(1,true)
                },
                disabled: ()=>!app.settings.get("show_chapters") || app.media.chapters.length == 0 || app.media.time >= app.media.chapters[app.media.chapters.length-1].start,
                // hidden: ()=>!app.settings.get("show_chapters") || this.chapters.length == 0
            }),
            this.reload_button = new UI.Button(`<i class="fas fa-sync"></i>`, {
                title:"Reload",
                click: (e)=>{
                    app.request({
                        call: ["session", "reload"]
                    });
                },
                disabled:()=>!app.$._session._is_running,
                update: function(){
                    // toggle_class(this.elem, "pending", app.$.session.current_playing_item.userdata.pending_changes);
                }
            }),
            this.set_time_button = new UI.Button(`<i class="far fa-clock"></i>`, {
                title:"Precise Seek",
                click: (e)=>{
                    app.set_time_pos_menu.show();
                },
                disabled:()=>!app.media.seekable,
            })
        );
        
        this.volume_wrapper = new UI(`<div class="player-volume-wrapper"></div>`);
        this.player_inline_elem.append(this.volume_wrapper);

        this.volume = new UI.Property("volume_target", null, `<div><input id="volume" type="range" min="0" max="200" step="1" value="100" title="Volume" style="width:100px"></div>`, {
            default: 100,
            reset: false,
            reset_on_dblclick: true,
            update: ()=>this.vol_input.update()
        });

        this.volume.on("change", (e)=>{
            if (e.trigger) {
                app.$._push([`sessions/${app.$._session.id}/volume_target`, +e._value]);
                app.request({
                    call: ["session", "update_values"],
                    arguments: [["volume_target", +e._value]]
                });
            }
        });
        
        this.vol_down_button = new UI.Button(`<i class="fas fa-volume-down"></i>`, {
            class:"icon-btn",
            title:"Volume - 5%",
            click: (e)=>{
                this.volume.set_values(utils.ceil_to_factor(this.volume.value-VOLUME_STEP,VOLUME_STEP), {trigger:true});
            }
        });
        
        /* this.vol_input = new UI.Property(null, null, `<input type="number" min="0" max="200" step="1">`, {
            "default": 100,
            reset: false,
        })
        this.volume.input_modifiers.push(v=>Math.round(parseFloat(v)));
        this.volume.output_modifiers.push(v=>v+"%"); */
        this.vol_input = new UI.Button(null, {
            content: ()=>`<span style="font-size:10px">${Math.round(this.volume.value)}%</span>`,
            click: (e)=>{
                new SetVolumeSettings().show();
            }
        });
        
        this.vol_up_button = new UI.Button(`<i class="fas fa-volume-up"></i>`, {
            class:"icon-btn",
            title:"Volume + 5%",
            click: (e)=>{
                this.volume.set_values(utils.floor_to_factor(this.volume.value+VOLUME_STEP,VOLUME_STEP), {trigger:true});
            }
        })
        
        /* this.mute_button = new UI.Button(`<i class="fas fa-volume-xmark"></i>`, {
            class:"icon-btn",
            title:"Mute",
            hidden: true,
            click: (e)=>{
                var new_muted = !app.$.stream.mpv.muted;
                app.request({
                    call:["session", "stream", "mpv", "set_property"],
                    arguments: ["muted", new_muted]
                });
                app.$.push([`sessions/${app.$.session.id}/mpv/muted`, new_muted]);
            },
            update:function() {
                toggle_class(this.elem, "mute", !!app.$.stream.mpv.muted);
            }
        }); */
        
        this.vol_speed = new UI.Property("volume_speed", null, `<select>`, {
            title: "Volume Transition Speed",
            default: 1.0,
            reset:false,
            options: [[0.5, "Very Slow"], [1.0, "Slow"], [2.0, "Medium"], [4.0, "Fast"], [8.0, "Very Fast"], [0, "Immediate"]],
            hidden:true,
        });
        this.vol_speed.on("change",(e)=>{
            if (e.trigger) {
                app.$._push([`sessions/${app.$._session.id}/volume_speed`, e._value]);
                app.request({
                    call:["session", "update_values"],
                    arguments: [["volume_speed", e.value]]
                });
            }
        })
        this.volume_wrapper.append(this.vol_input, this.vol_down_button, this.volume, this.vol_up_button /*,this.mute_button */, this.vol_speed);
        
        this.stats_elem = $(`<div class="stats">`)[0];
        this.body_elem.append(this.stats_elem);
        
        // this.fader_controls_elem = $(`<div class="fader-controls"></div>`)[0];
        // this.body.append(this.fader_controls_elem);

        var detect_wrap = dom_utils.debounce_next_frame(()=>{
            dom_utils.detect_wrapped_elements(this.player_inline_elem);
        });
        var resize_observer = new ResizeObserver(()=>detect_wrap());
        resize_observer.observe(this.elem);
        
        this.on("destroy", ()=>{
        });
        this.on("update", ()=>{
            var started = app.$._session._is_running;
            set_inner_html(this.status_prefix_elem, `${app.media.status}: `);
            app.build_playlist_breadcrumbs(this.status_path_elem, app.$._session._current_playing_item, true, true);
            
            var stats_html = Object.entries(app.media.stats).map(([k,v])=>`<span>${k}: ${v}</span>`).join(" | ");
            set_inner_html(this.stats_elem, stats_html);
            toggle_class(this.stats_elem, "d-none", !started);
            
            if (app.media.curr_chapters.length) {
                this.chapters_elem.style.display = "";
                let html = `Chapter: `+app.media.curr_chapters.map(c=>app.chapter_to_string(c)).join(" | ");
                set_inner_html(this.chapters_elem, `<span>${html}</span>`);
            } else {
                this.chapters_elem.style.display = "none";
            }
            
            detect_wrap();

            this.refresh_player();
        });
    }

    async refresh_player(force) {
        var test_video_url = `${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/media-server/test/${app.$._session.id}.flv`;
        var show = !!(app.$._session._is_running && app.$._stream.test && test_video_url);
        var is_popped_out = !!windows["test-"+app.$._session.id];
        var is_playable = !!(show && app.$._session._get_connected_nms_session_with_appname("test"));

        toggle_class(this.test_stream_container_elem, "d-none", !show);
        toggle_class(this.test_stream_overlay_elem, "d-none", !is_playable);
        toggle_class(this.test_stream_popout_button, "d-none", is_popped_out);
        toggle_attribute(this.test_stream_popout_button, "data-toggled", is_popped_out);
        
        var buffer_length = this.video_buffer_length;
        set_inner_html(this.test_stream_info_elem, `Buffered: ${buffer_length ? buffer_length.toFixed(2) : "-"} secs`);

        if (!force && !!this.flv_player == is_playable) return;

        if (this.flv_player) {
            this.flv_player.pause();
            this.flv_player.unload();
            this.flv_player.detachMediaElement();
            this.flv_player.destroy();
            this.flv_player = null
            if (this.video_el) {
                this.video_el.remove();
                this.video_el = null;
            }
        }

        if (is_playable) {

            this.video_el = this.test_stream_elem.ownerDocument.createElement("video");
            this.video_el.controls = true;
            this.video_el.autoplay = false;
            this.video_el.muted = true;
            this.video_el.addEventListener('loadedmetadata', (e)=>{
                // set_style_property(this.test_stream_container_elem, "--aspect-ratio", this.video_el.videoWidth / this.video_el.videoHeight)
            });
            this.test_stream_video_wrapper.append(this.video_el);
            this.flv_player = flvjs.createPlayer({
                type: "flv",
                url: test_video_url,
                hasAudio: true,
                hasVideo: true,
                isLive: true,
                // deferLoadAfterSourceOpen: false,
            },{
                // enableStashBuffer: false,
                accurateSeek: true,
            });
            
            this.flv_player.on(flvjs.Events.MEDIA_INFO, (s)=>{
                this.flv_media_info = s;
            })
            var initialized = false;
            this.flv_player.on(flvjs.Events.STATISTICS_INFO, (s)=>{
                this.flv_statistics = s;
                if (!initialized) {
                    if (this.video_buffer_length > (MIN_VIDEO_BUFFER_TIME/1000)) {
                        this.flv_player.play();
                        initialized = true;
                    }
                }
            })
            this.flv_player.attachMediaElement(this.video_el);
            this.flv_player.load();
        }
    }
}

export class MediaSettingsPanel extends Panel {
    toggle_mode(v) {
        this._mode = v;
        this.body.update_layout(this.interface.get_layout());
        this.update();
    }
    constructor() {
        super("Media Settings", {
            nullify_defaults: ()=>!app.$._session._is_running,
            data: ()=>(this._mode === MediaSettingsMode.current) ? (app.$._session._is_running ? app.$._session.stream.mpv.props : app.$._session._current_playing_item.props) : app.$._session.player_default_override,
            disabled: ()=>this._mode === MediaSettingsMode.current && !app.$._session._is_running,
        });

        this.header_elem.append($(`<div class="buttons border-group">
            <button class="player-settings-toggle-current" title="Current File Media Settings">current</button>
            <button class="player-settings-toggle-default" title="Default Media Settings">all</button>
        </div>`)[0]);
        
        this.body_elem.id = "player-settings";
        this.toggle_current_button = this.elem.querySelector("button.player-settings-toggle-current");
        this.toggle_all_button = this.elem.querySelector("button.player-settings-toggle-default");
        this.toggle_current_button.addEventListener("click", (e)=>{
            this.toggle_mode(MediaSettingsMode.current);
        });
        this.toggle_all_button.addEventListener("click", (e)=>{
            this.toggle_mode(MediaSettingsMode.all);
        });
        
        this.on("update", ()=>{
            var p = this.toggle_all_button.parentElement;
            var toggle = (this._mode === MediaSettingsMode.current) ? "0" : "1";
            if (p.dataset.toggle != toggle) p.dataset.toggle = toggle;
        });
        
        this.on("property-change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.request({
                call: ["session","set_player_property"],
                arguments: [e.name, e._value, this._mode === MediaSettingsMode.current]
            });
            /* if (this._mode === MediaSettingsMode.all) {
                app.$.push([`sessions/${app.$.session.id}/player_default_override/${e.name}`, e._value]);
            } else {
                app.$.push([`streams/${app.$.stream.id}/mpv/props/${e.name}`, e._value]);
            } */
        });

        this.interface = new MediaSettingsInterface(this);
        this.toggle_mode(MediaSettingsMode.current);
    }
}

export class LogViewerPanel extends Panel {
    constructor(name) {
        super(name);
        add_class(this.body_elem, "no-padding");

        this.logs_wrapper = $(`<div class="logs-wrapper"></div>`)[0];
        this.logs_container = $(`<div class="logs"></div>`)[0];
        this.body_elem.append(this.logs_wrapper);
        this.logs_wrapper.append(this.logs_container)
        
        this._logs = {};
        this._num_logs = 0;
        this._default_logger_settings = {
            show_dates: false,
            show_times: true,
            level_filters: {
                info:true,
                warn:true,
                error:true,
                debug:false,
            }
        };
        this._logger_settings = utils.deep_copy(this._default_logger_settings)
        this.i = 0;
    
        this.storage_name = `${this.panel_id}-log-viewer-settings`;
        add_class(this.logs_container, "thin-scrollbar");
        $(this.logs_wrapper).resizable({handles:"s"});
        
        var create_toggle_button = (text)=>{
            var elem = $(`<button class="toggle-button">${text}</button>`)[0];
            return elem;
        }

        this.bar = $(`<div class="logs-bar"></div>`)[0];
        this.show_dates_button = create_toggle_button("Show Dates");
        this.bar.append(this.show_dates_button);
        this.show_dates_button.addEventListener("click", (e)=>{
            this._logger_settings.show_dates = !this._logger_settings.show_dates;
            this.save();
        });
        this.show_times_button = create_toggle_button("Show Times");
        this.bar.append(this.show_times_button);
        this.show_times_button.addEventListener("click", (e)=>{
            this._logger_settings.show_times = !this._logger_settings.show_times;
            this.save();
        });
        this.bar.append($(`<div class="sep"></div>`)[0]);
        this.levels = $("<div></div>")[0];
        this.level_buttons = {};
        for (let k in this._default_logger_settings.level_filters) {
            let button = create_toggle_button(k);
            this.level_buttons[k] = button
            button.addEventListener("click", (e)=>{
                this._logger_settings.level_filters[k] = !this._logger_settings.level_filters[k];
                this.save();
            });
            this.levels.append(button);
        }
        this.bar.append(this.levels);
        this.bar_wrapper = $(`<div class="logs-bar-wrapper"></div>`)[0];
        this.bar_wrapper.append(this.bar);
        this.logs_wrapper.append(this.bar_wrapper);

        this.load();

        this.on("update", ()=>{
            toggle_class(this.show_dates_button, "toggled", this._logger_settings.show_dates);
            toggle_class(this.show_times_button, "toggled", this._logger_settings.show_times);
            for (var k in this._logger_settings.level_filters) {
                toggle_class(this.level_buttons[k], "toggled", this._logger_settings.level_filters[k]);
                toggle_attribute(this.logs_wrapper, `data-show-${k}`, this._logger_settings.level_filters[k]);
            }
            toggle_attribute(this.logs_wrapper, "data-show-times", this._logger_settings.show_times)
            toggle_attribute(this.logs_wrapper, "data-show-dates", this._logger_settings.show_dates)
        });
    }

    append_logs(logs) {
        var scroll_bottom = dom_utils.scroll_y_percent(this.logs_container) == 1;
        this._new_log_elems = [];
        for (var log of Object.values(logs)) {
            if (!log || !log.message) continue;
            var d = new Date(log.ts);
            var log_id = JSON.stringify([log.message, log.level]);
            var log_elem;
            if (this.last_log_elem && this.last_log_elem._log_id === log_id) {
                log_elem = this.last_log_elem;
            } else {
                log_elem = $(`<p><span class="date"></span><span class="time"></span><span class="level"></span><span class="number"></span><span class="message"></span></p>`)[0];
                this.i++;
                if (!this._logs[log.level]) this._logs[log.level] = [];
                this._logs[log.level].push(log_elem);
            }
            log_elem.dataset.number = +(log_elem.dataset.number || 0) + 1;
            log_elem.dataset.level = log.level;
            log_elem.querySelector(".date").textContent = `[${d.toLocaleDateString("en-GB")}]`;
            log_elem.querySelector(".time").textContent = `[${d.toLocaleTimeString("en-GB")}]`;
            log_elem.querySelector(".number").textContent = (+log_elem.dataset.number > 1) ? log_elem.dataset.number : "";
            var level_html;
            var message = log_elem.querySelector(".message");
            var message_html = "";
            if (log.level === "error") {
                set_style_property(message, "font-weight", "bold");
                level_html = `<i title="Error" class="fas fa-exclamation-circle"></i>`;
            } else if (log.level === "warn") {
                level_html = `<i title="Warning" class="fas fa-exclamation-triangle"></i>`;
            } else if (log.level === "debug") {
                level_html = `<i title="Warning" class="fas fa-bug"></i>`;
            } else {
                level_html = `<i title="Info" class="fas fa-info-circle"></i>`;
            }
            message_html += log.message.replace(/\n/g,"<br>");
            set_inner_html(message, message_html);
            log_elem._log_id = log_id
            this.last_log_elem = log_elem;
            set_inner_html(log_elem.querySelector(".level"), level_html);

            this.logs_container.append(log_elem);

            if (this._logs[log.level].length > logs_max_length) {
                this._logs[log.level].shift().remove();
            }
        }
        if (scroll_bottom) dom_utils.scroll_y_percent(this.logs_container, 1);
        this.update();
    }

    save() {
        app.settings.set(this.storage_name, this._logger_settings);
        this.update();
    }

    load() {
        this._logger_settings = utils.deep_copy(Object.assign({}, this._default_logger_settings, app.settings.get(this.storage_name)));
        // console.log(this.storage_name, this._logger_settings);
        this.update();
    }

    empty() {
        set_inner_html(this.logs_container, "");
        utils.clear(this._logs);
        this.last_log_elem = null;
        this._num_logs = 0;
        this.update();
    }
}

export class StreamMetricsPanel extends Panel {
    #modes = [];
    #mode = "";
    #zooming = false;
    #panning = false;
    #init_view_len = 60*1000
    #last_data_max = 0;
    constructor() {
        super("Stream Metrics");

        var button_group = $(`<div class="buttons border-group">`)[0];
        button_group.append($(`<button class="show_encoder_info" title="Toggle Encoder Info"><i class="fas fa-info-circle"></i></button>`)[0]);
        button_group.append($(`<button class="pause_encoder" title="Toggle Pause"><i class="fas fa-pause"></i></button>`)[0]);
        
        this.header_elem.append(button_group);

        this.body_elem.classList.add("chart-wrapper", "no-padding");
        this.body_elem.style.gap = 0;

        this.#modes = ["speed", "bitrate"];
        this.tabs_elem = $(`<div class="tabs buttons" data-toggle="0">`)[0];
        
        this.#modes.forEach(t=>{
            var n = utils.capitalize(t);
            this.tabs_elem.append($(`<button title="${n}" data-value="${t}">${n}</button>`)[0]);
        })
        this.#mode = this.#modes[0];

        this.body_elem.append(this.tabs_elem);
        this.tabs_elem.addEventListener("click", (e)=>{
            var b = e.target.closest("[data-value]");
            this.#set_mode(b.dataset.value);
        })
        
        this.body_elem.append(
            ...$(`
                <div class="chart-inner">
                    <canvas id="chart"></canvas>
                </div>
                <div class="chart-info thin-scrollbar"></div>
            `)
        );
        
        /** @type {HTMLCanvasElement} */
        this.canvas = this.elem.querySelector("#chart");
        this.chart_info_elem = this.elem.querySelector(".chart-info");

        this.on("update", ()=>{
            this.#update_chart();
            if (!this.#panning && !this.#zooming) {
                this.#update_info();
            }
        });
        this.canvas.ondblclick = ()=>{
            this.#update_pan(true);
        };
        var ms_to_timespan = (value)=>{
            value = +value;
            return utils.ms_to_timespan_str(value, "hh:mm:ss")
        }
        this.chart = new Chart(this.canvas, {
            type: "line",
            data: {},
            options: {
                normalized: true,
                parsing: false,
                spanGaps: true,
                onHover: (e)=>{
                    this.canvas.style.cursor = "crosshair"
                },
                animation: false,
                maintainAspectRatio: false,
                responsive:true,
                scales: {
                    x: {
                        // display: 'auto',
                        type: "linear",
                        min: 0,
                        max: this.#init_view_len,
                        ticks: {
                            // count: 6,
                            // stepSize: 5*1000,
                            autoSkip: false,
                            includeBounds: true,
                            // autoSkipPadding
                            // autoSkip: true,
                            // maxRotation: 0,
                            callback: (value, index, values)=>{
                                if (index == 0 || index == values.length - 1) return null;
                                return ms_to_timespan(value);
                            }
                        },
                    },
                    y: {
                        // display: 'auto',
                        type: "linear",
                        ticks: {
                            callback: (value, index, values)=>{
                                return this.#format_value(value)
                            }
                        },
                        /* ticks: {
                            suggestedMin: 0.99,
                            suggestedMax: 1.01,
                            maxTicksLimit: 5,
                        } */
                    }
                },
                plugins: {
                    zoom: {
                        limits: {
                            x: {
                                minRange: 10*1000
                            },
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                            threshold: 1,
                            onPanStart:(c, ...args)=>{
                                this.#panning = true;
                                this.update();
                            },
                            onPanComplete:(c)=>{
                                this.#panning = false;
                                this.update();
                            }
                        },
                        zoom: {
                            wheel: {
                                enabled: false,
                            },
                            pinch: {
                                enabled: false
                            },
                            mode: 'x',
                            onZoomStart:()=>{
                                this.#zooming = true;
                                this.update();
                            },
                            onZoomComplete:(c)=>{
                                this.#zooming = false;
                                this.update();
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (ctxs)=>{
                                return ctxs.map(ctx=>ms_to_timespan(ctx.raw.x)).join(", ");
                            },
                            label: (ctx)=>{
                                return `${this.#parse_key(ctx.dataset.label)[0]}: ${this.#format_value(ctx.raw.y)}`;
                            }
                        }
                    },
                    legend: {
                        labels: {
                            boxWidth: Chart.defaults.font.size,
                            generateLabels: (c)=>{
                                var items = Chart.defaults.plugins.legend.labels.generateLabels(c);
                                for (var i of items) {
                                    i.text = this.#parse_key(i.text)[0];
                                }
                                return items;
                            }
                        },
                        onHover: ()=>{
                            this.canvas.style.cursor = "pointer";
                        },
                        onLeave: ()=>{
                            this.canvas.style.cursor = "";
                        },
                        onClick: (e, legendItem, legend)=>{
                            Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                            this.update();
                        }
                    },
                    decimation: {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: 128,
                        threshold: 128
                    },
                }
            }
        });
        this.#update_chart();
    }

    get data_range() {
        return {
            min: this.chart.data.datasets.length ? Math.min(...this.chart.data.datasets.map(dataset=>{
                var data = dataset._data ?? dataset.data;
                return data.length ? data[0].x : 0;
            })) : 0,
            max: Math.max(0, ...this.chart.data.datasets.map(dataset=>{
                var data = dataset._data ?? dataset.data;
                return data.length ? data[data.length-1].x : 0;
            }))
        }
    }

    #set_mode(mode) {
        if (this.#mode === mode) return;
        this.tabs_elem.dataset.toggle = this.#modes.indexOf(mode);
        this.#mode = mode;
        this.update();
    }
    #parse_key(key) {
        var o = key.split(":")
        var last = o.pop();
        return [o.join(":"), last];
    }

    #update_chart() {
        var pause = app.settings.get("pause_encoder");
        if (pause) return;

        var reset = false;
        var mode_hash = JSON.stringify([this.#mode]);
        if (this._mode_hash != mode_hash) {
            this._mode_hash = mode_hash;
            this.chart.data.datasets = [];
        }
        var reinit_hash = JSON.stringify([app.$._stream.id, app.$._session.id]);
        if (this._reinit_hash != reinit_hash) {
            this._reinit_hash = reinit_hash;
            this.chart.data.datasets = [];
            this.#last_data_max = 0;
            reset = true;
        }

        let graphs = app.$._session.stream.graphs;
        let raw_data = Object.fromEntries(Object.entries(graphs).filter(([k,v])=>k.split(":").pop()===this.#mode));
        var _hash = JSON.stringify([mode_hash, reinit_hash, Object.entries(graphs).map(([k,v])=>[k, v.data])]);
        if (this._hash !== _hash) {
            this._hash = _hash;
            this.chart.data.datasets = Object.entries(raw_data).map(([key,{min,max,data}], i)=>{
                let dataset = this.chart.data.datasets.find(d=>d.label==key);
                dataset = dataset ?? {
                    label: key,
                    borderWidth: 1.0,
                    pointRadius: 1.5,
                    pointHitRadius: 2,
                    pointStyle: "rect",
                    fill: false,
                    // tension: 0,
                    tension: 0.5,
                    borderJoinStyle: "round",
                    data: []
                };
                dataset.borderColor = graph_colors[i%graph_colors.length];
                if (data && max>0) {
                    let dataset_data = dataset._data ?? dataset.data;
                    for (var i = dataset_data.length; i<max; i++) {
                        let [x,y] = data[i];
                        let d = {x:x??0,y: y??0};
                        dataset.data.push(d);
                        if (dataset._data) dataset._data.push(d);
                    }
                }
                return dataset;
            });
        }
        
        this.#update_pan(reset);
        
        this.chart.update();
    }
    #format_value(value) {
        var type = this.#mode;
        // var type = ds.label.split(":").pop();
        if (type == "speed") return `${value.toFixed(3)}x`;
        if (type == "bitrate") return utils.format_bitrate(value, "k");
    }
    #update_pan(reset=false) {
        if (!this.chart.scales.x) return;
        if (reset) this.chart.resetZoom();

        var pan_min = this.chart.scales.x._range.min;
        var pan_max = this.chart.scales.x._range.max;
        var pan_len = pan_max - pan_min;
        var {min, max} = this.data_range;
        var limits_min = min;
        var limits_max = Math.max(min+this.#init_view_len, max);
        var follow = (max > this.#last_data_max && pan_max >= this.#last_data_max && pan_max < max);
        if (this.#last_data_max == 0 && max > 0) reset = true;
        
        this.chart.options.plugins.zoom.limits.x.min = limits_min;
        this.chart.options.plugins.zoom.limits.x.max = limits_max;

        if (reset) this.chart.zoomScale("x", {min: Math.max(min, limits_max - pan_len), max: Math.max(limits_max,max)});
        else if (follow) this.chart.zoomScale("x", {min: Math.max(min, max - pan_len), max: max});
        
        var enabled = max>0;
        this.chart.options.plugins.zoom.pan.enabled = enabled;
        this.chart.options.plugins.zoom.zoom.wheel.enabled = enabled;
        this.chart.options.plugins.zoom.zoom.pinch.enabled = enabled;
        
        this.#last_data_max = max;
    }
    
    #update_info() {
        this.chart.update("zoom"); // not sure why this is necessary. segments is balls.
        var info_rows = [];
        for (var i=0; i<this.chart.data.datasets.length; i++) {
            let dataset = this.chart.data.datasets[i];
            if (!dataset.data.length) continue;
            var meta = this.chart.getDatasetMeta(i);
            var {start,end} = meta.dataset.segments[0];
            var visible_data = dataset.data.slice(start, end+1);
            var y_values = visible_data.map(d=>d.y);
            var avg = utils.average(...y_values);
            var min = Math.min(...y_values);
            var max = Math.max(...y_values);
            var info = {
                "": dataset.label,
                "avg": this.#format_value(avg),
                "min": this.#format_value(min),
                "max": this.#format_value(max),
            };
            info_rows.push(info);
        }
        var hash = JSON.stringify(info_rows);
        if (this.__info_rows_hash != hash) {
            this.__info_rows_hash = hash;
            var table = dom_utils.build_table(info_rows);
            set_children(this.chart_info_elem, table ? [table] : []);
        }
    }
}

export const PLAYLIST_ZOOM_MIN = 0.01;
export const PLAYLIST_ZOOM_MAX = 100;
export const PLAYLIST_ZOOM_BASE = 1.3333;
export class PlaylistPanel extends Panel {
    
    /** @type {any[]} */
    #tracks;
    /** @type {PlaylistItem} */
    #current;
    #tracks_hash;
    get active_sortable() { return this.sortables.find(s=>s.is_active_sortable_in_group()) || this.sortables[0]; }
    get active_track_index() { return this.sortables.indexOf(this.active_sortable); }
    get timeline_width() { return Math.max(...[...this.tracks_elem.children].map(t=>t.lastElementChild ? t.lastElementChild.offsetLeft+t.lastElementChild.offsetWidth : 0)); }
    get tracks() { return this.#tracks; }
    get orientation() { return this.timeline_mode ? Orientation.HORIZONTAL : Orientation.VERTICAL; }
    get timeline_mode() { return this.timeline_mode_select.value == 1; }
    set timeline_mode(value) {
        this.timeline_mode_select.value = value;
        this.sortables.forEach(s=>s.orientation = this.orientation);
        this.update();
    }
    get selection() { return this.active_sortable.get_selection(); }
    set current(value) { this.#current = value; }
    /** @return {PlaylistItem} */
    get current() { return this.#current || app.$._session.playlist["0"] || NULL_PLAYLIST_ITEM; }

    /** @param {Element} elem */
    constructor() {
        super("Playlist");

        this.collapsible = false;
        this.clipping = null;
        // this.debounced_update_info = dom_utils.debounce_next_frame(()=>this.update_info());
        // this.debounced_update_view = dom_utils.debounce_next_frame(()=>this.update_view());

        this.header_elem.innerHTML =
        `<div class="playlist-header">
            <span>Playlist</span>
            <span class="playlist-time-total" title='Playlist Total Duration'></span>
            <span class="playlist-time-left"title='Playlist Time Remaining'></span>
        </div>
        <div class="playlist-controls">
            <div class="timeline-controls buttons border-group">
                <button class="playlist-goto-playhead" title="Go to Playhead"><i class="fas fa-map-marker"></i></button>
            </div>
            <div class="timeline-controls buttons border-group">
                <input class="playlist-zoom-input" type="text"></input>
                <button class="playlist-zoom-into" title="Zoom Into Selection"><i class="fas fa-arrows-alt-h"></i></button>
                <button class="playlist-zoom-out" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
                <button class="playlist-zoom-in" title="Zoom In"><i class="fas fa-search-plus"></i></button>
            </div>
            <div class="buttons border-group">
                <select class="playlist-mode" title="Playlist Mode">
                    <option default value="0">List</option>
                    <option value="1">Timeline</option>
                </select>
            </div>
            <div class="buttons border-group">
                <button class="playlist_sticky" title="Toggle Sticky Mode"><i class="fas fa-thumbtack"></i></button>
                <!-- <button class="playlist_show_scheduled_times" title="Toggle Scheduled Times"><i class="far fa-clock"></i></button> -->
                <button class="wrap_playlist_items" title="Toggle Line Wrap"><i class="fas fa-level-down-alt"></i></button>
                <button class="show_extra_playlist_icons" title="Toggle Media Info Icons"><i class="far fa-play-circle"></i></button>
            </div>
        </div>`;

        this.body_elem.innerHTML =
            `<div class="playlist-info-wrapper">
                <button class="back"><i class="fas fa-arrow-left"></i></button>
                <div class="playlist-path">
                    <div class="info-path-wrapper">
                        <div class="info-path"></div>
                    </div>
                </div>
                <div class="playlist-info">
                    <div class="info-text"></div>
                    <button class="toggle-selection"></button>
                </div>
            </div>
            <div class="playlist-content">
                <div class="timeline-container" tabindex="-1">
                    <div class="timeline-headers"></div>
                    <div class="timeline-and-ticks-wrapper">
                        <div class="timeline-ticks"></div>
                        <div class="timeline-wrapper">
                            <div class="timeline-tracks thin-scrollbar"></div>
                            <div class="timeline-overlay">
                                <div class="timeline-playhead" style="--color:rgb(185,0,0);--triangle-size:3px"><div class="tri top-right"></div><div class="tri top-left"></div></div>
                                <div class="timeline-cursor" style="--color:black;--triangle-size:3px"><div class="tri top-right"></div><div class="tri top-left"></div><div class="tri bottom-right"></div><div class="tri bottom-left"></div></div>
                                <div class="timeline-limits"></div>
                                <div class="timeline-highlights"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="playlist-buttons">
                    <button id="pl-add-file" title="Add Files...">Add Files...</button>
                    <button id="pl-upload-file" title="Upload Files...">Upload Files...</button>
                    <button id="pl-add-url" title="Add URLs...">Add URLs...</button>
                    <button id="pl-add-other" title="Other..."><i class="fas fa-ellipsis-h"></i></button>
                </div>
            </div>`
        add_class(this.body_elem, "playlist-body");
        add_class(this.elem, "playlist-wrapper");
        
        this.zoom = 1.0;
        /** @type {ResponsiveSortable[]} */
        this.sortables = [];
        this.duration = 0;
        this.time = null;

        this.timeline_container_elem = this.elem.querySelector(".timeline-container");
        this.wrapper_elem = this.elem.querySelector(".timeline-and-ticks-wrapper");
        this.tracks_elem = this.elem.querySelector(".timeline-tracks");
        this.ticks_elem = this.elem.querySelector(".timeline-ticks");
        this.headers_elem = this.elem.querySelector(".timeline-headers");
        this.overlay_elem = this.elem.querySelector(".timeline-overlay");
        set_attribute(this.ticks_elem, "title", `Place Timeline Cursor`);
        
        this.playhead_elem = this.elem.querySelector(".timeline-playhead");
        this.cursor_elem = this.elem.querySelector(".timeline-cursor");
        this.limits_elem = this.elem.querySelector(".timeline-limits");
        this.highlights_elem = this.elem.querySelector(".timeline-highlights");
        
        this.playlist_time_total_elem = this.elem.querySelector(".playlist-time-total");
        this.playlist_time_left_elem = this.elem.querySelector(".playlist-time-left");

        this.playlist_info_wrapper_elem = this.elem.querySelector(".playlist-info-wrapper");
        
        // this.pl_toggle_sticky_button = this.playlist_wrapper_elem.querySelector(".playlist_sticky");
        this.timeline_mode_select = this.elem.querySelector(".playlist-mode");
        this.playlist_zoom_in_button = this.elem.querySelector(".playlist-zoom-in");
        this.playlist_zoom_out_button = this.elem.querySelector(".playlist-zoom-out");
        this.playlist_zoom_into_button = this.elem.querySelector(".playlist-zoom-into");
        this.playlist_goto_playhead_button = this.elem.querySelector(".playlist-goto-playhead");
        this.playlist_info = this.elem.querySelector(".playlist-info");
        this.playlist_info_text = this.playlist_info.querySelector(".info-text");
        this.playlist_path = this.elem.querySelector(".playlist-path");
        this.playlist_path_text = this.playlist_path.querySelector(".info-path");
        this.playlist_back_button = this.elem.querySelector("button.back");
        this.toggle_selection_button = this.playlist_info.querySelector(".toggle-selection");
        this.playlist_zoom_input = this.elem.querySelector(".playlist-zoom-input");
        this.pl_show_extra_icons_button = this.elem.querySelector("button.show_extra_playlist_icons");
        this.pl_toggle_line_wrap_button = this.elem.querySelector("button.wrap_playlist_items");
        this.toggle_milliseconds_button = this.elem.querySelector("button.time_display_ms");

        this.pl_add_file_button = this.elem.querySelector("#pl-add-file");
        this.pl_upload_file_button = this.elem.querySelector("#pl-upload-file");
        this.pl_add_url_button = this.elem.querySelector("#pl-add-url");
        this.pl_add_other_button = this.elem.querySelector("#pl-add-other");

        this.ticks_bar = new TicksBar(this.ticks_elem, {
            placement: "top",
        });
        
        this.playlist_back_button.addEventListener("click", ()=>{
            this.back();
        })

        this.timeline_container_elem.addEventListener("dblclick", (e) => {
            var item_el = e.target.closest(".item");
            if (!item_el) return;
            var item = app.$._session.playlist[item_el.dataset.id];
            app.playlist_play(item);
            // elem.ondblclick = ()=>app.playlist_play(item);
        })

        this.timeline_container_elem.addEventListener("contextmenu", (e) => {
            if (e.target.contentEditable == "true") return;
            var sortable = Sortable.utils.get(e.target);
            if (sortable) {
                e.preventDefault();
                e.stopPropagation();
                this.open_context_menu(e.target, e);
            }
        });
        
        this.playlist_zoom_input.addEventListener("change",()=>{
            this.set_timeline_view(parseFloat(this.playlist_zoom_input.value)/100);
        })
        
        this.playlist_zoom_in_button.addEventListener("click", (e)=>{
            this.inc_timeline_zoom(1);
        });
        this.playlist_zoom_out_button.addEventListener("click", (e)=>{
            this.inc_timeline_zoom(-1);
        });
        this.playlist_zoom_into_button.addEventListener("click", (e)=>{
            this.zoom_into_selected_playlist_items();
        });
        this.playlist_goto_playhead_button.addEventListener("click", (e)=>{
            this.scroll_to_playhead();
        });
        this.timeline_mode_select.addEventListener("change", (e)=>{
            app.settings.set("playlist_mode", +this.timeline_mode_select.value);
            this.scroll_to_playhead();
        });
        this.pl_add_file_button.addEventListener("click", async (e)=>{
            var paths = await open_file_manager({
                id: "load-file",
                files: true,
                multiple: true
            }, true);
            if (paths) app.playlist_add(paths);
        });
        if (IS_ELECTRON) this.pl_upload_file_button.style.display = "none";
        this.pl_upload_file_button.addEventListener("click", async (e)=>{
            var files = await dom_utils.open_file_dialog({multiple:true}) // directories:true
            app.playlist_add(files);
        });

        this.pl_add_url_button.addEventListener("click", async (e)=>{
            var urls_str = await new Promise((resolve)=>{
                app.playlist_add_url_menu.show(resolve);
            });

            if (urls_str) {
                var urls = urls_str.split(/\n+/).map(s=>s.trim()).filter(s=>s);
                app.playlist_add(urls);
            }
        });

        dom_utils.tippy(this.pl_add_other_button, {
            appendTo: app.elem,
            allowHTML: true,
            trigger: "click",
            // hideOnClick: "toggle",
            placement: "top-start",
            interactive: true,
            theme:"list",
            onShow: (instance) =>{
                var c = this.commands;
                var items = [
                    c.add_empty,
                    c.add_playlist,
                    c.add_rtmp,
                    c.add_intertitle,
                    c.add_handover_macro,
                    c.add_stop_streaming_macro,
                    c.add_playlist_exit,
                    "-----",
                    c.unload_current,
                    c.rescan_all,
                    "-----",
                    c.save_playlist,
                    c.generate_schedule,
                ];
                var list = create_menu(items, {click:()=>instance.hide()});
                instance.setContent(list);
            },
        });

        this.commands = {
            play: new PlaylistCommand({
                name: "Play",
                description: "Play Selection",
                icon: `<i class="fas fa-play"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    app.playlist_play(items[0]);
                },
                shortcut: "P",
            }),
            info: new PlaylistCommand({
                name: "Information",
                description: "Information",
                icon: `<i class="fas fa-info-circle"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    app.playlist_info_menu.show(items);
                },
                shortcut: "I",
            }),
            modify: new PlaylistCommand({
                name: "Modify...",
                description: "Modify Selection...",
                icon: `<i class="fas fa-sliders-h"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    app.playlist_modify_menu.show(items);
                },
                shortcut: "M",
            }),
            delete_item: new PlaylistCommand({
                name: "Delete",
                description: "Delete Selection",
                icon: `<i class="fas fa-trash-alt"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    app.playlist_remove(items);
                },
                shortcut: "Delete",
            }),
            rescan: new PlaylistCommand({
                name:  "Rescan",
                description: "Rescan Selection",
                icon: `<i class="fas fa-sync-alt"></i>`,
                visible: (items)=>items.some(i=>i._is_scannable),
                // disabled: (items)=>!items.every(i=>i.is_scannable),
                click: (items)=>{
                    app.playlist_rescan(items);
                },
                shortcut: "R",
            }),
            reveal: new PlaylistCommand({
                name: "Navigate To",
                description: "Navigate To Selection",
                icon: `<i class="fas fa-arrow-up-right-from-square"></i>`,
                visible: (items)=>items.some(i=>i._url.protocol.match(/^(file|https?):$/)),
                disabled: (items)=>!items.every(i=>i._is_navigatable),
                click: (items)=>{
                    app.navigate_to(items.map(i=>i.filename));
                },
                shortcut: "Ctrl+F",
            }),
            download: new PlaylistCommand({
                name: "Download",
                description: "Download Selection",
                icon: `<i class="fas fa-download"></i>`,
                visible: (items)=>items.some(i=>i._is_downloadable),
                // disabled: (items)=>!items.every(i=>i.is_downloadable),
                click: (items)=>{
                    app.playlist_download(items);
                },
            }),
            cancel_download: new PlaylistCommand({
                name: "Cancel Download",
                icon: `<i class="fas fa-ban"></i>`,
                visible: (items)=>items.some(i=>i._download),
                click: (items)=>{
                    app.playlist_cancel_download(items);
                }
            }),
            cancel_upload: new PlaylistCommand({
                name: "Cancel Upload",
                icon: `<i class="fas fa-ban"></i>`,
                visible: (items)=>items.some(i=>i.upload && i.upload.status == UPLOAD_STATUS.STARTED),
                click: (items)=>{
                    app.playlist_cancel_upload(items);
                }
            }),
            rename: new PlaylistCommand({
                name: "Rename",
                description: "Rename Selection",
                icon: `<i class="fas fa-i-cursor"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.rename(items[0]);
                },
                shortcut: "F2",
            }),
            edit_playlist: new PlaylistCommand({
                name: "Enter Playlist",
                description: "Enter Selected Playlist",
                icon: `<i class="fas fa-right-to-bracket"></i>`,
                visible: (items)=>items.some(i=>i._is_playlist),
                // disabled: (items)=>!items.every(i=>i.is_playlist),
                click: (items)=>{
                    if (items[0]) this.open(items[0]);
                },
                shortcut: "Enter",
            }),
            add_to_playlist: new PlaylistCommand({
                name: "Add to New Playlist",
                description: "Add Selection to New Playlist",
                icon: `<i class="far fa-object-group"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    app.playlist_group(items);
                },
                shortcut: "Ctrl+G",
            }),
            breakdown_playlist: new PlaylistCommand({
                name: "Breakdown Playlist",
                description: "Breakdown Selected Playlist",
                icon: `<i class="far fa-object-ungroup"></i>`,
                visible: (items)=>items.some(i=>i._is_playlist),
                // disabled: (items)=>!items.every(i=>i.is_playlist),
                click: (items)=>{
                    app.playlist_breakdown(items);
                },
                shortcut: "Ctrl+U",
            }),
            split: new PlaylistCommand({
                name: "Split...",
                description: "Split Selection...",
                icon: `<i class="fas fa-sitemap" style="transform:rotate(-90deg);"></i>`,
                visible: (items)=>items.some(i=>i._is_splittable),
                disabled: (items)=>!items.every(i=>i._is_splittable),
                click: (items)=>{
                    app.split_menu.show(items);
                }
            }),
            slice_at_timeline_cursor: new PlaylistCommand({
                name: "Slice at Timeline Cursor",
                description: "Slice Selection at Timeline Cursor",
                icon: `<i class="fas fa-slash"></i>`,
                visible: (items)=>this.timeline_mode && this.cursor_position != null,
                disabled: (items)=>!items.every(i=>i._is_splittable),
                click: (items)=>{
                    app.playlist_split(items, [this.cursor_position], false, true);
                },
                shortcut: "S",
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            /* timeline_cursor_play: new Command({
                name: "Play from Cursor",
                icon: `<i class="fas fa-play"></i>`,
                visible: this.timeline_mode && this.playlist.cursor_position != null,
                click: ()=>{
                    this.playlist_play()
                }
            }), */
            timeline_cursor_to_start: new PlaylistCommand({
                name: "Set Timeline Cursor to Start",
                description: "Set Timeline Cursor to Start of Selection",
                icon: `<i class="fas fa-arrow-right-to-bracket" style="transform:scaleX(-1);"></i>`,
                visible: (items)=>items.length>0 && this.timeline_mode,
                click: (items)=>{
                    this.cursor_position = Math.min(...items.map(i=>i._userdata.timeline_start));
                    this.#update_view();
                },
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            timeline_cursor_to_end: new PlaylistCommand({
                name: "Set Timeline Cursor to End",
                description: "Set Timeline Cursor to End of Selection",
                icon: `<i class="fas fa-arrow-right-to-bracket"></i>`,
                visible: (items)=>items.length>0 && this.timeline_mode,
                click: (items)=>{
                    this.cursor_position = Math.max(...items.map(i=>i._userdata.timeline_end));
                    this.#update_view();
                },
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            clipboard_copy: new PlaylistCommand({
                name: "Copy",
                description: "Copy Selection to Clipboard",
                icon: `<i class="fas fa-copy"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.selection_to_clipboard(false)
                },
                shortcut: "Ctrl+C",
            }),
            clipboard_cut: new PlaylistCommand({
                name: "Cut",
                description: "Cut Selection to Clipboard",
                icon: `<i class="fas fa-cut"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.selection_to_clipboard(true)
                },
                shortcut: "Ctrl+X",
            }),
            clipboard_paste: new PlaylistCommand({
                name: "Paste from Clipboard",
                icon: `<i class="fas fa-paste"></i>`,
                // visible: (items)=>true,
                visible: (items)=>!!this.clipboard,
                click: (items)=>{
                    this.clipboard_paste();
                },
                shortcut: "Ctrl+V",
            }),
            clipboard_clear: new PlaylistCommand({
                name: "Clear Clipboard",
                icon: `<i class="far fa-clipboard"></i>`,
                visible: (items)=>!!this.clipboard,
                click: (items)=>{
                    this.clipboard_clear();
                },
            }),
            move_to_top: new PlaylistCommand({
                name: "Move to Start",
                description: "Move Selection to Start",
                icon: ()=>`<i class="fas fa-angle-double-${this.timeline_mode?"left":"up"}"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.move_selection_to_start();
                },
                shortcut: "Alt+Home",
            }),
            move_up: new PlaylistCommand({
                name: "Move Back",
                description: "Move Selection Back",
                icon: ()=>`<i class="fas fa-angle-${this.timeline_mode?"left":"up"}"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.move_selection_back();
                },
                shortcut: ()=>`Alt+Arrow${this.timeline_mode?"Left":"Up"}`,
            }),
            move_down: new PlaylistCommand({
                name: "Move Forward",
                description: "Move Selection Forward",
                icon: ()=>`<i class="fas fa-angle-${this.timeline_mode?"right":"down"}"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.move_selection_forward();
                },
                shortcut: ()=>`Alt+Arrow${this.timeline_mode?"Right":"Down"}`,
            }),
            move_to_bottom: new PlaylistCommand({
                name: "Move to End",
                description: "Move Selection to End",
                icon: ()=>`<i class="fas fa-angle-double-${this.timeline_mode?"right":"down"}"></i>`,
                visible: (items)=>items.length>0,
                click: (items)=>{
                    this.move_selection_to_end();
                },
                shortcut: "Alt+End",
            }),
            focus: new PlaylistCommand({
                name: "Focus",
                description: "Focus Selection",
                click: (items)=>{
                    this.zoom_into_selected_playlist_items()
                },
                shortcut: "F",
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            playlist_back: new PlaylistCommand({
                name: "Parent Playlist",
                click: (items)=>{
                    this.back();
                },
                shortcut: "Backspace | Escape",
            }),
            // ------------------------------
            add_empty: new PlaylistCommand({
                name: ()=>"Add Empty",
                icon: `<i class="fas fa-plus"></i>`,
                click: ()=>{
                    app.playlist_add({
                        filename:"livestreamer://empty",
                        props: {
                            background_mode: "default"
                        }
                    });
                }
            }),
            add_playlist: new PlaylistCommand({
                name: ()=>"Add Empty Playlist",
                icon: `<i class="fas fa-plus"></i>`,
                click: ()=>{
                    app.playlist_add({
                        filename:"livestreamer://playlist",
                    });
                }
            }),
            add_rtmp: new PlaylistCommand({
                name: ()=>"Add RTMP Stream",
                icon: `<i class="fas fa-plus"></i>`,
                click: ()=>{
                    app.playlist_add({
                        filename:"livestreamer://rtmp",
                    });
                },
                disabled: ()=>!!this.current._is_merged
            }),
            add_intertitle: new PlaylistCommand({
                name: ()=>"Add Intertitle",
                icon: `<i class="fas fa-plus"></i>`,
                click: async()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://intertitle",
                    });
                    // this.playlist_modify_settings.show(ids);
                },
                disabled: ()=>!!this.current._is_merged
            }),
            add_stop_streaming_macro: new PlaylistCommand({
                name: ()=>"Add Macro: Stop",
                icon: `<i class="fas fa-plus"></i>`,
                click: async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://macro",
                        props: {
                            function: "stop"
                        }
                    });
                },
                disabled: ()=>!!this.current._is_merged
            }),
            add_handover_macro: new PlaylistCommand({
                name: ()=>"Add Macro: Handover",
                icon: `<i class="fas fa-plus"></i>`,
                click: async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://macro",
                        props: {
                            function: "handover"
                        }
                    });
                },
                disabled: ()=>!!this.current._is_merged
            }),
            add_playlist_exit: new PlaylistCommand({
                name: ()=>"Add Playlist Exit",
                icon: `<i class="fas fa-plus"></i>`,
                click: async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://exit",
                    });
                },
                visible: ()=>!!this.current._parent
            }),
            unload_current: new PlaylistCommand({
                name: ()=>"Unload Current File",
                icon: `<i class="fas fa-minus-circle"></i>`,
                disabled: ()=>!app.$._session._current_playing_item !== NULL_PLAYLIST_ITEM,
                click: ()=>app.playlist_play(NULL_PLAYLIST_ITEM),
            }),
            rescan_all: new PlaylistCommand({
                name: ()=> "Rescan All",
                icon: `<i class="fas fa-sync-alt"></i>`,
                // click: ()=>app.playlist_rescan_all(),
                click: ()=>app.playlist_rescan(this.current._children),
            }),
            save_playlist: new PlaylistCommand({
                name: ()=>"Save Playlist...",
                icon: `<i class="fas fa-save"></i>`,
                click: ()=>app.save_playlist_menu.show(),
            }),
            generate_schedule: new PlaylistCommand({
                name: ()=>"Generate Schedule...",
                icon: `<i class="fas fa-calendar-alt"></i>`,
                click: ()=>app.schedule_generator_menu.show()
            })
        }

        for (let color_key in item_colors) {
            let color = item_colors[color_key] || "#fff";
            this.commands[`color_${color_key}`] = new PlaylistCommand({
                click: (items)=>{
                    var v = color_key === "none" ? null : color_key;
                    items.map(i=>i.props.color = v);
                    app.$._push(...items.map(i=>[`sessions/${app.$._session.id}/playlist/${i.id}/props/color`, v]));
                    app.request({
                        call: ["session", "update_values"],
                        arguments: items.map(i=>[`playlist/${i.id}/props/color`, v])
                    });
                },
                render:(items, elem)=>{
                    add_class(elem, "color");
                    var colors = new Set(items.map(i=>i.props.color||"none"));
                    var inner = colors.has(color_key) ? ((colors.size == 1) ? `✓` : "-") : "";
                    var el = $(`<div class="color" style="background: ${color}; outline: 1px solid #ddd; text-align: center;">${inner}</div>`)[0];
                    elem.append(el);
                },
                title: utils.capitalize(color_key),
            })
        }
        
        /*  move_to_bottom: new PlaylistCommand({
            name: "Move to End",
            description: "Move Selection to End",
            icon: ()=>`<i class="fas fa-angle-double-${this.timeline_mode?"right":"down"}"></i>`,
            visible: (items)=>items.length>0,
            click: (items)=>{
                this.move_selection_to_end();
            },
            shortcut: "Alt+End",
        }), */
        
        this.timeline_container_elem.addEventListener("wheel", (e)=>{
            if (!this.timeline_mode) return;
            e.preventDefault();
            var d = e.shiftKey ? 0.25 : 1;
            if (e.deltaY > 0) d *= -1;
            this.inc_timeline_zoom(d, e);
        });

        this.tracks_elem.addEventListener("scroll", ()=>this.#update_view());

        ondrag(this.timeline_container_elem, (e)=>{
            if (e.button == 0 && e.altKey) {
                var orig_e = e;
                var pos = [this.tracks_elem.scrollLeft, this.tracks_elem.scrollTop];
                return (e)=>{
                    this.tracks_elem.scrollLeft = pos[0] + orig_e.clientX - e.clientX;
                    this.tracks_elem.scrollTop = pos[1] + orig_e.clientY - e.clientY;
                }
            }
        });

        {
            this.timeline_container_elem.addEventListener('touchmove', (e)=>{
                if (e.touches.length > 1) e.preventDefault();
            });
            let mc = new Hammer.Manager(this.timeline_container_elem, {touchAction: 'none', cssProps: {userSelect:"auto"}});
            let pinch = new Hammer.Pinch({enable:true});
            mc.add([pinch]);
            let x_percent;
            let init_zoom;
            mc.on("pinchstart", (e)=>{
                var r = this.timeline_container_elem.getBoundingClientRect();
                init_zoom = this.zoom;
                x_percent = (e.center.x - r.x) / r.width;
            });
            mc.on("pinchmove", (e)=>{
                this.set_timeline_view(init_zoom * e.scale, null, x_percent);
            });
        }

        // this.ticks_elem.style.cursor = "none" // "text";
        this.ticks_elem.addEventListener("click", (e)=>{
            var data = this.ticks_bar.parse_event(e);
            this.cursor_position = data.time;
            this.#update_view();
        });
        
        window.addEventListener("keydown", this.on_keydown = (e)=>{
            if (dom_utils.has_focus(this.timeline_container_elem)) {
                this.try_command_shortcut(e);
            }
        }, true);

        var on_scroll;
        // window.addEventListener("resize", ()=>this.#update_position());
        app.main_elem.addEventListener("scroll", on_scroll=()=>this.#update_position());
        var resize_observer = new ResizeObserver(()=>this.#update_position());
        this.on("register", ()=>resize_observer.observe(this.elem.parentElement));

        this.on("update", ()=>{
            var current = this.current;
            var current_ud = current._userdata;
            var duration = current_ud.duration;
            var timeline_duration = current_ud.timeline_duration;
            var self_and_parents = [app.$._session._current_playing_item, ...app.$._session._current_playing_item._parents];
            var a_index = self_and_parents.indexOf(current);
            var timeline_time = utils.sum(self_and_parents.slice(0, a_index).map(item=>utils.try(()=>item._userdata.timeline_start)||0)) + Math.min(app.$._session._current_time, app.$._session._current_playing_item._userdata.timeline_duration);
            var time = utils.sum(self_and_parents.slice(0, a_index).map(item=>utils.try(()=>item._userdata.start)||0)) + Math.min(app.$._session._current_time, app.$._session._current_playing_item._userdata.duration);
    
            this.time = timeline_time;
            this.duration = timeline_duration;
            this.clipping = current_ud.clipping;
            if (this.clipping) {
                this.clip_time = utils.loop(this.time + this.clipping.offset + this.clipping.start, this.clipping.start, this.clipping.end);
            } else {
                this.clip_time = this.time;
            }
    
            this.playlist_back_button.disabled = !current._parent;
            
            set_inner_html(this.playlist_time_total_elem, `(${utils.seconds_to_timespan_str(duration)})`);
            set_inner_html(this.playlist_time_left_elem, `[-${utils.seconds_to_timespan_str(duration-time)}]`);
    
            this.playlist_time_left_elem.style.display = current === app.$._session.playlist["0"] ? "" : "none"
            
            app.build_playlist_breadcrumbs(this.playlist_path_text, current, true);
            
            this.#update_position();
            this.#update_view();
            this.#rebuild_items();
            this.#update_info();
        })

        this.on("destroy", ()=>{
            resize_observer.disconnect();
            app.main_elem.removeEventListener("scroll", on_scroll);
            this.sortables.forEach(s=>s.destroy());
            this.sortables = [];
        });

        this.set_tracks(1);
    }

    set_tracks(num_tracks, is_2_track) {
        var tracks = (is_2_track) ? [{
            title:"Video Track",
            header: `<i class="fas fa-film"></i>`,
        }, {
            title:"Audio Track",
            header: `<i class="fas fa-music"></i>`,
        }] : [];
        num_tracks = Math.max(1,num_tracks);
        for (var i = 0; i < num_tracks; i++) {
            if (!tracks[i]) tracks[i] = { header:`Track ${i+1}` };
        }
        var tracks_hash = JSON.stringify(tracks);
        if (tracks_hash == this.#tracks_hash) return;

        console.debug("refreshing sortables")
        this.#tracks_hash = tracks_hash;
        this.#tracks = tracks;
        dom_utils.empty(this.tracks_elem);
        dom_utils.empty(this.headers_elem);
        dom_utils.empty(this.highlights_elem);
        this.sortables.forEach(s=>s.destroy());

        toggle_class(this.timeline_container_elem, "single-track", num_tracks == 1);

        this.sortables = tracks.map((t,i)=>{
            // var playlist_top = $(`<div class="playlist-top" title="${utils.capitalize(t.name)}">${t.icon}</div>`)[0];
            // playlist_track.append(playlist_top);
            var playlist_elem = $(`<ul class="playlist"></ul>`)[0];
            this.tracks_elem.append(playlist_elem);

            var playlist_header = $(`<div>${t.header}</div>`)[0];
            set_attribute(playlist_header, "title", t.title || t.header);
            playlist_header.onclick = ()=>sortable.set_active_sortable_in_group();
            this.headers_elem.append(playlist_header);

            var playlist_highlight = $(`<div></div>`)[0];
            this.highlights_elem.append(playlist_highlight);

            var sortable = new ResponsiveSortable(playlist_elem, {
                group: 'playlist-tracks',
                // handle: ".handle",
                filter: ".item-dropdown",
                multiDrag: true, // Enable multi-drag
                fallbackTolerance: 3, // So that we can select items on mobile
                animation: 150,
                avoidImplicitDeselect: true, // true - if you don't want to deselect items on outside click
            });
            sortable.orientation = this.orientation;
            sortable.el.addEventListener("select", (evt)=>{
                this.update();
            });
            sortable.el.addEventListener("unchoose", (e)=>{
                this.scroll_into_view(e.item)
            });
            sortable.el.addEventListener("deselect", (evt)=>{
                this.update();
            });
            sortable.el.addEventListener("active-change", (e)=>{
                toggle_class(playlist_header, "active", e.active);
                toggle_class(playlist_highlight, "active", e.active);
            });
            sortable.el.addEventListener("end", (evt)=>{
                this.sync();
            });
            return sortable;
        });
        if (this.sortables[0]) this.sortables[0].set_active_sortable_in_group();
    }

    /** @param {Element} elem */
    scroll_into_view(elem, opts) {
        if (!elem) return;
        /* var parent = elem.parentElement;
        while (parent) {
            if (opts.nearest) {
                if ((elem.offsetTop < parent.scrollTop) || ((elem.offsetTop+elem.offsetHeight) > (parent.scrollTop + parent.offsetHeight))) {
                    if ((elem.offsetTop + elem.offsetHeight/2) < (parent.scrollTop + parent.offsetHeight/2)) {
                        parent.scrollTop = elem.offsetTop;
                    } else {
                        parent.scrollTop = elem.offsetTop - parent.offsetHeight + elem.offsetHeight;
                    }
                }
                if ((elem.offsetLeft+elem.offsetWidth) > (parent.scrollLeft + parent.offsetWidth) && (elem.offsetWidth < parent.offsetWidth)) {
                    parent.scrollLeft = elem.offsetLeft - parent.offsetWidth + elem.offsetWidth;
                } else if (elem.offsetLeft <= parent.scrollLeft || elem.offsetWidth > parent.offsetWidth) {
                    parent.scrollLeft = elem.offsetLeft;
                }
            } else {
                parent.scrollTop = elem.offsetTop;
                parent.scrollLeft = elem.offsetLeft;
            }
            parent = parent.parentElement;
        } */
        elem.scrollIntoView({block:"nearest", inline:"nearest"});
        if (this.orientation === Orientation.VERTICAL) {
            var r = elem.getBoundingClientRect();
            var bottom = app.main_elem.offsetHeight-40;
            if (r.bottom > bottom) {
                app.main_elem.scrollBy(0, r.bottom-bottom);
            }
        }
    }

    async #rebuild_items() {
        await Promise.all(this.sortables.map(s=>s.last_drag));

        let is_running = app.$._session._is_running;
        
        var current_playlist = this.current;
        var current_playlist_tracks = current_playlist._tracks;
        // var last_playlist = this.last_playlist_on_rebuild || NULL_PLAYLIST_ITEM;
        /** @type {PlaylistItem} */
        var current_item = app.$._session._current_playing_item;
        var current_item_parents = new Set(current_item._parents);
        
        var start_time = null;
        // var now = Date.now();
        // /** @param {PlaylistItem} item */
        // var calculate_start_time = (item)=>{
        //     var t = (utils.sum([item, ...item._get_parents()].map(i=>i._userdata.start || 0))) * 1000;
        //     if (item === current_item) t -= app.$._session._current_time * 1000;
        //     return t;
        // }
        // if (app.settings.get("playlist_show_scheduled_times")) {
        //     if (!is_running && app.$._session.schedule_start_time) {
        //         start_time = +new Date(app.$._session.schedule_start_time);
        //     } else {
        //         // start_time = calculate_start_time(current_item)
        //     }
        // }

        this.set_tracks(current_playlist_tracks.length, current_playlist && current_playlist.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK);
        var new_items = [];

        var emit_change = dom_utils.debounce_next_frame(()=>this.emit("change"));

        this.sortables.forEach((sortable,i)=>{
            /** @type {PlaylistItem[]} */
            var items = current_playlist_tracks[i] || EMPTY_ARRAY;
            dom_utils.rebuild(sortable.el, items, {
                add: (item, elem, index)=>{
                    if (!elem) {
                        new_items.push(item);
                        elem = $(`<li class="item"><div><div class="clips"></div><div class="front"><span class="play-icons"></span><span class="icons"></span><span class="filename"></span><span class="extra"></span><span class="badges"></span><div class="duration"></div></div></div></li>`)[0];
                    }
                    var ud = item._userdata;
                    var is_current_item = item.id == current_item.id;
                    var is_current_ancestor = current_item_parents.has(item);
                    var is_cutting = !!(this.clipboard && this.clipboard.cutting && this.clipboard.items_set.has(item));
                    
                    var _hash = JSON.stringify([index, item, ud, is_current_item, is_current_ancestor, is_cutting, start_time, is_running]);
                    if (_hash === elem._hash) return;

                    elem._hash = _hash;
                    elem._item = item;
                    
                    let media_info = item._media_info || EMPTY_OBJECT;
                    let children = item._children;
                    // let num_descendents = item._descendents.length;
                    let root_merged_playlist = item._root_merged_playlist;
                    var is_playlist = item._is_playlist;
                    var problems = [];
                    let name = item._get_pretty_name();
                    let filename_parts = [`<span>${name}</span>`];
                    let title_parts = [name];
                    let main_icon;
                    var icons = [];
                    var play_icons = [];
                    let background_color, outline_color;
                    let badges = {};
    
                    toggle_class(elem, "cutting", is_cutting);
                    var is_upload_dummy = item.filename == "livestreamer://upload"
                    
                    var play_icons_elem = elem.querySelector(".play-icons");
                    var icons_elem = elem.querySelector(".icons");
                    var filename_elem = elem.querySelector(".filename");
                    var duration_elem = elem.querySelector(".duration");
                    var extra_elem = elem.querySelector(".extra");
                    var badges_elem = elem.querySelector(".badges");
                    var clips_elem = elem.querySelector(".clips");
                    
                    let blocks = [];

                    if (ud.clipping) {
                        if (ud.clipping.loops < 128) {
                            let segments = get_clip_segments(ud.clipping);
                            if (ud.clipping.loops > 1) {
                                let t = 0, d = ud.duration;
                                if (d) {
                                    for (let s of segments) {
                                        blocks.push({x:t/d, width:s.duration/d})
                                        t += s.duration
                                    }
                                }
                            } else {
                                let d = ud.media_duration;
                                if (d) {
                                    for (let s of segments) {
                                        blocks.push({x:s.start/d, width:s.duration/d});
                                    }
                                }
                            }
                        }
                        blocks = blocks.filter(b=>b.width>0.0001);
                        if (blocks.length == 1 && blocks[0].width == 1) blocks = [];
                    }
                    let clips_html = blocks.map(b=>`<div style="left:${b.x.toFixed(5)*100}%;width:${b.width.toFixed(5)*100}%;"></div>`).join("");
                    set_inner_html(clips_elem, clips_html);
                    toggle_class(clips_elem, "repeats", !!(ud.clipping && ud.clipping.loops > 1))
                    
                    if (ud.is_processing) {
                        play_icons.push(`<i class="fas fa-sync fa-spin"></i>`);
                    } else if (is_current_ancestor) {
                        play_icons.push(`<i class="fas fa-arrow-right"></i>`);
                    } else if (is_current_item) {
                        if (is_running) {
                            play_icons.push(`<i class="fas fa-play"></i>`);
                        } else {
                            play_icons.push(`<i class="fas fa-forward-step"></i>`);
                        }
                    } else {
                        play_icons.push(`<span class="numbering">${String(index+1).padStart(2,"0")}</span>`);
                    }
                    
                    if (!is_upload_dummy) {
                        if (media_info.exists === false) {
                            problems.push({level:3, text:"Media does not exist."});
                        } else if (!utils.is_empty(media_info) && !media_info.streams && media_info.protocol !== "livestreamer:" && !item._is_playlist && !ud.is_processing) {
                            problems.push({level:1, text:"Possibly invalid media."});
                        } else if (root_merged_playlist && !item._is_mergable) {
                            problems.push({level:2, text:"Merged items must be local files or empties."});
                        }
                    }
                    
                    if (item.props.color) {
                        background_color = item_colors[item.props.color];
                        outline_color = new utils.Color(item_colors[item.props.color]).rgb_mix("#000",0.3).to_rgb_hex();
                    }
                    if (is_playlist) {
                        main_icon = `<i class="fas fa-folder-open" title="Playlist"></i>`;
                        let b = "playlist";
                        if (item.props.playlist_mode == PLAYLIST_MODE.MERGED) b = "merged-playlist";
                        if (item.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK) b = "2-track-playlist";
                        badges["playlist"] = b;
                        filename_parts.push(`<span class="playlist-count">${children.length}</span>`)
                        title_parts.push(`(${children.length})`);
                    }
                    // userdata.number = String(i+1).padStart(2,"0")
                    
                    var is_special = item.filename.startsWith("livestreamer://");
                    if (is_special) {
                        var type = item.filename.replace("livestreamer://", "");
                        if (!(type in badges)) badges[type] = type;
                        if (type == "macro") {
                            main_icon = `<i class="fas fa-scroll"></i>`
                        } else if (type == "intertitle") {
                            main_icon = `<i class="fas fa-paragraph"></i>`
                        } else if (type == "macro") {
                            main_icon = `<i class="fas fa-scroll"></i>`
                        } else if (type == "empty") {
                            main_icon = `<i class="fas fa-ghost"></i>`
                        } else if (type == "exit") {
                            main_icon = `<i class="fas fa-arrow-left-long"></i>`
                        } else if (type == "rtmp") {
                            title_parts.push(item._is_rtmp_live ? "[Connected]" : "[Disconnected]");
                            if (item._is_rtmp_live) {
                                main_icon = `<i class="fas fa-link" style="color:#00cc00;" title="Connected"></i>`;
                            } else {
                                main_icon = `<i class="fas fa-unlink" title="Disconnected"></i>`;
                            }
                            // main_icon = `<i class="fas fa-tower-broadcast"></i>`
                        } 
                    }
                    
                    if (media_info.downloadable && item.filename.match(/^https?:/)) {
                        let icon = $(`<i class="fas fa-globe"></i>`)[0]; //  style="color:cornflowerblue"
                        set_attribute(icon, "title", item.filename);
                        main_icon = icon.outerHTML;
                        badges["web"] = new URL(item.filename).hostname.replace(/^www\./, "");
                    }
                    
                    if (!ud.download) {
                        if (media_info.streams) {
                            var default_video = utils.sort(media_info.streams.filter(s=>s.type === "video"),
                                (s)=>s.albumart,
                                (s)=>[s.default | s.forced * 2, "DESCENDING"]
                            )[0];
                            var default_audio = utils.sort(media_info.streams.filter(s=>s.type === "audio"),
                                (s)=>[s.default | s.forced * 2, "DESCENDING"]
                            )[0];
                            let has_video = default_video && default_video.codec && !default_video.albumart;
                            let has_audio = default_audio && default_audio.codec;

                            if (has_video) {
                                var codec = default_video.codec.replace(/video$/, "").split(".")[0];
                                var size = get_video_size(default_video.width, default_video.height, media_info.interlaced);
                        
                                if (!media_info.duration || media_info.duration <= IMAGE_DURATION) {
                                    icons.push(`<i class="fas fa-image"></i>`);
                                    badges["image"] = `${codec} ${default_video.width}x${default_video.height}`;
                                } else {
                                    icons.push(`<i class="fas fa-film"></i>`);
                                    badges["video"] = `${codec} ${size.text}`;
                                }
                            }
                            if (has_audio) {
                                if (!has_video) icons.push(`<i class="fas fa-music"></i>`);
                                badges["audio"] = default_audio.codec.replace(/^pcm_.+$/, "pcm").split(".")[0];
                            }
                            if (root_merged_playlist && default_video && default_video.codec == "vc1") {
                                problems.push({level:2, text: "VC-1 video codec can lead to playback issues within a merged playlist."});
                            }
                        }
                    }
                    {
                        let upload = item.upload;
                        let download = item._download;
                        let d = null, t = null;
                        if (download) {
                            d = download
                            t = "download";
                        } else if (upload || item.filename === "livestreamer://upload") {
                            d = upload || { bytes:0, total:0, speed:0 };
                            t = "upload";
                        }
                        
                        if (d) {
                            let bar_el = extra_elem.querySelector(`.progress`) || $(`<div class="progress"><span class="percent"></span><span class="speed"></span></div>`)[0];
                            let percent_el = bar_el.querySelector(".percent");
                            let speed_el = bar_el.querySelector(".speed");
                            let canceled = d.status == UPLOAD_STATUS.CANCELED;
                            let p = d.total ? ( d.bytes / d.total) : 0;
                            bar_el.title = canceled ? "Canceled" : `${utils.capitalize(t)}ing [${utils.format_bytes(d.bytes || 0)} / ${utils.format_bytes(d.total || 0)}]`;
                            set_style_property(bar_el, "--progress",`${p*100}%`);
                            let percent_text = [];
                            if (d.stages) percent_text.push(`${d.stage+1}/${d.stages}`);
                            percent_text.push(`${(p * 100).toFixed(2)}%`);
                            set_inner_html(percent_el, canceled ? "Canceled" : percent_text.join(" | "));
                            set_inner_html(speed_el, canceled ? "Canceled" : `${utils.format_bytes(d.speed || 0)}ps`);
                            icons.push(`<i class="fas fa-${t}"></i>`);
                            set_children(extra_elem, [bar_el]);
                        } else {
                            set_children(extra_elem, []);
                        }
                    }

                    set_inner_html(badges_elem, Object.entries(badges).map(([k,v])=>{
                        var parts = v.split(" ");
                        parts[0] = parts[0].toUpperCase();
                        return `<i class="badge" data-badge-type="${k}">${parts.join(" ")}</i>`
                    }).join(""));

                    if (!is_special && ud.modified) {
                        icons.push(`<i class="fas fa-wrench"></i>`);
                    }
    
                    var duration_str = null;
                    // let _start_time = start_time ? (start_time + ud.start * 1000) : 0;
                    // if (_start_time >= now) {
                    //     let s = new Date(_start_time);
                    //     let t_str = `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`;
                    //     duration_str = `<i class="far fa-clock" style="padding-right:3px"></i><span>${t_str}</span>`;
                    // }
                    // if (start_time) {
                    //     let _start_time = (calculate_start_time(item) - calculate_start_time(current_item));
                    //     // if (_start_time >= start_time) {
                    //     let s = new Date(_start_time);
                    //     let t_str = `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`;
                    //     duration_str = `<i class="far fa-clock" style="padding-right:3px"></i><span>${t_str}</span>`;
                    //     // }
                    // }
                    if (!duration_str) {
                        if (ud.duration || ud.media_duration) duration_str = utils.seconds_to_timespan_str(ud.duration || ud.children_duration, "h?:mm:ss");
                    }

                    set_inner_html(duration_elem, duration_str || "  -  ");
                    
                    if (problems.length) {
                        var problem_groups = utils.group_by(problems, p=>p.level);
                        var err_icon_html;
                        if (problem_groups["3"]) err_icon_html = `<i class="fas fa-times" style="color:red;"></i>`;
                        else if (problem_groups["2"]) err_icon_html = `<i class="fas fa-exclamation-triangle" style="color:orange;"></i>`;
                        else if (problem_groups["1"]) err_icon_html = `<i class="fas fa-question-circle" style="color:#6495ED;"></i>`;
                        if (err_icon_html) {
                            let icon = $(err_icon_html)[0];
                            set_attribute(icon, "title", problems.map(p=>" - "+p.text).join("\n"));
                            icons.push(icon.outerHTML);
                        }
                    }
    
                    set_inner_html(play_icons_elem, play_icons.join(""));

                    // if (!main_icon) main_icon = `<i class="fas fa-file"></i>`;
                    set_inner_html(icons_elem, [main_icon, ...icons].join(""));
    
                    set_inner_html(filename_elem, filename_parts.join(" "));
    
                    set_style_property(elem, "--duration", ud.timeline_duration);
                    set_style_property(elem, "--start", ud.timeline_start);
                    set_style_property(elem, "--end", ud.timeline_end);
                    set_style_property(elem, "--background-color", background_color || "");
                    set_style_property(elem, "--outline-color", outline_color || "");
                    set_attribute(elem, "title", title_parts.join(" "));
                    toggle_class(elem, "current", is_current_item);

                    emit_change();
    
                    return elem;
                },
                remove:(elem)=>{
                    // console.log(`deleted ${elem.dataset.id}`)
                    // if (elem.classList.contains("insert-marker")) return;
                    var sortable = Sortable.utils.get(elem);
                    if (sortable) sortable.deselect(elem);
                    elem.remove();

                    emit_change();
                }
            });
        });
    }


    /** @return {PlaylistCommand[]} */
    get all_commands() {
        return Object.values(this.commands);
    }

    back(){
        var current = this.current;
        var parent = current._parent;
        if (!parent) return;
        if (app.$._session._is_running && current == app.$._session._current_playing_item && current._calculate_contents_hash() != current.__private.hash_on_open) {
            app.prompt_for_reload_of_current_item();
        }
        this.open(parent, [current]);
    }

    move_selection_to_start() {
        var elems = this.get_selection();
        elems.reverse();
        elems.forEach((e,i)=>e.parentElement.prepend(e));
        elems.forEach(e=>this.scroll_into_view(e));
        this.sync();
    }
    move_selection_back() {
        var elems = this.get_selection();
        var first_index = Math.max(0,dom_utils.get_index(elems[0])-1);
        elems.forEach((e,i)=>dom_utils.insert_at(e.parentElement, e, first_index+i));
        this.scroll_into_view(elems[0]);
        this.sync();
    }
    move_selection_forward() {
        var elems = this.get_selection();
        var last_index = Math.min(elems[0].parentElement.childElementCount, dom_utils.get_index(elems[elems.length-1])+2);
        elems.forEach((e,i)=>dom_utils.insert_at(e.parentElement, e, last_index));
        this.scroll_into_view(elems[elems.length-1])
        this.sync();
    }
    move_selection_to_end() {
        var elems = this.get_selection();
        elems.forEach((e,i)=>e.parentElement.append(e));
        elems.forEach(e=>this.scroll_into_view(e));
        this.sync();
    }

    focus() {
        this.timeline_container_elem.focus();
    }

    /** @param {KeyboardEvent} e */
    try_command_shortcut(e) {
        if (e.key === "Alt") return;
        if (e.key === "Control") return;
        for (var c of Object.values(this.commands)) {
            var shortcut = c.shortcut();
            if (!shortcut) continue;
            for (var k of shortcut.split(/\s*[\|]\s*/)) {
                var keys = k.split(/\s*[\+]\s*/);
                var keys_lower = new Set([...keys, ...keys.map(k=>k.toLowerCase())]);
                if (keys_lower.has("ctrl") == e.ctrlKey && keys_lower.has("alt") == e.altKey && keys_lower.has("shift") == e.shiftKey && keys_lower.has(e.key.toLowerCase())) {
                    if (this.context_menu) this.context_menu.hide();
                    c.click(this.get_selection_datas());
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }
    }

    /* get_commands() {
        var items = this.get_selection_datas();
        return Object.fromEntries(Object.entries(this.commands).map(([k,c])=>{
            var c = {...c};
            for (var k in c) {
                if (typeof c[k] === "function") c[k] = c[k](items);
            }
            return [k, c];
        }));
    } */
    
    open_context_menu(parent, e) {
        var items = this.get_selection_datas();
        var c = this.commands;
        var menu_groups = [
            [c.play, c.info, c.modify, c.rescan, c.reveal, c.split, c.rename, c.delete_item],
            [c.download, c.cancel_download, c.cancel_upload],
            [c.edit_playlist, c.breakdown_playlist, c.add_to_playlist],
            [/* c.timeline_cursor_play,*/ c.slice_at_timeline_cursor, c.timeline_cursor_to_start, c.timeline_cursor_to_end],
            [c.clipboard_copy, c.clipboard_cut, c.clipboard_paste, c.clipboard_clear],
            [c.move_to_top, c.move_up, c.move_down, c.move_to_bottom],
        ];
        if (items.length) {
            menu_groups.push([Object.keys(c).filter(c=>c.startsWith("color_")).map(k=>c[k])]);
        }
        var menu_items = [];
        for (var g of menu_groups) {
            if (g.flat().some(i=>i.visible(items))) {
                if (menu_items.length) menu_items.push("-----");
                menu_items.push(...g);
            }
        }
        var menu = create_menu(menu_items, {
            click: ()=>instance.hide(),
            params: [items]
        });
        var instance = this.context_menu = create_context_menu(parent, menu, e);
    }

    sync() {
        var playlist_changes = {};
        this.sortables.forEach((s,t)=>{
            s.get_items().forEach((e,i)=>{
                playlist_changes[e.dataset.id] = {index: i, track_index: t};
            });
        });
        app.playlist_update(playlist_changes)
    }

    selection_to_clipboard(cutting=false) {
        var items = this.get_selection_datas();
        if (!items.length) return;
        var all_items = items.map(i=>[i, ...i._descendents]).flat().map(i=>i._copy());
        var items_set = new Set(items);
        this.clipboard = { items, items_set, all_items, cutting };
        this.update();
    }

    async clipboard_paste() {
        if (!this.clipboard) return;
        var clipboard = this.clipboard;
        if (clipboard.cutting) {
            this.clipboard = null;
            app.playlist_move(clipboard.items);
        } else {
            app.playlist_add(clipboard.items);
        }
    }

    async clipboard_clear() {
        this.clipboard = null;
        this.update();
    }

    /** @param {PlaylistItem} item */
    rename(item) {
        var el = this.get_element(item);

        this.scroll_into_view(el);
        // var new_name = window.prompt("Rename:", item.props.label || "");

        var filename = el.querySelector(".filename");
        var old_name = filename.innerText;
        var default_name = item._get_pretty_name({label:false});

        filename.contentEditable = true;
        set_inner_html(filename, item.props.label || default_name);
        filename.focus();
        window.getSelection().selectAllChildren(filename);
        var blur_listener, keydown_listener;
        filename.addEventListener("keydown", keydown_listener = (e)=>{
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                filename.blur();
            }
        });
        filename.addEventListener("blur", blur_listener = ()=>{
            filename.contentEditable = false;
            filename.removeEventListener("blur", blur_listener);
            filename.removeEventListener("keydown", keydown_listener);
            var new_name = filename.innerText;
            if (!new_name || new_name == default_name) new_name = null;
            set_inner_html(filename, `<span>${new_name || default_name}</span>`);

            if (old_name != new_name) {
                app.$._push([`sessions/${app.$._session.id}/playlist/${item.id}/props/label`,new_name]);
                app.request({
                    call: ["session", "update_values"],
                    arguments: [[`playlist/${item.id}/props/label`, new_name]]
                });
            }
            this.timeline_container_elem.focus({preventScroll: true});
        });
    }

    zoom_into_selected_playlist_items() {
        var ud = this.current._userdata;
        var start, end;
        if (ud.clipping) [start,end] = [ud.clipping.start, ud.clipping.end];
        else {
            var items = this.get_selection_datas();
            if (!items || !items.length) items = this.get_datas();
            start = Math.min(...items.map(item=>item._userdata.timeline_start));
            end = Math.max(...items.map(item=>item._userdata.timeline_end));
        }
        this.set_timeline_view([start, end]);
    }

    scroll_to_playhead() {
        this.set_timeline_view(null, this.time || 0);
    }

    /** @param {PlaylistItem[]} items */
    set_selection(items, focus=true) {
        if (!Array.isArray(items)) items = [items];
        this.sortables.forEach(s=>s.deselect_all());
        var elems = new Set(items.map(item=>this.get_element(item)).filter(e=>e));
        elems.forEach((elem,i)=>{
            Sortable.utils.get(elem).click(elem, false, i!=0);
        });
        if (focus) this.focus();
    }

    /** @param {PlaylistItem} item */
    get_element(item) {
        var id;
        if (item instanceof Element) id = item.dataset.id;
        else if (typeof item == "object") id = item.id;
        else if (typeof item == "string") id = item;
        return this.get_elements().find(e=>e.dataset.id == id);
    }
    get_elements() {
        return this.sortables.map(s=>s.get_items()).flat();
    }
    get_selection() {
        return this.sortables.map(s=>s.get_selection()).flat();
    }
    get_first_selected() {
        return this.get_selection()[0];
    }
    get_datas() {
        return this.get_elements().map(e=>app.$._session.playlist[e.dataset.id]).filter(i=>i);
    }
    get_selection_datas() {
        return this.get_selection().map(e=>app.$._session.playlist[e.dataset.id]).filter(i=>i);
    }
    get_selection_indices() {
        return this.get_selection().map(e=>dom_utils.get_index(e));
    }
    get_first_selected_data() {
        return this.get_selection_datas()[0];
    }

    /** @param {PlaylistItem} item */
    open(item, selection) {
        if (!item) item = app.$._session.playlist["0"];
        if (!item._is_playlist) return;
        this.sortables.forEach(s=>s.forget_last_active());
        this.current = item;
        this.cursor_position = null;
        this.update();
        item.__private.hash_on_open = item._calculate_contents_hash()
        this.once("update", ()=>{
            if (this.timeline_mode && this.clipping) this.set_timeline_view([this.clipping.start, this.clipping.end], this.time);
            else this.scroll_into_view(this.get_elements()[0]);
        })
        this.once("change",()=>{
            if (selection) this.set_selection(selection);
        })
    }
    
    #update_info() {
        var selected_items = this.get_selection_datas();
        var len = this.get_elements().length;
        var info = {};
        info["Selection"] = `<i class="far fa-square-check"></i> [${selected_items.length}/${len}]`;
        if (selected_items.length) {
            var duration = utils.sum(selected_items.map(i=>i._userdata.duration));
            info["Duration"] = `<i class="far fa-clock"></i> (${utils.seconds_to_timespan_str(duration, "h?:mm:ss")})`;
        }
        if (this.clipboard) {
            info["Clipboard"] = `${this.clipboard.cutting ? `<i class="fas fa-scissors"></i>` : `<i class="far fa-clipboard"></i>`} [${this.clipboard.items.length}]`;
        }
        set_inner_html(this.playlist_info_text, Object.entries(info).map(([name,text])=>`<span title="${name}">${text}</span>`).join(""));
        set_inner_html(this.toggle_selection_button, `${selected_items.length?"Deselect":"Select"} All`);
        toggle_attribute(this.toggle_selection_button, "disabled", len == 0);
        this.toggle_selection_button.onclick = ()=>{
            if (selected_items.length) this.active_sortable.deselect_all();
            else this.active_sortable.select_all();
            this.timeline_container_elem.focus({preventScroll: true});
        };
    };

    #update_position() {
        if (!this.base_min_height) {
            var c = window.getComputedStyle(this.elem);
            this.base_min_height = parseFloat(c.getPropertyValue("--min-height"));
        }
        var get_style = ()=>{
            if (!app.settings.get("playlist_sticky")) return;
            if (this.elem.parentElement.childElementCount > 1) return;
            var r = this.elem.parentElement.getBoundingClientRect();
            var min_height = 400;
            var max_height = r.bottom - r.top;
            var padding = 10;
            var top = Math.max(-r.top + padding, 0);
            var bottom = Math.min(top + r.bottom, top + window.innerHeight - padding) - padding;
            var height = Math.min(bottom - top, window.innerHeight - r.top - padding);
            var width = r.right - r.left;
            var offset = Math.min(0, height - min_height);
            var fixed_top = Math.max(r.top, padding);
            if (top > 0) fixed_top += offset;
            height -= offset;
            if (width > window.innerWidth * 0.7) return;
            height = utils.clamp(height, min_height, max_height);
            if (height < this.base_min_height) return;
            return {
                position: "relative",
                top: `${fixed_top-r.top}px`,
                // width: `${width}px`,
                height: `${height}px`,
                flex: "none",
            }
        }
        Object.assign(this.elem.style, get_style() || {
            position: "",
            top: ``,
            // width: ``,
            height: ``,
            flex: "",
        });
    };

    #update_view() {
        if (this.timeline_mode) {
            this.view_start = this.tracks_elem.scrollLeft / this.zoom;
            this.view_duration = this.tracks_elem.clientWidth / this.zoom;
            this.view_end = this.view_start + this.view_duration;

            if (this.clipping) {
                let limits_html = [
                    `<div style="left:0; width:${Math.max(0,(this.clipping.start - this.view_start)/this.view_duration*100).toFixed(3)}%"></div>`,
                    `<div style="right:0; width:${Math.max(0,(this.view_end - this.clipping.end)/this.view_duration*100).toFixed(3)}%"></div>`,
                ].join("");
                set_inner_html(this.limits_elem, limits_html);
            }
            
            this.limits_elem.style.display = this.clipping ? "" : "none";

            // var max_width = Math.max(...this.sortables.map(s=>s.el.offsetWidth));
            // set_style_property(this.elem, "--timeline-width", `${max_width}px`);
            set_style_property(this.timeline_container_elem, "--timeline-width", `${this.duration * this.zoom}px`)

            this.ticks_bar.update(this.view_start, this.view_end);

            this.cursor_elem.style.left = `${((this.cursor_position || 0)-this.view_start) * this.zoom}px`;
            this.cursor_elem.style.display = (this.cursor_position == null) ? "none" : "";
        
            this.playhead_elem.style.display = (this.time == null || this.time < 0 || this.time > this.duration) ? "none" : "";
            this.playhead_elem.style.left = `${(this.clip_time - this.view_start) / this.view_duration * 100}%`;
            
            this.playlist_zoom_out_button.disabled = this.playlist_zoom <= PLAYLIST_ZOOM_MIN;
            this.playlist_zoom_in_button.disabled = this.playlist_zoom >= PLAYLIST_ZOOM_MAX;
            this.playlist_zoom_input.value = (this.zoom*100).toFixed(2)+"%";
            this.playlist_goto_playhead_button.disabled = this.time == null;
        }

        this.scrollbar_width = Math.max(...get_scrollbar_width(this.tracks_elem));
        set_style_property(this.timeline_container_elem, "--scrollbar-width", `${this.scrollbar_width}px`);
    }
    
    get timeline_window_duration() {
        return this.tracks_elem.clientWidth / this.zoom;
    }
    get timeline_window_start() {
        return this.tracks_elem.scrollLeft / this.zoom;
    }
    get_timeline_scroll_percent = (ox=0.5)=>(this.timeline_window_start + this.timeline_window_duration * ox) / this.duration;
    set_timeline_scroll_percent = (v, ox=0.5)=>{
        this.tracks_elem.scrollLeft = this.duration * (v - (this.timeline_window_duration / this.duration * ox)) * this.zoom;
    }
    set_timeline_zoom(v){
        this.zoom = utils.clamp(v, PLAYLIST_ZOOM_MIN, PLAYLIST_ZOOM_MAX);
        if (isNaN(this.zoom) || !isFinite(this.zoom)) this.zoom = 1.0;
        set_style_property(this.timeline_container_elem, "--playlist-zoom", this.zoom);
    }
    reset_scroll(){
        this.tracks_elem.scrollLeft = this.tracks_elem.scrollTop = 0;
    }
    inc_timeline_zoom(v=0, e) {
        this.set_timeline_view(Math.pow(PLAYLIST_ZOOM_BASE, utils.log(this.zoom, PLAYLIST_ZOOM_BASE) + v), null, e);
    }
    set_timeline_view(zoom, time, e=null) {
        var ox = 0.5;
        if (e instanceof MouseEvent) {
            var pt = {x:e.clientX, y:e.clientY};
            var rect = this.tracks_elem.getBoundingClientRect();
            ox = utils.clamp(get_rect_pt_percent(rect, pt).x);
        } else if (e instanceof Number) {
            ox = e;
        }
        if (Array.isArray(zoom)) {
            this.set_timeline_zoom(this.zoom * this.timeline_window_duration / (zoom[1]-zoom[0]));
            this.set_timeline_scroll_percent((zoom[0] + zoom[1]) / 2 / this.duration);
        } else {
            var scroll_x = (time == null) ? this.get_timeline_scroll_percent(ox) : (time / this.duration);
            if (zoom != null) this.set_timeline_zoom(zoom);
            this.set_timeline_scroll_percent(scroll_x, ox);
        }
        this.update();
    }
}

//------------------------------------------------------

export class Loader {
    constructor() {
        var html = `<div class="loader">
            <div class="icon"><i></i><i></i><i></i></div>
            <div class="msg">Loading...</div>
        </div>`
        this.el = $(html)[0];
        this.el.style.zIndex = 999999999;
    }
    update(opts) {
        var msg = this.el.querySelector(".msg");
        if ("text" in opts) {
            set_inner_html(msg, opts.text);
        }
        if ("visible" in opts) {
            if (opts.visible && this.el.parentElement != document.body) document.body.append(this.el);
            else if (!opts.visible && this.el.parentElement) this.el.remove();
        }
    }
    destroy() {
        this.el.remove();
    }
}

export class Area extends UI.Column {
    constructor(elem, settings) {
        super(elem, settings);
        add_class(this.elem, "area");
        add_class(this.elem, `area-${app.areas.length+1}`);
        app.areas.push(this);
    }
}

export class App extends utils.EventEmitter {
    get playlist_item_props_class() { return utils.try(()=>this.$.properties.playlist.__enumerable__.props); }
    get focused_element() { return this.root_elem.activeElement; }
    get dev_mode() { return this.$.conf["debug"] || new URLSearchParams(window.location.search.slice(1)).has("dev"); }
    
    $ = new Remote();

    async init() {

        this.settings = new dom_utils.LocalStorageBucket("livestreamer-1.0", {
            "playlist_mode": 0,
            // "playlist_show_scheduled_times": false,
            "playlist_sticky": true,
            "show_extra_playlist_icons": true,
            "wrap_playlist_items": false,
            "time_display_ms": false,
            "test_stream_info": true,
            "show_chapters": true,
            "show_encoder_info": true,
            "pause_encoder": false,
            "sessions_display": "tabs",
            "open_file_manager_in_new_window": false,
            "time_left_mode": TimeLeftMode.TIME_LEFT,
            "layout":null,
            "session_order": null,
            "last_session_id": null
        });
        this.passwords = new dom_utils.LocalStorageBucket("livestreamer-passwords");

        this.loader = new Loader();
        this.loader.update({visible:true, text:"Initializing..."});

        this.media = new Media();

        this.elem = document.querySelector("#livestreamer");
        this.body_elem = this.elem.parentElement;
        this.root_elem = this.elem.getRootNode();

        // this.conf = await fetch("conf").then(r=>r.json()); // crazy...;
        /** @type {Area[]} */
        this.areas = [];
        
        this.font_cache = {};
        this.num_requests = 0;
        this.upload_queue = new UploadQueue();
        this.clipboard = null;
        this.plugins = {};
        this.target_config_menus = {};
        this.advanced_functions = [];

        this.main_elem = this.elem.querySelector(".main");
        this.show_help_button = this.root_elem.querySelector("#show-help");
        this.show_config_button = this.root_elem.querySelector("#show-config");
        this.show_admin_button = this.root_elem.querySelector("#show-admin");
        toggle_class(this.show_admin_button, "d-none", true); // !app.user.is_admin
        this.session_elem = this.root_elem.querySelector("#session");
        this.session_controls_wrapper_elem = this.root_elem.querySelector(".session-controls-wrapper");
        this.session_load_save_elem = this.root_elem.querySelector("#session-load-save");
        this.session_inner_elem = this.root_elem.querySelector("#session-inner");
        this.session_ui_elem = this.root_elem.querySelector("#session-ui");
        this.no_sessions_elem = this.root_elem.querySelector("#no-sessions");
        this.session_password_elem = this.root_elem.querySelector("#session-password");
        this.new_session_button = this.root_elem.querySelectorAll(".new-session");
        this.destroy_session_button = this.root_elem.querySelector("#destroy-session");
        this.minimize_session_button = this.root_elem.querySelector("#minimize-session");
        // if (!this.dev_mode) add_class(this.minimize_session_button, "d-none");
        this.sign_out_session_button = this.root_elem.querySelector("#sign-out-session");
        this.config_session_button = this.root_elem.querySelector("#config-session");
        this.load_session_button = this.root_elem.querySelector("#load-session");
        this.save_session_button = this.root_elem.querySelector("#save-session");
        this.history_session_button = this.root_elem.querySelector("#history-session");
        this.sessions_tabs_elem = this.root_elem.querySelector("#sessions-tabs");
        this.sessions_select = this.root_elem.querySelector("#sessions-select");
        this.users_elem = this.root_elem.querySelector("#users");
        this.request_loading_elem = this.root_elem.querySelector("#request-loading");
        
        this.root = new UI.Root();
        // this.root.on("pre_update", ()=>{
        //     var t0 = Date.now();
        //     this.root.once("post_update", ()=>{
        //         var t1 = Date.now();
        //         console.debug(`UI update: ${t1-t0}ms`);
        //     })
        // });
        
        var session_ui = new UI.Column();
        var row1 = new UI.Row();
        row1.append(new Area());
        var row2 = new UI.Row();
        row2.append(new Area(), new Area());
        session_ui.append(row1, row2);
        this.session_ui_elem.append(session_ui);

        /** @type {Record<PropertyKey,Panel>} */
        this.panels = {};
        
        this.stream_settings = new StreamSettings();
        this.areas[0].append(this.stream_settings);

        this.playlist = new PlaylistPanel();
        this.areas[1].append(this.playlist);
        
        this.media_player = new MediaPlayerPanel();
        this.media_settings = new MediaSettingsPanel();
        this.metrics = new StreamMetricsPanel();
        this.session_logger = new LogViewerPanel("Session Log", {ffmpeg: false});

        this.areas[2].append(this.media_player,this.media_settings,this.metrics,this.session_logger);
        this.default_layout = this.get_layout();
        
        this.app_log_section = this.elem.querySelector(".app-logs-section");
        this.app_logger = new LogViewerPanel("Application Log");
        this.app_log_section.append(this.app_logger);

        this.playlist_modify_menu = new PlaylistModifySettings();
        this.playlist_add_url_menu = new PlaylistAddURLMenu();
        this.file_system_info_menu = new FileSystemInfoMenu();
        this.session_config_menu = new SessionConfigurationSettings();
        this.schedule_stream_menu = new ScheduleStreamSettings();
        this.save_playlist_menu = new SavePlaylistSettings();
        this.history_menu = new HistorySettings();
        this.schedule_generator_menu = new ScheduleGenerator();
        this.keyboard_shortcuts_menu = new KeyboardShortcuts();
        // this.advanced_functions_menu = new AdvancedFunctionsMenu();
        this.system_manager = new SystemManagerMenu();
        this.file_manager_menu = new FileManagerMenu();
        this.configure_targets_menu = new TargetConfigurationMenu();
        this.configure_external_session_menu = new ExternalSessionConfigurationMenu();
        this.user_config_menu = new UserConfigurationSettings();
        this.admin_menu = new AdminSettings();
        this.set_time_pos_menu = new SetTimePosSettings();
        this.playlist_info_menu = new InfoSettings();
        this.change_log_menu = new ChangeLog();
        this.split_menu = new SplitSettings();
        this.uploads_downloads_menu = new UploadsDownloadsMenu();
        
        // this.fonts_menu = new FontSettings();

        this.target_config_menus["local"] = new LocalServerTargetConfigMenu();

        this.session_password = new (class extends UI {
            constructor(...a) {
                super(...a);
                let row = new UI.FlexRow();
                this.password = new UI.Property(null, "Password", `<input type="text">`,{
                    "default":"",
                    "reset":false,
                    "placeholder": "Enter password",
                });
                this.password.input.addEventListener("keydown", (e)=>{
                    if (e.key === "Enter") button.click();
                });
                let button = $(`<button class="button" title="Sign in"><i class="fas fa-key"></i></button>`)[0];
                button.addEventListener("click", ()=>{
                    app.passwords.set(app.$._session.id, this.password.value);
                    if (!app.$._session.access_control._self_has_access(this.password.value)) {
                        window.alert("Incorrect Password")
                    }
                });
                this.password.inner.append(button);
                row.append(this.password);
                this.elem.append(row);
            }
        })(this.session_password_elem);

        this.sign_out_session_button.addEventListener("click", (e)=>{
            this.passwords.unset(this.$._session.id);
        });
        
        for (let area of this.areas) {
            new Sortable(area.elem, {
                group: "layout",
                fallbackTolerance: 3, // So that we can select items on mobile
                animation: 150,
                handle: ".drawer>.header",
                filter: (e)=>{
                    if (e.target.closest(".drawer>.header")) {
                        if (dom_utils.has_touch_screen() || e.target.closest("button,input,select")) return true;
                    }
                },
                onEnd: ()=>this.save_layout(),
                preventOnFilter: false,
            });
        }
        
        this.session_sortable = new ResponsiveSortable(this.sessions_tabs_elem, {
            fallbackTolerance: 3, // So that we can select items on mobile
            animation: 150,
            // filter: ".unmovable",
            handle: ".handle",
            onEnd: (evt)=>{
                if (this.$.conf["main.session_order_client"]) {
                    this.settings.set("session_order", [...this.sessions_tabs_elem.children].map(e=>e.dataset.id));
                } else {
                    this.request({
                        call: ["rearrange_sessions"],
                        arguments: [evt.oldIndex, evt.newIndex]
                    });
                }
            },
        });

        this.footer_buttons = new UI.Row().elem;
        this.main_elem.append(this.footer_buttons);
        set_style_property(this.footer_buttons, "justify-content", "end");

        {
            let row = new UI.Row({
                gap: 0,
                visible: ()=>app.$.processes["file-manager"] || IS_ELECTRON
            });
            
            if (!IS_ELECTRON) {
                row.append(
                    new UI.Button(`<i class="fas fa-folder-tree"></i>`, {
                        click: ()=>{
                            app.file_system_info_menu.show();
                        },
                        title: ()=>app.file_system_info_menu.modal_title
                    })
                )
                row.append(
                    new UI.Link(`File Manager`, {
                        class: "button",
                        href: get_file_manager_url(),
                        click: (e)=>{
                            e.preventDefault();
                            open_file_manager({ new_window:true, standalone:true, hidden_id:"file-manager-standalone" });
                        }
                    })
                );
            }
            this.footer_buttons.append(row);
        }
        
        /* this.footer_buttons.append(
            new UI.Button(`Font Manager`, {
                click: ()=>app.fonts_menu.show()
            })
        ) */
        this.footer_buttons.append(
            new UI.Button(`Configure Targets`, {
                click: ()=>this.configure_targets_menu.show()
            }),
            new UI.Button(`System Manager`, {
                click: ()=>this.system_manager.show()
            }),
            /* new UI.Button(`Advanced Functions`, {
                click: ()=>this.advanced_functions_menu.show()
            }), */
            new UI.Button(`Uploads & Downloads`, {
                click: ()=>this.uploads_downloads_menu.show()
            }),
            new UI.Button(`Controls`, {
                click: ()=>this.keyboard_shortcuts_menu.show()
            }),
            new UI.Button(`Change Log`, {
                click: ()=>this.change_log_menu.show(),
                /** @this {UI} */
                update: function() {
                    var diff = (app.settings.get("last_change_log") != app.$.change_log.mtime);
                    if (this.__last_diff != diff) {
                        if (diff) {
                            this.elem.animate([
                                {
                                    "boxShadow": "0px 0px 5px 0px rgba(0,153,255,1)"
                                },
                                {
                                    "boxShadow": "0px 0px 0px 0px rgba(0,153,255,0)"
                                },
                                {
                                    "boxShadow": "0px 0px 5px 0px rgba(0,153,255,1)"
                                }
                            ], {
                                duration: 1500,
                                easing: "ease-in-out",
                                iterations: Infinity
                            });
                        } else {
                            this.elem.getAnimations().forEach(a=>a.cancel());
                        }
                    }
                    this.__last_diff = diff;
                }
            }),
            new UI.Button(`Setup External Session`, {
                click: ()=>this.configure_external_session_menu.show()
            }),
        );

        var messenger = new dom_utils.WindowCommunicator();
        var key;
        if (window.self == window.top) {
            key = dom_utils.Cookie.get("ls_key") || new URLSearchParams(window.location.search).get("ls_key");
        } else {
            key = await messenger.request(window.parent, "key");
        }
        if (key) dom_utils.Cookie.set("ls_key", key, { expires: 365 });
        messenger.destroy();

        var ws_url = `${(window.location.protocol === "https:") ? "wss:" : "ws:"}//${window.location.host}/main/`;
        var ws_params = new URLSearchParams();
        // if (key) ws_params.set("key", key);
        var session_id = window.location.hash.slice(1) || this.settings.get("last_session_id");
        if (session_id) ws_params.set("session_id", session_id);

        this.ws = new dom_utils.WebSocket(ws_url+"?"+ws_params.toString());
        this.ws.on("open", ()=>{
            this.$ = new Remote();
            this.$.on("update", (changes)=>this.#update(changes));
        });
        this.ws.on("data", (data)=>{
            if (data.$) this.$._push(data.$);
        });
        this.ws.on("close", ()=>{
            this.loader.update({visible:true, text:"Lost connection..."});
            this.remove_plugins();
            Fancybox.close(true);
        });
    
        this.loader.update({text:"Connecting..."});

        var on_setting_change = (k,v)=>{
            if (k.startsWith("drawer:")) {
                var panel = this.panels[k.slice(7)];
                if (panel) panel.toggle(!v)
            } else if (typeof v === "boolean") {
                toggle_attribute(this.body_elem, `data-${k}`, v);
                [...this.elem.querySelectorAll(`button.${k}`)].forEach(c=>{
                    if (v) delete c.dataset.toggled; else c.dataset.toggled = 1;
                });
            } else {
                var t = typeof v;
                if (t != "object" && t != "function") {
                    set_attribute(this.body_elem, `data-${k}`, v);
                }
            }
            if (k === "playlist_mode") {
                this.playlist.timeline_mode = v;
            }
            this.update();
        };

        this.settings.on("change", (e)=>{
            on_setting_change(e.name, e.new_value);
        });

        this.passwords.on("change", (e)=>{
            this.update();
        });

        this.elem.addEventListener("click",(e)=>{
            var button = e.target.closest("button");
            if (button) {
                for (var k of this.settings.keys) {
                    if (button.classList.contains(k)) {
                        this.settings.toggle(k);
                    }
                }
            }
            if (e.target.matches("a")) {
                var url = dom_utils.get_anchor_url(e.target);
                if (url.origin === "/file-manager/index.html", window.location.origin === url.origin) {
                    // open file-manager
                }
                if (url.origin === "/main/index.html", window.location.origin === url.origin) {
                    if (url.hash) {
                        this.try_attach_to(url.hash.slice(1));
                        e.preventDefault();
                    }
                }
            }
        });

        this.sessions_select.addEventListener("change", ()=>{
            window.location.hash = `#${this.sessions_select.value}`;
        })
        
        Object.assign(Fancybox.defaults, {parentEl: this.body_elem});

        dom_utils.tippy.setDefaultProps({
            distance: 0,
            // boundary just doesn't work... maybe due to shadow dom, have to use popperOptions
            popperOptions: {
                strategy: 'fixed',
                /* modifiers: [
                    {
                        name: 'preventOverflow',
                        options: {
                            altAxis: true
                            // boundary: this.elem,
                        },
                    }
                ] */
            }
        });

        /* var style = [];
        for (var k in item_colors) {
            if (!item_colors[k]) continue;
            var outline = new utils.Color(item_colors[k]).rgb_mix("#000",0.3).to_rgb_hex();
            style.push(`[data-bg-color="${k}"] { background: ${item_colors[k]} !important; outline-color: ${outline} !important; }`);
        }
        this.main_elem.append($(`<style>${style.join("")}</style>`)[0]); */
        
        window.addEventListener("keydown", this.on_keydown = (e)=>{
            if (!isNaN(e.key) && e.ctrlKey) {
                var sessions = this.sessions_ordered;
                var i = +e.key-1;
                this.try_attach_to(sessions[i] ? sessions[i].id : null);
            } else if (e.key === "s" && e.ctrlKey) {
                this.save_session();
            } else if (e.key === "F1") {
                this.toggle_help()
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });

        $(this.new_session_button).on("click", (e)=>{
            this.request({
                call: ["new_session"]
            }, {
                block: true,
            });
        });

        this.config_session_button.addEventListener("click", ()=>{
            this.session_config_menu.show()
        });

        this.destroy_session_button.addEventListener("click", (e)=>{
            if (confirm(`Are you sure you want to delete '${this.$._session.name}'?`)) {
                this.$._push([`clients/${this.$.client_id}/session_id`, null]);
                // this.last_destroyed_session_id = this.$._session.id;
                this.request({
                    call: ["session", "destroy"],
                    arguments: [true],
                });
            }
        });

        this.minimize_session_button.addEventListener("click", (e)=>{
            this.try_attach_to(null);
        });

        this.sessions_tabs_elem.addEventListener("contextmenu", (e) => {
            var elem = this.session_sortable.get_item(e.target);
            if (!elem) return;
            e.preventDefault();
            var i = this.session_sortable.get_item_index(elem);
            var item = this.sessions_ordered[i];
            var menu_items = [
                {
                    name: ()=>`ID: ${item.id}`,
                    click: ()=>window.navigator.clipboard.writeText(item.id),
                }
            ];
            var menu = create_menu(menu_items, {click:()=>instance.hide()});
            var instance = create_context_menu(elem, menu, e);
        });

        this.load_session_button.addEventListener("click", async (e)=>{
            this.load_session();
        });
        this.save_session_button.addEventListener("click", async (e)=>{
            this.save_session();
        });
        this.history_session_button.addEventListener("click", async (e)=>{
            this.history_menu.show();
        });

        this.show_help_button.addEventListener("click", async ()=>{
            this.toggle_help();
        });

        this.show_config_button.addEventListener("click", ()=>this.user_config_menu.show());

        this.show_admin_button.addEventListener("click", ()=>this.admin_menu.show());

        window.addEventListener("hashchange", ()=>{
            console.log("hashcange", window.location.hash);
            this.try_attach_to(window.location.hash.slice(1));
        });

        window.addEventListener("beforeunload", ()=>{
            for (var w of Object.values(windows)) w.close();
        });

        var fd = new FileDrop(this.playlist.elem);
        
        fd.on("drop", /** @param {FileSystemEntry[]} entries */ async (entries)=>{
            if (!entries.length) return;
            var items = [];
            /** @param {PlaylistItem} parent */ 
            var traverse = async (entry, parent) => {
                if (!entry) return;
                if (entry.isFile) {
                    /** @type {FileSystemFileEntry} */
                    let file_entry = entry;
                    let file = await new Promise(resolve=>file_entry.file(resolve));
                    app.playlist_add({
                        filename: file_entry.name,
                        file,
                    }, {
                        parent
                    });
                } else if (entry.isDirectory) {
                    /** @type {FileSystemDirectoryEntry} */
                    let dir_entry = entry;
                    let [item] = app.playlist_add({
                        filename:"livestreamer://playlist",
                        props: {
                            label: dir_entry.name
                        }
                    }, {
                        parent
                    });
                    await new Promise((resolve)=>{
                        var reader = dir_entry.createReader();
                        reader.readEntries(async (entries) => {
                            for (var e of entries) {
                                await traverse(e, item);
                            }
                            resolve();
                        });
                    });
                }
            };
            for (var e of entries) {
                await traverse(e, this.playlist.current);
            }
            this.playlist_add(items);
        })
        
        this.tick_interval = setInterval(()=>this.tick(), 1000/10);
        this.tick();
        
        this.update_layout();

        for (var k of this.settings.keys) {
            on_setting_change(k, this.settings.get(k))
        }

        this.root.update();
    }

    update = utils.debounce(this.#update, 0);

    #update(changes = {}) {
        this.media.update();

        this.loader.update({visible:false});
        this.elem.style.display = "";

        var last_session_id = window.location.hash.slice(1);
        var client_id = this.$.client_id;
        var client_changes = changes.clients && changes.clients[client_id];
        var is_new_session = !!(client_changes && client_changes.session_id);
        var session_changes = is_new_session ? this.$._session : changes.sessions && changes.sessions[this.$._session.id];
        var is_null_session = this.$._session === NULL_SESSION;
        var access_control = this.$._session.access_control
        var has_ownership = access_control._self_is_owner_or_admin || access_control._owners.length == 0;
        var has_access = is_null_session || access_control._self_has_access(app.passwords.get(this.$._session.id)) || this.$._client.is_admin;
        var requires_password = access_control._self_requires_password;
        var is_external_session = this.$._session.type === SessionTypes.EXTERNAL;

        // if (this.$._last_session && !this.$.sessions[this.$._last_session.id]) {
        //     alert(`'${this.$._last_session.name}' was terminated internally or by another user.`);
        // }
        if (client_changes && "session_id" in client_changes && client_changes.session_id != last_session_id) {
            window.location.hash = client_changes.session_id || "";
        }

        this.session_elem.dataset.type = this.$._session.type;
        toggle_class(this.session_elem, "d-none", is_null_session);
        toggle_class(this.session_inner_elem, "d-none", !has_access);
        toggle_class(this.session_controls_wrapper_elem, "d-none", is_null_session);
        toggle_class(this.no_sessions_elem, "d-none", !is_null_session && has_access);
        toggle_class(this.no_sessions_elem.querySelector(".no-session"), "d-none", !has_access);
        toggle_class(this.no_sessions_elem.querySelector(".no-access"), "d-none", has_access);
        toggle_class(this.no_sessions_elem.querySelector(".owner"), "d-none", has_access);
        set_inner_html(this.no_sessions_elem.querySelector(".owner"), `This session is owned by ${access_control._owners.map(u=>`[${u.username}]`).join(" | ")}`);
        this.session_password.hidden = (has_access || !requires_password);
        
        this.session_load_save_elem.style.display = is_external_session ? "none": "";

        this.playlist.hidden = is_external_session;
        this.media_player.hidden = is_external_session;
        this.media_settings.hidden = is_external_session;

        toggle_attribute(this.load_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.save_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.history_session_button, "disabled", !has_access || !has_ownership);
        
        toggle_class(this.sign_out_session_button, "d-none", has_ownership || !(requires_password && has_access));
        toggle_attribute(this.config_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.destroy_session_button, "disabled", !has_ownership);

        if (is_new_session) {
            this.playlist.sortables.forEach(s=>s.deselect_all());
            this.session_logger.empty();
            this.session_password.password.reset();
            this.playlist.open(null);
        }

        this.#rebuild_sessions();
        this.#rebuild_clients();
        
        if (changes.plugins) {
            for (var k in changes.plugins) this.init_plugin(k);
        }

        if (session_changes) {
            if (session_changes.playlist && !Object.isFrozen(this.$._session)) {
                var ids = new Set([...Object.keys(this.$._session._deleted_playlist_items), ...Object.keys(session_changes.playlist)]);
                for (var id of ids) {
                    let new_item = this.$._session.playlist[id];
                    let old_item = this.$._session._deleted_playlist_items[id] || new_item;
                    if (new_item) new_item.__private.num_updates++;
                    let old_parent = old_item ? old_item.__private.parent : null;
                    let new_parent = new_item ? new_item._parent : null;
                    if (old_parent) {
                        old_parent.__private.children.delete(old_item);
                        old_parent.__private.children_ordered = null;
                        old_item.__private.parent = null;
                    }
                    if (new_parent) {
                        new_parent.__private.children.add(new_item);
                        new_parent.__private.children_ordered = null;
                        new_item.__private.parent = new_parent;
                    }
                }
            }
            var curr_playlist = this.playlist.current;
            if (curr_playlist._is_deleted) {
                this.playlist.open(null);
            }
            
            if (session_changes.logs) {
                this.session_logger.append_logs(session_changes.logs);
            }
        }

        {
            let filenames = new Set();
            let ids = new Set();
            if (changes.downloads) {
                utils.set_add(ids, Object.keys(changes.downloads));
            }
            if (changes.uploads) {
                utils.set_add(ids, Object.keys(changes.uploads));
            }
            if (changes.uploads) {
                for (var id in changes.uploads) {
                    var ul = this.$.uploads[id];
                    if (!ul || ul.status === UploadStatus.CANCELED) {
                        this.upload_queue.cancel(id);
                    }
                }
            }
            if (changes.media_info) {
                utils.set_add(filenames, Object.keys(changes.media_info));
            }
            if (changes.nms_sessions !== undefined) {
                utils.set_add(ids, this.playlist.current._children.filter(i=>i.filename==="livestreamer://rtmp").map(i=>i.id));
            }
            if (session_changes) {
                if (session_changes.playlist) {
                    utils.set_add(ids, Object.keys(session_changes.playlist));
                }
                if (session_changes.playlist_id !== undefined) {
                    utils.set_add(ids, [this.playlist.current.id, this.$._session.playlist_id]);
                }
            }
            utils.set_add(ids, [...filenames].map(k=>this.$._session._get_items_with_media(k)).flat().map(i=>i.id));
            
            if (ids.size) {
                /** @type {PlaylistItem[]} */
                var items = [];
                for (var id of ids) {
                    let item = this.$._session.playlist[id];
                    if (item) {
                        items.push(item, ...item._parents);
                    } else {
                        var deleted_item = this.$._session._deleted_playlist_items[id];
                        if (deleted_item) {
                            items.push(...deleted_item._parents);
                        }
                    }
                }
                items.forEach(item=>item.__private.userdata = null);
            }
        }
        
        toggle_class(this.app_log_section, "d-none", !this.$._client.is_admin);
        if (changes.logs !== undefined) {
            if (this.app_logger) this.app_logger.append_logs(changes.logs);
        }

        // we can forget old items now (I think)
        utils.clear(this.$._session._deleted_playlist_items);
        
        if (!utils.is_empty(changes)) {
            this.emit("change", changes);
        }

        this.root.update();
    }

    get_rtmp_url() {
        var host = window.location.hostname;
        var port = this.$.conf["media-server.rtmp_port"];
        if (port != 1935) host += `:${port}`;
        return `rtmp://${host}`;
    }

    load_font(id) {
        if (!this.font_cache[id]) {
            this.font_cache[id] = app.request({
                call: ["app", "get_font"],
                arguments: [id]
            });
        }
        return this.font_cache[id];
    }
    
    /* get_property(...path) {
        path = path.map(p=>p.split("/")).flat().filter(p=>p);
        var curr = this.$.properties;
        for (var i = 0; i<path.length; i++) {
            curr = curr[path[i]];
            if (i != path.length-1) {
                if (path[i+1] == "*") {
                    curr = curr.__enumerable__
                    i++;
                }
            }
        }
        return curr;
    } */

    get_layout() {
        return this.areas.map(area=>[...area.elem.children].map(c=>c.dataset.id))
    }
    save_layout() {
        this.settings.set("layout", this.get_layout())
    }
    update_layout() {
        (this.settings.get("layout")||this.default_layout).forEach((blocks, i)=>{
            this.areas[i].append(...blocks.map(id=>this.panels[id]).filter(b=>b));
        });
    }

    /** @param {PlaylistItem[]} items */
    playlist_rescan(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;

        this.request({
            call: ["session", "update_media_info_from_ids"],
            arguments: [items.map(item=>item.id), true],
        });
    }

    /* playlist_rescan_all() {
        this.request({
            call: ["session", "update_media_info_all"],
            arguments: [true],
        });
    } */

    /** @param {PlaylistItem[]} items */
    playlist_split(items, splits, local_times=false) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        splits = utils.sort(splits);
        if (!splits.length) return [];

        var add_items = [];
        var remove_items = [];
        items = items.filter(i=>i._is_splittable);
        for (var item of items) {
            var ud = item._userdata;
            var clip_length = ud.clipping ? ud.clipping.length : ud.duration;
            var clip_offset = item.props.clip_offset || 0;
            var start = local_times ? 0 : ud.timeline_start;
            var duration = ud.timeline_duration;
            var end = start + duration;
            // var segment_start = start;
            var segment_end = start;
            for (var i = 0; i <= splits.length; i++) {
                var segment_start = segment_end;
                segment_end = (i < splits.length) ? splits[i] : end;
                var d = Math.max(0, segment_end - segment_start);
                // var segment = [segment_start, segment_end];
                if (!(utils.almost_equal(segment_start, start) && utils.almost_equal(segment_end, end)) && segment_start >= start && segment_end <= end && d>0 && !utils.almost_equal(d, 0)) {
                    var new_item = item._copy();
                    new_item.props.clip_offset = clip_offset;
                    new_item.props.clip_duration = d;
                    clip_offset = (clip_offset + d) % clip_length;
                    add_items.push(new_item);
                }
            }
            remove_items.push(item);
        }
        if (add_items.length) {
            this.playlist_add(add_items, {
                insert_pos: item.index+1,
                track_index: item.track_index
            });
        }
        if (remove_items.length) this.playlist_remove(remove_items);
        // await Promise.all(promises);
    }

    /** @param {PlaylistItem[]} items */
    playlist_group(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;

        items.sort((a,b)=>a.index-b.index);
        var index = items[0].index;
        var name = items[0]._get_pretty_name()
        var track_index = items[0].track_index
        var props = {};
        // if (items.length == 1)
        props.label = name;
        var new_item = this.playlist_add({
            filename: "livestreamer://playlist",
            props
        }, {
            insert_pos: index,
            track_index: track_index
        })[0];
        var changes = Object.fromEntries(items.map((item,i)=>[item.id, {parent_id: new_item.id, index: i, track_index: 0}]));
        this.playlist_update(changes);

        /* await app.request({
            call: ["session", "create_playlist"],
            arguments: [items.map(item=>item.id)]
        }); */

        // delete this.$.session.playlist[fake_id];
        // this.$.push([`sessions/${this.$.session.id}/playlist/${new_item.id}`, null]);
    }

    /** @param {PlaylistItem[]} items */
    playlist_breakdown(items) {
        if (!Array.isArray(items)) items = [items];
        items = items.filter(item=>item._is_playlist);
        if (!items.length) return;

        // var affected_ids = [];
        var changes = {}
        var selection = [];
        items.forEach((item)=>{
            var children = item._children;
            children.forEach((c)=>{
                // affected_ids.push(c.id);
                changes[c.id] = {parent_id: item.parent_id, track_index: item.track_index};
            });
            var parent_items = item._parent._get_track(item.track_index);
            var i = parent_items.indexOf(item);
            parent_items.splice(i, 1, ...children);
            selection.push(...children);
            parent_items.forEach((p,i)=>{
                if (!changes[p.id]) changes[p.id] = {};
                changes[p.id].index = i;
            });
        });
        items.forEach((item)=>changes[item.id] = null);
        this.playlist_update(changes);
        
        this.playlist.once("change",()=>{
            this.playlist.set_selection(selection);
        })
    }

    /** @typedef {{insert_pos:number, track_index:number, parent:PlaylistItem}} PlaylistInsertOptions */
    /** @param {PlaylistItem[]} items @param {PlaylistInsertOptions} opts */
    playlist_move(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let {track_index, insert_pos, parent} = this.get_playlist_insert_options(opts);
        var new_parent_session_id = parent._session.id;

        var all = items.map(i=>[{id:i.id, parent:parent.id}, ...i._descendents.map(d=>({id:d.id, parent:d.parent_id}))]).flat();
        var is_circular = utils.is_circular(all);
        if (is_circular) {
            alert("Detected circular parent-child loop. Aborting operation.");
            return;
        }

        var affected = new Set(items);
        var parent_items = parent._get_track(track_index);
        parent_items = parent_items.map(item=>affected.has(item)?null:item);
        var i = insert_pos;
        for (var [session_id, group] of Object.entries(utils.group_by(items, i=>i._session.id))) {
            if (session_id == new_parent_session_id) {
                parent_items.splice(i, 0, ...group);
            } else {
                this.playlist_remove(group);
                this.playlist_add(group, {insert_pos:i, track_index});
            }
            i += group.length;
        }
        parent_items = parent_items.filter(i=>i);
        var data = Object.fromEntries(parent_items.map((item,i)=>[item.id, {index:i, track_index, parent_id:parent.id}]));
        this.playlist_update(data, new_parent_session_id);
        this.playlist.once("change",()=>{
            this.playlist.set_selection(items);
        });
    }

    /** @param {any[]} items @param {PlaylistInsertOptions} opts */
    playlist_add(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let {track_index, insert_pos, parent} = this.get_playlist_insert_options(opts);

        /** @type {PlaylistItem[]} */
        var new_items = [];
        var add_file = async (data, index, parent_id, track_index)=>{
            let id = dom_utils.uuid4();
            let filename, props, children;
            if (typeof data === "string") {
                filename = data;
                props = {};
            } else if (typeof data === "object") {
                filename = data.filename ?? null;
                props = data.props ?? {};
                if (data.file instanceof File) {
                    /** @type {File} */
                    let file = data.file;
                    if (IS_ELECTRON) {
                        filename = electron.getPathForFile(file);
                    } else {
                        filename = `livestreamer://upload`;
                        file.id = id;
                        this.upload_queue.add(file, {
                            first_and_last_pieces_first: !!data.name.match(/\.mp4$/i),
                            media: true,
                            session: this.$._session.id,
                        });
                    }
                }
                if (data instanceof PlaylistItem) children = data._children;
                else if (data.children) children = data.children;
            }
            var item = new PlaylistItem({filename, id, index, track_index, parent_id, props}, this.$._session);
            new_items.push(item);
            if (children) {
                children.forEach((c,i)=>add_file(c, i, item.id, c.track_index||0));
            }
            return item;
        }

        items.forEach((c,i)=>{
            add_file(c, insert_pos+i, parent.id, track_index)
        });

        /* 
        #fix_2_track_playlist(id) {
            for (var item of this.get_playlist_items(id)) {
                var ext = path.extname(item.filename);
                item.track_index = ext.match(/^\.(aa|aac|aax|act|aiff|alac|amr|ape|au|awb|dss|dvf|flac|gsm|iklax|ivs|m4a|m4b|m4p|mmf|movpkg|mp3|mpc|msv|nmf|ogg|oga|mogg|opus|ra|rm|raw|rf64|sln|tta|voc|vox|wav|wma|wv|8svx|cda)$/i) ? 1 : 0;
            }
            this.#playlist_update_indices();
        } */

        var new_playlist = Object.fromEntries(new_items.map(f=>[f.id,f]));
        parent._get_track(track_index).slice(insert_pos).forEach((item,i)=>{
            new_playlist[item.id] = {index: insert_pos+items.length+i};
        });

        this.$._push([`sessions/${this.$._session.id}/playlist`, new_playlist]);
        this.request({
            call: ["session","playlist_add"],
            arguments: [new_items, {insert_pos, parent_id:parent.id, track_index}]
        });
        
        this.playlist.once("change",()=>{
            this.playlist.set_selection(new_items);
        })

        return new_items;
    }

    /** @param {PlaylistItem[]} items */
    async playlist_remove(items) {
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;

        for (var item of items) {
            var ul = item._upload;
            if (ul) app.upload_queue.cancel(ul.id);
        }
        for (var [session_id, group] of Object.entries(utils.group_by(items, i=>i._session.id))) {
            var all_deleted_items = new Set(group.map(i=>[i, ...i._descendents]).flat());
            this.$._push(...[...all_deleted_items].map(item=>[`sessions/${session_id}/playlist/${item.id}`, null]));
            this.request({
                call: ["sessions", session_id, "playlist_remove"],
                arguments: [group.map(i=>i.id)]
            });
            var next_item, current_item;
            next_item = current_item = this.$._session._current_playing_item;
            if (all_deleted_items.has(next_item)) {
                if (this.$._session._is_running) {
                    while (all_deleted_items.has(next_item)) {
                        next_item = next_item._next;
                    }
                } else {
                    next_item = NULL_PLAYLIST_ITEM;
                }
            }
            if (next_item !== current_item) {
                this.playlist_play(next_item);
            }
        }
    }

    /** @param {object} changes */
    async playlist_update(changes, session_id) {
        if (!session_id) session_id = app.$._session.id;
        changes = utils.tree_from_entries(changes)
        changes = cull(changes, this.$.sessions[session_id].playlist);
        if (changes) {
            this.$._push([`sessions/${session_id}/playlist`, changes]);
            await this.request({
                call: ["sessions", session_id, "playlist_update"],
                arguments: [changes]
            });
        } else {
            await this.playlist.update();
        }
    }
    
    /** @param {PlaylistItem[]} items */
    playlist_download(items) {
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;

        this.request({
            call: ["session", "download_and_replace"],
            arguments: [items.map(item=>item.id)]
        }, {
            show_spinner: false
        });
    }
    
    /** @param {PlaylistItem[]} items */
    playlist_cancel_download(items){
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;

        this.request({
            call: ["session", "cancel_download"],
            arguments: [items.map(item=>item.id)]
        }, {
            show_spinner: false
        });
    }
    
    /** @param {PlaylistItem[]} items */
    playlist_cancel_upload(items) {
        if (!Array.isArray(items)) items = [items];
        items.forEach(i=>app.upload_queue.cancel(i.id));
        if (items.length == 0) return;
        // this also cancels it for other users:
        this.request({
            call: ["session", "cancel_upload"],
            arguments: [items.map(item=>item.id)]
        }, {
            show_spinner: false
        });
    }

    /** @param {PlaylistItem} item */
    playlist_play(item, start=0) {
        var options = {pause:false};
        var root_merged = item._root_merged_playlist;
        if (root_merged) {
            var t = 0;
            for (var p of [item, ...item._get_parents(root_merged)]) {
                t += p._userdata.start;
                p = p._parent;
                var ud = p._userdata;
                if (ud.clipping) {
                    // damn this gets complicated... but it works.
                    t = utils.loop(t - ud.clipping.offset, ud.clipping.start, ud.clipping.end) - ud.clipping.start;
                }
            }
            item = root_merged;
            start += t;
        }
        options.start = start
        
        // this.media_player.seek.seek(options.start);

        this.$._push(
            [`sessions/${this.$._session.id}/playlist_id`, item.id],
            [`sessions/${this.$._session.id}/time`, start]
        );
        
        return this.request({
            call: ["session","playlist_play"],
            arguments: [item.id, options]
        });
    }

    /** @param {string[]} uris */
    async navigate_to(uris) {
        if (!Array.isArray(uris)) uris = [uris];
        var seen = new Set();
        for (var uri of uris) {
            if (seen.has(uri)) continue;
            seen.add(uri);
            var is_file = !utils.is_uri(uri) || uri.startsWith("file:");
            if (IS_ELECTRON) {
                if (is_file) await electron.shell.showItemInFolder(utils.try_file_uri_to_path(uri.replace(/\//g, "\\")));
                else await electron.shell.openExternal(uri);
            } else {
                if (is_file) open_file_manager({start: utils.try_file_uri_to_path(uri)});
                else window.open(uri, "_blank");
            }
        }
    }

    /** @param {number} t */
    seek(t, relative=false) {
        if (relative) t += this.$._session._current_time;
        if (t < 0) t = 0;
        app.$._push(
            [`sessions/${app.$._session.id}/time`, t],
        );
        return this.request({
            call: ["session", "seek"],
            arguments: [t]
        })
    }

    seek_chapter(i, relative=false) {
        var chapters = this.$._session._current_chapters;
        if (relative) {
            var t = this.$._session._current_time;
            var c = this.$._session._get_current_chapter_at_time(t);
            if (c) {
                if ((c.start - t) < -5 && i < 0) i++;
                i += c.index;
            }
        }
        i = utils.clamp(i, 0, chapters.length-1);
        c = chapters[i];
        if (c) {
            return this.seek(c.start);
        }
    }

    /** @param {PlaylistInsertOptions} opts */
    get_playlist_insert_options(opts) {
        let {parent, track_index, insert_pos} = opts ?? {};
        parent = parent ?? this.playlist.current;
        track_index = track_index ?? this.playlist.active_track_index;
        let num_items = parent._get_track(track_index).length;
        if (insert_pos === undefined) {
            let last_active = this.playlist.sortables[track_index].get_last_active();
            insert_pos = (last_active) ? dom_utils.get_index(last_active) + 1 : num_items;
        }
        insert_pos = utils.clamp(insert_pos, 0, num_items);
        track_index = utils.clamp(track_index, 0, 1);
        return {parent, track_index, insert_pos};
    }

    // ---------------
    
    /** @param {Element} parent_elem @param {PlaylistItem} item */
    build_playlist_breadcrumbs(parent_elem, item, exclude_root=false, bold_current=false) {
        var path = [item, ...item._parents].reverse().filter(p=>p);
        var path_hash = JSON.stringify([this.playlist.current.id, path.map(i=>[i.id, i._hash])]);
        if (parent_elem._path_hash === path_hash) return;
        parent_elem._path_hash = path_hash;
        dom_utils.empty(parent_elem);
        add_class(parent_elem, "breadcrumbs");
        path.forEach((item,i)=>{
            var elem = $(`<a></a>`)[0];
            var name = item._get_pretty_name() || "[Untitled]";
            if (item._is_root) {
                if (exclude_root) return;
                elem.style.overflow = "visible";
                set_inner_html(elem, `<i class="fas fa-house"></i>`);
            } else {
                set_inner_html(elem, name);
            }
            elem.href = "javascript:void(0)";
            parent_elem.append(elem);
            elem.onclick = ()=>item._reveal();
            set_attribute(elem, "title", name);
            if (i != path.length-1) {
                parent_elem.append($(`<i></i>`)[0]);
            }
        });
    }

    get_handover_sessions_options(include_none=true) {
        var sessions = this.sessions_ordered.filter(s=>s.type===SessionTypes.INTERNAL && !s._is_running);
        var names = sessions.map(s=>s.name);
        names = utils.uniquify(names, (s,i,n)=>n>1?`${s} [${i+1}]`:s);
        var options = names.map((n,i)=>[sessions[i].id,n])
        if (include_none) options.unshift([null, "-"]);
        return options;
    }

    update_request_loading() {
        toggle_class(this.request_loading_elem, "v-none", this.$._pending_requests.size == 0);
    }

    request_no_timeout(data) {
        return this.ws.request(data, 0);
    }

    request(data, opts) {
        opts = {
            show_spinner: true,
            block: false,
            timeout: 60 * 1000,
            ...opts
        };
        return new Promise(async (resolve)=>{
            // replace undefineds with nulls
            /* utils.deep_walk(data, function(k,v) {
                if (v === undefined) this[k] = null;
            }); */
            if (this.dev_mode) {
                console.debug(`request`, JSON.stringify(data));
            }
            var ws_promise = this.ws.request(data, opts.timeout);

            if (opts.show_spinner) this.$._pending_requests.add(ws_promise);
            var loader;
            if (opts.block) {
                loader = new Loader();
                loader.update({visible:true, text:"Loading..."});
            }
            this.update_request_loading();

            // delete this.expected_changes[r];
            this.last_request = ws_promise
                .then(d=>resolve(d))
                .catch((e)=>{
                    if (e instanceof utils.TimeoutError) return;
                    if (this.dev_mode) {
                        console.warn("Server error:\n" + e.toString());
                        window.alert("Server error:\n" + e.toString());
                    }
                })
                .finally(()=>{
                    if (opts.show_spinner) this.$._pending_requests.delete(ws_promise);
                    this.update_request_loading();
                    if (opts.block) loader.destroy();
                });
        })
    }

    /* chat_blocklist_add = (...args)=>this.blocklist_command("chat_blocklist", "add", ...args);
    chat_blocklist_remove = (...args)=>this.blocklist_command("chat_blocklist", "remove", ...args);
    app_blocklist_add = (...args)=>this.blocklist_command("app_blocklist", "add", ...args);
    app_blocklist_remove = (...args)=>this.blocklist_command("app_blocklist", "remove", ...args);
    
    blocklist_command(blocklist, command, ...args) {
        return this.request({
            call: [["app", blocklist, command], args],
        });
    } */

    async try_attach_to(session_id) {
        if (session_id && !this.$.sessions[session_id]) return;
        if (!this.$.client_id) return;
        session_id = session_id || "";
        var new_hash = `#${session_id}`;
        this.settings.set("last_session_id", session_id);
        this.$._last_session = this.$.sessions[session_id];
        if (window.location.hash !== new_hash) {
            window.history.replaceState({}, '', new_hash);
        }
        if (this.$._client.session_id != session_id) {
            this.$._push([`clients/${this.$.client_id}/session_id`, session_id]);
            this.request({
                call: ["attach_to"],
                arguments: [session_id]
            });
        }
        return true;
    }

    add_notice(content, dismissable = true) {
        throw new Error("not implemented yet");
        var notice = $(`<div class="notice custom-notice">${content}</div>`)[0];
        if (dismissable) add_class(notice, "is-dismissible");
        add_class(notice, "below-h2"); // fixes fucking annoying wordpress automatically moving it after header on page load.
        notices_elem.appendChild(notice);
        return notice;
    }

    remove_plugins() {
        for (var id of Object.keys(this.plugins)) this.remove_plugin(id);
    }

    async remove_plugin(id) {
        if (!this.plugins[id]) return;
        console.debug("remove_plugin", id);
        this.plugins[id].destroy();
        delete this.plugins[id];
    }

    async init_plugin(id) {
        var data = this.$.plugins[id];
        console.debug("init_pugin", id);
        this.remove_plugin(id);
        try {
            var plugin_js = await (await fetch(data.front_url)).text();
            this.plugins[id] = eval.apply(window, [plugin_js]);
            this.plugins[id].init(data.options);
        } catch (e) {
            console.error(`Plugin '${id}' failed to load...`)
            console.error(e);
        }
    }

    tick() {
        toggle_class(this.body_elem, "is-touch", dom_utils.has_touch_screen());
    }

    #rebuild_clients() {
        var session_id = this.$._client.session_id;
        var clients = Object.values(this.$.clients).filter(c=>c.session_id == session_id);
        /** @type {Record<PropertyKey,Client[]>} */
        var clients_stacked = {};
        for (var c of clients) {
            if (clients_stacked[c.username] === undefined) clients_stacked[c.username] = [];
            clients_stacked[c.username].push(c);
        }
        var owners = new AccessControl(this.$._session.access_control)._owners.map(u=>u.username);
        var items = [
            ...owners.map(o=>({username:o, type:"owner"})),
            ...utils.sort(Object.values(clients_stacked), a=>a[0].username).map(c=>({username:c[0].username, type:"client", number:c.length}))
        ];
        for (var i of items) i.id = utils.md5(JSON.stringify(i));

        dom_utils.rebuild(this.users_elem, items, {
            add: (item, elem, i)=>{
                var elem = $(`<span class="user"></span>`)[0];
                var is_self = this.$._client.username == item.username;
                var text = is_self ? `Me` : item.username;
                toggle_class(elem, "is-self", is_self);
                if (item.type === "owner") {
                    elem.append($(`<i class="fas fa-user-tie"></i>`)[0]);
                    add_class(elem, "is-owner");
                } else {
                    elem.append($(`<i class="fas fa-user"></i>`)[0]);
                    if (item.number > 1) text += ` (${item.number})`;
                }
                elem.append($(`<span>${text}</span>`)[0]);
                set_attribute(elem, "title", `${item.username} (${utils.capitalize(item.type)})`);
                return elem;
            }
        });
    }

    get sessions_ordered() {
        if (this.$.conf["main.session_order_client"]) {
            var order = this.settings.get("session_order") || EMPTY_ARRAY;
            return utils.sort(Object.values(this.$.sessions), (s)=>{
                var i = order.indexOf(s.id);
                if (i == -1) return Number.MAX_SAFE_INTEGER;
                return i;
            }, (s)=>s.index);
        } else {
            return utils.sort(Object.values(this.$.sessions), (s)=>s.index);
        }
    }

    async #rebuild_sessions() {
        await this.session_sortable.last_drag;

        var items = this.sessions_ordered;
        var session_id = this.$._client.session_id;
        dom_utils.rebuild(this.sessions_tabs_elem, items, {
            add: (item, elem, i)=>{
                if (!elem) elem = $(`<a class="session-tab"><div class="handle"><i class="fas fa-grip-lines"></i></div><span class="name"></span><span class="icons"></span></a>`)[0];
                var access_control = item.access_control;
                var has_access = access_control._self_has_access(app.passwords.get(item.id));
                var requires_password = access_control._self_requires_password;
                var is_active = item.id == session_id;
                var is_owner = access_control._self_is_owner;
                var state = item.stream.state;
                var hash = JSON.stringify([item.name, item.schedule_start_time, state, is_owner, is_active, has_access, requires_password]);
                if (elem._hash == hash) return;
                elem._hash = hash;

                var handle = elem.querySelector(".handle");
                // toggle_class(handle, "d-none", !access_control.self_can_edit)
                set_attribute(elem, "href", `#${item.id}`);
                elem.querySelector(".name").textContent = item.name;
                set_attribute(elem, "title", item.name);
                // toggle_class(elem, "unmovable", !item.movable);
                var icons = elem.querySelector(".icons");
                var icons_html = "";
                var option_data = {text: item.name, value:item.id};
                if (is_owner) {
                    // icons_html += `<i class="fas fa-user-tie"></i>`;
                    option_data.text += ` [Owner]`
                } else if (requires_password) {
                    icons_html += `<i class="fas fa-key"></i>`;
                    option_data.text += ` [Password Protected]`;
                } else if (!requires_password && !has_access) {
                    icons_html += `<i class="fas fa-lock"></i>`;
                    option_data.text += ` [Locked]`
                }
                elem.option_data = option_data;
                toggle_class(elem, "locked", !has_access);
                var schedule_start_time = item.schedule_start_time ? +new Date(item.schedule_start_time) : 0;
                if (["starting","stopping"].includes(state)) {
                    icons_html += `<i class="fas fa-sync fa-spin"></i>`;
                } else if (state === "started") {
                    icons_html += `<i class="fas fa-circle blinking"></i>`;
                } else if (schedule_start_time > Date.now()) {
                    icons_html += `<i class="far fa-clock"></i>`;
                }
                set_inner_html(icons, icons_html);
                toggle_class(elem, "active", is_active);
                toggle_class(elem, "owned", is_owner);
                toggle_class(elem, "live", state !== "stopped");
                return elem;
            },
        });
        set_select_options(this.sessions_select, [["","-",{style:{"display":"none"}}], ...[...this.sessions_tabs_elem.children].map(e=>e.option_data)]);
        set_value(this.sessions_select, this.$._client.session_id || "");
    }

    get_user(id) {
        for (var client of Object.values(this.$.clients)) {
            if (client.user_id == id) {
                return { "id": client.user_id, "username": client.username };
            }
        }
        return null;
    }

    get user_time_format() { return this.settings.get("time_display_ms") ? "h:mm:ss.SSS" : "h:mm:ss"; }

    async load_session() {
        var files = await open_file_dialog(".json,.csv,.txt");
        var text = await read_file(files[0]);
        /* var filename = files[0].name;
        if (filename.match(/\.txt$/i)) {
        } else if (filename.match(/\.json$/i)) {
        } else if (filename.match(/\.csv$/i)) {
        }
        if (text.startsWith("//")) {
            var n = text.indexOf(`\n`);
            var info = text.slice(0, n);
            text = text.slice(n);
        }
        text = text.trim(); */
        var data;
        try { data = JSON.parse(text); } catch {}
        if (data) {
            this.request({
                call: ["session","load"],
                arguments: [data]
            });
        }
    }

    async save_session() {
        this.request({
            call: ["session", "autosave"],
            show_spinner: false
        });
        var data = await this.request({
            call: ["session", "get_user_save_data"]
        });
        var name = `${utils.sanitize_filename(this.$._session.name)}-${utils.date_to_string()}`
        await save_local_file(`${name}.json`, JSON.stringify(data, null, "  "));
    }

    async toggle_help() {
        if (!this.help_container) {
            this.help_container = $(await fetch("./help.html").then(d=>d.text()))[0];
            this.elem.append(this.help_container);
            var close_button = this.help_container.querySelector("button.close");
            close_button.onclick = ()=>this.toggle_help();
        }
        toggle_class(this.body_elem, "show-side-panel");
    }
    chapter_to_string(c, show_time=false) {
        var item = this.$._session.playlist[c.id];
        var title = c.title || (item ? item._get_pretty_name() : null);
        var parts = [`${String(c.index+1).padStart(2,"0")}.`];
        if (title) parts.push(title);
        if (show_time) parts.push(`[${utils.seconds_to_timespan_str(c.start)}]`);
        return parts.join(" ");
    }

    filename_to_elfinder_hash(uri) {
        if (!utils.is_uri(uri)) uri = utils.path_to_file_uri(uri);
        var volume = Object.values(this.$.volumes).find(v=>uri.startsWith(v.uri) || v.uri == (uri+"/"));
        if (volume) {
            var relpath = decodeURI(uri.slice(volume.uri.length));
            if (!relpath.startsWith("/")) relpath = "/"+relpath;
            return volume.id + btoa(unescape(encodeURIComponent(relpath))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'.').replace(/\.+$/,'');
        }
    }
    prompt_for_reload_of_current_item() {
        if (window.confirm(`The item is currently playing and requires reloading to apply changes.\nDo you want to reload?`)) {
            app.request({
                call: ["session", "reload"]
            });
        }
    }

    destroy() {
        this.removeAllListeners();
        // UI.destroy();
        // window.removeEventListener("keydown", this.on_keydown);
        // window.removeEventListener("hashchange", this.on_hashchange);
        // window.removeEventListener("beforeunload", this.beforeunload);
        // this.playlist.destroy();
    }
};

/* window.addEventListener("message", (e)=>{
    console.log(e);
    var d = JSON.parse(e.data);
    if (d.event) {
        console.log(d.event);
    }
}); */

if (IS_ELECTRON) {
    window.prompt = async (message, default_value)=>{
        var result = await fancybox_prompt(message, default_value);
        if (result) return result;
        else return null;
    };
}

export var app = new App();
jQuery(()=>app.init());