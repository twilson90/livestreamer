import * as utils from "../../utils/all.js";
import { jQuery, $ } from '../../jquery-global.js';
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
import Sortable, {MultiDrag} from 'sortablejs';
import { ResponsiveSortable, CancelSortPlugin } from './ResponsiveSortable.js';
import { terminalCodesToHtml } from "terminal-codes-to-html";
import * as mime_ext_map from "../../utils/mime_ext_map.js";
import * as constants from "../../core/constants.js" ;

import "./style.scss";
/** @import * as ui from "../../utils/ui.js" */
/** @import {API as noUiSliderAPI} from "nouislider" */
/** @import {Rectangle} from "../../utils/all.js" */

/** @type {MainWebApp} */
let app;

export { utils, jQuery, $, Fancybox, noUiSlider, flvjs, Chart, Hammer, Sortable, MultiDrag }
export const { ui, add_class, remove_class, toggle_attribute, set_inner_html, set_children, set_attribute, set_select_options, set_text, set_value, set_style_property, update_style_properties, remove_style_property, toggle_class } = utils.dom;

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

export const LOGS_MAX_PER_LEVEL = 256;
export const ZERO_DURATION = 60;
export const VOLUME_STEP = 5;
export const MAX_CLIP_SEGMENTS = 128;
export const EMPTY_OBJECT = Object.freeze({});
export const EMPTY_ARRAY = Object.freeze([]);
export const ALL_XHRS = new Set();

export const { Observer } = utils;
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

export let plugins = [];

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

const VALIDATORS = (()=>{
    let media_type = function(type) {
        var v = this.value;
        if (!v) return true;
        var mi = app.$._session.media_info[v];
        if (!mi || !mi.exists) return "Media does not exist.";
        if (type && mi && mi.streams && !mi.streams.find(s=>s.type === type)) return `No ${type} streams detected.`
        return true;
    };
    return {
        ...ui.VALIDATORS,
        media_exists: function() { return media_type.apply(this, []); },
        media_video: function() { return media_type.apply(this, ["video"]); },
        media_audio: function() { return media_type.apply(this, ["audio"]); },
        media_subtitle: function() { return media_type.apply(this, ["subtitle"]); },
    };
})();

/** @type {Record<PropertyKey,Window>} */
export var windows = {};

// returns selected file paths
export var default_file_manager_options = {
    files: false,
    folders: false,
    multiple: false,
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
for (var k in item_colors) {
    if (!item_colors[k]) continue;
    item_colors[k] = new utils.Color(item_colors[k]).rgb_mix("#fff",0.5).to_rgb_hex();
}

/* var children_map = new Map();
export var parent_map = new Map();
export function toggle_parent(elem, v) {
    if (v && !elem.parentElement) {
        var p = parent_map[elem];
        var new_children = children_map[p].filter(e=>!!e.parentElement || e === elem);
        utils.dom.insert_at(p, elem, new_children.indexOf(elem));
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
    ufc.id = blob.id || utils.dom.uuid4();
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
                let url = new URL(location.origin);
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
export function cull_equal_props(o1, o2) {
    var cull = (o1,o2) =>{
        if (Array.isArray(o1) || Array.isArray(o2)) {
            return (JSON.stringify(o1) === JSON.stringify(o2));
        } else if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
            for (var k in o1) {
                if (cull(o1[k], o2[k])) delete o1[k];
            }
            return utils.is_empty(o1);
        } else {
            return ((o1 === o2) || (o1 == null && o2 == null));
        }
    }
    return cull(o1,o2) ? null : o1;
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
        return utils.dom.read_file(file, {encoding})
    } else if (IS_ELECTRON) {
        return fs.readFileSync(file.path, encoding);
    }
    throw new Error(`Cannot read file '${file}'`);
}
async function open_file_dialog(options) {
    if (IS_ELECTRON)  {
        var paths = await open_file_manager(options);
        return paths.map(p=>({ path:p, name:utils.basename(p) }));
    } else {
        var dialog_opts = {};
        if (options.filter) dialog_opts.accept = options.filter.join(", ");
        if (options.multiple) dialog_opts.multiple = !!options.multiple;
        return await utils.dom.open_file_dialog(dialog_opts);
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
        utils.dom.download(filename, text);
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

export function create_background_properties(settings) {
    settings = Object.assign({
        "name": "background",
        "label": "Background",
        "default": "",
    }, settings)
    var name = settings["name"];

    var background_mode = new ui.Property(`<select></select>`, {
        "name": `${name}_mode`,
        "info": ()=>{
            if (background_mode.value == "embedded") return `Shows the currently playing audio file's embedded artwork.`;
            if (background_mode.value == "external") return `Shows the external artwork relative to the audio file (a file named AlbumArt.jpg, Cover.jpg, etc.)`;
        },
        "label": settings["label"],
        "options": settings["options"],
        "default": settings["default"],
    });

    var background_color = new ui.Property(`<input type="color">`, {
        "name": `${name}_color`,
        "label": "Color",
        "default": "#000000",
        "hidden": ()=>background_mode.value !== "color"
    });

    var get_file_duration = ()=>app.$._session.media_info[background_file.value] ? app.$._session.media_info[background_file.value].duration : 0;
    var is_file_image = ()=>get_file_duration()<=IMAGE_DURATION;

    var background_file = new FileProperty({
        "name": `${name}_file`,
        "label": "Video / Image Loop File",
        "file.options": { files: true, filter: ["image", "video"] },
        "info": `An image or video file, overriding the '${settings.label}' option`,
        // "hidden": ()=>background_mode.value !== "file",
    });

    var background_file_start = new ui.TimeSpanProperty({
        "name": `${name}_file_start`,
        "label": "Loop Start Time",
        "timespan.format": "h:mm:ss.SSS",
        "min":0,
        "default": 0,
        "hidden": ()=>is_file_image(),
    });
    
    var background_file_end = new ui.TimeSpanProperty({
        "name": `${name}_file_end`,
        "label": "Loop End Time",
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

        this.hover_listener = new utils.dom.TouchListener(opts.hover_elem, {
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



function get_file_manager_url(opts) {
    var url = new URL("/index.html", utils.dom.get_url(null, "file-manager"));
    if (!opts) opts = {};
    var elfinder_options = {};
    if (opts.id != null) elfinder_options.id = opts.id;
    if (opts.multiple != null) {
        if (!elfinder_options.commandsOptions) elfinder_options.commandsOptions = {};
        elfinder_options.commandsOptions.multiple = !!opts.multiple;
    }
    if (opts.folders != null) {
        if (!elfinder_options.commandsOptions) elfinder_options.commandsOptions = {};
        elfinder_options.commandsOptions.folders = !!opts.folders;
    }
    if (opts.folders) {
        elfinder_options.onlyMimes = ["directory"];
    }
    if (opts.start) {
        var hash = app.filename_to_elfinder_hash(opts.start);
        if (hash) {
            url.hash = "#elf_"+hash;
        }
    }
    if (opts.filter) {
        elfinder_options.fileFilter = opts.filter;
    }
    
    var getfile = !!(opts.multiple || opts.files || opts.folders);
    if (getfile) {
        elfinder_options.getFileCallback = true;
    }

    url.searchParams.append("opts", JSON.stringify(elfinder_options));
    return url.toString();
}

/**
 * @param {{id:any, hidden_id:any, folders:boolean, files:boolean, multiple:boolean, filter:string[], start:string}} options 
 */
async function open_file_manager(options) {
    console.log(options);
    options = Object.assign({
        "new_window" : app.settings.get("open_file_manager_in_new_window")
    }, default_file_manager_options, options);
    if (!options.standalone && options.id === undefined) options.id = utils.dom.uuidb64();
    // if ("start" in options && !Array.isArray(options.start)) options.start = [options.start];

    if (IS_ELECTRON) {
        var electron_options = {
            properties: []
        };
        if (options.start) electron_options.defaultPath = utils.pathify(options.start); // utils.dirname(options.start[0]);
        if (options.folders) electron_options.properties.push("openDirectory");
        if (options.files) electron_options.properties.push("openFile");
        if (options.multiple) electron_options.properties.push("multiSelections");
        if (options.filter) {
            electron_options.filters = [];
            electron_options.filters.push({name:"All Files", extensions:["*"]});
            var custom_ext = [];
            let mime_filters = [];
            for (var f of options.filter) {
                mime_filters.push({name: utils.capitalize(f), extensions: mime_ext_map[f]||["*"]});
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
        var messenger = new utils.dom.WindowCommunicator();
        return new Promise((resolve,reject)=>{
            messenger.on("files", ({files,id})=>{
                if (id != options.id) return;
                var paths = files.map(f=>utils.pathify(f.uri));
                resolve(paths);
            });

            var url = get_file_manager_url(options);

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
            if (use_window) win.close();
            else app.file_manager_menu.hide();
        })
    } else {
        console.error("File Manager not present")
    }
}

export function fancybox_prompt(title, inputs, settings) {
    settings = Object.assign({
        ok:"OK",
        cancel:"Cancel",
        valid:()=>true
    }, settings);

    var modal = new Modal({
        "modal.title": title,
        "modal.footer": true,
    });

    if (!Array.isArray(inputs)) inputs = [inputs];
    var props = inputs.map(input=>{
        var prop;
        if (input instanceof ui.Property) {
            prop = input;
        } else if (utils.dom.is_html(input)) {
            prop = new ui.Property(input, { "reset": false });
        } else if (typeof input === "number") {
            prop = new ui.Property(`<input type="number"></input>`, { "default": input, "reset": false });
        } else if (typeof input === "boolean") {
            prop = new ui.Property(`<input type="checkbox"></input>`, { "default": input, "reset": false });
        } else {
            prop = new ui.Property(`<input type="text"></input>`, { "default": input, "reset": false });
        }
        return prop;
    });
    modal.content.append(...props);
    
    modal.show();
    if (props[0]) props[0].input.focus();

    return new Promise((resolve,reject)=>{
        if (settings.ok) {
            var ok_button = new ui.Button(`<button>${settings.ok}</button>`, {
                "disabled": ()=>!settings.valid(),
                "click": ()=>{
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
            var cancel_button = new ui.Button(`<button>${settings.cancel}</button>`, {
                "click": ()=>resolve(null)
            })
            modal.footer_elem.append(cancel_button)
        }
        modal.on("hide", ()=>resolve(null))
    }).finally(()=>{
        modal.hide();
    });
}
export class PlaylistCommand {
    /** @typedef {function(PlaylistItem[])} PLCFunc */
    /** @param {Record<PropertyKey, PLCFunc>} options */
    constructor(options) {
        this.options = {
            "label": "",
            "icon": null,
            "visible": true,
            "disabled": false,
            "click": utils.noop,
            "shortcut": null,
            "view": "list",
            "color": null,
            "title": null,
            ...options,
        }
    }
    #get(s, items, elem) {
        var f = this.options[s];
        if (!Array.isArray(items)) items = [items];
        return typeof f === "function" ? f.apply(null, [items, elem]) : f;
    };
    /** @type {String} */
    label(items) { return this.#get("label", items); }
    title(items) { return this.#get("title", items); }
    color(items) { return this.#get("color", items); }
    /** @type {String} */
    description(items) { return this.#get("description", items); }
    /** @type {String} */
    description_or_label(items) { return this.description(items) || this.label(items); }
    /** @type {String} */
    icon(items) { return this.#get("icon", items); }
    /** @type {boolean} */
    visible(items) { return this.#get("visible", items); }
    render(items, elem) { return this.#get("render", items, elem); }
    /** @type {boolean} */
    disabled(items) { return this.#get("disabled", items); }
    click(items) { return this.#get("click", items); }
    /** @type {String} */
    shortcut(items) { return this.#get("shortcut", items); }
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
    get _self_can_edit() { return !IS_ELECTRON && (this._owners.length == 0 || this._self_is_owner_or_admin); }
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
    time_pos = 0;
    playback_speed = 1;
    duration = 0;
    chapters = [];
    seekable = false;
    seeking = false;
    buffering = false;
    loaded;
    running = false;
    #cache = {};
    constructor() {
        this.update();
    }
    update() {
        var session = app.$._session;
        var stream = app.$._stream;
        var item = session._current_playing_item;
        var running = session._is_running;
        var loaded = !!(!running || stream.mpv.context.loaded);
        var seeking = running ? !!(loaded && stream.mpv.context.seeking) : false;
        var buffering = (seeking || !loaded || !!stream.mpv.context.props["paused-for-cache"]);
        var seekable = !running || !!stream.mpv.context.seekable;
        var special_seeking = !!(running && stream.mpv.special_seeking);

        this.buffering = buffering;
        this.seeking = seeking;
        this.running = running;

        if (special_seeking) return;

        this.playback_speed = stream.mpv.context.playback_speed;
        this.time_pos = session.time_pos;
        this.paused = stream.mpv.context.props.pause || stream.mpv.context.props["paused-for-cache"];
        this.duration = session._current_duration;
        this.chapters = loaded ? session._current_chapters : EMPTY_CHAPTERS;
        this.seekable = loaded ? this.duration != 0 && seekable && item.filename !== "livestreamer://empty" : false;
        this.loaded = loaded;
        this.status = running ? (loaded ? "Playing" : "Loading") : "Pending";
        this.stats = {};
        this.stats["V-FPS"] = (+stream.mpv.context.props["estimated-vf-fps"] || 0).toFixed(2);
        if (!stream.is_encode) this.stats["D-FPS"] = (+stream.mpv.context.props["estimated-display-fps"] || 0).toFixed(2);
        this.stats["INTRP"] = stream.mpv.context.interpolation ? "On" : "Off";
        this.stats["DEINT"] = stream.mpv.context.deinterlace ? "On" : "Off";
        this.ranges = session._current_seekable_ranges;
        // this.#last_seeks = stream.mpv.context.seeks;
        this.#cache = {};
    }
    get curr_chapters() {
        var session = app.$._session;
        return this.#cache["curr_chapters"] = this.#cache["curr_chapters"] ?? session._get_current_chapters_at_time(this.time_pos);
    }
    get time_left() {
        return Math.max(0, this.duration - this.time_pos);
    }
    get do_live_seek(){
        var stream = app.$._stream;
        return stream._is_running && !stream.is_encode && !stream.mpv.context.is_special;
    }
}

export class Remote extends utils.EventEmitter {
    client_id = null;
    clients = create_proxy(Client);
    sessions = create_proxy(Session);
    targets = create_proxy(Target);
    volumes = {};
    change_log = {};
    logs = {};
    nms_sessions = {};
    /** @type {typeof import("../InternalSessionProps.js").default} */
    properties = {};
    fonts = {};
    uploads = {};
    downloads = {};
    processes = {};
    sysinfo = {
        platform: ""
    };
    process_info = {};
    conf = {};
    detected_crops = {};

    _changes = [];
    _pending_requests = new Set();
    /** @type {Session} */
    _last_session = null;
    get _ping() { return app.ws.last_ping };
    ts = this._ts = Date.now();

    _refresh_ping(){
        return app.ws.ping();
    }

    _debounced_update = utils.dom.debounce_next_frame(()=>this._update());
    _update() {
        var changes = utils.tree_from_pathed_entries(this._changes);
        utils.clear(this._changes);

        // !! IMPORTANT FOR DATES AND THINGS LIKE THAT.

        // this will automatically do any toJSON calls and not pollute the original data structure.
        changes = utils.json_copy(changes)
        
        /* utils.walk(changes, function(k,v) {
            if (v && typeof v === "object" && v.toJSON && typeof v.toJSON === "function") {
                this[k] = v.toJSON();
            }
        }); */
        
        Observer.apply_changes(this, changes);
        this.emit("update", changes);
    }
    _push(...items) {
        this._changes.push(...items.map(i=>utils.json_copy(i)));
        this._debounced_update();
    }
    /** @type {Session} */
    get _session() { return this.sessions[this._client.session_id] || NULL_SESSION; }
    /** @type {Client} */
    get _client() { return this.clients[this.client_id] || NULL_CLIENT; }
    get _stream() { return this._session.stream; }
    get _streams() { return Object.fromEntries(Object.values(this.sessions).map(s=>s.stream).filter(s=>s).map((s)=>[s.id, s])); }
    // gets server time
    get _now() { return Date.now() - (this._ts - this.ts); }
    get _targets() {
        var targets = Object.values(this.targets);
        targets = targets.filter(t=>t.locked?true:t.access_control._self_has_access());
        utils.sort(targets, t=>!t.locked, t=>t.ts);
        return Object.fromEntries(targets.map(t=>[t.id, t]));
    }
}

export class Client {
    id = "";
    session_id = undefined;
    is_admin = false;
    username = null;
    email = null;
}

export class Target {
    id = "";
    name = ""
    description = ""
    rtmp_host = ""
    rtmp_key = ""
    url = ""
    access_control = new AccessControl();
    ts = 0
    limit = 0
    locked = false
    opts = {};
    get _streams() { return Object.values(app.$._streams).filter(st=>st.stream_targets[this.id]); }
    get _active_streams() { return this._streams.filter(s=>s._is_running); }
    get _in_use() { return !!this._active_streams.length; }
    // get _stream_targets() { return Object.values(app.$._streams).map(s=>s._get_stream_target(this.id)).filter(st=>st); }
}

/** @typedef {{index:number,start:number,end:number,id:string}} Chapter */
/** @typedef {{filenames:string[]}} PlaylistInfo */
/** @typedef {{duration:Number,media_duration:Number,children_duration:Number}} PlaylistItemDurations */
/** @typedef {{start:Number,end:Number,duration:Number,offset:Number}} PlaylistItemClipping */
/** @typedef {{download:Download,is_processing:boolean,color:string,modified:boolean,clipping:PlaylistItemClipping,is_playlist:boolean, is_merged:boolean,display_name:string,chapters:Chapter[],timeline_duration:Number,start:Number,end:Number,timeline_start:Number,timeline_end:Number,parent_ids:string[]} & PlaylistItemDurations} PlaylistUserData */

export class StreamTarget {
    id = "";
    state = "stopped";
    stream_id = "";
    target_id = "";

    get _session() {
        return this._stream._session;
    }
    get _stream() {
        return app.$._streams[this.stream_id];
    }
    get _target() {
        return app.$.targets[this.target_id];
    }
}

export class Stream {
    id = "";
    start_time = 0;
    state = "stopped";
    metrics = {};
    session_id = 0;
    mpv = {
        special_seeking: false,
        context: new MPVContext(this),
    };
    targets = {};
    stream_targets = create_proxy(StreamTarget);
    test = false;
    bitrate = 0;
    internal_path;
    is_encode = false;
    restart = 0;
    
    get _is_only_gui() {
        return !!(Object.keys(this.targets).length == 1 && this.targets["gui"]);
    }
    
    get _session() {
        return app.$.sessions[this.session_id];
    }
    get _is_running() {
        return this.state !== "stopped";
    }
    get _live_nms_session() {
        return Object.values(app.$.nms_sessions).find(s=>s.appname === "live" && this.internal_path === s.publishArgs.origin);
    }
    get _run_time() {
        return app.$._now - this.start_time;
    }
    _get_stream_target(id) {
        return Object.values(this.stream_targets).find(st=>st.id == id || st.target_id == id || st.stream_id == id);
    }
}

export class MPVContext {
    preloaded = false;
    loaded = false;
    seeking = false;
    is_special = false;
    seekable = false;
    interpolation = false;
    deinterlace = false;
    duration = 0;
    time = 0;
    seekable_ranges = [];
    playing = true;
    props = {};
    streams = [];
    playback_speed = 1;
}
export class Session {
    id = "";
    type;
    index = 0;
    playlist_id = -1;
    time_pos = 0;
    logs = {};
    downloads = {};
    access_control = new AccessControl();
    player = {};
    player_default_override = {};
    stream_settings = {};
    stream = new Stream();
    media_info = {};
    // current_item_on_load = null;
    // current_descendents_on_load = null;
    name = "";
    background_mode = "";
    /** @type {Record<PropertyKey,PlaylistItem>} */
    playlist = new Proxy({}, {
        /** @param {Record<PropertyKey,PlaylistItem>} target */
        get: (target, prop)=>{
            if (prop == "0") return this._root_playlist_item;
            return target[prop];
        },
        /** @param {Record<PropertyKey,PlaylistItem>} target */
        set:(target, prop, value)=>{
            if (prop in target) target[prop].__private.register_parent(null);
            target[prop] = new PlaylistItem(value, this);
            target[prop].__private.register_parent();
            return true;
        },
        /** @param {Record<PropertyKey,PlaylistItem>} target */
        deleteProperty: (target, prop)=>{
            if (prop != "0" && prop in target) {
                target[prop].parent_id = null;
                target[prop].__private.register_parent();
                delete target[prop];
            }
            return true;
        }
    });
    /** @typedef {{filenames:string[]}} PlaylistInfo */
    /** @type {Record<PropertyKey,PlaylistInfo>} */
    playlist_info = {};
    playlist_history = new class{
        position = 0;
        start = 0;
        end = 0;
        stack = {};
        get _size() { return this.end-this.start; }
        get _next() { return this.stack[this.position]; }
        get _prev() { return this.stack[this.position-1]; }
    };

    _root_playlist_item = new PlaylistItem({id:"0"}, this);
    
    get _connected_nms_sessions() {
        return Object.values(app.$.nms_sessions).filter(s=>s.publishStreamPath.split("/").pop() === this.id);
    }
    /** @return {PlaylistItem} */
    get _current_playing_item() {
        return this.playlist[this.playlist_id] || NULL_PLAYLIST_ITEM;
    }
    get _is_running() {
        return this.stream._is_running;
    }
    /** @return {Chapter[]} */
    get _current_chapters() {
        return this._current_playing_item._userdata.chapters;
    }
    get _current_duration() {
        var d = 0;
        if (this.stream._is_running && this.stream.mpv.context.duration) {
            d = this.stream.mpv.context.duration;
        } else {
            var item = this._current_playing_item;
            if (!item._is_playlist || item._is_merged_playlist) d = item._userdata.duration;
        }
        return round_ms(d || 0);
    }
    get _current_seekable_ranges() {
        if (this.stream._is_running) return this.stream.mpv.context.seekable_ranges;
        return [];
    }
    _get_connected_nms_session_with_appname(...appnames) {
        return this._connected_nms_sessions.find(s=>appnames.includes(s.appname));
    }
    _get_current_chapters_at_time(t) {
        return this._current_chapters.filter(c=>t>=c.start && t<c.end);
    }
    _get_current_chapter_at_time(t) {
        return this._get_current_chapters_at_time(t).pop();
    }
}
class PlaylistItemPrivate {
    /** @type {PlaylistItem} */
    item;
    /** @type {Session} */
    session;
    num_updates = 0;
    /** @type {PlaylistUserData} */
    userdata = null;
    /** @type {Set<PlaylistItem>} */
    children = new Set();
    /** @type {PlaylistItem[]} */
    children_ordered = null;
    /** @type {PlaylistItem} */
    parent = null;
    constructor(item, session) {
        this.item = item;
        this.session = session;
    }
    register_parent() {
        var new_parent = this.item._parent;
        if (this.parent == new_parent) return;
        let old_parent = this.parent;
        if (old_parent) {
            old_parent.__private.clear_userdata();
            old_parent.__private.children.delete(this.item);
            old_parent.__private.children_ordered = null;
            this.parent = null;
        }
        if (new_parent) {
            new_parent.__private.children.add(this.item);
            new_parent.__private.children_ordered = null;
            this.parent = new_parent;
        }
    }
    clear_userdata() {
        this.userdata = null;
        for (var p of this.item._iterate_parents()) {
            p.__private.userdata = null;
        }
    }
}
export class PlaylistItem {
    id = "-1";
    /** @type {String} */
    parent_id = null;
    filename = "";
    index = 0;
    track_index = 0;
    props = {};
    upload_id = null;
    /** @type {PlaylistItemPrivate} */
    __private;

    /** @param {Session} session */
    constructor(data, session) {
        if (!session) session = NULL_SESSION;
        var _this = new Proxy(this, {
            set: (_, prop, value)=>{
                this.__private.num_updates++;
                this.__private.clear_userdata();
                var res = Reflect.set(this, prop, value);
                if (this._is_connected) {
                    if (prop == "parent_id") {
                        this.__private.register_parent();
                    } else if (prop == "track_index" || prop == "index") {
                        if (this.__private.parent) this.__private.parent.__private.children_ordered = null;
                    }
                }
                return res;
            },
        });
        Object.defineProperty(this, "__private", {
            value: new PlaylistItemPrivate(_this, session),
            enumerable: false,
        });
        Object.assign(_this, data);
        return _this;
    }
    /** @return {Session} */
    get _session() {
        return this.__private.session;
    }
    get _is_connected() {
        return this.id in this._session.playlist;
    }
    /** @return {PlaylistUserData} */
    get _userdata() {
        if (!this.__private.userdata) {
            this._update_userdata();
            this.__private.num_updates++;
        }
        return this.__private.userdata;
    }
    get _hash() {
        this._userdata;
        return this.__private.num_updates;
    }
    get _parent() {
        return this._session.playlist[this.parent_id];
    }
    get _media_info() {
        return this._session.media_info[this.filename];
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
    get _is_modifiable() {
        return !this._is_root && !this._is_null;
    }
    get _detected_crops() {
        return app.$.detected_crops[this.id];
    }
    get _crop() {
        var vals = this.props.crop || [0,0,0,0];
        return new utils.Rectangle({left:vals[0], top:vals[1], right:1-vals[2], bottom:1-vals[3]});
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
        let duration = round_ms(Math.max(0, clip_length * clip_loops));
        timeline_duration = round_ms(Math.max(ZERO_DURATION, timeline_duration * clip_loops));
        
        if (download) ud.download = download;
        if (upload) ud.upload = upload;
        if (is_processing) ud.is_processing = true;

        var props = new Set(Object.keys(this.props));
        props.delete("label");
        props.delete("color");
        if (props.size) {
            ud.modified = true;
        }
        if ("clip_start" in this.props || "clip_end" in this.props || "clip_loops" in this.props || "clip_offset" in this.props) {
            let start = this.props.clip_start || 0;
            let end = this.props.clip_end || media_duration;
            let length = end-start;
            let loops = this.props.clip_loops ?? 1;
            let duration = length * loops;
            let offset = ((this.props.clip_offset || 0) % length) || 0;
            ud.clipping = { start, end, length, duration, offset, loops };
        }

        ud.is_merged = this._is_merged;
        ud.duration = duration || 0;
        ud.media_duration = media_duration || 0;
        ud.children_duration = children_duration || 0;
        ud.timeline_duration = timeline_duration || 0;
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
            chapters = utils.json_copy(media_info.chapters || EMPTY_ARRAY);
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
                if (!c.id && !c.title) c.title = `Chapter ${i+1}`;
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
        return !!(this._is_rtmp && this._session._get_connected_nms_session_with_appname("private", "session"));
    }
    get _info() {
        return this._session.playlist_info[this.id];
    }
    get _filenames() {
        return (this._info||{}).filenames || [];
    }
    get _related_media_infos() {
        return this._filenames.map(f=>this._session.media_info[f]).filter(mi=>mi);
    }
    get _is_processing() {
        return this._related_media_infos.some(mi=>mi.processing) || this._children.some(i=>i._is_processing);
    }
    get _parents() {
        return [...this._iterate_parents()].filter(p=>p);
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
    get _is_url() {
        this._url.protocol.match(/^(https?|rtmps?):$/)
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
        return app.$.uploads[this.upload_id];
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
        /** @type {PlaylistItem} */
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
        if (next && next._is_root) return;
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
    /** @param {PlaylistItem} [until] @return {Iterable<PlaylistItem>} */
    *_iterate_parents(until) {
        var item = this;
        while (item) {
            item = item._parent;
            if (item) yield item;
            if (until === item) break;
        }
    }
    _copy(include_non_enumerable=false) {
        if (include_non_enumerable) return Object.fromEntries((utils.get_property_keys(this).map(k=>[k,utils.json_copy(this[k])])));
        return utils.json_copy(this);
    }
    /** @param {PlaylistItem[]} items */
    static get_items_title(items) {
        items = items.filter(i=>i);
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
export const NULL_STREAM_TARGET = Object.freeze(new StreamTarget());

/** @extends {ui.UI<{save:Rectangle}>} */
export class CropPreview extends ui.UI {
    rect = new utils.Rectangle();

    constructor(url, rect, rect2, editable, width, height) {
        var elem = $(
            `<div class="crop-preview-wrapper">
                <div class="crop-preview">
                    <img src="${url}" draggable="false" width="${width}" height="${height}">
                    <div class="bg-area">
                        <div class="crop-edges"></div>
                        <div class="detected-crop-border"></div>
                        <div class="crop-border"></div>
                    </div>
                    <div class="ui-area"></div>
                </div>
            </div>`
        )[0];
        
        super(elem);

        this.corners = {};
        this.edges = {};
        
        this.black_elem = this.elem.querySelector(".crop-edges");
        this.crop_border_elem = this.elem.querySelector(".crop-border");
        toggle_class(this.crop_border_elem, "d-none", !rect2);
        this.detected_crop_border_elem = this.elem.querySelector(".detected-crop-border");
        this.content_elem = this.elem.querySelector(".crop-preview");
        this.img_elem = this.elem.querySelector("img");
        this.orig_rect = rect;
        this.orig_crop_rect = rect2;
        /** @type {HTMLElement} */
        this.ui_elem = this.elem.querySelector(".ui-area");

        var legend_elem = $(`<div class="legend"></div>`)[0];

        var add_legend = (name, clazz)=>{
            var elem = $(`<div><div class="${clazz}" style="width:15px;height:15px"></div><span>${name}</span></div>`)[0]
            legend_elem.append(elem);
        }

        add_legend("Crop Area", "crop-border");

        if (editable) {
            if (rect2) {
                add_legend("Detected Crop Area", "detected-crop-border");
                this.append(legend_elem);
            }
            
            var b = new utils.Rectangle(0,0,1,1);

            var setup_drag = (el, keys, constrain=false)=>{
                var get_coords=(e)=>{
                    var client_rect = this.content_elem.getBoundingClientRect();
                    var x = e.clientX - client_rect.left;
                    var y = e.clientY - client_rect.top;
                    return {x,y};
                }
                $(el).on("mousedown", (e)=>{
                    var rect = this.rect.clone();
                    var {x:x0, y:y0} = get_coords(e)
                    var onmousemove =  (e)=>{
                        var {x:x1, y:y1} = get_coords(e)
                        var [dx, dy] = [x1-x0, y1-y0];
                        var new_rect = rect.clone();
                        for (var key of keys) {
                            if (key === "bottom" || key === "top" || key === "y" || key === "height") {
                                new_rect[key] += dy / this.content_elem.offsetHeight;
                            } else {
                                new_rect[key] += dx / this.content_elem.offsetWidth;
                            }
                        }
                        if (constrain) new_rect.constrain(b);
                        this.update_crop(new_rect);
                    };
                    $(document).on("mousemove", onmousemove);
                    $(document).one("mouseup", (e)=>{
                        $(document).off("mousemove", onmousemove);
                    });
                });
            }
            
            this.drag_rect_elem = $(`<div class="drag-rect"></div>`)[0];
            this.drag_rect_elem.ondblclick = ()=>{
                this.update_crop(b);
            }
            this.ui_elem.append(this.drag_rect_elem);
            setup_drag(this.drag_rect_elem, ["x","y"], true)

            var edges = ["top","right","bottom","left"];
            edges.forEach((key,i)=>{
                var edge_elem = $(`<div class="drag-edge ${key}"></div>`)[0];
                this.edges[key] = edge_elem;
                this.ui_elem.append(edge_elem);
                setup_drag(edge_elem, [key]);
            });

            var corners = ["top-right","bottom-right","bottom-left","top-left"];
            corners.forEach((key,i)=>{
                var corner_elem = $(`<div class="drag-corner ${key}"></div>`)[0];
                this.corners[key] = corner_elem;
                this.ui_elem.append(corner_elem);
                setup_drag(corner_elem, key.split("-"));
            });
            this.info_elem = $(`<div class="info"></div>`)[0];
            this.append(this.info_elem);
        }
        if (rect2) this.update_crop(rect2);
        set_crop_border(this.detected_crop_border_elem, rect);
    }
    
    /** @param {Rectangle} r */
    update_crop(r) {
        r = new utils.Rectangle(r);
        r.left = utils.clamp(r.left)
        r.right = utils.clamp(r.right)
        r.bottom = utils.clamp(r.bottom)
        r.top = utils.clamp(r.top);
        if (this.rect.equals(r)) return;
        this.rect = r.fix();
        
        var corner_cursors = {
            "top-right": "ne-resize",
            "bottom-right": "se-resize",
            "bottom-left": "sw-resize",
            "top-left":"nw-resize"
        };
        var edge_cursors = {
            "top": "n-resize",
            "right": "e-resize",
            "bottom": "s-resize",
            "left": "w-resize"
        };

        var fix_key = (k, r)=>{
            if (k === "top") return r[k] > r.bottom ? "bottom" : k;
            if (k === "bottom") return r[k] < r.top ? "top" : k;
            if (k === "left") return r[k] > r.right ? "right" : k;
            if (k === "right") return r[k] < r.left ? "left" : k;
            return k;
        };

        $(this.drag_rect_elem).css({
            top: `${r.top*100}%`,
            left: `${r.left*100}%`,
            width: `${r.width*100}%`,
            height: `${r.height*100}%`,
        })

        for (var k in this.corners) {
            var [k0,k1] = k.split("-");
            $(this.corners[k]).css({
                top: `${r[k0]*100}%`,
                left: `${r[k1]*100}%`,
                cursor: corner_cursors[`${fix_key(k0, r)}-${fix_key(k1, r)}`],
            });
        }
        for (var k in this.edges) {
            var x,y,d;
            if (k == "top") [x,y,d] = [r.left, r.top, "width"];
            else if (k == "bottom") [x,y,d] = [r.left, r.bottom, "width"];
            else if (k == "left") [x,y,d] = [r.left, r.top, "height"];
            else if (k == "right") [x,y,d] = [r.right, r.top, "height"];
            $(this.edges[k]).css({
                top: `${y*100}%`,
                left: `${x*100}%`,
                [d]: `${r[d]*100}%`,
                cursor: edge_cursors[fix_key(k, r)]
            });
        }

        // var client_rect = this.content_elem.getBoundingClientRect();
        // this.ui_elem.style.setProperty("--tw", `${client_rect.width * this.rect.width}px`)
        // this.ui_elem.style.setProperty("--th", `${client_rect.height * this.rect.height}px`)

        set_inner_html(this.black_elem, [
            `<div style="left:0;width:${this.rect.left*100}%;top:0;bottom:0"></div>`,
            `<div style="left:${this.rect.right*100}%;right:0;top:0;bottom:0"></div>`,
            `<div style="left:0;right:0;top:0;height:${this.rect.top*100}%"></div>`,
            `<div style="left:0;right:0;top:${this.rect.bottom*100}%;bottom:0"></div>`,
        ].join(""));

        if (this.crop_border_elem) {
            set_crop_border(this.crop_border_elem, r);
        }

        if (this.info_elem) {
            let html = ["left","top","right","bottom","width","height"].map((e,i)=>{
                var v = (i!=2 && i!=3) ? r[e] : 1-r[e];
                return `<span>${e}=${(v*100).toFixed(2)}%</span>`;
            }).join("");
            set_inner_html(this.info_elem, html);
        }
        
        this.emit("change");
    }
}

/** @param {Rectangle} rect */
function set_crop_border(elem, rect) {
    $(elem).css({
        left:`${rect.x*100}%`,
        top:`${rect.y*100}%`,
        width:`${rect.width*100}%`,
        height:`${rect.height*100}%`,
    });
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
            if (!utils.dom.has_focus(this.elem)) return;
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
        this.emit("change", this._selected);
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
    /** @type {Record<PropertyKey,JsonElement>} */
    children = {};

    constructor(data, key, parent) {
        this.data = data;
        this.type = typeof this.data;
        this.key = key;
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

        var empty = false;
        if (this.type == "array" || this.type == "object") {
            empty = true;
            for (var k in this.data) {
                var child = new JsonElement(data[k], is_array ? null : k, this);
                this.value_elem.append(child.elem);
                this.children[k] = child;
                empty = false;
            }
        } else {
            this.value_elem.innerText = String(this.data);
        }
        var children = Object.values(this.children);
        var collapsible = !!(children && children.length > 0 && !!parent);
        var placeholder_elem;
        if (collapsible) {
            placeholder_elem = document.createElement("span");
            add_class(placeholder_elem, "json-placeholder");
            placeholder_elem.innerText = `${children.length} items`;
            if (collapsible) {
                placeholder_elem.onclick=()=>this.collapse();
                prefix_elem.onclick=()=>this.collapse();
                suffix_elem.onclick=()=>this.collapse();
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
    collapse(value) {
        toggle_class(this.elem, "collapsed", value)
    }
    find(path) {
        if (!Array.isArray(path)) path = [path];
        var c = this;
        for (var k of path) {
            c = c.children[k];
        }
        return c;
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
export class JSONContainer extends ui.UI {
    constructor(data, collapsed_children=false) {
        var json_root = new JsonRoot(data, collapsed_children);
        super(json_root.elem);
        this._json_root = json_root;
    }
}

// -----------------------------------------------------------

/** @template T,K @extends {ui.UI<K>} */
export class Modal extends ui.UI {
    get showing() { return !!this.fb; }
    get modal_title() { return this.get_setting("modal.title"); }
    get changes() {
        if (!this.props) return null;
        return utils.deep_entries(utils.deep_diff(this.items_on_show, this.props.items));
    }
    get items() { return this.props.items; }

    /** @type {ui.PropertyContainer<T>} */
    props;

    constructor(settings) {
        settings = {
            // modal_click: "close",
            "modal.close": true,
            "modal.title": "",
            "modal.title-overflow": false,
            "modal.footer": false,
            "modal.header": true,
            "modal.width": undefined,
            "modal.props": false,
            ...settings
        };

        super(settings);
        
        this.header_elem = $(`<div class="modal-header"></div>`)[0];
        this.content = new ui.UI($(`<div class="modal-content"></div>`)[0]);
        this.footer_elem = $(`<div class="modal-footer"></div>`)[0];

        this.elem.append(this.header_elem);
        this.elem.append(this.content);
        this.elem.append(this.footer_elem);

        if (this.settings["modal.props"]) {
            this.props = this.get_setting("modal.props");
            this.content.append(this.props);
            
            this.props.on("change", ()=>{
                this.update();
            });
        }
        
        this.on("render", ()=>{
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

    async show(items) {
        if (this.fb) return;
        if (!Array.isArray(items)) items = [items];
        if (this.props) this.props.items = items;
        this.items_on_show = utils.json_copy(items);
        
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
        
        this.emit("show");
        await this.update();
    }

    hide() {
        if (!this.fb) return;
        this.fb.close();
        this.fb = null;
    }
}

export class TargetConfigMenu extends Modal {
    get _target() { return app.$.targets[this._target_id]; }
    /** @param {Target} target  */
    constructor(target_id, title) {
        super({
            "modal.title": `Configure ${title}`,
            "modal.props": new ui.PropertyContainer({
                "nullify_defaults": true,
                "items": ()=>[this._target_menu._value[target_id]],
            })
        });
        this._target_id = target_id;
        app.target_config_menus[target_id] = this;

        var _this = this;
        /** @this {ui.Property} */
        this._get_default = function() { return _this._target.opts[this.name]; }

        this.props.on("change", (e)=>{
            if (e.trigger) {
                var opts = this._target_menu._value;
                if (!opts[target_id]) opts[target_id] = {};
                if (e._value === null) delete opts[target_id][e.name];
                else opts[target_id][e.name] = e._value;
                this._target_menu.update_value();
            }
        });

        this.config();
    }

    config() { }

    /** @param {TargetMenu} target_menu */
    async show(target_menu) {
        this._target_menu = target_menu;
        await super.show();
    }
}

export class LocalMediaServerTargetConfigMenu extends TargetConfigMenu {
    constructor() {
        super("local", `Local Media Server`);
    }
    config() {
        var use_hardware = new ui.Property(`<select>`, {
            "name": "use_hardware",
            "label": "Use Hardware",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "Use GPU to encode (much faster than using CPU)"
        });
        this.props.append(use_hardware);
        var use_hevc = new ui.Property(`<select>`, {
            "name": "use_hevc",
            "label": "Use HEVC",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "Use a modern video codec (incompatible with older browsers & firefox, not recommended)"
        });
        this.props.append(use_hevc);
        var outputs = new ui.PropertyList({
            "name": "outputs",
            "label": "Outputs", 
            "item_size": 300,
            "type": ()=>class extends ui.PropertyContainer {
                constructor() {
                    super();
                    var name = new ui.Property(`<input type="text">`, {
                        "name": "name",
                        "label": "Name",
                        "reset": false,
                        "placeholder": "Name of preset"
                    });
                    this.append(name);
                    var resolution = new ui.Property(`<select>`, {
                        "name": "resolution",
                        "label": "Resolution",
                        "options": [[0, "Pass-through"], ...[1080, 720, 480, 360, 240].map(o=>[o,String(o)+"p"])],
                        "reset": false,
                    });
                    var video_bitrate = new ui.Property(`<input type="number">`, {
                        "name": "video_bitrate",
                        "label": "Video Bitrate",
                        "suffix": `kbps`,
                        "step": 50,
                        "min": 100,
                        "max": 5000,
                        "reset": false,
                    });
                    var audio_bitrate = new ui.Property(`<input type="number">`, {
                        "name": "audio_bitrate",
                        "label": "Audio Bitrate",
                        "suffix": `kbps`,
                        "step": 1,
                        "min": 64,
                        "max": 320,
                        "reset": false,
                    });
                    var row = new ui.FlexRow();
                    row.append(resolution, video_bitrate, audio_bitrate);
                    this.append(row);
                }
            },
            "default": this._get_default,
        });
        this.props.append(outputs);
    }
}

export class FileTargetConfigMenu extends TargetConfigMenu {
    constructor() {
        super("file", `File`);
    }
    config() {
        var keywords = {
            "session": "Name of the session",
            "unix": "Unix timestamp",
            "date": "Date timestamp"

        }
        var filename = new ui.Property(`<input type="text">`, {
            "name": "filename",
            "label": "Output File Name",
            "default": this._get_default,
            "info": `<span>The name of the file which will be output to your session directory.<br>Special keywords:</span><ul>${Object.entries(keywords).map(([k,v])=>`<li style="margin:0">${k} => ${v}</li>`).join("")}</ul>`
        });
        this.props.append(filename);
        var format = new ui.Property(`<select>`, {
            "name": "format",
            "label": "Output Format",
            "default": "flv",
            "options": [["flv", "flv"], ["matroska", "matroska"], ["mp4", "mp4"]]
        });
        this.props.append(format);
        var re = new ui.Property(`<select>`, {
            "name": "re",
            "label": "Realtime",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "If not realtime and no other targets, encoding will be as fast as possible."
        });
        this.props.append(re);
    }
}

export class GUITargetConfigMenu extends TargetConfigMenu {
    constructor() {
        super("gui", `GUI`);
    }
    config() {
        var osc = new ui.Property(`<select></select>`, {
            "name": "osc",
            "label": "Show OSC",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "Show On-Screen-Controller"
        });
        this.content.append(osc);
    }
}

export class UserConfigurationSettings extends Modal {
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "data": (_,k)=>app.settings.get(k[0]),
            }),
            "modal.title": "Client Configuration",
            "modal.footer":true,
        });

        var groups = utils.group_by(Object.entries(app.settings_prop_defs), ([k,v])=>v.__group__);
        var group_keys = Object.keys(app.settings_groups);
        group_keys.forEach((k,i)=>{
            var box = new ui.Box(`<p>${app.settings_groups[k].title}</p>`);
            var row = box.append(new ui.FlexRow());
            for (var [name, def] of groups.get(k)) {
                var prop_settings = {
                    "name": name,
                    "label":def.__title__, 
                    "title": def.__title__,
                    "options": def.__options__,
                    "default": def.__default__,
                };
                if (def.__info__) prop_settings.info = def.__info__;
                
                row.append(new ui.Property(def.__input__, prop_settings));
            }
            this.props.append(box);
        });
        var ping = new ui.Property(`<input type="text">`, {
            "label": "Client Ping",
            "readonly": true,
            "default": ()=>`${app.$._ping} ms`,
            "reset": false,
        });
        this.props.append(ping);
        var refreshing = false;
        this.ping_button = new ui.Button(`<button><i class="fas fa-arrows-rotate"></i></button>`, {
            "click":async()=>{
                refreshing = true;
                this.update();
                await app.$._refresh_ping();
                refreshing = false;
                this.update();
            },
            "disabled":()=>refreshing,
            "title": "Refresh Ping",
        });
        ping.outer_el.append(this.ping_button);

        
        var reset_button = new ui.Button(`<button>Reset</button>`, {
            "click": ()=>this.props.reset()
        });
        this.footer_elem.append(reset_button);
        
        var reset_layout_button = new ui.Button(`<button>Reset Layout</button>`, {
            "click": ()=>{
                app.settings.set("layout", null);
                app.update_layout();
            }
        });
        this.footer_elem.append(reset_layout_button);
        var logout_button = new ui.Button(`<button>Log Out</button>`, {
            "click": async ()=>{
                utils.dom.Cookies.remove("ls_key");
                var request = new XMLHttpRequest();
                request.addEventListener("loadend", ()=>window.location.reload());
                request.open("get", "/logout", false, "false", "false");
                request.send();
            }
        });
        this.footer_elem.append(logout_button);

        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set(e.name, e._value);
        })
    }
}
export class KeyboardShortcuts extends Modal {
    constructor() {
        super({
            "modal.title": "Controls",
            "modal.props": new ui.PropertyContainer(),
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
                ...app.playlist.all_commands.filter(c=>c.options.view === PLAYLIST_VIEW.LIST && c.shortcut()).map(c=>[c.shortcut_alt(), c.description_or_label()])
            ],
            "Playlist (Timeline Mode)": [
                [`[Arrow Left] / [Arrow Right]`, `Select Previous / Next Item`],
                [`Mouse Wheel Up / Down`, `Zoom In & Out`],
                [`Left Click Tick Bar`, `Place Timeline Cursor`],
                ...app.playlist.all_commands.filter(c=>c.options.view === PLAYLIST_VIEW.TIMELINE && c.shortcut()).map(c=>[c.shortcut_alt(), c.description_or_label()])
            ]
        };
        //.replace("+", `<i class="fas fa-plus"></i>`)
        var html = Object.entries(sections).map(([name,s])=>`<table class="keyboard-shortcuts"><tr><th colspan="2">${name}</th></tr>${s.map(line=>`<tr>${line.map(l=>`<td>${l.replace(/\[(.+?)\]/g, `<span class="keyboard-key">$1</span>`)}</td>`).join("")}</tr>`).join("")}</table>`).join("");
        var tables = $(html);
        this.props.append(...tables);
    }
}

export class FileSystemInfoMenu extends Modal {
    constructor() {
        super({
            "modal.title": "Local File System Tree",
            "modal.width": "80%",
            "modal.footer": true,
            "modal.props": new ui.PropertyContainer(),
        });
        var uid = 0;
        var nodes = [];
        var percent_fraction_digits=1;
        var path_join = (...parts)=>parts.join("/").replace(/\/+/g, "/");
        var process = (d, parent, icon)=>{
            var node = {};
            node.id = ++uid;
            nodes[node.id] = node;
            let level = parent.level+1;
            node.level = level;
            node.parent = parent;
            node.name = d[0];
            
            node.path = (icon == "files") ? parent.path : path_join(parent.path, node.name);
            console.log(node.path)

            if (typeof d[1] === "object") {
                var children = d[1];
                node.icon = icon || "folder";
                node.isdir = true;
                node.folders = 0;
                node.files = 0;
                node.size = 0;
                node.children = [];
                children.sort((a,b)=>(typeof b[1]==="object"?1:0)-(typeof a[1]==="object"?1:0));
                var i=0, len=children.length;
                var f = children.findIndex(c=>typeof c[1]!=="object");
                if (f < 1) f = len;
                for (;i<f;i++) {
                    node.children.push(process(children[i], node));
                }
                if (i<len) {
                    var files = children.slice(i);
                    if (files.length == 1) {
                        var f = files[0];
                        node.children.push(process(files[0], node));
                    } else {
                        node.children.push(process([`[${files.length} Files]`, files], node, "files"));
                    }
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
                node.size = d[1] || 0;
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
        var process2 = (node, parent, root_node)=>{
            if (parent) {
                node.percent = (node.size / parent.size) || 0;
            }
            node.total_percent = node.size / root_node.size;
            if (node.isdir) {
                for (var c of node.children) {
                    process2(c, node, root_node);
                }
            }
        };

        var init = async()=> {
            utils.dom.empty(tbody);
            for (let id in app.$.volumes) {
                if (app.$.volumes[id].driver !== "LocalFileSystem") continue;
                var volume = app.$.volumes[id];
                var loading_el = $(`<tr><td colspan="6"><i class="fas fa-sync fa-spin"></i> Loading...</td></tr>`)[0];
                tbody.append(loading_el);
                var r = await app.request({
                    call: ["app", "analyze_local_file_system_volume"],
                    arguments: [id]
                });
                loading_el.remove();
                var root_node = process(r, {path:volume.root.split("/").slice(0, -1).join("/"), level:-1}, "drive");
                root_node.name = volume.name
                process2(root_node, null, root_node);
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
            name_inner_el.style.display="flex";
            name_inner_el.style.alignItems="center";
            name_inner_el.style.gap="5px";
            name_inner_el.style.paddingLeft = `${node.level * 10}px`;

            var name_el = document.createElement("a");
            name_el.href = get_file_manager_url({start:node.path});
            name_el.target = "_blank";
            name_el.innerText = node.name;
            name_el.onclick = (e)=>{
                e.preventDefault();
                open_file_manager({start:node.path});
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
        this.props.append(table);

        var refresh_button = new ui.Button(`<button>Refresh</button>`, {
            "click":()=>init()
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

export class SystemManagerMenu extends Modal {
    constructor() {
        super({
            "modal.title": "System Manager",
            "modal.props": new ui.PropertyContainer(),
        });
        class Bar extends ui.UI {
            constructor(settings) {
                super(null, settings);
                this.append(new ui.FlexRow()).append(this.label = new ui.Label(null, {content: ()=>this.get_setting("label")}));
                this.bar = new ui.UI($(`<div class="bar"></div>`)[0]);
                this.append(new ui.FlexRow()).append(this.bar);
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
        class Process extends ui.Column {
            constructor(name) {
                super({gap:5});

                var is_running = ()=>app.$.processes[name].status == "online"

                var row = this.append(new ui.Row());
                add_class(this.elem, "process");
                var info_ui = row.append(new ui.UI({flex:1}));
                var name_ui = info_ui.append(new ui.UI());
                var description_ui = info_ui.append(new ui.UI());
                var buttons_ui = row.append(new ui.Row({gap:5}));
                var stats_ui = this.append(new ui.Row({justify:"right"}));
                var restart_button = new ui.Button(`<button>RESTART</button>`, {
                    "click": ()=>{
                        app.request_no_timeout({
                            call: ["core", `module_restart`],
                            arguments: [name]
                        });
                    },
                    hidden: ()=>!is_running()
                });
                var stop_button = new ui.Button(`<button>STOP</button>`, {
                    "click": ()=>{
                        app.request_no_timeout({
                            call: ["core", `module_stop`],
                            arguments: [name]
                        });
                    },
                    hidden: ()=>!is_running()
                });
                var start_button = new ui.Button(`<button>START</button>`, {
                    "click": ()=>{
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
        var uptime = this.props.append(new ui.UI({
            "update":()=>{
                set_inner_html(uptime.elem, `System uptime: ${utils.ms_to_human_readable_str(app.$.sysinfo.uptime*1000)}`)
            }
        }));
        var transfer = this.props.append(new ui.UI({
            "update":()=>{
                set_inner_html(transfer.elem, `Transfer rate: ↑ ${utils.format_bytes(app.$.sysinfo.sent)}ps / ↓ ${utils.format_bytes(app.$.sysinfo.received)}ps`)
            }
        }));
        this.props.append(new Bar({
            label: "Disk",
            value: ()=>app.$.sysinfo.disk_total-app.$.sysinfo.disk_free,
            total: ()=>app.$.sysinfo.disk_total,
            format: (x)=>utils.format_bytes(x)
        }));
        this.props.append(new Bar({
            label:"Memory",
            value: ()=>app.$.sysinfo.memory_total-app.$.sysinfo.memory_free,
            total: ()=>app.$.sysinfo.memory_total,
            format: (x)=>utils.format_bytes(x)
        }));
        this.props.append(new Bar({
            label:"CPU Usage",
            value: ()=>app.$.sysinfo.cpu_avg,
            format: (x)=>Number(x*100).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})+"%"
        }));

        var process_wrapper = new ui.UI();
        process_wrapper.append(`<label>Processes</label>`)
        var process_container = new ui.FlexColumn({gap:5});
        process_wrapper.append(process_container);
        this.props.append(process_wrapper);

        this.on("update", ()=>{
            var processes = Object.keys(app.$.processes);
            utils.sort(processes, (p)=>p==="main"?0:1)
            utils.dom.rebuild(process_container.elem, processes, {
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
export class FileManagerMenu extends Modal {
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
    async show(url) {
        await super.show();
        this.iframe.src = url;
    }
}


export class ScheduleGenerator extends Modal {
    constructor() {
        super({
            "modal.title": "Schedule Generator",
            "modal.props": new ui.PropertyContainer({
                "items": ()=>[app.settings.get("schedule_generator") || {}],
                "nullify_defaults": true,
            }),
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.start_time = new ui.Property(`<input type="time">`, {
                "name": "start_time",
                "label": "Start Time",
                "default": ()=>"00:00" //new Date().toLocaleTimeString().slice(0,5)
            }),
            this.time_rounding = new ui.Property(`<select>`, {
                "name": "time_rounding",
                "label": "Time Rounding",
                "default": 5*60,
                "options": [[1*60,"None"],[5*60,"5 mins"],[10*60,"10 mins"],[15*60,"15 mins"]],
            }),
            this.min_duration_filter = new ui.Property(`<select>`, {
                "name": "min_duration_filter",
                "label": "Minimum Duration Filter",
                "default": 0,
                "options": [[0,"None"],...[10,30,1*60,2*60,5*60,10*60].map(f=>[f, utils.seconds_to_human_readable_str(f)])],
                "info": "Filters out small or interstitial items that might clutter up your schedule."
            })
        )

        var row = this.props.append(new ui.FlexRow());
        row.append(
            // this.time_format = new ui.Property(`<select>`, {
            //     "name": "time_format",
            //     "label": "Time Format",
            //     "default": "24",
            //     "options": [["12","12 Hour"], ["24","24 Hour"]],
            // }),
            this.remove_ext = new ui.Property(`<select>`, {
                "name": "remove_ext",
                "label": "Remove File Extensions",
                "default": true,
                "options": YES_OR_NO,
            }),
            this.use_labels = new ui.Property(`<select>`, {
                "name": "use_labels",
                "label": "Use Labels",
                "default": true,
                "options": YES_OR_NO,
            })
            /* this.inner_playlists = new ui.Property(`<select>`, {
                "name": "inner_playlists",
                "label": "Include Playlist Contents",
                "default": true,
                "options": YES_OR_NO,
            }); */
        );

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.output = new ui.TextAreaProperty({
                "label": "Output",
                "textarea.rows": 12,
                "reset": false,
                "copy": true,
            })
        );

        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set("schedule_generator", this.props.named_property_lookup_not_null);
        });

        this.on("update", ()=>{
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
export class FontSettings extends Modal {
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "items":()=>app.$.fonts,
            }),
            "modal.title": `Font Manager`,
            "modal.footer":false,
        });

        add_class(this.elem, "font-manager");

        var row = this.props.append(new ui.FlexRow());
        
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
        
        var add_button = new ui.Button(`<button>Add New Font</button>`, {
            "click":async ()=>{
                var files = utils.dom.upload(`application/font-sfnt,application/font-sfnt`, true)
                app.upload_queue.add(files, {dir:"/fonts"});
            },
            "disabled":()=>!list.selected,
        });

        left_footer_elem.append(add_button);
        
        var delete_button = new ui.Button(`<button>Delete</button>`, {
            "click":async ()=>{
                await app.request({
                    call: ["app", "delete_font"],
                    arguments: [list.selected.id]
                });
            },
            "disabled":()=>!list.selected,
        });
        var download_button = new ui.Button(`<button>Download</button>`, {
            "click":async ()=>{
            },
            "disabled":()=>!list.selected,
        });
        right_footer_elem.append(delete_button, download_button);
        
        list.on("change", async (item, i)=>{
            // await app.load_font(item.id);
            // utils.dom.empty(info_elem);
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

export class SplitSettings extends Modal {
    /** @type {PlaylistItem[]} */
    get _items() { return this.props.items; }
    constructor() {
        super({
            "modal.title": ()=>`Split '<span>${PlaylistItem.get_items_title(this._items)}</span>'`,
            "modal.title-overflow": true,
            "modal.footer":true,
            "modal.props": new ui.PropertyContainer(),
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.split_type = new ui.Property(`<select>`, {
                "name": "split_type",
                "label": "Split Method",
                "options":[["total", "# of Parts"], ["duration", "Duration"], ["time_list", "List of Time Codes"], ["every_chapter", "Every Chapter"], ["chapter_list", "List of Chapters"]],
                "default": "time_list",
            })
        );

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.total = new ui.Property(`<input type="number"></input>`, {
                "name": "total",
                "label": "# of Parts",
                "info":`Number of pieces (evenly split)`,
                "default":1,
                "min":1,
                "hidden":()=>this.split_type.value != "total",
            }),
            this.duration = new ui.TimeSpanProperty({
                "name": "duration",
                "label": "Duration",
                "timespan.format": "h:mm:ss.SSS",
                "info":`Every specified time span`,
                "default": 0,
                "min":0,
                "hidden":()=>this.split_type.value != "duration",
            }),
            this.time_list = new ui.TextAreaProperty({
                "name": "time_list",
                "label": "List of Time Codes",
                "info":`Comma separated list of time-codes like '1:03, 00:30:00, 1:02:57.333'`,
                "textarea.rows": 1,
                "textarea.grow": true,
                "textarea.return_blur": true,
                "default":[],
                "hidden":()=>this.split_type.value != "time_list",
            }),
            this.chapter_list = new ui.TextAreaProperty({
                "name": "chapter_list",
                "label": "Chapter List",
                "info":`Comma separated list of chapters (zero-based) like '0, 1, 5, 6'`,
                "textarea.rows": 1,
                "textarea.grow": true,
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

        var row = this.props.append(new ui.FlexRow());
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
        
        this.split_button = new ui.Button(`<button>Split</button>`, {
            "click": ()=>{
                app.playlist_split(this._items, this.get_splits(), true);
                this.time_list.set_value([]);
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

    async show() {
        await super.show();
        this.seek.update_settings({
            "seek.duration": this._items[0]._userdata.duration,
            "seek.chapters": this._items[0]._userdata.chapters
        });
        this.update_markers();
    }
}

/** @extends {Modal<PlaylistItem>} */

export class CropEditMenu extends Modal {
    /** @param {PlaylistItem} item @param {Rectangle} rect */
    constructor(item, index, rect) {
        super({
            "modal.title": "Crop Editor",
            "modal.footer": true,
        });

        var default_rect = new utils.Rectangle(0,0,1,1);
        var detected_crop_rect = new utils.Rectangle(0,0,1,1);
        
        var reset_button0 = new ui.Button(`<button class="button"><i class="fas fa-arrow-rotate-left"></i></button>`, {
            "title": "Undo",
            "disabled": ()=>cp.rect.equals(rect),
            "click": ()=>cp.update_crop(rect),
        })
        var reset_button = new ui.Button(`<button class="button">Set to Detected</button>`, {
            "flex": 1,
            "disabled": ()=>cp.rect.equals(detected_crop_rect),
            "click": ()=>cp.update_crop(detected_crop_rect),
        })
        var reset_button2 = new ui.Button(`<button class="button">Reset</button>`, {
            "flex": 1,
            "disabled": ()=>cp.rect.equals(default_rect),
            "click": ()=>cp.update_crop(default_rect),
        })
        var save_button = new ui.Button(`<button class="button">Apply</button>`, {
            "flex": 1,
            "disabled": ()=>item._crop.equals(cp.rect),
            "click":()=>{
                this.hide();
                app.playlist_update([
                    [`${item.id}/props/crop`, [cp.rect.left, cp.rect.top, 1-cp.rect.right,1-cp.rect.bottom]],
                ])
            }
        })
        this.footer_elem.append(reset_button0, reset_button, reset_button2, save_button);

        var data = item._detected_crops;
        var container = $(`<div class="crop-editor-container"></div>`)[0];
        var crop_container = $(`<div></div>`)[0];
        /** @type {CropPreview} */
        var cp;
        container.append(crop_container);
        
        var row = $(`<div class="buttons border-group"></div>`)[0];
        var left = new ui.Button(`<button class="button"><i class="fas fa-arrow-left"></i></button>`, {
            "title": "Previous",
            "flex": "none",
            "click":()=>update(index-1)
        })
        var page_el = $(`<span></span>`)[0];
        var right = new ui.Button(`<button class="button"><i class="fas fa-arrow-right"></i></button>`, {
            "title": "Next",
            "flex": "none",
            "click":()=>update(index+1)
        })
        row.append(left, page_el, right);
        container.append(row);
        this.content.append(container);

        var update = (i)=>{
            utils.dom.empty(crop_container);
            index = i = utils.loop(i, 0, data.crops.length);
            var c = data.crops[i];
            detected_crop_rect = c.rect;
            if (cp) rect = cp.rect;
            cp = new CropPreview(c.url, c.rect, rect, true, data.width, data.height);
            cp.on("change", ()=>{
                this.update()
            });
            crop_container.append(cp);
            page_el.innerHTML = `${i+1} / ${data.crops.length}`;
            this.update();
        }
        update(index);
    }

}


export class ScheduleStreamSettings extends Modal {
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "items": ()=>[app.$._session],
                "nullify_defaults": true,
            }),
            "modal.title": "Schedule Stream Start",
            "modal.footer": true,
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.schedule_start_time = new ui.DateTimeProperty("schedule_start_time", null, {
                "label": function() {
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
        
        var reset_button = new ui.Button(`<button>Reset</button>`, {
            "click": ()=>this.reset()
        });
        this.footer_elem.append(reset_button);
        
        this.props.on("change", (e)=>{
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

export class SessionConfigurationSettings extends Modal {
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "items": ()=>[app.$._session],
            }),
            "modal.title":"Session Configuration",
        });

        function get_default() { return utils.try(()=>app.$.properties[this.name].__default__); }
        this.name = new ui.Property(`<input type="text">`, {
            "name": "name",
            "label": "Session Name",
            "default": null,
            "reset": false,
        });
        this.name.validators.push(VALIDATORS.not_empty);

        /* this.default_stream_title = new ui.Property(`<input type="text">`, {
            "name": "default_stream_title",
            "label": "Default Stream Title",
            "placeholder":()=>this.name.value,
            "default": "",
            "reset": true,
        }); */
        
        this.creation_time = new ui.Property(`<input type="text">`, {
            "name": "creation_time",
            "label": "Creation Date",
            "readonly": true,
            "reset": false,
        });
        this.creation_time.output_modifiers.push(v=>new Date(v).toLocaleString());

        this.stream_host = new ui.Property(`<input type="text">`, {
            "label": "Stream Host",
            "readonly": true,
            "default": ()=>app.get_media_server_base_url(),
            "reset": false,
            "copy": true,
            "info": "Connect and stream to dynamic RTMP playlist items. Use this RTMP host and key in OBS or your streaming software of preference",
        });

        this.stream_key = new ui.TextAreaProperty({
            "label": "Stream Key",
            "textarea.rows": 1,
            "textarea.grow": true,
            "textarea.break_all": true,
            "readonly": true,
            "default": ()=>`session/${app.$._session.id}`,
            "reset": false,
            "copy": true,
        });

        /* var regenerate_button = new ui.Button(`<button><i class="fas fa-sync-alt"></i></button>`, {
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
        })

        this.files_dir = new FileProperty({
            "name": "files_dir",
            "label": "Session Directory",
            "info": "Your preferred location for storing any uploaded / downloaded files.",
            "file.options":{ folders: true },
            "default": get_default,
        });
        this.files_dir.validators.push(VALIDATORS.media_exists);

        this.interpolation_mode = new ui.Property(`<select></select>`, {
            "name": "interpolation_mode",
            "label": "Interpolation Mode",
            "options":()=>{
                return [["auto","Auto"], [false, "Off"], [true, "On"]];
            },
            "default": get_default,
        });
        this.auto_interpolation_rate = new ui.Property(`<select></select>`, {
            "name": "auto_interpolate_rate",
            "label": "Auto Interpolation Target FPS",
            "options":()=>{
                return [24, 25, 30, 60];
            },
            "disabled":()=>this.interpolation_mode.value !== "auto",
            "default": get_default,
        });

        this.members = new AccessControlProperty({
            "name": "access_control",
            "label": "Access Control",
            "info": "Owners: Full access.\nAllowed: Full access but cannot edit session confugration, delete the session, load/save session files or access history.\nDenied: No access rights whatsoever.",
        });
        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.$._push([`sessions/${app.$._session.id}/${e.name}`, e._value]);
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
            if (this.props.item.type === SessionTypes.INTERNAL) {
                layout.push(
                    [this.stream_host], [this.stream_key],
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
            this.props.update_layout(layout);
        });
    }
}

export class AdminSettings extends Modal {
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "items": ()=>[app.$._session],
            }),
            "modal.title":"Admin",
        });
    }
}

export class ChangeLog extends Modal {
    constructor() {
        super({
            "modal.title": "Change Log",
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

export class UploadsDownloadsMenu extends Modal {
    constructor() {
        super({
            "modal.title":"Uploads / Downloads",
            "modal.width": "70%",
            "modal.props": new ui.PropertyContainer(),
        });
        var types = ["uploads", "downloads"];
        this.on("update", ()=>{
            var content = new ui.UI();
            var stats = types.map(t=>`Total ${t.slice(0,-1)} rate: ${utils.format_bytes(utils.sum(Object.values(app.$[t]).map(u=>u.speed)))+"ps"}`).join(" | ");
            content.append(...$(`<div>${stats}</div>`));
            Object.assign(this.props.elem.style, {"white-space": "pre-wrap", "word-break": "break-all", "font-family":"monospace" });
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
                var table = utils.dom.build_table(rows, { header, empty: `No active ${type}` });
                content.append(table);
            }
            utils.dom.sync_dom(this.props.elem, content.elem, {attrs:false});
        });
    }
}

export class JSONViewer extends Modal {
    async show(title, data, all_collapsed=false) {
        await super.show();
        this.update_settings({"modal.title": title });
        var json = new JSONContainer(data, all_collapsed);
        this._json_root = json._json_root;
        set_inner_html(this.content.elem, "");
        set_style_property(this.content.elem, "margin-bottom", 0);
        this.content.elem.append(json);
    }
}

export class InfoSettings extends JSONViewer {
    /** @param {PlaylistItem[]} items */
    async show(items) {
        var name;
        var special_keys = ["_media_info", "_info", "_userdata"]
        var data = items.map(d=>{
            var a = {...d};
            for (var k of special_keys) a[k] = d[k];
            return a;
        })
        if (items.length == 1) {
            name = `'<span>${items[0]._get_pretty_name()}</span>'`;
            data = data[0]
        } else {
            name = `[${items.length} Items]`
        }
        await super.show(name, data, false);
        for (var k of special_keys) {
            var n = this._json_root.find(k);
            if (n) n.collapse(true);
        }
    }
}

export class SetTimePosSettings extends Modal {
    constructor() {
        super({
            "modal.title":"Precise Seek",
            "modal.footer":true,
            "modal.props": new ui.PropertyContainer(),
        });
        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.chapter_select = new ui.Property(`<select>`, {
                "label": "Chapter",
                "disabled":()=>!app.settings.get("show_chapters") || app.$._session._current_chapters.length < 2,
                "options":()=>{
                    return app.$._session._current_chapters.map((c,i)=>[i, app.chapter_to_string(c, true)])
                },
                "reset":false,
            }),
            this.time_pos = new ui.TimeSpanProperty({
                "name": null,
                "label": "Time",
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

        this.ok = new ui.Button(`<button>Seek</button>`, {
            "click": ()=>{
                app.seek(this.time_pos.value);
                this.hide();
            }
        });
        this.cancel = new ui.Button(`<button>Cancel</button>`, {
            "click": ()=>this.hide()
        });
        this.footer_elem.append(this.ok, this.cancel);

        this.on("show",()=>{
            this.time_pos.settings.default = app.$._session.time_pos;
            this.time_pos.reset();
        })
    }
}

export class SetVolumeSettings extends Modal {
    constructor() {
        super({
            "modal.title":"Precise Volume Adjustment",
            "modal.footer":true,
            "modal.props": new ui.PropertyContainer({
                data: app.$._session,
            }),
        });
        var row = this.props.append(new ui.FlexRow());
        //<div style="padding:0 5px; border-left: 1px solid #aaa; border-bottom: 1px solid #aaa;">
        var volume_input = new ui.Property(`<input type="number">`, {
            "name": "volume_target",
            "label": "Volume (%)",
            "default": 100,
            "min": 0,
            "max": 200,
        });
        row.append(volume_input);
        var volume_speed = new ui.Property(`<select>`, {
            "name": "volume_speed",
            "label": "Volume Transition Speed",
            "default": 4.0,
            "options": [[0.5, "Very Slow"], [1.0, "Slow"], [2.0, "Medium"], [4.0, "Fast"], [8.0, "Very Fast"], [0, "Immediate"]],
        });
        row.append(volume_speed);
        
        var row = this.props.append(new ui.FlexRow());
        var volume_slider = new ui.Property(`<input type="range">`, {
            "label": "Volume (%)", //  style="margin-right:5px"
            "default": 100,
            "step": 1,
            "min": 0,
            "max": 200,
            "reset": false,
            "dblclick":()=>volume_slider.reset()
        });
        row.append(volume_slider);
        
        volume_input.on("change", (e)=>{
            volume_slider.set_value(e._value);
        });
        volume_slider.on("change", (e)=>{
            volume_input.set_value(e._value, {trigger:e.trigger})
        });

        this.ok = new ui.Button(`<button>Apply</button>`, {
            "disabled": ()=>this.changes.length==0,
            "click": ()=>{
                app.media_player.volume.set_value(volume_input.value, {trigger:true});
                app.media_player.vol_speed.set_value(volume_speed.value, {trigger:true});
                this.hide();
            }
        });
        this.cancel = new ui.Button(`<button>Cancel</button>`, {
            "click": ()=>this.hide()
        });
        this.footer_elem.append(this.ok, this.cancel);
    }
}

export class ExternalSessionConfigurationMenu extends Modal {
    /** @param {ui.Property} prop */
    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "nullify_defaults": true,
                "items": ()=>[app.settings.get("external-session-config")]
            }),
            "modal.title":"Setup External Session",
            "modal.footer":false,
        });
        
        var row = this.props.append(new ui.FlexRow());
        set_inner_html(row.elem, `Setup your streaming software to stream to cabtv and restream to multiple targets.`);

        var row = this.props.append(new ui.FlexRow());
        set_inner_html(row.elem, `<hr/>`);
        
        this.stream_name = new ui.Property(`<input type="text">`, {
            "name": "name",
            "label": "Name",
            "default": ()=>`${app.$._client.username}'s Stream`,
            "placeholder": ()=>`CAB TV`,
            "info": "This must be a unique name to identify your stream."
        });
        this.props.append(this.stream_name);

        this.stream_targets = new TargetsProperty({
            "name": "targets",
            "label": "Target(s)",
            "allow_empty": false,
            "reset": true,
            "show_in_use":false,
        });
        this.props.append(this.stream_targets)

        var input_props = [
            this.stream_name,
            this.stream_targets,
        ]
        
        var valid = ()=>input_props.every(i=>i.valid);

        this.props.append(new ui.Separator());

        this.output_host = new ui.Property(`<input type="text">`, {
            "label": "Stream Host",
            "readonly": true,
            "copy":true,
            "reset": false,
            "disabled":()=>!valid()
        });
        this.props.append(this.output_host)

        this.output_key = new ui.TextAreaProperty({
            "label": "Stream Key", 
            "textarea.rows": 1,
            "textarea.grow": true,
            "textarea.break_all": true,
            "readonly": true,
            "copy": true,
            "reset": false,
            "disabled": ()=>!valid()
        });
        this.props.append(this.output_key);

        var get_settings = ()=>Object.fromEntries(input_props.map(i=>[i.name, i._value]).filter(([k,v])=>v!=null));

        var host, key, old_hash;
        this.on("update", ()=>{
            var hash = JSON.stringify(get_settings());
            if (hash === old_hash) return;
            old_hash = hash;

            var name = this.stream_name.value.trim();
            var params = new URLSearchParams();
            params.set("targets", this.stream_targets._has_opts ? JSON.stringify(this.stream_targets.value) : this.stream_targets._enabled_ids);
            if (name) params.set("name", name)
            var query_str = params.toString();
            host = app.get_media_server_base_url();
            key = `external/${app.$._client.ip_hash}`;
            if (query_str) key += "?"+query_str;

            this.output_host.set_values(host);
            this.output_key.set_values(key);
        });

        this.props.on("change", (e)=>{
            if (e.trigger) {
                app.settings.set("external-session-config", get_settings());
            }
        })
    }
}

export const TimeLeftMode = {
    TIME_LEFT:0,
    DURATION:1,
}

export class TargetEditMenu extends Modal {
    constructor() {
        super({
            "modal.title": ()=>this.target ? `Edit '<span>${this.target.name}</span>'` : "New Target",
            "modal.title-overflow": true,
            "modal.footer":true,
            "modal.props": new ui.PropertyContainer(),
        });

        /* var row = this.props.append(new ui.FlexRow());
        var id = new ui.Property(`<input type="text">`, {
            "name": "id",
            "label": "ID",
            "readonly": true,
            "disabled":true,
            hidden: ()=>!this.id
        });
        row.append(id) */

        var row = this.props.append(new ui.FlexRow());
        this.name = new ui.Property(`<input type="text">`, {
            "name": "name",
            "label": "Name",
            "reset":false,
            "default": "",
            "placeholder": "My Stream",
        });
        this.name.validators.push(VALIDATORS.not_empty, (v)=>{
            return Object.values(app.$.targets).filter((t)=>t!=this.target).map(t=>t.name).includes(v) ? "Name already exists." : true
        });
        row.append(this.name)

        var row = this.props.append(new ui.FlexRow());
        this.description = new ui.TextAreaProperty({
            "name": "description",
            "label": "Description",
            "textarea.rows": 2,
            "textarea.grow": true,
            "reset":false,
            "default": "",
        });
        row.append(this.description)

        var row = this.props.append(new ui.FlexRow());
        this.rtmp_host = new ui.Property(`<input type="url">`, {
            "name": "rtmp_host",
            "label": "Stream Host",
            "reset":false,
            "default": "",
            "placeholder": "rtmp://streaming-service.com",
        });

        this.rtmp_host.validators.push(VALIDATORS.rtmp);
        this.rtmp_key = new ui.TextAreaProperty({
            "name": "rtmp_key",
            "label": "Stream Key",
            "textarea.rows": 1,
            "textarea.grow": true,
            "textarea.break_all": true,
            "reset":false,
            "default": "",
            "placeholder": ""
        });
        row.append(this.rtmp_host, this.rtmp_key);

        var row = this.props.append(new ui.FlexRow());
        this.url = new ui.Property(`<input type="url">`, {
            "name": "url",
            "label": "View URL",
            "reset": false,
            "info": "The public URL to view your channel's livestream.",
            "default": "",
            "placeholder": "https://streaming-service.com/my-channel",
        });
        this.url.validators.push((v)=>!v || VALIDATORS.url(v));
        row.append(this.url);

        var row = this.props.append(new ui.FlexRow());
        this.access_control = new AccessControlProperty({
            "name": "access_control",
            "label": "Access Control",
            "info": "Owner: User can edit, delete or utilize the target (full access).\nAllowed: User can view and utilize the target.\nDenied: Users cannot view or utilize target.",
            "access.allow_passwords": false,
        });
        if (!IS_ELECTRON) {
            this.props.append(this.access_control);
        }

        /* var row = this.append(new ui.FlexRow());
        this.custom = new ui.TextArea("custom", "Additional Properties (JSON)", {
            "default": {},
        });
        this.custom.validators.push(VALIDATORS.json);
        this.custom.input_modifiers.push(v=>{ try { return JSON.parse(v) } catch {} });
        this.custom.output_modifiers.push(v=>JSON.stringify(v, null, "  "));
        row.append(this.custom); */
        
        var save_button = new ui.Button(`<button>Save</button>`, {
            "disabled": ()=>!this.props.valid,
            "hidden": ()=>!!this.target,
            "click": ()=>{
                app.request({
                    call: ["app", "create_target"],
                    arguments: [this.props.named_property_lookup]
                });
                this.hide();
            }
        });

        var delete_button = new ui.Button(`<button>Delete</button>`, {
            "hidden": ()=>!this.target,
            "click": ()=>{
                if (confirm(`Are you sure you want to delete Target '${this.target.name}'?`)) {
                    app.request({
                        call: ["app", "delete_target"],
                        arguments: [this.target.id]
                    });
                    this.hide();
                }
            }
        });
        this.footer_elem.append(save_button, delete_button);
        
        this.props.on("change", (e)=>{
            if (!this.target || !e.name || !e.trigger) return;
            app.request({
                call: ["app", "update_target"],
                arguments: [this.target.id, {[e.name]:e._value}]
            });
        });
    }

    /** @param {Target} target */
    async show(target) {
        await super.show(target);
        this.target = target;
        if (!target) { // new
            this.access_control._claim();
        }
    }
}

export class TargetMenu extends Modal {
    /** @type {string[]} */
    get _enabled_target_ids() { return Object.keys(filter_enabled_targets(this._value)); }
    _value = {};

    get _enabled_targets() {
        var targets = app.$._targets;
        return this._enabled_target_ids.map(id=>targets[id]).filter(t=>t);
    }
    get _disabled_targets() {
        var targets = app.$._targets;
        return [...utils.set_difference(Object.values(targets), new Set(this._enabled_targets))];
    }
    get _disabled_targets_ids() { return this._disabled_targets.map(t=>t.id); }

    get _auto_apply() {
        if (this._targets_prop) return this._targets_prop.get_setting("auto_apply");
        return false;
    }

    get _show_in_use() {
        if (this._targets_prop) return this._targets_prop.get_setting("show_in_use");
        return false;
    }

    /** @param {TargetsProperty} targets_prop */
    constructor(targets_prop, settings) {
        super({
            "modal.title": "Targets",
            "modal.footer": ()=>!this._auto_apply,
            "modal.props": new ui.PropertyContainer(),
            ...settings,
        });

        this._targets_prop = targets_prop;

        add_class(this.props.elem, "target-config");

        /** @type {HTMLElement} */
        var enabled_el;
        if (targets_prop) {
            enabled_el = $(`<div></div>`)[0];
            add_class(enabled_el, "target-list");
            this.props.append(enabled_el);
            this.props.append(new ui.Separator());
            var update_from_prop = ()=>{
                this._value = targets_prop.value;
                this.update();
            }
            this.on("show", ()=>{
                update_from_prop();
            })
            targets_prop.on("change", (e)=>{
                if (e.trigger) {
                    update_from_prop();
                }
            })
        }

        var disabled_el = $(`<div></div>`)[0];
        add_class(disabled_el, "target-list");
        this.props.append(disabled_el);

        var row = this.props.append(new ui.FlexRow());
        var new_button = new ui.Button(`<button>New Target <i class="fas fa-plus" style="padding:0 5px"></i></button>`, {
            "click":()=>{
                new TargetEditMenu().show(null);
            },
            "title": "New Target",
        });
        row.append(new_button);

        var apply_button = new ui.Button(`<button>Apply</button>`, {
            "hidden": ()=>this._auto_apply,
            "click":()=>{
                this.apply();
                this.update();
                this.hide();
            },
            "title": "Apply",
        });
        this.footer_elem.append(apply_button);

        var update_target_ids = ()=>{
            var enabled_ids = [...enabled_el.children, ...disabled_el.children].filter(e=>e.dataset.id && e.querySelector("input").checked).map(e=>e.dataset.id);
            var new_value = {};
            for (var id of enabled_ids) {
                new_value[id] = {...this._value[id], enabled: true};
            }
            var allowed = app.$._targets;
            for (var id in this._value) {
                if (id in allowed && !(id in new_value)) new_value[id] = {...this._value[id], enabled: false};
            }
            this._value = new_value;
            this.update_value();
        }

        var is_editable = (target)=>{
            return !target.locked && new AccessControl(target.access_control)._self_can_edit;
        };
        /** @param {Target} target */
        var add = (target, elem, i)=>{
            elem = $(`<div></div>`)[0];

            /** @type {HTMLLabelElement} */
            var label_el = $(`<span></span>`)[0];

            var checkbox_input = $(`<input type="checkbox">`)[0];
            var text_wrapper_elem = $(`<div class="text-wrapper"></div>`)[0];
            checkbox_input.onchange = ()=>{
                update_target_ids();
            };
            label_el.append(checkbox_input, text_wrapper_elem);

            var up_button = new ui.Button(`<button><i class="fas fa-arrow-up"></i></button>`, {
                "click":()=>{
                    utils.dom.move(elem, -1);
                    update_target_ids();
                },
                "hidden":()=>this._enabled_target_ids.length<2 || !this._enabled_target_ids.includes(target.id),
                "disabled":()=>this._enabled_target_ids.indexOf(target.id)==0,
                "title": "Move Up",
            });

            var down_button = new ui.Button(`<button><i class="fas fa-arrow-down"></i></button>`, {
                "click":()=>{
                    utils.dom.move(elem, 1);
                    update_target_ids();
                },
                "hidden":()=>this._enabled_target_ids.length<2 || !this._enabled_target_ids.includes(target.id),
                "disabled":()=>this._enabled_target_ids.indexOf(target.id) == this._enabled_target_ids.length-1,
                "title": "Move Down",
            });

            var get_config_menu = ()=>{
                var menu = app.target_config_menus[target.id];
                if (target.id === "gui" && !app.is_os_gui) menu = undefined;
                return menu;
            }

            var config_button = new ui.Button(`<button><i class="fas fa-cog"></i></button>`, {
                "hidden": ()=>!targets_prop || !get_config_menu(),
                "click": ()=>get_config_menu().show(this),
                "title": "Configure",
            });

            var disabled_restart = false;
            var restart_button = new ui.Button(`<button><i class="fas fa-sync"></i></button>`, {
                "hidden": ()=>{
                    if (!targets_prop) return true;
                    var stream = targets_prop._stream;
                    if (!stream) return true;
                    return !stream.stream_targets[target.id];
                },
                "disabled": ()=>disabled_restart,
                "click": async ()=>{
                    disabled_restart = true;
                    app.stream_restart([target.id]);
                    await utils.timeout(5000);
                    disabled_restart=false;
                },
                "title": "Restart",
            });

            /* var view_url_button = new ui.Link(`<i class="fas fa-arrow-up-right-from-square"></i>`, {
                "hidden": ()=>!target.url,
                "href": ()=>target.url,
            }); */

            var edit_button = new ui.Button(`<button><i class="fas fa-edit"></i></button>`, {
                "click":()=>{
                    new TargetEditMenu().show(target)
                },
                "hidden":()=>{
                    return !is_editable(target)
                },
                "title": "Edit",
            });

            var delete_button = new ui.Button(`<button><i class="fas fa-trash-can"></i></button>`, {
                "click":()=>{
                    if (confirm(`Are you sure you want to delete Target '${target.name}'?`)) {
                        app.request({
                            call: ["app", "delete_target"],
                            arguments: [target.id]
                        });
                    }
                },
                "hidden":()=>!is_editable(target),
                "title": "Delete",
            });
            var buttons_el = $(`<div class="buttons"></div>`)[0];
            buttons_el.append(edit_button, config_button, delete_button, /*view_url_button, */ up_button, down_button, restart_button);
            elem.append(label_el, buttons_el);

            var name_elem = $(`<span class="name"></span>`)[0];
            var description_elem = $(`<div class="description"></div>`)[0];
            set_inner_html(text_wrapper_elem, "");
            text_wrapper_elem.append(name_elem, description_elem);
            var checkbox_input = elem.querySelector(`input[type="checkbox"]`);

            var parts = [target.name || target.id];
            if (this._show_in_use && target._in_use) parts.push(`<span class="flashing-slow">[Currently In Use]</span>`);
            if (target.locked) parts.push(` <i class="fas fa-lock"></i>`);
            if (target.builtin) parts.push(` <i class="fas fa-star"></i>`);
            if (target.url) parts.push(`<a href="${target.url}" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i></a>`);
            set_inner_html(name_elem, parts.join(" "));
            set_inner_html(description_elem, utils.convert_links_to_html(target.description || ""));
            checkbox_input.checked = this._enabled_target_ids.includes(target.id)
            checkbox_input.style.display = targets_prop ? "" : "none";
            checkbox_input.disabled = !targets_prop;

            return elem;
        };

        var render_hash;
        this.on("render", ()=>{
            var hash = JSON.stringify([this._enabled_target_ids, this._disabled_targets_ids]);
            if (hash === render_hash) return;
            render_hash = hash;

            var enabled_targets = this._enabled_targets;
            var disabled_targets = this._disabled_targets;

            if (targets_prop) {
                utils.dom.rebuild(enabled_el, enabled_targets, { add });
                if (enabled_targets.length == 0) {
                    set_inner_html(enabled_el, `<span style="display: flex; justify-content: center; padding: 10px;">No Targets Selected.</span>`);
                }
            }
            utils.dom.rebuild(disabled_el, disabled_targets, { add });
            if (disabled_targets.length == 0) {
                set_inner_html(disabled_el, `<span style="display: flex; justify-content: center; padding: 10px;">No Remaining Targets.</span>`);
            }
        });
    }

    apply() {
        this._targets_prop.set_value(utils.json_copy(this._value), {trigger:true});
    };
    
    update_value() {
        this.update();
        if (this._auto_apply) this.apply();
    }
}

function filter_enabled_targets(value) {
    return Object.fromEntries(Object.entries(value).filter(([k,v])=>v.enabled));
}

export class TargetsProperty extends ui.Property {
    /** @type {Stream} */
    get _stream() { return this.get_setting("stream"); }
    get _enabled_ids() { return Object.entries(filter_enabled_targets(this.value)).map(([k,v])=>k); }
    get _has_opts() {
        for (var k in this.value) {
            if (Object.keys(this.value[k]).length > 1) return true;
        }
        return false;
    }

    constructor(settings) {
        settings = {
            "default": { "local": {enabled:true} },
            "reset": false,
            "prefix": `<i class="far fa-circle-dot"></i>`,
            "stream": null,
            "show_in_use": true,
            "allow_empty": false,
            "auto_apply": true,
            ...settings,
            "readonly": true,
            "width": 180,
        };
        
        // var input = $(`<input type="text">`)[0];
        var input = $(`<div class="fake-input"></div>`)[0];
        input.style.cursor = "pointer";

        super(input, settings);

        if (!this.get_setting("allow_empty")) {
            this.validators.push(()=>(this._enabled_ids.length == 0) ? "No targets selected" : true);
        }

        /** @type {TargetMenu} */
        var modal;
        input.onclick = (e)=>{
            if (!modal) modal = new TargetMenu(this);
            modal.show();
        }

        this.output_modifiers.push((value)=>{
            var ids = Object.keys(filter_enabled_targets(value));
            var str = ids && ids.length ? ids.length == 1 ? (app.$.targets[ids[0]]||EMPTY_OBJECT).name : `${ids.length} Targets` : `None`
            // return str;
            var html = `<span>${str}</span>`
            if (this._has_opts) html += ` <i class="fas fa-wrench"></i>`
            return html;
        });
    }
}
export class SeekBar extends ui.UI {
    #seeking = false;
    #seek_pos = 0;

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
        super(input, Object.assign({
            "reset": false,
            "disabled": ()=>!this.get_setting("seek.seekable"),
            //-----
            "seek.time_pos": 0,
            "seek.paused": true,
            "seek.seekable": true,
            "seek.duration": 0,
            "seek.chapters": [],
            "seek.ranges": [],
            "seek.markers": [],
            "seek.buffering": false,
            "seek.show_times": true,
            "seek.add_markers": false,
            "seek.time_pos_left_mode": TimeLeftMode.TIME_LEFT,
        }, settings));
        
        this.time = 0;
        this.seek_elem = this.elem.querySelector(".seek");
        this.bar_elem = this.elem.querySelector(".bar");
        this.ticks_bar_elem = this.elem.querySelector(".ticks-bar");
        this.ranges_elem = this.elem.querySelector(".ranges");
        this.chapters_elem = this.elem.querySelector(".chapters");
        this.markers_elem = this.elem.querySelector(".markers");
        this.bg_elem = this.elem.querySelector(".bg");
        
        this.time_elem = this.elem.querySelector("#time");
        this.time_elem.title = "Time Position"
        this.time_left_elem = this.elem.querySelector("#time-left");
        this.time_left_elem.title = "Time Remaining";
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

        var hover_listener = new utils.dom.TouchListener(this.seek_elem, {
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
        var last_time;
        var seek_listener = new utils.dom.TouchListener(this.seek_elem, {
            start: (e)=>{
                last_time = this.ticks_bar.parse_event(e).time;
                this.seek_elem.focus();
                this.#seek_pos = last_time;
                this.#seeking = true;
                this.emit("seek-start", {time:last_time});
                this.update();
            },
            move: (e)=>{
                last_time = this.ticks_bar.parse_event(e).time;
                this.#seek_pos = last_time;
                this.emit("seeking", {time:last_time});
                this.update();
            },
            end: (e)=>{
                last_time = this.ticks_bar.parse_event(e).time;
                this.#seeking = false;
                this.emit("seek-end", {time:last_time});
                this.update();
            }
        });

        var curr_marker, moving_curr_marker, curr_marker_start_x;
        var marker_listener = new utils.dom.TouchListener(this.seek_elem, {
            start: (e)=>{
                this.seek_elem.focus();
                var data = this.ticks_bar.parse_event(e);
                curr_marker_start_x = data.pt.x;
                curr_marker = null;
                moving_curr_marker = false;
                var marker_elem = e.target.closest(".marker");
                if (marker_elem) {
                    curr_marker = this.get_setting("seek.markers").find(m=>m.id == marker_elem.dataset.id);
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
            var time_left_mode = (this.get_setting("seek.time_pos_left_mode")+1) % 2;
            this.emit("time_left_mode", time_left_mode);
        });

        this.on("render", ()=>{
            var duration = this.get_setting("seek.duration");
            var ranges = this.get_setting("seek.ranges");
            var markers = this.get_setting("seek.markers");
            var chapters = this.get_setting("seek.chapters");
            var show_markers = this.get_setting("seek.add_markers");
            var time_left_mode = this.get_setting("seek.time_pos_left_mode");
            var buffering = this.get_setting("seek.buffering");
            var seekable = this.get_setting("seek.seekable");

            this.render_time();
            
            this.time_left_elem.title = time_left_mode == 0 ? "Time Remaining" : "Duration";

            toggle_attribute(this.seek_elem, "disabled", !seekable)
            this.elem.style.cursor = show_markers ? "copy" : "";
            toggle_class(this.bar_elem, "d-none", show_markers);
            this.markers_elem.style.display = show_markers ? "" : "none";

            var ranges_hash = JSON.stringify([duration, ranges]);
            if (this._ranges_hash != ranges_hash) {
                this._ranges_hash = ranges_hash;
                utils.dom.empty(this.ranges_elem);
                if (duration && ranges) {
                    for (var r of ranges) {
                        var e = $(`<div class="range"></div>`)[0];
                        e.style.left = `${r.start / duration * 100}%`;
                        e.style.width = `${(r.end - r.start) / duration * 100}%`;
                        this.ranges_elem.appendChild(e);
                    }
                }
            }

            toggle_class(this.seek_elem, "buffering", buffering);

            var markers_hash = JSON.stringify([markers, duration]);
            if (this._markers_hash != markers_hash) {
                this._markers_hash = markers_hash;
                utils.dom.empty(this.markers_elem);
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
                utils.dom.empty(this.chapters_elem);
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
        });

        this.on("destroy", ()=>{
            hover_listener.destroy();
            seek_listener.destroy();
        })
    }

    render_time() {
        var time_pos = this.get_setting("seek.time_pos");
        var show_times = this.get_setting("seek.show_times");
        var duration = this.get_setting("seek.duration");
        
        var t = this.#seeking ? this.#seek_pos : time_pos;
        var p = (t / duration) || 0;
        if (!Number.isFinite(p)) p = 0;
        this.bar_elem.style.width = `${p*100}%`;
        
        var time_left_mode = this.get_setting("seek.time_pos_left_mode");
        var time_left = duration ? (duration - time_pos) : 0;
        this.time_elem.style.display = show_times ? "" : "none";
        this.time_left_elem.style.display = show_times ? "" : "none";
        set_text(this.time_elem, `${utils.seconds_to_timespan_str(time_pos, app.user_time_format)}`);
        var time_left_str = "";
        if (time_left_mode === TimeLeftMode.TIME_LEFT) time_left_str = `-${utils.seconds_to_timespan_str(Math.max(0, time_left), app.user_time_format)}`;
        else if (time_left_mode === TimeLeftMode.DURATION) time_left_str = utils.seconds_to_timespan_str(Math.max(0, duration), app.user_time_format)
        set_text(this.time_left_elem, time_left_str);
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
        super({
            "seek.time_pos_left_mode": ()=>app.settings.get("media_time_left_mode"),
        });
    
        var seek_time = 0, last_seek_time, seeking_interval;
        var cleanup = ()=>{
            clearInterval(seeking_interval);
        }
        this.on("seek-start", (e)=>{
            seek_time = e.time;
            cleanup();
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
            cleanup();
            if (seek_time != last_seek_time) {
                app.seek(seek_time)
            }
        });
        this.on("time_left_mode", (v)=>{
            app.settings.set("media_time_left_mode", v);
        });

        var last_time = 0;
        var speed = 1;
        var is_playing = ()=>app.$._session._is_running && app.$._stream.mpv.context.playing && !app.media.paused;
        this.on("pre_update", ()=>{
            var time = app.media.time_pos;
            if (last_time != time || !is_playing()) this.settings["seek.time_pos"] = time;
            last_time = time;
            Object.assign(this.settings, {
                "seek.paused": !is_playing(),
                "seek.seekable": app.media.seekable,
                "seek.duration": app.media.duration,
                "seek.chapters": app.media.chapters,
                "seek.ranges": app.media.ranges,
                "seek.buffering": app.media.buffering,
            });
        });

        this.on("update", ()=>{
            set_interpolation(app.settings.get("media_seek_time_interpolation"));
        })

        var interpolation_interval;
        var interpolation_enabled = false;
        var set_interpolation = (enabled)=>{
            if (enabled == interpolation_enabled) return;
            interpolation_enabled = enabled;
            clearInterval(interpolation_interval);
            var now = Date.now();
            if (enabled) {
                interpolation_interval = setInterval(()=>{
                    let c = Date.now();
                    if (is_playing()) {
                        let new_speed = app.media.playback_speed;
                        speed += (new_speed-speed) * 0.6;
                        var delta = (c-now);
                        this.settings["seek.time_pos"] += (delta/1000)*speed;
                        this.render_time();
                    }
                    now = c;
                }, 1000/30);
            }
        }

        this.on("destroy", ()=>{
            set_interpolation(false);
        });
    }
}
export class StreamConfigurationMenu extends Modal {
    constructor(){
        super({
            "modal.title": "Stream Configuration",
            "modal.props": new ui.PropertyContainer({
                "items":()=>[app.$._stream],
            }),
        });
        var title_ui = new ui.Property(`<input type="text">`, {
            "name": "title",
            "label": "Title",
            // "reset": false
        });
        this.props.append(title_ui);
        
        var row = this.props.append(new ui.FlexRow({
            "align":"end",
        }));
        var stream_targets = new TargetsProperty({
            "name": "targets",
            "label": "Target(s)",
            "stream": app.$._stream,
            "allow_empty": false,
            "auto_apply": false,
        });

        var disabled = false;
        var restart_button = new ui.Button(`<button><i class="fas fa-sync"></i></button>`, {
            "hidden": ()=>!app.$._stream._is_running,
            "disabled": ()=>disabled,
            "click": async()=>{
                disabled = true;
                restart_button.update();
                app.stream_restart();
                await utils.timeout(5000);
                disabled = false
                restart_button.update();
            },
            "title": "Restart Stream Targets",
            "flex": 0
        });
        stream_targets.outer_el.append(restart_button);

        row.append(stream_targets)

        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.request({
                call: ["session", "stream", "update_values"],
                arguments: [[e.name, e._value]]
            });
        })
    }
}
export class HandoverSessionMenu extends Modal {
    constructor(){
        super({
            "modal.title": "Handover Session",
            "modal.footer": true,
            "modal.props": new ui.PropertyContainer(),
        });
        var row = this.props.append(new ui.FlexRow());
        var handover_stream_property = new ui.Property(`<select>`, {
            "label": "Session",
            "options":()=>app.get_handover_sessions_options(),
            "reset":false,
            "info":"To seamlessly hand off to another session, select the session in the dropdown and click OK. Without interruption, the livestream will immediately start playing from the current playlist position in the selected stream."
        })
        row.append(handover_stream_property);

        this.footer_elem.append(new ui.Button(`<button>OK</button>`, {
            "disabled": ()=>!handover_stream_property.value,
            "click": ()=>{
                this.hide();
                app.request({
                    call: ["session", "handover"],
                    arguments: [handover_stream_property.value]
                });
            }
        }));
    }
}
export class SavePlaylistSettings extends Modal {
    constructor() {
        super({
            "modal.title": ()=>`Save Playlist '<span>${playlist_name}</span>'`,
            "modal.title-overflow": true,
            "modal.footer": true,
            "modal.props": new ui.PropertyContainer({
                "items": ()=>[app.settings.get("save_playlist_settings")],
            }),
        });
        
        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.settings.set("save_playlist_settings", this.props.named_property_lookup_not_null);
        });

        var playlist_name, filename;
        
        var row = this.props.append(new ui.FlexRow());
        this.playlist_save_file = new ui.Property(`<input type="text">`, {
            "name": "playlist-save-file",
            "label": "Filename",
            flex: 2,
            "default": ()=>filename,
        });
        this.playlist_save_file.validators.push(VALIDATORS.not_empty);
        row.append(this.playlist_save_file);

        this.playlist_save_format = new ui.Property(`<select></select>`, {
            "name": "playlist-save-format",
            "label": "Format",
            "default": "json",
            "options": [["json","JSON"],["text","Simple Text"]],
            "hidden":true,
        });
        row.append(this.playlist_save_format);

        this.playlist_save_children = new ui.Property(`<select></select>`, {
            "name": "playlist-save-children",
            "label": "Include Nested Playlists",
            "default": true,
            "options": YES_OR_NO,
        });
        row.append(this.playlist_save_children);

        this.playlist_json_spaces = new ui.Property(`<input type="number">`, {
            "name": "playlist-json-spaces",
            "label": "JSON spaces",
            "default": 2,
            "min": 0,
            "max": 10,
            "hidden":()=>this.playlist_save_format.value!="json"
        });
        row.append(this.playlist_json_spaces);

        var row = this.props.append(new ui.FlexRow());
        this.playlist_save_dir = new FileProperty({
            "name": "playlist-save-dir",
            "label": "Remote Save Directory",
            "file.options": { folders: true },
            "default": "",
            "invalid_class": null,
        });
        this.playlist_save_dir.validators.push(VALIDATORS.not_empty);
        row.append(this.playlist_save_dir);
        
        var save_remote_button = new ui.Button(`<button>Save (Remote)</button>`, {
            "flex": 0,
            "disabled":()=>!this.props.valid,
            "click": ()=>{
                app.request({
                    call: ["save_file"],
                    arguments: [this.playlist_save_dir.value+"/"+this.playlist_save_file.value, serialize()]
                });
                this.hide();
            }
        });
        save_remote_button.elem.style.flex = "0"
        row.append(save_remote_button);

        var row = this.props.append(new ui.FlexRow());
        var last_hash;
        
        var preview_content = $(`<div class="text-block"></div>`)[0];
        this.preview = new ui.Property(preview_content, {
            "label": "Preview",
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

        var save_local_button = new ui.Button(`<button>Save (Local)</button>`, {
            "click": async ()=>{
                if (await save_local_file(this.playlist_save_file.value+"."+this.playlist_save_format.value, serialize())) this.hide();
            }
        });
        this.cancel = new ui.Button(`<button>Cancel</button>`, {
            "click": ()=>this.hide()
        });
        this.footer_elem.append(save_local_button, this.cancel)

        this.on("show", ()=>{
            playlist_name = app.playlist.current._get_pretty_name() || app.$._session.name;
            filename = `${utils.sanitize_filename(playlist_name)}-${utils.date_to_string()}`;
            render_preview();
        });

        var render_preview = ()=>{
            preview_content.innerText = serialize();
        }
    }
}

export class HistorySettings extends Modal {
    history = [];
    constructor() {
        super({
            "modal.min-width": "900px",
            "modal.props": new ui.PropertyContainer(),
        });
        add_class(this.props.elem, "autosave-history");
        var table_data = {
            "Time":(data)=>{
                var mtime = new Date(data.mtime);
                var e = $(`<span>${utils.time_diff_readable(new Date(), mtime)}</span>`)[0];
                e.title = mtime.toLocaleString();
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
        var row = this.props.append(new ui.FlexRow());
        var table_wrapper = $(`<div class="table-wrapper thin-scrollbar"></div>`)[0];
        var table = $(`<table><thead></thead><tbody></tbody></table>`)[0];
        var thead = table.querySelector("thead");
        var thead_tr = $(`<tr></tr>`)[0];
        var tbody = table.querySelector("tbody");
        Object.keys(table_data).forEach(k=>{
            $(thead_tr).append(`<th>${k}</th>`);
        });
        thead.append(thead_tr);
        var table_col = row.append(new ui.Column());
        table_wrapper.append(table);
        table_col.append(table_wrapper);
        
        var info_col = row.append(new ui.Column());
        var info_wrapper_elem = $(`<div class="info-wrapper"></div>`)[0];
        var info_elem = $(`<div class="info thin-scrollbar"></div>`)[0];
        info_wrapper_elem.append(info_elem);
        var info_footer_elem = $(`<div class="footer"></div>`)[0];
        info_wrapper_elem.append(info_footer_elem);
        info_col.append(info_wrapper_elem)
        
        var loading = false;
        this.load_button = new ui.Button(`<button>Load</button>`, {
            "click":async ()=>{
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
        this.selectable_list.on("change", ()=>{
            var i = this.selectable_list.selected_index;
            var data = this.history[i];
            utils.dom.empty(info_elem);
            this.update();

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
            utils.dom.empty(tbody);

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

export class PlaylistAddURLMenu extends Modal {
    constructor() {
        super({
            "modal.title": "Add URLs to Playlist",
            "modal.footer":true,
            "modal.props": new ui.PropertyContainer(),
        });
        var urls = new ui.Property(`<textarea style="height:180px;white-space:pre"></textarea>`, {
            "label": "URLs",
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
        var row = this.props.append(new ui.FlexRow());
        row.append(urls);

        var row = this.props.append(new ui.FlexRow());
        row.append(...$(`<span>If you're having problems downloading some media it might be due to geo-blocking in the server's locale, try <a href="https://oleksis.github.io/youtube-dl-gui/" target="_blank">yt-dlg</a> to download the media in your locale and upload to the server.</span>`));

        var ok_button = new ui.Button(`<button>OK</button>`, {
            "disabled": ()=>!urls.value,
            "click": ()=>{
                this._resolve(urls.value);
                urls.set_value("", {trigger:false});
                this.hide();
            }
        })
        this.footer_elem.append(ok_button)
        var cancel_button = new ui.Button(`<button>Cancel</button>`, {
            "click": ()=>{
                this._resolve(null);
                this.hide();
            }
        })
        this.footer_elem.append(cancel_button)
        this.on("hide", ()=>this._resolve(null));
    }
    async show(resolve) {
        this._resolve = resolve;
        await super.show();
    }
};

export const MediaSettingsMode = {
    "current": "current",
    "all": "all",
}

/** @extends {Modal<PlaylistItem>} */
export class PlaylistModifySettings extends Modal {
    async show(items, new_type) {
        this._new_type = new_type;
        this._saved = false;
        await super.show(items);
    }

    hide(saved=false) {
        this._saved = saved;
        super.hide();
    }

    get is_new() {
        this.props.item === NULL_PLAYLIST_ITEM;
    }

    get changes() {
        var changes = new Set(super.changes);
        changes.delete(this.interface.label.id);
        changes.delete(this.interface.color.id);
        return [...changes];
    }

    constructor() {
        super({
            "modal.props": new ui.PropertyContainer({
                "nullify_defaults": true,
            }),
            "modal.close": ()=>{
                if (!this._saved && this.is_new && !IS_ELECTRON) return window.confirm("This new item will be discarded. Continue?");
                if (app.$._session._is_running && this.props.items.some(d=>d === app.$._session._current_playing_item) && this.changes.length) {
                    app.prompt_for_reload_of_current_item();
                }
                return true;
            },
            "modal.title": ()=>{
                if (this.is_new) return `Add [${this._new_type}]`;
                return `Modify '<span>${PlaylistItem.get_items_title(this.props.items)}</span>'`;
            },
            "modal.title-overflow": true,
            "modal.footer":true,
        });
        
        this.props.items = [NULL_PLAYLIST_ITEM];

        this.footer_elem.append(
            this.save_button = new ui.Button(`<button>Save</button>`, {
                "hidden":()=>!!this.props.item,
                "disabled":()=>!this.props.valid,
                "click":()=>{
                    app.playlist_add({
                        filename: `livestreamer://${this._new_type}`,
                        props: this.props.named_property_lookup_not_null
                    });
                    this.hide(true);
                }
            }),
            this.reset_button = new ui.Button(`<button>Reset</button>`, {
                // necessary to remove possibly unused playlist_props vars (instead of running this.reset() which only removes the recognized props).
                // "hidden":()=>this.is_new,
                "click":()=>{
                    if (this.is_new) {
                        this.props.reset();
                    } else {
                        var changes = [];
                        for (var item of this.props.items) {
                            changes.push(...Object.keys(item.props).map(p=>[`${item.id}/props/${p}`, null]));
                        }
                        app.playlist_update(changes);
                    }
                }
            })
        );

        this.props.on("change", (e)=>{
            if (this.is_new) return;
            if (e.name && e.trigger) {
                app.playlist_update(e.datas.map(data=>[`${data.id}/${e.name}`, e._value]));
            }
        });

        this.on("update", ()=>{
            // if (!this.props.items.length) return;
            this.props.update_layout(this.interface.get_layout());
        });

        this.interface = new MediaSettingsInterface(this);
    }
}

export class MediaSettingsInterface {
    constructor(parent) {
        /** @type {PlaylistModifySettings|MediaSettingsPanel} */
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
            /* if (is_playing && app.$._stream.mpv.context.props[id_key] === "generated") {
                indeterminate_option.text = "Generated";
            } else { */
            if (is_playing) {
                default_stream = streams[app.$._stream.mpv.context.props[id_key]-1] || default_stream;
            }
            var auto_text = "Auto";
            if (this.parent instanceof MediaSettingsPanel) auto_text = `${auto_text} [${stream_to_text(default_stream)}]`;
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
                streams = app.$._stream.mpv.context.streams;
            }
            if (!streams) streams = [];
            if (type) streams = streams.filter(s=>s.type == type);
            return streams;
        };

        let prop_name = (name)=>{
            if (this.parent instanceof PlaylistModifySettings) return `props/${name}`;
            return name;
        }

        /* let get_current_streams = (type)=>{
            var streams = [];
            var track_list = app.$.stream.mpv.context.props["track-list"] || EMPTY_ARRAY;
            if (track_list.length > 0 && this.parent instanceof MediaSettingsPanel) {
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
                if (_this.parent instanceof MediaSettingsPanel) {
                    value = utils.ref.get(app.$.session.player_default_override, name);
                } else {
                    value = utils.ref.get(app.$.session.current_playing_item.props, name);
                }
            } */
            /* if (value === undefined && parent._mode === MediaSettingsMode.current) {
                value = utils.try(()=>app.$.session.current_playing_item.props[name]);
            } */
            if (_this.parent instanceof PlaylistModifySettings || (_this.parent instanceof MediaSettingsPanel && _this.parent._mode === MediaSettingsMode.current)) {
                value = utils.ref.get(app.$._session.player_default_override, name);
            }
            if (value === undefined) {
                value = utils.try(()=>app.$.properties.playlist.__enumerable__.props[name].__default__);
            }
            /* if (value === undefined) {
                // value = utils.try(()=>app.get_property("player_default_override", name).__default__);
            } */
            if (value === undefined) value = null;
            return value;
        }
        
        let get_options = function() {
            var options;
            var name = this.name.split("/").pop();
            if (_this.parent instanceof PlaylistModifySettings) {
                options = utils.try(()=>app.$.properties.playlist.__enumerable__.props[name].__options__);
            }
            if (options === undefined) {
                options = utils.try(()=>app.$.properties.player_default_override[name].__options__);
            }
            return options || [];
        };

        this.aspect_ratio = new ui.Property(`<select></select>`, {
            "name": prop_name("aspect_ratio"),
            "label": "Aspect Ratio",
            "options": [[-1,"Default"],  [1.777778,"16:9"], [1.333333,"4:3"], [2.35,"2.35:1"]],
            "default": get_default,
        });

        this.deinterlace = new ui.Property(`<select></select>`, {
            "name": prop_name("deinterlace_mode"),
            "label": "Deinterlace",
            "options": [["auto","Auto"],[false, "Off"],[true, "On"]],
            "default": get_default,
        });

        this.aid_override = new ui.Property(`<select></select>`, {
            "name": prop_name("aid_override"),
            "label": "Audio Track",
            "options": (item)=>{
                return get_stream_options(item, "audio")
            },
            "default": get_default,
            "disabled": ()=>this.parent._mode === MediaSettingsMode.all,
        });
       
        this.audio_delay = new ui.Property(`<input type="number">`, {
            "name": prop_name("audio_delay"),
            "label": "Audio Delay",
            "suffix": "secs",
            "step":0.05,
            "default": get_default,
        });
        
        this.audio_channels = new ui.Property(`<select></select>`, {
            "name": prop_name("audio_channels"),
            "label": "Audio Channels",
            "default": get_default,
            "options":()=>[["left", "Left → Mono"],["right", "Right → Mono"],["mix", "L + R → Mono"],["stereo", "Stereo"]],
        });
        
        this.sid_override = new ui.Property(`<select></select>`, {
            "name": prop_name("sid_override"),
            "label": "Subtitle Track",
            "options": (item)=>{
                return get_stream_options(item, "subtitle")
            },
            "default": get_default,
            "disabled": this.parent instanceof MediaSettingsPanel ? ()=>this.parent._mode === MediaSettingsMode.all : false,
        });

        this.subtitle_delay = new ui.Property(`<input type="number">`, {
            "name": prop_name("sub_delay"),
            "label": "Subtitle Delay",
            "suffix": `secs`,
            "precision":3,
            "step": 0.05,
            "default": get_default,
        });
        this.subtitle_delay.output_modifiers.push((v)=>Number(v).toFixed(2));
        
        this.subtitle_scale = new ui.Property(`<input type="number">`, {
            "name": prop_name("sub_scale"),
            "label": "Subtitle Scale",
            "precision":2,
            "step": 0.01,
            "min": 0.1,
            "max": 10,
            "suffix": "%",
            "default": get_default,
        });
        this.subtitle_scale.input_modifiers.push((v)=>+v/100);
        this.subtitle_scale.output_modifiers.push((v)=>Math.round(+v*100));

        this.subtitle_pos = new ui.Property(`<input type="number">`, {
            "name": prop_name("sub_pos"),
            "label": "Subtitle Position",
            "precision":2,
            "step": 1,
            "min": 0,
            "max": 150,
            "suffix": "%",
            "default": get_default,
            "info": `The vertical position of the subtitle in % of the screen height. 100 is the original position, which is often not the absolute bottom of the screen, but with some margin between the bottom and the subtitle. Values above 100 move the subtitle further down.`
        });
        this.subtitle_pos.output_modifiers.push((v)=>Math.round(+v));

        /* this.playback_speed = new ui.Property(`<input type="number">`, {
            "name": prop_name("speed"),
            "label": "Playback Speed",
            "precision":2,
            "step": 0.05,
            "default": get_default,
            "hidden": ()=>!app.$._stream.method != "gui"
        });
        this.playback_speed.output_modifiers.push((v)=>Number(v).toFixed(2));
        this.pitch_correction = new ui.Property(`<select></select>`, {
            "name": prop_name("audio_pitch_correction"),
            "label": "Audio Pitch Correction",
            "options": [[false, "Off"],[true, "On"]],
            "default": get_default,
            "hidden": ()=>!app.$._stream.method != "gui"
        }); */
        
        this.volume_normalization = new ui.Property(`<select></select>`, {
            "name": prop_name("volume_normalization"),
            "label": "Volume Normalization",
            "options":()=>{
                return [[false,"Off"], ...(utils.try(()=>app.$.properties.player_default_override.volume_normalization.__options__)||EMPTY_ARRAY).map(([f,_])=>[f,f])]
            },
            "default": get_default,
        });
        
        this.volume_multiplier = new ui.Property(`<input type="number">`, {
            "name": prop_name("volume_multiplier"),
            "label": "Volume Multiplier",
            "step":0.05,
            "min": 0,
            "max": 2,
            "suffix": "%",
            "precision":2,
            "default": 1,
        });
        this.volume_multiplier.input_modifiers.push((v)=>v/100);
        this.volume_multiplier.output_modifiers.push((v)=>Math.round(v*100).toString());
        
        this.audio_visualization = new ui.Property(`<select></select>`, {
            "name": prop_name("audio_visualization"),
            "label": "Audio Visualization",
            "options":()=>{
                return [[false,"None"], ["waveform","Waveform"]];
            },
            "default": get_default,
        });

        // this.fps = new ui.Property(`<select></select>`, {
        //     "name": prop_name("force_fps"),
        //     "label": "Frame Rate",
        //     "options": get_options,
        //     "default": get_default,
        // });

        this.loop = new ui.Property(`<select></select>`, {
            "name": prop_name("loop_file"),
            "label": "Loop",
            "options": [[false, "Off"],["inf", "On"]],
            "default": get_default,
        });

        if (this.parent instanceof PlaylistModifySettings) {

            /** @return {PlaylistItem} */
            let _item = ()=>this.parent.props.item;
            /** @return {PlaylistItem[]} */
            let _items = ()=>this.parent.props.items;

            /** @param {PlaylistItem} item */
            let get_default_duration = (item)=>{
                return (item || _item())._userdata.media_duration;
            };
            
            this.filename = new ui.Property(`<input type="text">`, {
                "name": "filename",
                "label": "File URI",
                "default": (d,i)=>{
                    return this.parent.items_on_show[i].filename || ""
                },
                "nullify_defaults": false,
                "reset": true,
                "info": "A single wrong character will invalidate the file URI, edit with care."
            });
            this.filename.validators.push(VALIDATORS.not_empty);
            this.filename.validators.push(VALIDATORS.media_exists);

            this.playlist_mode = new ui.Property(`<select>`, {
                "name": prop_name("playlist_mode"),
                "label": "Playlist Mode",
                "info": `Setting to 'Merged' or '2-Track', the media player will attempt to merge the playlist's contents as if it were a single file, with each item represented as a chapter. A merged playlist may only include local files (ie, no URIs or special items).`,
                "options": get_options,
                "default": get_default,
            });

            this.playlist_end_on_shortest_track = new ui.Property(`<select>`, {
                "name": prop_name("playlist_end_on_shortest_track"),
                "label": "End Playlist on Shortest Track",
                "info": `Enabling sets the item to end when the track with the shortest duration ends. Disabling will pad the shortest track to match the duration of the longer track.`,
                "options": ()=>{
                    return [[false, "Off"], [true, "On"]];
                },
                "hidden": (item)=>item.props.playlist_mode != PLAYLIST_MODE.DUAL_TRACK,
                "default": get_default,
            });

            this.playlist_revert_to_video_track_audio = new ui.Property(`<select>`, {
                "name": prop_name("playlist_revert_to_video_track_audio"),
                "label": "Revert to Video Track Audio",
                "info": `If the audio track is shorter than the video track, revert to the audio supplied in the video track.`,
                "options": ()=>{
                    return [[false, "Off"], [true, "On"]];
                },
                "disabled": (item)=>item.props.playlist_end_on_shortest_track,
                "hidden": (item)=>item.props.playlist_mode != PLAYLIST_MODE.DUAL_TRACK,
                "default": get_default,
            });

            this.clip_start = new ui.TimeSpanProperty({
                "name": prop_name("clip_start"),
                "label": "Clip Start",
                "timespan.format": "h:mm:ss.SSS",
                "min": 0,
                "max": ()=>Math.min(get_default_duration(), this.clip_end.value),
                "default": 0,
            })
            this.clip_

            this.clip_end = new ui.TimeSpanProperty({
                "name": prop_name("clip_end"),
                "label": null,
                "label": ()=>utils.dom.is_visible(this.clip_start.elem) ? "Clip End" : "Duration",
                "timespan.format": "h:mm:ss.SSS",
                "min": ()=>this.clip_start.value,
                "max": ()=>get_default_duration(),
                "default": ()=>get_default_duration(),
            });

            this.clip_length = new ui.TimeSpanProperty({
                "name": null,
                "label": "Clip Length",
                "timespan.format": "h:mm:ss.SSS",
                "reset": false,
                "min": 0,
                "max": ()=>get_default_duration()-this.clip_start.value,
                // "spinner": false,
                // "readonly": true,
                // "disabled": true,
                // "default":()=>(this.clip_end.value-this.clip_start.value)*this.clip_loops.value,
            });

            var get_clip_length = ()=>{
                return this.clip_end.value - this.clip_start.value;
            };
            var get_total_duration = ()=>{
                return get_clip_length() * this.clip_loops.value;
            };

            this.clip_offset = new ui.TimeSpanProperty({
                "name": prop_name("clip_offset"),
                "label": "Clip Offset",
                "timespan.format": "h:mm:ss.SSS",
                "default": 0,
            });

            this.clip_loops = new ui.Property(`<input type="number">`, {
                "name": prop_name("clip_loops"),
                "label": "Clip Loops",
                "min": 0,
                "step": 0.1,
                "precision": 8,
                "default": 1,
            });
            // this.clip_loops.output_modifiers.push(v=>v.toFixed(6).replace(/0+$/, ""));

            this.total_duration = new ui.TimeSpanProperty({
                "name": null,
                "label": "Total Duration",
                // "readonly": true,
                // "disabled": true,
                "reset": false,
                // "spinner": false,
                "min":0,
                "timespan.format": "h:mm:ss.SSS",
            });

            this.start_end_time_range = new RangeProperty({
                "min": 0,
                "max": ()=>get_default_duration(),
                "step": 0.001,
                "default": (item)=>[0, get_default_duration(item)],
                "hidden": ()=>!get_default_duration(),
                "reset": false,
                "title": `Clip Range`,
            });
            var update_clip_length = ()=>{
                this.start_end_time_range.set_value([this.clip_start.value, this.clip_end.value]);
                this.clip_length.set_value(get_clip_length())
            };
            var update_total_duration = ()=>{
                this.total_duration.set_value(get_total_duration());
            };
            this.clip_start.on("change", ()=>{
                update_clip_length();
                update_total_duration();
            });
            this.clip_end.on("change", ()=>{
                update_clip_length();
                update_total_duration();
            });
            this.clip_length.on("change", (e)=>{
                if (e.trigger) this.clip_end.set_value(this.clip_start.value + e.value, {trigger:true});
            });
            this.clip_loops.on("change", (e)=>{
                update_total_duration();
            });
            this.total_duration.on("change", (e)=>{
                if (e.trigger) this.clip_loops.set_value(e.value / get_clip_length(), {trigger:true});
            });
            this.start_end_time_range.on("change", (e)=>{
                var trigger = e.trigger;
                this.clip_start.set_value(e.value[0], {trigger});
                this.clip_end.set_value(e.value[1], {trigger});
            });

            // -------------------------------------

            this.fade_in_time = new ui.Property(`<input type="number">`, {
                "name": prop_name("fade_in"),
                "label": "Fade In Duration",
                "suffix": "secs",
                "step":0.1,
                "default": get_default,
                "min": 0,
            })

            this.fade_out_time = new ui.Property(`<input type="number">`, {
                "name": prop_name("fade_out"),
                "label": "Fade Out Duration",
                "suffix": "secs",
                "step":0.1,
                "default": get_default,
                "min": 0,
            });

            /* this.fade_in_out_time = new ui.Property(`<input type="number">`, {
                "name": prop_name("fade_in"),
                "label": "Fade In/Out",
                "suffix": `secs`,
                "step": 0.1,
                "min": 0,
                "default": 0,
            });
            this.fade_in_out_time.on("change", (e)=>{
                if (e.trigger) {
                    this.fade_in_time.set_value(e._value, true);
                    this.fade_out_time.set_value(e._value, true);
                }
            }) */

            /** @param {PlaylistItem} item */
            var is_special = (item)=>item && item.filename.startsWith("livestreamer:");
            /** @param {Playlistitem} item */
            var is_empty = (item)=>item && item.filename == "livestreamer://empty";

            /** @param {Playlistitem} item */
            function get_background_options(item) {
                var options = utils.json_copy(get_options.apply(this));
                if (is_special(item)) options = options.filter(o=>!["embedded","external"].includes(o[0]));
                // if (is_empty(item)) options = options.filter(o=>!["default"].includes(o[0]));
                return options
            };

            [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end] = create_background_properties({
                "name": prop_name("background"),
                "label": "Replace Video",
                /** @this {ui.Property} */
                /** @param {Playlistitem} item */
                "options":function(item){
                    var options = get_background_options.apply(this,[item]);
                    if (item.filename == "livestreamer://intertitle") {
                        options = options.filter(o=>o[0]=="color" || o[0]==null || o[0]=="default");
                    } else {
                        var default_opt = options.find(o=>o[0]=="default") || options.find(o=>o[0]==null);
                        var background_mode_option = app.$.properties.background_mode.__options__.find(o=>o[0]==app.$._session.background_mode);
                        if (default_opt && background_mode_option) {
                            default_opt[1] = `Default Background (${background_mode_option[1]})`;
                        }
                    }
                    return options;
                },
                "default": null,
            });

            this.audio_file = new FileProperty({
                "name": prop_name("audio_file"),
                "label": "Add Audio",
                "file.options": { files: true, filter: ["audio", "video"] },
            });
            this.audio_file.validators.push(VALIDATORS.media_audio);

            this.subtitle_file = new FileProperty({
                "name": prop_name("subtitle_file"),
                "label": "Add Subtitles",
                "file.options": { files: true, filter: ["text"] },
            })
            this.subtitle_file.validators.push(VALIDATORS.media_subtitle);
            
            this.crop = new ui.MultiProperty({
                "name": prop_name("crop"),
                "label": "Crop (Left/Top/Right/Bottom)",
                "step": 0.01,
                "min": 0,
                "max": CROP_LIMIT*100,
                "precision":4,
                "spinner": false,
                "default": get_default,
                "props": ["left","up","right","down"].map((dir,i)=>{
                    var p = new ui.Property(`<input type="number">`, {
                        "name": i,
                        "reset": false,
                        "step": 0.01,
                        "min": 0,
                        "max": 1,
                        // "prefix": `<i class="fa-solid fa-arrow-${dir}"></i>`,
                        "suffix": `%`,
                    });
                    p.input_modifiers.push((v)=>v/100);
                    p.output_modifiers.push((v)=>Math.round(v*100));
                    return p;
                })
            });

            var auto_cropping = false;
            this.auto_crop_button = new ui.Button(null, {
                "flex": 0,
                "disabled":()=>auto_cropping,
                "content":()=>auto_cropping ? `Crop Detecting <i class="fas fa-sync fa-spin"></i>` : `Crop Detect`,
                "click":async ()=>{
                    auto_cropping = true;
                    this.auto_crop_button.update()
                    await app.request({
                        call: ["session", "detect_crop_and_apply"],
                        arguments: [_item().id]
                    }, {
                        show_spinner: false,
                        timeout: 0
                    }).catch(utils.noop);
                    auto_cropping = false;
                    this.auto_crop_button.update();
                }
            });

            var old_hash;
            var crop_el = $(`<div class="crop-image-container"></div>`)[0];
            this.detected_crops_images = new ui.UI(crop_el, {
                "hidden": function() {
                    return _items().length != 1 || !_item()._detected_crops;
                },
                /** @this {ui.Property} */
                "update": function() {
                    var item = _item();
                    var data = item._detected_crops;
                    var hash = JSON.stringify([data, item._crop, item.id]);
                    if (hash === old_hash) return;
                    old_hash = hash;

                    utils.dom.empty(crop_el);
                    if (data && _items().length == 1) {
                        data.crops.forEach((d,i)=>{
                            var p = new CropPreview(d.url, d.rect, item._crop, false, data.width, data.height);
                            var container = $(`<div></div>`)[0];
                            container.appendChild(p.elem);
                            crop_el.appendChild(container);
                            p.elem.onclick = ()=>new CropEditMenu(_item(), i, item._crop).show();
                        });
                    }
                }
            });

            // -------------------------------------
            
            this.empty_duration = new ui.TimeSpanProperty({
                "name": prop_name("empty_duration"),
                "label": "Duration",
                "min":0,
                "timespan.zero_infinity": true,
                "timespan.format": "h:mm:ss.SSS",
                "default":get_default,
            });

            // -------------------------------------
            
            this.title_text = new ui.TextAreaProperty({
                "name": prop_name("title_text"),
                "label": "Text",
                "default":get_default,
                "placeholder":"Insert Text Here",
                "reset": false,
                "textarea.rows": 3,
                "textarea.grow": true,
            });
            this.title_text.validators.push(VALIDATORS.not_empty);
            
            this.title_duration = new ui.TimeSpanProperty({
                "name": prop_name("title_duration"),
                "label": "Duration",
                "min":0,
                "timespan.format": "h:mm:ss.SSS",
                "default": get_default
            });
            this.title_fade_in_out = new ui.Property(`<input type="number">`, {
                "name": prop_name("title_fade"),
                "label": "Fade In/Out",
                "suffix": `secs`,
                "precision":3,
                "step": 0.1,
                "min": 0,
                "default": get_default
            });

            //Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

            this.title_font = new ui.Property(`<select>`, {
                "name": prop_name("title_font"),
                "label": "Font",
                "default": get_default,
                "options": get_options,
            });
            /* this.title_font.group_elem.append(new ui.Button(`<button><i class="fas fa-plus"></i></button>`, {
                "title": `Add New Font...`,
                "click": ()=>{
                    app.font_menu.show()
                }
            })) */

            this.title_size = new ui.Property(`<input type="number">`, {
                "name": prop_name("title_size"),
                "label": "Size",
                "default": get_default,
                "min": 10,
                "max": 100,
            });
            this.title_color = new ui.Property(`<input type="color">`, {
                "name": prop_name("title_color"),
                "label": "Color",
                "default": get_default,
            });
            this.title_style = new ui.Property(`<select>`, {
                "name": prop_name("title_style"),
                "label": "Style",
                "default": get_default,
                "options": get_options,
            });
            this.title_alignment = new ui.Property(`<select>`, {
                "name": prop_name("title_alignment"),
                "label": "Alignment",
                "default": get_default,
                "options": get_options,
            });
            this.title_spacing = new ui.Property(`<input type="number">`, {
                "name": prop_name("title_spacing"),
                "label": "Letter Spacing",
                "default": get_default,
                "min": -50,
                "min": 50,
            });
            this.title_outline_thickness = new ui.Property(`<input type="number"></div>`, {
                "name": prop_name("title_outline_thickness"),
                "label": "Outline Thickness",
                "precision":1,
                "step": 0.5,
                "min": 0,
                "max": 50,
                "default": get_default
            });
            this.title_outline_color = new ui.Property(`<input type="color">`, {
                "name": prop_name("title_outline_color"),
                "label": "Outline Color",
                "default": get_default
            });
            this.title_shadow_depth = new ui.Property(`<input type="number">`, {
                "name": prop_name("title_shadow_depth"),
                "label": "Shadow Depth",
                "precision":1,
                "step": 0.5,
                "min": 0,
                "max": 50,
                "default": get_default,
            });
            this.title_shadow_color = new ui.Property(`<input type="color">`, {
                "name": prop_name("title_shadow_color"),
                "label": "Shadow Color",
                "default": get_default,
            });
            this.title_underline = new ui.Property(`<select>`, {
                "name": prop_name("title_underline"),
                "label": "Underline",
                "default": get_default,
                "options": YES_OR_NO,
            });
            this.title_rotation = new ui.MultiProperty({
                "name": prop_name("title_rotation"),
                "label": "3D Rotation (degrees)",
                "default": get_default,
                props: ["x","y","z"].map((d,i)=>{
                    return new ui.Property(`<input type="number">`, {
                        "name": i,
                        "reset": false,
                        suffix: d,
                    })
                })
            });
            this.title_margin = new ui.Property(`<input type="number">`, {
                "name": prop_name("title_margin"),
                "label": "Margin",
                "default": get_default,
                "min": 0,
                "max": 100,
            });
            
            var alignments = ["bottom left", "bottom center", "bottom right", "center left", "center", "center right", "top left", "top center", "top right"];
            var alignment_styles = [{"text-align":"left", bottom:0}, {"text-align":"center", bottom:0}, {"text-align":"right", bottom:0}, {top: "50%", transform: "translateY(-50%)", "text-align":"left"}, {top: "50%", transform: "translateY(-50%)", "text-align":"center"}, {top: "50%", transform: "translateY(-50%)", "text-align":"right"},{top:0, "text-align":"left"}, {top:0, "text-align":"center"}, {top:0, "text-align":"right"}];
            (()=>{
                var _title_hash, _anim_hash;
                var title_preview_content_el = $(`<div class="title-preview"></div>`)[0];
                this.title_preview = new ui.Property(title_preview_content_el, {
                    "label": "Preview",
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
                Object.assign(title_preview_content_el.style, {
                    "width": "100%",
                    "padding-top": "56.25%",
                    "position": "relative",
                    "overflow":"hidden",
                    "border": "1px solid #ddd",
                });
                title_preview_content_el.onclick=()=>{
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
                title_preview_content_el.append(timeline_elem);

                var padding = $(`<div></div>`)[0];
                Object.assign(padding.style, {
                    "position":"absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                });
                title_preview_content_el.append(padding);

                var black_overlay = $(`<div></div>`)[0];
                Object.assign(black_overlay.style, {
                    "position":"absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                    "background": "black",
                    "z-index": 5,
                });
                title_preview_content_el.append(black_overlay);

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

                title_preview_content_el.onanimationend = ()=>{
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
                    utils.dom.restart_animation(title_preview_content_el);
                }

                var update_preview = ()=>{
                    Object.assign(title_preview_content_el.style, {
                        "background":this.background_mode.value == "color" ? this.background_color.value : "#000000",
                    });

                    var style = (this.title_style.value||"");
                    var scale = 1.25;

                    Object.assign(padding.style, {
                        "padding":`${this.title_margin.value*scale}px`,
                    });

                    title_preview_content_el.querySelectorAll(".preview-text").forEach(e=>{
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
                    title_preview_content_el.querySelectorAll(".preview-container").forEach(e=>{
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

            this.macro_function = new ui.Property(`<select>`, {
                "name": prop_name("function"),
                "label": "Function",
                "options":get_options,
                "default":get_default,
            });
            // this.macro_function.validators.push(VALIDATORS.not_empty);

            this.macro_handover_session = new ui.Property(`<select>`, {
                "name": prop_name("function_handover_session"),
                "label": "Handover Session",
                "options":()=>app.get_handover_sessions_options(),
                "default":get_default,
                "reset":true,
                "hidden":()=>this.macro_function.value != "handover"
            });
            this.macro_handover_session.validators.push(VALIDATORS.not_empty);

            // -------------------------------------

            this.label = new ui.Property(`<input type="text">`, {
                "name": prop_name("label"),
                "label": "Label",
                /** @param {PlaylistItem} item */
                "default": (item)=>{
                    return (item??NULL_PLAYLIST_ITEM)._get_pretty_name({label:false}) || "";
                },
            });

            this.color = new ui.Property(`<select></select>`, {
                "name": prop_name("color"),
                "label": "Item Color",
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
        // rows.push([this.playback_speed, this.pitch_correction]);
        rows.push([this.volume_normalization, this.volume_multiplier, this.audio_visualization]);
        return rows;
    }

    get_layout() {
        if (this.parent instanceof MediaSettingsPanel) {
            return this.get_default_layout();
        }
        
        var items = this.parent.props.items;

        var background_layout = [
            [this.background_mode, this.background_color, this.background_file, this.background_file_start, this.background_file_end]
        ];
        var clip_layout = [
            [this.clip_start, this.clip_end, ...(this.clip_length ? [this.clip_length] : [])],
            [this.start_end_time_range],
            [this.clip_offset, this.clip_loops, this.total_duration],
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
        
        // var is_2_track_playlist = items.every(i=>i._num_tracks == 2);
        var is_merged_playlist = items.every(i=>i._is_merged_playlist);
        var is_parent_merged = items.every(i=>i._root_merged_playlist);
        // var is_youtube = items.every(i=>utils.try(()=>i._media_info.probe_method === "youtube-dl"));
        var is_image = items.every(i=>utils.try(()=>i._media_info.duration <= IMAGE_DURATION));
        var is_url = items.every(i=>i._is_url);
        // var exists = items.every(i=>utils.try(()=>i._media_info.exists));

        var crop_layout = [
            [this.crop]
        ];
        if (is_normal && !is_url) {
            crop_layout[0].push(this.auto_crop_button);
            crop_layout.push(this.detected_crops_images);
        }

        var layout = [];
        if (is_normal || is_empty) {
            if (!is_empty) {
                layout.push([this.filename]);
                layout.push("---");
            }
            if (is_empty || is_image) {
                layout.push([this.empty_duration]);
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
            layout.push([this.title_text]);
            layout.push([this.title_size, this.title_duration, this.title_fade_in_out]);
            layout.push([this.title_font, this.title_size, this.title_color]);
            layout.push([this.title_style, this.title_alignment, this.title_spacing]);
            layout.push([this.title_underline,this.title_margin]);
            layout.push([this.title_rotation]);
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

export class FileProperty extends ui.Property {
    constructor(settings = {}) {
        var input = $(`<input type="text" class="file">`)[0];
        super(input, Object.assign({
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
            "readonly": true,
            "placeholder": ()=>`Choose a ${this.get_setting("file.options").folders ? "directory" : "file"}...`
        }, settings));
        this.output_modifiers.push((v)=>v?pretty_uri_basename(v):"");
    }
}


export class EditAccessControlMemberMenu extends Modal {
    /** @param {AccessControlProperty} prop */
    constructor(prop) {
        var is_new = ()=>utils.is_empty(this.props.item);
        super({
            "modal.title": "Edit Access Control",
            "modal.footer": ()=>this.props.item.username != "*",
            "modal.props": new ui.PropertyContainer(),
        });

        var row = this.props.append(new ui.FlexRow());
        this.username = new ui.Property(`<input type="text">`, {
            "name": "username",
            "label": "Username",
            "default": "",
            "disabled": ()=>!is_new(),
            "reset": false,
        });
        this.username.validators.push(VALIDATORS.not_empty);
        this.username.validators.push((v)=>(is_new() && prop._access_control[v]) ? "Username already registered" : true);
        this.access = new ui.Property(`<select>`, {
            "name": "access",
            "label": "Access",
            "default": "allow",
            "options": ()=>{
                return [["owner",{disabled:this.props.item.username == "*"}],"allow","deny"]
            },
        });
        this.password = new ui.Property(`<input type="text">`, {
            "name": "password",
            "label": "Password",
            "default": "",
            "hidden": ()=>this.access.value!=="allow" || this.props.item.username != "*",
        });
        this.suspended = new ui.Property(`<select>`, {
            "name": "suspended",
            "label": "Suspended",
            "default": false,
            "options": YES_OR_NO,
            "disabled": ()=>this.props.item.username != "*" && this.access.value === "owner" && this.props.item.username === app.$._client.username,
            "hidden": ()=>this.props.item.username == "*",
        });
        
        row.append(this.username, this.access);
        
        if (prop.get_setting("access.allow_passwords")) row.append(this.password);
        row.append(this.suspended);
        
        this.save_button = new ui.Button(`<button>Save</button>`, {
            "disabled":()=>!this.props.valid,
            "hidden": ()=>!is_new(),
            "click": ()=>{
                if (!this.props.valid) return; // insurance
                prop._edit(this.username.value, {access:this.access.value, password:this.password.value, suspended:this.suspended.value});
                this.hide();
            },
        });
        var delete_button = new ui.Button(`<button>Delete</button>`, {
            "hidden": ()=>is_new() || this.props.item.username == "*",
            "disabled": ()=>this.props.item.username == "*",
            "click": ()=>{
                if (prop._edit(this.props.item.username, null)) {
                    this.hide();
                }
            },
        });
        this.footer_elem.append(this.save_button, delete_button)

        this.props.on("change", (e)=>{
            if (is_new() || !e.name || !e.trigger) return;
            if (e.name == "username") return;
            prop._edit(this.props.item.username, {[e.name]:e.value});
        });
    }
}

export class AccessControlProperty extends ui.Property {
    constructor(settings = {}) {
        var elem = $(`<div class="access-control"></div>`)[0];
        super(elem, {
            "default": AccessControl.DEFAULT_ACCESS_FOR_SELF,
            "reset": false,
            "hidden": ()=>!this._access_control._self_can_edit,
            "access.allow_passwords": true,
            ...settings
        });
        
        this._access_control = new AccessControl();

        var columns = {
            "Username": (data)=>$(`<span>${data.username}</span>`)[0],
            "Access": (data)=>(data.access === "allow" && data.password) ? "allow [password protected]" : data.access,
            // "Password": (data)=>data.password ? ("*".repeat(data.password ? data.password.length : 0)) : "-",
            "Controls": (data)=>{
                var edit_button, delete_button, suspend_button;
                if (this._access_control._owners.length == 0) return;
                if (this._access_control._self_is_owner_or_admin) {
                    edit_button = $(`<button title="Edit"><i class="fas fa-wrench"></i></button>`)[0];
                    edit_button.onclick = ()=>{
                        new EditAccessControlMemberMenu(this).show(data);
                    };
                    edit_button.disabled = data.access == "owner" && this._access_control._owners.length < 2;
                    if (data.username !== "*" && data.access !== "owner") {
                        suspend_button = $(`<button title="${data.suspended ? "Unsuspend" : "Suspend"}"><i style="opacity:${data.suspended?0.5:1.0};"class="far fa-pause-circle"></i></button>`)[0];
                        suspend_button.onclick = ()=>{
                            this._edit(data.username, {suspended: !data.suspended});
                        };
                    }
                    if (data.username !== "*") {
                        delete_button = $(`<button title="Delete"><i class="fas fa-trash-alt"></i></button>`)[0];
                        delete_button.onclick = ()=>{
                            this._edit(data.username, null);
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
            if (this._access_control._owners.length == 0) {
                this._claim();
            } else {
                new EditAccessControlMemberMenu(this).show({});
            }
        });
        thead_elem.append($(`<tr>${Object.keys(columns).map(c=>`<th>${c}</th>`)}</tr>`)[0]);
        var old_hash;
        this.on("render", ()=>{
            var hash = JSON.stringify(this._access_control)
            if (hash === old_hash) return;
            old_hash = hash;

            utils.dom.empty(tbody_elem);
            add_button.innerText = add_button.title = this._access_control._owners.length == 0 ? "Claim Ownership" : "Add User";
            toggle_attribute(add_button, "disabled", !this._access_control._self_can_edit);
            for (let user of this._access_control._users) {
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
            utils.clear(this._access_control);
            Object.assign(this._access_control, utils.json_copy(e._value));
        });
    }

    _claim() {
        this._access_control._claim();
        this.update_value();
    }

    _edit(username, data) {
        var res = this._access_control._edit(username, data);
        this.update_value();
        return res;
    }

    update_value() {
        var d = utils.json_copy(this._access_control);
        this.set_values(d, {trigger:true});
    }
}

export class RangeProperty extends ui.Property {
    constructor(settings = {}) {
        var input = $(`<div class="ui-slider-range"></div>`)[0];
        input.style.width = "100%";
        input.style.padding = "0 10px";
        var value;
        /** @type {noUiSliderAPI} */
        var slider;

        super(input, Object.assign({
            "min": 0,
            "max": 100,
            "step": 1,
            "default": [0, 100],
            "spinner": false,
            "setup": ()=>{
                slider = noUiSlider.create(input, {
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
                slider.on("slide", (_values)=>{
                    value = _values.map(v=>+v);
                    // this.emit("slide", { value });
                    this.set_value(value);
                });
                slider.on("end", (_values)=>{
                    value = _values.map(v=>+v);
                    this.set_value(value, {trigger:true});
                });
                return input;
            },
        }, settings));

        var last_hash;
        this.on("render", (e)=>{
            var disabled = this.get_setting("disabled");
            var range =  disabled ? {'min':0, 'max':1} : {'min':this.get_setting("min"), 'max':this.get_setting("max")};
            var step = this.get_setting("step");
            var value = this.value;
            var hash = JSON.stringify([value, step, range]);
            if (last_hash !== hash) {
                last_hash = hash;
                slider.updateOptions({ step, range });
                slider.set(value, false, false);
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



export class Panel extends ui.UI {
    get collapsible() { return !!this.elem.dataset.collapsible; }
    set collapsible(value) {
        if (value) {
            this.elem.dataset.collapsible = 1;
        } else {
            delete this.elem.dataset.collapsible;
        }
    }
    constructor(title, settings) {
        super({...settings});
        this.panel_id = title.toLowerCase().replace(/[^\w]+/, "-");
        app.panels[this.panel_id] = this;

        add_class(this.elem, "drawer");
        this.elem.dataset.id = this.panel_id;
        var header_container_elem = $(`<div class="header"><div class="inner"></div><div class="collapse-arrow"><i class="fas fa-chevron-down"></i></div></div>`)[0];
        this.body_elem = $(`<div class="body"></div>`)[0];
        this.body = new ui.UI(this.body_elem);
        this.header = new ui.UI(header_container_elem);
        this.header_elem = header_container_elem.querySelector(".inner");
        this.collapse_arrow_elem = header_container_elem.querySelector(".collapse-arrow");

        var title_elem = $(`<span></span>`)[0];
        set_inner_html(title_elem, title);
        this.header_elem.append(title_elem, $(`<span class="gap"></span>`)[0]);

        this.elem.append(header_container_elem, this.body_elem);
        
        this.collapsible = true;
        
        header_container_elem.addEventListener("click", (e)=>{
            if (!this.elem.dataset.collapsible) return;
            if (e.target != header_container_elem) return;
            var setting_id = `drawer:${this.panel_id}`;
            if (app.settings.get(setting_id) === undefined) app.settings.set(setting_id, false);
            else app.settings.toggle(setting_id);
        });
    }

    /** @param {ui.PropertyContainer} props */
    add_reset_button(props, opts) {
        var opts = {
            "disabled": utils.noop,
            ...opts,
        }
        var g = $(`<div class="buttons border-group"></div>`)[0];
        var reset_button = new ui.Button(`<button class="reset icon" title="Reset"><i class="fas fa-undo"></i></button>`, {
            "disabled": ()=>props.is_default || !!opts.disabled(),
            "click": ()=>props.reset(),
        })
        props.on("change", (e)=>{
            reset_button.update();
        });
        g.append(reset_button)
        this.header_elem.append(g);
    }

    toggle(value) {
        toggle_class(this.elem, "hide", value)
    }
}

export class StreamSettings extends Panel {
    constructor() {
        super("Stream Settings");
        this.props = new ui.PropertyContainer({
            "nullify_defaults": true,
            "items": ()=>[app.$._session.stream_settings],
            // "disabled": ()=>app.$.session.is_running,
        });
        this.body.append(this.props);
        var left = new ui.Row({ "flex":1 });
        var right = new ui.Row({ "flex":0, "gap":0 });
        var inner = new ui.UI();
        inner.append(left, right);
        add_class(inner.elem, "stream-settings");
        this.props.append(inner);

        this.add_reset_button(this.props, { "disabled":()=>app.$._session._is_running });
        
        this.properties_ui = new ui.Row({
            "class":"stream-properties",
            "gap": 5,
            "align":"end",
            "hidden": ()=>app.$._session._is_running || app.$._session.type !== SessionTypes.INTERNAL
        })
        this.info_ui = new ui.UI({
            "class":"stream-info",
            "hidden": ()=>!app.$._session._is_running
        });
        left.append(this.properties_ui, this.info_ui);
        
        this.button_group_ui = new ui.FlexRow({gap:0, class:"border"});
        right.append(this.button_group_ui);

        var restart_elem = $(`<div>Restarting... [<span class="restart-time"></span>] <a class="restart-cancel" href="javascript:void(0)">Cancel</a></div>`)[0];
        this.on("update", ()=>{
            var restart_time = app.$._session.stream.restart;
            toggle_class(restart_elem, "d-none", restart_time == 0);
            set_text(restart_elem.querySelector(".restart-time"), `${restart_time}s`);
        });
        restart_elem.querySelector(".restart-cancel").addEventListener("click", ()=>{
            app.request({
                call: ["session", "stop_stream"],
            });
        });

        this.toggle_streaming_button = new ui.Button(null, {
            "id": "toggle-streaming",
            "title": "Start/Stop Streaming",
            "hover": ()=>{
                return !app.$._session._is_running && !this.props.valid;
            },
            "disabled": ()=>{
                return !app.$._session._is_running && !this.props.valid;
            },
            // "update":()=>{
            //     this.toggle_streaming_button.update_settings({"disabled": !app.$._session._is_running && !this.props.valid_visible})
            // },
            "click": (e)=>{
                if (app.$._session._is_running) {
                    app.request({
                        call: ["session", "stop_stream"],
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
            },
            "update": ()=>{
                var state = app.$._session.stream.state;
                if (state === constants.State.STOPPED) state = `START`;
                else if (state === constants.State.STARTED) state = `STOP`;
                else if (state === constants.State.STOPPING) state = `Stopping...`;
                else if (state === constants.State.STARTING) state = `Starting...`;
                // if (app.$._session.stream.restart) state = `Restarting (${app.$._session.stream.restart}s)...`;
                // this.toggle_streaming_button.elem.classList.toggle("started", (state === constants.State.STARTING || state === constants.State.STARTED));
                // this.toggle_streaming_button.elem.innerHTML = `<span>${state}</span>`;
                this.toggle_streaming_button.elem.innerHTML = state;
            },
        });
        this.schedule_stream_button = new ui.Button(`<button>Schedule</button>`, {
            "id": "schedule-stream",
            "click": (e)=>{
                app.schedule_stream_menu.show();
            },
            "disabled":()=>app.$._session._is_running,
            "hidden":()=>app.$._session._is_running
        });
        this.handover_button = new ui.Button(`<button>Handover</button>`, {
            "id": "handover-button",
            "click": async (e)=>{
                var modal = new HandoverSessionMenu();
                modal.show();
            },
            "hidden":()=>!app.$._session._is_running || app.$._session.type != SessionTypes.INTERNAL || app.$._stream.test
        });
        this.config_button = new ui.Button(`<button><i class="fas fa-cog"></i></button>`, {
            "id": "config-button",
            "title": "Stream Configuration",
            "click": async (e)=>{
                var modal = new StreamConfigurationMenu();
                modal.show();
            },
            "hidden":()=>!app.$._session._is_running || app.$._stream.test
        });
        var row = new ui.FlexRow({gap:0});
        set_style_property(row.elem, "flex-wrap", "nowrap");
        row.append(this.schedule_stream_button, this.handover_button, this.config_button);
        this.button_group_ui.append(restart_elem, this.toggle_streaming_button, row);

        function get_default() { return utils.try(()=>app.$.properties.stream_settings[this.name].__default__); }
        function get_options() {
            return utils.try(()=>app.$.properties.stream_settings[this.name].__options__) ?? (utils.try(()=>typeof app.$.properties.stream_settings[this.name].__default__) === "boolean" ? YES_OR_NO : []);
        }

        this.targets = new TargetsProperty({
            "name": "targets",
            "label": "Target(s)",
            "reset": true,
            "allow_empty": false,
            // "default": get_default,
        });

        this.properties_ui.append(this.targets);

        this.title = new ui.Property(`<input type="text">`, {
            "name": "title",
            "label": "Title",
            "default": get_default,
            "placeholder": ()=>/* app.$.session.default_stream_title || */ app.$._session.name,
            width: 200,
        });
        this.properties_ui.append(this.title)

        this.h264_preset = new ui.Property(`<select></select>`, {
            "name": "h264_preset",
            "label": "h264 Preset",
            "options": get_options,
            "default": get_default,
        });
        this.properties_ui.append(this.h264_preset)

        this.video_bitrate = new ui.Property(`<input type="number">`, {
            "name": "video_bitrate",
            "label": "Video Bitrate",
            "suffix": `kbps`,
            "step": 100,
            "min": 500,
            "max": 8000,
            "default": get_default,
            width: 140,
        });
        this.properties_ui.append(this.video_bitrate)

        this.audio_bitrate = new ui.Property(`<input type="number">`, {
            "name": "audio_bitrate",
            "label": "Audio Bitrate",
            "step": 1,
            "min": 64,
            "max": 320,
            "suffix": `kbps`,
            "default": get_default,
            width: 140,
        });
        this.properties_ui.append(this.audio_bitrate)

        this.stream_resolution = new ui.Property(`<select></select>`, {
            "name": "resolution",
            "label": "Resolution",
            "options": get_options,
            "default": get_default,
        });
        this.properties_ui.append(this.stream_resolution)

        this.frame_rate = new ui.Property(`<select></select>`, {
            "name": "frame_rate",
            "label": "Frame Rate",
            "options": get_options,
            "default": get_default,
        });
        this.properties_ui.append(this.frame_rate)

        this.experimental_mode = new ui.Property(`<select></select>`, {
            "name": "experimental_mode",
            "label": "Experimental Mode",
            "info": "Uses an alternative method to stream. Recommended to be left off.",
            "options": get_options,
            "default": get_default,
        });
        this.properties_ui.append(this.experimental_mode)

        this.use_hardware = new ui.Property(`<select></select>`, {
            "name": "use_hardware",
            "label": "Hardware Transcoding",
            "options": get_options,
            "default": get_default,
            "hidden": ()=>!this.experimental_mode.value
        });
        this.properties_ui.append(this.use_hardware)

        this.test_button = new ui.Button(`<button>Test</button>`, {
            "disabled": ()=>!app.$.processes["media-server"],
            "title": ()=>`Starts a test stream. `+(app.$.conf["test_stream_low_settings"] ? `Ignores h264 preset, bitrates & resolution settings, uses a medium quality preset instead.` : `Ignores targets.`),
            "click": ()=> {
                app.request({
                    call: ["session", "start_stream"],
                    arguments: [{ "test": true }],
                })
            },
        })
        this.properties_ui.append(this.test_button)

        this.props.on("change", (e)=>{
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
    
            var state;
            if (stream.state === "stopped") state = `Start`;
            else if (stream.state === "started") state = `Stop`;
            else if (stream.state === "stopping") state = `Stopping...`;
            else if (stream.state === "starting") state = `Starting...`;
            set_text(this.toggle_streaming_button, state);

            var stream_info = {};
            if (app.$._session.type === SessionTypes.INTERNAL) {
                let parts = {
                    "h264 Preset": `${stream["h264_preset"]}`,
                    "Video Bitrate": `${stream["video_bitrate"]}Kbps`,
                    "Audio Bitrate": `${stream["audio_bitrate"]}Kbps`,
                    "Resolution": `${stream["resolution"]}`,
                    "Experimental Mode": stream["experimental_mode"]?"Yes":"No"
                };
                if (stream["experimental_mode"]) {
                    parts["Use Hardware"] = `${stream["use_hardware"]?"Yes":"No"}`;
                }
                stream_info["Encoder Settings"] = Object.entries(parts).map(([k,v])=>`${k}: ${v}`).join(", ");
                
                if (stream["re"]) {
                    stream_info["Realtime"] =`${stream["re"]?"Yes":"No"}`;
                }
                if (stream["filename_evaluated"]) {
                    stream_info["Output Path"] = stream["filename_evaluated"] || "-";
                }
                stream_info["Frame Rate"] = `${stream["frame_rate"]}`;
            } else {
                var nms_session = app.$._session._get_connected_nms_session_with_appname("livestream", "external");
                if (nms_session) {
                    stream_info["Resolution"] = `${nms_session.videoWidth}x${nms_session.videoHeight}`;
                    stream_info["Frame Rate"] = `${nms_session["videoFps"]}`;
                }
            }
            // if (!stream["test"]) {
            stream_info["Target(s)"] = Object.keys(stream.targets).map((id)=>`${id} <span style="color:${stream.stream_targets[id]?"#00f":"f00"}">[${stream.stream_targets[id]?"OK":"NOT EXIST"}]</span>`).join(", ") || `<span style="color:#00f">NONE</span>`;
            if (stream.title) {
                stream_info["Title"] = stream.title;
            }
            // }
            var live_nms_session = stream._live_nms_session;
            if (live_nms_session) {
                var {live} = live_nms_session;
                if (live && live.url) {
                    stream_info["Live URL"] = `<a href="${live.url}" target="_blank">${live.url}</a>`;
                }
                /* if (live.thumbnail_url) {
                    stream_info["Thumbnail"] = `<a href="${live.thumbnail_url}" target="_blank">${new URL(live.thumbnail_url).pathname}</a>`;
                } */
            }
            var internal_session = app.$._session._get_connected_nms_session_with_appname("internal");
            if (internal_session) {
                let url = new URL(`${app.get_media_server_base_url()}${internal_session.publishStreamPath}`);
                // url.search = new URLSearchParams(internal_session.publishArgs);
                stream_info["Internal URL"] = `<a href="${url.toString()}" target="_blank">${url}</a>`;
            }
            stream_info["Bit Rate"] = utils.format_bytes_short(session.stream.bitrate, "k")+"ps";
            stream_info["Run Time"] = session._is_running ? utils.ms_to_timespan_str(session.stream._run_time) : 0;

            var hash = JSON.stringify(stream_info);
            if (hash !== last_stream_info_hash) {
                last_stream_info_hash = hash;
                utils.dom.rebuild(this.info_ui.elem, Object.keys(stream_info), {
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
        super("Media Player");
        this.props = new ui.PropertyContainer({
            "items": ()=>[app.$._session],
        });
        this.body_elem.append(this.props);

        add_class(this.elem, "player-interface-wrapper");

        var bg = $(`<div class="buttons border-group">
            <button class="show_live_feed icon" data-setting__show_live_feed title="Show/Hide Live Feed"><i class="fas fa-tv"></i></button>
            <button class="time_display_ms icon" data-setting__time_display_ms title="Show/Hide Milliseconds">MS</button>
            <button class="show_chapters icon" data-setting__show_chapters title="Show/Hide Chapters"><i class="fas fa-bookmark"></i></button>
        </div>`)[0];
        this.header_elem.append(bg);

        var test_container_el = $(`<div class="test-stream-container">
            <div class="test-stream">
                <div class="video-wrapper"></div>
                <div class="overlay">
                    <div class="buttons">
                        <button class="mini reload" title="Reload"><i class="fas fa-sync"></i></button>
                        <button class="mini popout" title="Pop-out Player"><i class="fas fa-external-link-alt"></i></button>
                        <button class="mini" data-setting__show_player_info title="Toggle Player Info"><i class="fas fa-circle-info"></i></button>
                    </div>
                </div>
                <span class="info"></span>
            </div>
        </div>`)[0];
        this.props.append(test_container_el);

        var media_ui = new ui.UI(`<div class="ui-wrapper"></div>`, {
            "hidden": ()=>app.$._session.type === SessionTypes.EXTERNAL,
        });
        this.props.append(media_ui);

        this.test_stream_container_elem = this.elem.querySelector(".test-stream-container");
        this.test_stream_elem = this.elem.querySelector(".test-stream");
        this.test_stream_video_wrapper = this.test_stream_elem.querySelector(".video-wrapper");
        this.test_stream_overlay_elem = this.test_stream_elem.querySelector(".overlay");
        this.test_stream_info_elem = this.test_stream_elem.querySelector(".info");
        this.test_stream_reload_button = this.test_stream_elem.querySelector("button.reload");
        this.test_stream_popout_button = this.test_stream_elem.querySelector("button.popout");

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
                var test_url = new URL("/blank.html", utils.dom.get_url(null, "main").toString());
                w = windows["test-"+id] = window.open(test_url, id, `width=${width},height=${height},scrollbars=1,resizable=1`);
                w.onload=()=>{
                    w.document.head.append($(`<title>Test Stream ${id}</title>`)[0]);
                    /* await */ utils.dom.clone_document_head(app.root_elem, w.document.head);
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
                    //+"\n"+utils.dom.get_all_css(document, true);
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
        media_ui.append(this.status_elem, this.chapters_elem);
        
        this.seek_controls_elem = $(`<div class="seek-controls"></div>`)[0];
        media_ui.append(this.seek_controls_elem);

        this.seek = new MediaSeekBar();
        this.seek_controls_elem.append(this.seek.elem);

        this.player_inline_elem = new ui.Row({class:"player-inline"}).elem;
        media_ui.append(this.player_inline_elem)
        
        this.player_controls_elem = new ui.UI(`<div class="player-button-wrapper"></div>`);
        this.player_inline_elem.append(this.player_controls_elem);
        
        this.player_controls_elem.append(
            this.prev_button = new ui.Button(`<button><i class="fas fa-step-backward"></i></button>`, {
                "title":"Previous Playlist Item",
                "class":"player-button",
                "click": (e)=>{
                    app.playlist_play(app.$._session._current_playing_item._previous);
                },
                "disabled":()=>!app.$._session._current_playing_item._previous
            }),
            this.backward_button = new ui.Button(`<button><i class="fas fa-backward"></i></button>`, {
                "title":"-30 Seconds",
                "class":"player-button",
                "click": (e)=>{
                    app.seek(-30, true);
                },
                "disabled":()=>!app.media.seekable || app.media.time_pos <= 0,
            }),
            this.toggle_play_pause_button = new ui.Button(null, {
                "title":"Play/Pause",
                "class":"player-button",
                "content": ()=>app.$._stream.mpv.context.props.pause ? `<i class="fas fa-play"></i>` : `<i class="fas fa-pause"></i>`,
                "click": (e)=>{
                    var new_pause = !app.$._stream.mpv.context.props.pause;
                    app.$._push([`sessions/${app.$._session.id}/stream/mpv/props/pause`, new_pause]);
                    app.request({
                        call: ["session", "mpv", "set_property"],
                        arguments: ["pause", new_pause]
                    });
                },
                "disabled":()=>!app.$._session._is_running,
            }),
            this.stop_button = new ui.Button(`<button><i class="fas fa-stop"></i></button>`, {
                "title":"Stop",
                "class":"player-button",
                "hidden":true,
                "click": (e)=>{
                    app.request({
                        call: ["session", "stop"],
                    });
                },
                "disabled": ()=>!app.$._session._is_running,
            }),
            this.forward_button = new ui.Button(`<button><i class="fas fa-forward"></i></button>`, {
                "title":"+30 Seconds",
                "class":"player-button",
                "click": (e)=>{
                    app.seek(30,true);
                },
                "disabled":()=>!app.media.seekable || app.media.time_left <= 0,
            }),
            this.next_button = new ui.Button(`<button><i class="fas fa-step-forward"></i></button>`, {
                "title":"Next Playlist Item",
                "class":"player-button",
                "click": (e)=>{
                    app.playlist_play(app.$._session._current_playing_item._next);
                },
                "disabled":()=>!app.$._session._current_playing_item._next
            }),
            this.prev_chapter_button = new ui.Button(`<button><i class="fas fa-fast-backward"></i></button>`, {
                "title":"Previous Chapter",
                "class":"player-button",
                "click": (e)=>{
                    app.seek_chapter(-1,true)
                },
                "disabled": ()=>app.media.chapters.length == 0 || app.media.time_pos <= app.media.chapters[0].start,
                "hidden": ()=>!app.settings.get("show_chapters") || app.media.chapters.length == 0
            }),
            this.next_chapter_button = new ui.Button(`<button><i class="fas fa-fast-forward"></i></button>`, {
                "title":"Next Chapter",
                "class":"player-button",
                "click": (e)=>{
                    app.seek_chapter(1,true)
                },
                "disabled": ()=>app.media.chapters.length == 0 || app.media.time_pos >= app.media.chapters[app.media.chapters.length-1].start,
                "hidden": ()=>!app.settings.get("show_chapters") || app.media.chapters.length == 0
            }),
            this.reload_button = new ui.Button(`<button><i class="fas fa-sync"></i></button>`, {
                "title":"Reload",
                "class":"player-button",
                "click": (e)=>{
                    app.request({
                        call: ["session", "reload"]
                    });
                },
                "disabled":()=>!app.$._session._is_running,
                "update": function(){
                    // toggle_class(this.elem, "pending", app.$.session.current_playing_item.userdata.pending_changes);
                }
            }),
            this.set_time_button = new ui.Button(`<button><i class="far fa-clock"></i></button>`, {
                "title":"Precise Seek",
                "class":"player-button",
                "click": (e)=>{
                    app.set_time_pos_menu.show();
                },
                "disabled":()=>!app.media.seekable,
            })
        );
        
        this.volume_wrapper = new ui.UI(`<div class="player-volume-wrapper"></div>`);
        this.player_inline_elem.append(this.volume_wrapper);

        this.volume = new ui.Property(`<div><input id="volume" type="range" value="100" title="Volume" style="width:100px"></div>`, {
            "name": "volume_target",
            "default": 100,
            "step": 1,
            "min": 0,
            "max": 200,
            "reset": false,
            "dblclick": ()=>this.volume.reset(),
            "nullify_defaults": true,
        });
        this.vol_speed = new ui.Property(`<select>`, {
            "name": "volume_speed",
            "title": "Volume Transition Speed",
            "default": 1.0,
            "reset": false,
            "options": [[0.5, "Very Slow"], [1.0, "Slow"], [2.0, "Medium"], [4.0, "Fast"], [8.0, "Very Fast"], [0, "Immediate"]],
            "hidden": true,
            "nullify_defaults": true,
        });
        /** @param {ui.PropertyChangeEvent} e */
        var on_volume_prop_change = (e)=>{
            if (e.trigger) {
                app.$._push([`sessions/${app.$._session.id}/${e.name}`, e._value]);
                app.request({
                    call:["session", "update_values"],
                    arguments: [[e.name, e._value]]
                });
            }
            this.set_volume_button.update();
        }
        this.volume.on("change", (e)=>on_volume_prop_change(e));
        this.vol_speed.on("change", (e)=>on_volume_prop_change(e));
        
        this.vol_down_button = new ui.Button(`<button><i class="fas fa-volume-down"></i></button>`, {
            "class":"player-button",
            "title":"Volume - 5%",
            "disabled": ()=>this.volume.value <= this.volume.get_setting("min"),
            "click": (e)=>{
                this.volume.set_values(utils.ceil_to_factor(this.volume.value-VOLUME_STEP,VOLUME_STEP), {trigger:true});
            }
        });
        
        /* this.vol_input = new ui.Property(`<input type="number">`, {
            "default": 100,
            "step": 1,
            "min": 0,
            "max": 200,
            "reset": false,
        })
        this.volume.input_modifiers.push(v=>Math.round(parseFloat(v)));
        this.volume.output_modifiers.push(v=>v+"%"); */
        this.set_volume_button = new ui.Button(null, {
            "class":"player-button",
            "content": ()=>`<span style="font-size:10px">${Math.round(this.volume.value)}%</span>`,
            "click": (e)=>{
                new SetVolumeSettings().show();
            }
        });
        
        this.vol_up_button = new ui.Button(`<button><i class="fas fa-volume-up"></i></button>`, {
            "class":"player-button",
            "title":"Volume + 5%",
            "disabled": ()=>this.volume.value >= this.volume.get_setting("max"),
            "click": (e)=>{
                this.volume.set_values(utils.floor_to_factor(this.volume.value+VOLUME_STEP,VOLUME_STEP), {trigger:true});
            }
        })
        
        /* this.mute_button = new ui.Button(`<button><i class="fas fa-volume-xmark"></i></button>`, {
            "class":"player-button",
            "title":"Mute",
            "hidden": true,
            "click": (e)=>{
                var new_muted = !app.$.stream.mpv.context.muted;
                app.request({
                    call:["session", "stream", "mpv", "set_property"],
                    arguments: ["muted", new_muted]
                });
                app.$.push([`sessions/${app.$.session.id}/mpv/muted`, new_muted]);
            },
            "update":function() {
                toggle_class(this.elem, "mute", !!app.$.stream.mpv.context.muted);
            }
        }); */
        this.volume_wrapper.append(this.set_volume_button, this.vol_down_button, this.volume, this.vol_up_button /*,this.mute_button */, this.vol_speed);
        
        this.stats_elem = $(`<div class="stats">`)[0];
        media_ui.append(this.stats_elem);
        
        // this.fader_controls_elem = $(`<div class="fader-controls"></div>`)[0];
        // this.body.append(this.fader_controls_elem);

        var wrap = new utils.dom.WrapDetector(this.player_inline_elem);
        
        this.on("destroy", ()=>{
        });

        this.on("update", ()=>{
            var started = app.$._session._is_running;
            set_inner_html(this.status_prefix_elem, `${app.media.status}: `);
            app.build_playlist_breadcrumbs(this.status_path_elem, app.$._session._current_playing_item, true, true);
            
            var stats_html = Object.entries(app.media.stats).map(([k,v])=>`<span>${k}: ${v}</span>`).join(" | ");
            set_inner_html(this.stats_elem, stats_html);
            toggle_class(this.stats_elem, "d-none", !started);
            // toggle_class(this.status_elem, "d-none", app.$._session._current_playing_item.id == -1);

            toggle_class(this.test_stream_info_elem, "d-none", !app.settings.get("show_player_info"));
            toggle_class(this.elem, "chapters-available", app.media.chapters.length > 0);
            
            if (app.media.chapters.length) {
                this.chapters_elem.style.display = "";
                let html = `Chapter(s): `+(app.media.curr_chapters.map(c=>app.chapter_to_string(c)).join(" | ") || "-");
                set_inner_html(this.chapters_elem, `<span>${html}</span>`);
            } else {
                this.chapters_elem.style.display = "none";
            }

            this.refresh_player();
        });
    }

    async refresh_player(force) {
        
        var test_video_url = new URL(`/internal/${app.$._session.id}.flv`, utils.dom.get_url(null, "media-server", true));
        var show = !!(app.$._session._is_running && !app.$._stream._is_only_gui);
        toggle_class(this.elem, "live-feed-available", show);
        if (!app.settings.get("show_live_feed")) show = false;
        var is_popped_out = !!windows["test-"+app.$._session.id];
        var is_playable = !!(show && app.$._session._get_connected_nms_session_with_appname("internal"));

        toggle_class(this.test_stream_container_elem, "d-none", !show);
        toggle_class(this.test_stream_overlay_elem, "d-none", !is_playable);
        toggle_class(this.test_stream_popout_button, "d-none", is_popped_out);
        // this.test_stream_popout_button.dataset.toggled = is_popped_out;
        
        var buffer_length = this.video_buffer_length;
        set_inner_html(this.test_stream_info_elem, `Buffered: ${buffer_length ? buffer_length.toFixed(2) : "-"} secs`);

        if (!force && (!!this.flv_player == is_playable)) return;

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
                url: test_video_url.toString(),
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
        this.update();
        this.props.update_layout(this.interface.get_layout());
    }

    constructor() {
        super("Media Settings", {
            "hidden": ()=>app.$._session.type === SessionTypes.EXTERNAL,
        });

        var item = ()=>app.$._session._current_playing_item;
        /* var header = new ui.Header(`<p><span>Modifying:</span> <span class="current-item"></span> <a class="modify" href="javascript:void(0);" title="Modify..."><i class="fas fa-wrench"></i></a></p>`, {
            "render":()=>{
                app.build_playlist_breadcrumbs(header_item_el, item(), true, true);
            },
            "hidden": ()=>this._mode === MediaSettingsMode.all || item().id == -1,
        });
        var header_item_el = header.elem.querySelector(".current-item");
        var modify_el = header.elem.querySelector(".modify");
        modify_el.onclick = ()=>{
            app.playlist_modify_menu.show(item());
        }
        this.body.append(header); */

        this.props = new ui.PropertyContainer({
            "nullify_defaults": true,
            "items": ()=>(this._mode === MediaSettingsMode.current) ? [item().props] : [app.$._session.player_default_override],
        });
        this.body.append(this.props);

        this.add_reset_button(this.props);

        this.header_elem.append($(`<div class="buttons border-group">
            <button class="player-settings-toggle-current mini" title="Current File Media Settings">current</button>
            <button class="player-settings-toggle-default mini" title="Default Media Settings">all</button>
        </div>`)[0]);
        
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
        
        this.props.on("change", (e)=>{
            if (!e.name || !e.trigger) return;
            app.request({
                call: ["session","set_player_property"],
                arguments: [e.name, e.value, this._mode === MediaSettingsMode.current]
            });
            /* if (this._mode === MediaSettingsMode.all) {
                app.$.push([`sessions/${app.$.session.id}/player_default_override/${e.name}`, e._value]);
            } else {
                app.$.push([`sessions/${app.$.session.id}/stream/mpv/props/${e.name}`, e._value]);
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
        this.logs_wrapper.append(this.logs_container);

        this._levels = {
            info: {
                title: "Information",
                // color: "#ccc",
                default: true,
                icon: `<i class="fas fa-info-circle"></i>`
            },
            warn: {
                title: "Warning",
                color: "orange",
                default: true,
                icon: `<i class="fas fa-triangle-exclamation"></i>`
            },
            error: {
                title: "Error",
                color: "red",
                default: true,
                icon: `<i class="fas fa-circle-exclamation"></i>`
            },
            debug: {
                title: "Debug",
                color: "green",
                default: false,
                icon: `<i class="fas fa-bug"></i>`
            },
        }
        
        this._logs = {};
        this._num_logs = 0;
        this._default_logger_settings = {
            dates: false,
            times: true,
            ...Object.fromEntries(Object.entries(this._levels).map(([k,v])=>[k,v.default]))
        };
        this._logger_settings = utils.json_copy(this._default_logger_settings)
        this.i = 0;
    
        this.storage_name = `log-viewer-settings:${this.panel_id}`;
        add_class(this.logs_container, "thin-scrollbar");
        $(this.logs_wrapper).resizable({handles:"s"});

        var button_defs = [
            [
                {
                    key: "dates",
                    inner: `<button><i class="fas fa-calendar"></i></button>`,
                    title:"Show Dates",
                },
                {
                    key: "times",
                    inner: `<button><i class="fas fa-clock"></i></button>`,
                    title:"Show Times",
                }
            ],
            Object.entries(this._levels)
                .map(([k,v])=>({
                    key: k,
                    inner: `<button>${v.icon}</button>`,
                    title: v.title,
                }))
        ];

        this.header_elem.append(...button_defs.map(g=>{
            var group_elem = $(`<div class="buttons border-group"></div>`)[0];
            group_elem.append(...g.map(b=>{
                var button = new ui.Button(b.inner, {
                    "title": b.title,
                    "click": ()=>{
                        if (b.click) b.click();
                        this._logger_settings[b.key] = !this._logger_settings[b.key];
                        this.save();
                    },
                    "render": ()=>{
                        if (this._logger_settings[b.key]) delete button.elem.dataset.toggled;
                        else button.elem.dataset.toggled = 1;
                    }
                });
                button.elem.classList.add("icon");
                return button;
            }))
            return group_elem;
        }));

        this.load();

        this.on("render", ()=>{
            for (var k in this._logger_settings) {
                toggle_attribute(this.logs_wrapper, `data-show-${k}`, this._logger_settings[k]);
            }
        });
    }

    /** @param {{level:string, message:string, ts:Number}[]} logs */
    update_logs(logs) {
        var scroll_bottom = utils.dom.scroll_y_percent(this.logs_container) == 1;
        this._new_log_elems = [];
        for (var id in logs) {
            var log = logs[id];
            if (!log) continue;
            var d = new Date(log.ts);
            var log_hash = JSON.stringify([log.message, log.level]);
            /** @type {HTMLElement} */
            var log_elem;
            if (this.last_log_elem && this.last_log_elem._log_id === log_hash) {
                log_elem = this.last_log_elem;
            } else {
                log_elem = $(`<p><span class="date"></span><span class="time"></span><span class="level"></span><span class="number"></span><span class="prefix"></span><span class="message"></span></p>`)[0];
                this.i++;
                if (!this._logs[log.level]) this._logs[log.level] = {total:0, elems:{}};
                this._logs[log.level].total++;
                this._logs[log.level].elems[id] = log_elem;
            }
            log_elem.dataset.number = +(log_elem.dataset.number || 0) + 1;
            log_elem.dataset.level = log.level;
            log_elem.querySelector(".date").textContent = `[${d.toLocaleDateString("en-GB")}]`;
            log_elem.querySelector(".time").textContent = `[${d.toLocaleTimeString("en-GB")}]`;
            log_elem.querySelector(".number").textContent = (+log_elem.dataset.number > 1) ? log_elem.dataset.number : "";
            log_elem.querySelector(".prefix").textContent = log.prefix.map(p=>`[${p}]`).join("");
            
            var message = log_elem.querySelector(".message");
            var message_html = "";
            
            var level = this._levels[log.level];
            if (level.color) log_elem.style.color = level.color;
            message_html += terminalCodesToHtml(log.message).replace(/\n/g,"<br>");
            message.innerHTML = message_html;
            log_elem._log_id = log_hash
            this.last_log_elem = log_elem;
            var level_icon_elem = log_elem.querySelector(".level");
            level_icon_elem.innerHTML = level.icon;
            level_icon_elem.title = level.title;

            this.logs_container.append(log_elem);

            if (this._logs[log.level].total > LOGS_MAX_PER_LEVEL) {
                var k = utils.first_key(this._logs[log.level].elems);
                this._logs[log.level].elems[k].remove();
                delete this._logs[log.level].elems[k];
                this._logs[log.level].total--;
            }
        }
        if (scroll_bottom) utils.dom.scroll_y_percent(this.logs_container, 1);
        this.update();
    }

    save() {
        app.settings.set(this.storage_name, this._logger_settings);
        this.update();
    }

    load() {
        this._logger_settings = utils.json_copy({ ...this._default_logger_settings, ...app.settings.get(this.storage_name) });
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
    _updates = 0;
    constructor() {
        super("Stream Metrics");

        this.body_elem.classList.add("chart-wrapper", "no-padding");
        this.body_elem.style.gap = 0;

        var modes = {
            "speed": {
                "icon": `<span>SPEED</span>`,
                "title": `Speed`
            },
            "bitrate": {
                "icon": `<span>BITRATE</span>`,
                "title": `Bitrate`,
            }
        };
        
        var button_group = $(`<div class="buttons border-group">`)[0];
        Object.entries(modes).forEach(([t,d])=>{
            var button = $(`<button class="mini" title="${d.title}">${d.icon}</button>`)[0];
            button.onclick = ()=>set_mode(t);
            button_group.append(button);
            d.button = button;
        });
        this.header_elem.append(button_group);
        this.#mode = modes[0];

        var set_mode = (mode)=>{
            if (this.#mode === mode) return;
            this.#mode = mode;
            for (var [key,d] of Object.entries(modes)) {
                d.button.toggleAttribute("data-toggled", mode != key);
            }
            this.update();
        };
        set_mode("speed");
        
        var inner_el = $(`<div class="chart-inner"></div>`)[0];
        /** @type {HTMLCanvasElement} */
        this.canvas = $(`<canvas id="chart"></canvas>`)[0];
        this.chart_info_elem = $(`<div class="chart-info"></div>`)[0];
        this.chart_info_elem.classList.add("thin-scrollbar");

        inner_el.append(this.canvas)
        this.body_elem.append(inner_el, this.chart_info_elem);

        var button_group = $(`<div class="buttons border-group">`)[0];
        button_group.append($(`<button class="icon" data-setting__show_metrics_info title="Toggle Encoder Info"><i class="fas fa-info-circle"></i></button>`)[0]);
        this.header_elem.append(button_group);

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
    #parse_key(key) {
        var o = key.split(":")
        var last = o.pop();
        return [o.join(":"), last];
    }

    #update_chart() {
        // var pause = app.settings.get("pause_metrics");
        // if (pause) return;

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

        let metrics = app.$._session.stream.metrics;
        var data_hash = JSON.stringify([mode_hash, reinit_hash, this._updates]);
        if (this._data_hash === data_hash) return;
        this._data_hash = data_hash;
        
        let raw_data = Object.fromEntries(Object.entries(metrics).filter(([k,v])=>k.split(":").pop()===this.#mode));
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
        this.#update_pan(reset);
        this.chart.update();
    }
    #format_value(value) {
        var type = this.#mode;
        // var type = ds.label.split(":").pop();
        if (type == "speed") return `${value.toFixed(3)}x`;
        if (type == "bitrate") return utils.format_bytes_short(value, "k");
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
            var table = utils.dom.build_table(info_rows);
            set_children(this.chart_info_elem, [table]);
        }
    }
}

export const PLAYLIST_ZOOM_MIN = 0.01;
export const PLAYLIST_ZOOM_MAX = 100;
export const PLAYLIST_ZOOM_BASE = 1.3333;
export class PlaylistPanel extends Panel {
    
    /** @type {any[]} */
    #tracks;
    #tracks_hash;
    /** @type {PlaylistItem[]} */
    #next_selection = [];

    get active_sortable() { return this.sortables.find(s=>s.is_active_sortable_in_group()) || this.sortables[0]; }
    get active_track_index() { return this.sortables.indexOf(this.active_sortable); }
    get timeline_width() { return Math.max(...[...this.tracks_elem.children].map(t=>t.lastElementChild ? t.lastElementChild.offsetLeft+t.lastElementChild.offsetWidth : 0)); }
    get tracks() { return this.#tracks; }
    get orientation() { return this.playlist_display_as_timeline ? ResponsiveSortable.HORIZONTAL : ResponsiveSortable.VERTICAL; }
    get playlist_display_as_timeline() { return this.playlist_display_mode_select.value == 1; }
    get selection() { return this.active_sortable.get_selection(); }
    
    #current_id;
    /** @return {PlaylistItem} */
    get current() { return app.$._session.playlist[this.#current_id] || app.$._session.playlist["0"] || NULL_PLAYLIST_ITEM; }

    /** @type {utils.dom.DropdownMenu} */
    context_menu;

    /** @param {Element} elem */
    constructor() {
        super("Playlist", {
            "hidden": ()=>app.$._session.type === SessionTypes.EXTERNAL
        });

        this.collapsible = false;
        this.clipping = null;

        this.header_elem
        this.header_elem.innerHTML =
            `<span>Playlist</span>
            <span class="playlist-time-total" title='Playlist Total Duration'></span>
            <span class="playlist-time-left"title='Playlist Time Remaining'></span>
            <span class="gap"></span>`;

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
                    <button id="pl-add-url" title="Add URLs...">Add URLs...</button>
                    <button id="pl-upload-file" title="Upload...">Upload...</button>
                    <button id="pl-add-other" title="Other..."><i class="fas fa-ellipsis-v"></i></button>
                </div>
            </div>`
        add_class(this.body_elem, "playlist-body");
        add_class(this.elem, "playlist-wrapper");
        
        this.zoom = 1.0;
        /** @type {ResponsiveSortable[]} */
        this.sortables = [];
        this.duration = 0;
        this.time = null;
        
        this.header_elem.append(...$(
            `<div class="timeline-controls buttons border-group">
                <button class="playlist-goto-playhead icon" title="Go to Playhead"><i class="fas fa-map-marker"></i></button>
            </div>
            <div class="timeline-controls buttons border-group">
                <input class="playlist-zoom-input mini" type="text"></input>
                <button class="playlist-zoom-into icon" title="Zoom Into Selection"><i class="fas fa-arrows-alt-h"></i></button>
                <button class="playlist-zoom-out icon" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
                <button class="playlist-zoom-in icon" title="Zoom In"><i class="fas fa-search-plus"></i></button>
            </div>
            <div class="buttons border-group">
                <select data-setting__playlist_display_mode class="playlist-display-mode mini" title="Playlist Display Mode">
                    <option default value="0">List</option>
                    <option value="1">Timeline</option>
                </select>
            </div>
            <div class="buttons border-group">
                <button class="icon" data-setting__playlist_sticky title="Toggle Sticky Mode"><i class="fas fa-thumbtack"></i></button>
                <button class="icon" data-setting__wrap_playlist_items title="Toggle Line Wrap"><i class="fas fa-level-down-alt"></i></button>
                <button class="icon" data-setting__show_extra_playlist_icons title="Toggle Media Info Icons"><i class="far fa-play-circle"></i></button>
            </div>`
        ));
        
        {
            let build_title = (text, e)=>{
                var text = [text]
                if (e) {
                    text.push(e.name);
                    // text.push(`${e.changes} changes`);
                }
                return text.join(" | ");
            }
            let g = $(`<div class="buttons border-group"></div>`)[0]
            var undo = new ui.Button(`<button class="icon"><i class="fas fa-arrow-left"></i></button>`, {
                "disabled": ()=>!app.$._session.playlist_history._prev,
                "click": ()=>app.playlist_undo(),
                "title": ()=>build_title(`Playlist Undo [Ctrl+Z]`, app.$._session.playlist_history._prev),
            });
            var redo = new ui.Button(`<button class="icon"><i class="fas fa-arrow-right"></i></button>`, {
                "disabled": ()=>!app.$._session.playlist_history._next,
                "click": ()=>app.playlist_redo(),
                "title": ()=>build_title(`Playlist Redo [Ctrl+Y]`, app.$._session.playlist_history._next),
            });
            g.append(undo, redo)
            this.header_elem.append(g);
        }

        this.timeline_container_elem = this.elem.querySelector(".timeline-container");
        this.wrapper_elem = this.elem.querySelector(".timeline-and-ticks-wrapper");
        this.tracks_elem = this.elem.querySelector(".timeline-tracks");
        this.ticks_elem = this.elem.querySelector(".timeline-ticks");
        this.headers_elem = this.elem.querySelector(".timeline-headers");
        this.overlay_elem = this.elem.querySelector(".timeline-overlay");
        this.ticks_elem.title = `Place Timeline Cursor`;
        
        this.playhead_elem = this.elem.querySelector(".timeline-playhead");
        this.cursor_elem = this.elem.querySelector(".timeline-cursor");
        this.limits_elem = this.elem.querySelector(".timeline-limits");
        this.highlights_elem = this.elem.querySelector(".timeline-highlights");
        
        this.playlist_time_total_elem = this.elem.querySelector(".playlist-time-total");
        this.playlist_time_left_elem = this.elem.querySelector(".playlist-time-left");

        this.playlist_info_wrapper_elem = this.elem.querySelector(".playlist-info-wrapper");
        
        // this.pl_toggle_sticky_button = this.playlist_wrapper_elem.querySelector(".playlist_sticky");
        this.playlist_display_mode_select = this.elem.querySelector(".playlist-display-mode");
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
            var sortable = ResponsiveSortable.closest(e.target);
            if (sortable) {
                e.preventDefault();
                e.stopPropagation();
                this.open_context_menu(e);
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
        this.playlist_display_mode_select.addEventListener("change", (e)=>{
            app.settings.set("playlist_display_mode", +this.playlist_display_mode_select.value);
            this.sortables.forEach(s=>s.orientation = this.orientation);
            this.update();
            this.scroll_to_playhead();
        });
        app.settings.on("change", (e)=>{
            if (e.name === "playlist_display_mode") {
                if (this.playlist_display_mode_select.value != e.new_value) {
                    this.playlist_display_mode_select.value = e.new_value;
                    this.playlist_display_mode_select.dispatchEvent(new Event("change"));
                }
            }
        })
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
            var files = await utils.dom.open_file_dialog({multiple:true}) // directories:true
            app.playlist_add(files.map(file=>({file})));
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

        this.commands = {
            play: new PlaylistCommand({
                "label": "Play",
                "icon": `<i class="fas fa-play"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    app.playlist_play(items[0]);
                },
                "shortcut": "P",
            }),
            info: new PlaylistCommand({
                "label": "Information",
                "icon": `<i class="fas fa-info-circle"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    app.playlist_info_menu.show(items);
                },
                "shortcut": "I",
            }),
            modify: new PlaylistCommand({
                "label": "Modify...",
                "icon": `<i class="fas fa-sliders-h"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    if (items.length == 0 || !items.every(i=>i._is_modifiable)) return;
                    app.playlist_modify_menu.show(items);
                },
                "shortcut": "M",
            }),
            delete_item: new PlaylistCommand({
                "label": "Delete",
                "icon": `<i class="fas fa-trash-alt"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    app.playlist_remove(items);
                },
                "shortcut": "Delete",
            }),
            rescan: new PlaylistCommand({
                "label":  "Rescan",
                "description": "Rescans the media for information",
                "icon": `<i class="fas fa-sync-alt"></i>`,
                "visible": (items)=>items.some(i=>i._is_scannable),
                // "disabled": (items)=>!items.every(i=>i.is_scannable),
                "click": (items)=>{
                    app.playlist_rescan(items);
                },
                "shortcut": "R",
            }),
            reveal: new PlaylistCommand({
                "label": "Navigate To",
                "description": "File: Open the File Manager | URL: Open the source URL",
                "icon": `<i class="fas fa-arrow-up-right-from-square"></i>`,
                "visible": (items)=>items.some(i=>i._url.protocol.match(/^(file|https?):$/)),
                "disabled": (items)=>!items.every(i=>i._is_navigatable),
                "click": (items)=>{
                    app.navigate_to(items.map(i=>i.filename));
                },
                "shortcut": "Ctrl+F",
            }),
            download: new PlaylistCommand({
                "label": "Download",
                "description": "Download the source onto disk",
                "icon": `<i class="fas fa-download"></i>`,
                "visible": (items)=>items.some(i=>i._is_downloadable),
                // "disabled": (items)=>!items.every(i=>i.is_downloadable),
                "click": (items)=>{
                    app.playlist_download(items);
                },
            }),
            cancel_download: new PlaylistCommand({
                "label": "Cancel Download",
                "icon": `<i class="fas fa-ban"></i>`,
                "visible": (items)=>items.some(i=>i._download),
                "click": (items)=>{
                    app.playlist_cancel_download(items);
                }
            }),
            cancel_upload: new PlaylistCommand({
                "label": "Cancel Upload",
                "icon": `<i class="fas fa-ban"></i>`,
                "visible": (items)=>items.some(i=>i._upload && i._upload.status == UPLOAD_STATUS.STARTED),
                "click": (items)=>{
                    app.playlist_cancel_upload(items);
                }
            }),
            rename: new PlaylistCommand({
                "label": "Rename",
                "icon": `<i class="fas fa-i-cursor"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    if (items[0]) this.rename(items[0]);
                },
                "shortcut": "F2",
            }),
            edit_playlist: new PlaylistCommand({
                "label": "Enter Playlist",
                "icon": `<i class="fas fa-right-to-bracket"></i>`,
                "visible": (items)=>items.some(i=>i._is_playlist),
                // "disabled": (items)=>!items.every(i=>i.is_playlist),
                "click": (items)=>{
                    if (items[0]) this.open(items[0]);
                },
                "shortcut": "Enter",
            }),
            add_to_playlist: new PlaylistCommand({
                "label": "Add to New Playlist",
                "icon": `<i class="far fa-object-group"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    app.playlist_group(items);
                },
                "shortcut": "Ctrl+G",
            }),
            breakdown_playlist: new PlaylistCommand({
                "label": "Breakdown Playlist",
                "icon": `<i class="far fa-object-ungroup"></i>`,
                "visible": (items)=>items.some(i=>i._is_playlist),
                // "disabled": (items)=>!items.every(i=>i.is_playlist),
                "click": (items)=>{
                    app.playlist_breakdown(items);
                },
                "shortcut": "Ctrl+U",
            }),
            split: new PlaylistCommand({
                "label": "Split...",
                "icon": `<i class="fas fa-sitemap" style="transform:rotate(-90deg);"></i>`,
                "visible": (items)=>items.some(i=>i._is_splittable),
                "disabled": (items)=>!items.every(i=>i._is_splittable),
                "click": (items)=>{
                    app.split_menu.show(items);
                }
            }),
            slice_at_timeline_cursor: new PlaylistCommand({
                "label": "Slice at Timeline Cursor",
                "icon": `<i class="fas fa-slash"></i>`,
                "visible": (items)=>this.playlist_display_as_timeline && this.cursor_position != null,
                "disabled": (items)=>!items.every(i=>i._is_splittable),
                "click": (items)=>{
                    app.playlist_split(items, [this.cursor_position], false, true);
                },
                "shortcut": "S",
                "mode": PLAYLIST_VIEW.TIMELINE,
            }),
            /* timeline_cursor_play: new Command({
                "label": "Play from Cursor",
                "icon": `<i class="fas fa-play"></i>`,
                "visible": this.timeline_mode && this.playlist.cursor_position != null,
                "click": ()=>{
                    this.playlist_play()
                }
            }), */
            timeline_cursor_to_start: new PlaylistCommand({
                "label": "Set Timeline Cursor to Start",
                "icon": `<i class="fas fa-arrow-right-to-bracket" style="transform:scaleX(-1);"></i>`,
                "visible": (items)=>items.length>0 && this.playlist_display_as_timeline,
                "click": (items)=>{
                    this.cursor_position = Math.min(...items.map(i=>i._userdata.timeline_start));
                    this.#update_view();
                },
                "mode": PLAYLIST_VIEW.TIMELINE,
            }),
            timeline_cursor_to_end: new PlaylistCommand({
                "label": "Set Timeline Cursor to End",
                "icon": `<i class="fas fa-arrow-right-to-bracket"></i>`,
                "visible": (items)=>items.length>0 && this.playlist_display_as_timeline,
                "click": (items)=>{
                    this.cursor_position = Math.max(...items.map(i=>i._userdata.timeline_end));
                    this.#update_view();
                },
                "mode": PLAYLIST_VIEW.TIMELINE,
            }),
            clipboard_copy: new PlaylistCommand({
                "label": "Copy",
                "description": "Copy to clipboard",
                "icon": `<i class="fas fa-copy"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.selection_to_clipboard(false)
                },
                "shortcut": "Ctrl+C",
            }),
            clipboard_cut: new PlaylistCommand({
                "label": "Cut",
                "description": "Cut to clipboard",
                "icon": `<i class="fas fa-cut"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.selection_to_clipboard(true)
                },
                "shortcut": "Ctrl+X",
            }),
            clipboard_paste: new PlaylistCommand({
                "label": "Paste",
                "description": "Paste from Clipboard",
                "icon": `<i class="fas fa-paste"></i>`,
                // "visible": (items)=>true,
                "visible": (items)=>!!this.clipboard,
                "click": (items)=>{
                    this.clipboard_paste();
                },
                "shortcut": "Ctrl+V",
            }),
            clipboard_clear: new PlaylistCommand({
                "label": "Clear Clipboard",
                "icon": `<i class="far fa-clipboard"></i>`,
                "visible": (items)=>!!this.clipboard,
                "click": (items)=>{
                    this.clipboard_clear();
                },
            }),
            move_to_top: new PlaylistCommand({
                "label": "Move to Start",
                "icon": ()=>`<i class="fas fa-angle-double-${this.playlist_display_as_timeline?"left":"up"}"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.move_selection_to_start();
                },
                "shortcut": "Alt+Home",
            }),
            move_up: new PlaylistCommand({
                "label": "Move Back",
                "icon": ()=>`<i class="fas fa-angle-${this.playlist_display_as_timeline?"left":"up"}"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.move_selection_back();
                },
                "shortcut": ()=>`Alt+Arrow${this.playlist_display_as_timeline?"Left":"Up"}`,
            }),
            move_down: new PlaylistCommand({
                "label": "Move Forward",
                "icon": ()=>`<i class="fas fa-angle-${this.playlist_display_as_timeline?"right":"down"}"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.move_selection_forward();
                },
                "shortcut": ()=>`Alt+Arrow${this.playlist_display_as_timeline?"Right":"Down"}`,
            }),
            move_to_bottom: new PlaylistCommand({
                "label": "Move to End",
                "icon": ()=>`<i class="fas fa-angle-double-${this.playlist_display_as_timeline?"right":"down"}"></i>`,
                "visible": (items)=>items.length>0,
                "click": (items)=>{
                    this.move_selection_to_end();
                },
                "shortcut": "Alt+End",
            }),
            undo: new PlaylistCommand({
                "label": "Undo",
                "description": "Undo the previous recorded action",
                "icon": ()=>`<i class="fas fa-arrow-left"></i>`,
                "disabled": ()=>!app.$._session.playlist_history._prev,
                "click": ()=>app.playlist_undo(),
                "visible": false,
                "shortcut": "Ctrl+Z",
            }),
            redo: new PlaylistCommand({
                "label": "Redo",
                "description": "Redo the next recorded action",
                "icon": ()=>`<i class="fas fa-arrow-right"></i>`,
                "disabled": ()=>!app.$._session.playlist_history._next,
                "click": ()=>app.playlist_redo(),
                "visible": false,
                "shortcut": "Ctrl+Y",
            }),
            focus: new PlaylistCommand({
                "label": "Focus",
                "click": (items)=>{
                    this.zoom_into_selected_playlist_items()
                },
                "shortcut": "F",
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            playlist_back: new PlaylistCommand({
                "label": "Parent Playlist",
                "click": (items)=>{
                    this.back();
                },
                "shortcut": "Backspace | Escape",
            }),
            // ------------------------------
            add_empty: new PlaylistCommand({
                "label": ()=>"Add Empty",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": ()=>{
                    app.playlist_add({
                        filename:"livestreamer://empty",
                        props: {
                            background_mode: "default"
                        }
                    });
                }
            }),
            add_playlist: new PlaylistCommand({
                "label": ()=>"Add Empty Playlist",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": ()=>{
                    app.playlist_add({
                        filename:"livestreamer://playlist",
                    });
                }
            }),
            add_rtmp: new PlaylistCommand({
                "label": ()=>"Add RTMP Stream",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": ()=>{
                    app.playlist_add({
                        filename:"livestreamer://rtmp",
                    });
                },
                "disabled": ()=>!!this.current._is_merged
            }),
            add_intertitle: new PlaylistCommand({
                "label": ()=>"Add Intertitle",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://intertitle",
                    });
                    // this.playlist_modify_settings.show(ids);
                },
                "disabled": ()=>!!this.current._is_merged
            }),
            add_stop_streaming_macro: new PlaylistCommand({
                "label": ()=>"Add Macro: Stop",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://macro",
                        props: {
                            function: "stop"
                        }
                    });
                },
                "disabled": ()=>!!this.current._is_merged
            }),
            add_handover_macro: new PlaylistCommand({
                "label": ()=>"Add Macro: Handover",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://macro",
                        props: {
                            function: "handover"
                        }
                    });
                },
                "disabled": ()=>!!this.current._is_merged
            }),
            add_playlist_exit: new PlaylistCommand({
                "label": ()=>"Add Playlist Exit",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async ()=>{
                    var ids = await app.playlist_add({
                        filename:"livestreamer://exit",
                    });
                },
                "visible": ()=>!!this.current._parent
            }),
            unload_current: new PlaylistCommand({
                "label": ()=>"Unload Current File",
                "icon": `<i class="fas fa-minus-circle"></i>`,
                "disabled": ()=>app.$._session._current_playing_item === NULL_PLAYLIST_ITEM,
                "click": ()=>app.playlist_play(NULL_PLAYLIST_ITEM),
            }),
            rescan_all: new PlaylistCommand({
                "label": ()=> "Rescan All",
                "icon": `<i class="fas fa-sync-alt"></i>`,
                // "click": ()=>app.playlist_rescan_all(),
                "click": ()=>app.playlist_rescan(this.current._children),
            }),
            save_playlist: new PlaylistCommand({
                "label": ()=>"Save Playlist...",
                "icon": `<i class="fas fa-save"></i>`,
                "click": ()=>app.save_playlist_menu.show(),
            }),
            generate_schedule: new PlaylistCommand({
                "label": ()=>"Generate Schedule...",
                "icon": `<i class="fas fa-calendar-alt"></i>`,
                "click": ()=>app.schedule_generator_menu.show()
            })
        }

        var menu = new utils.dom.DropdownMenu({
            target: this.pl_add_other_button,
            items:()=>{
                var c = this.commands;
                return [
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
            }
        });

        for (let color_key in item_colors) {
            let color = item_colors[color_key] || "#fff";
            this.commands[`color_${color_key}`] = new PlaylistCommand({
                "click": (items)=>{
                    var v = color_key === "none" ? null : color_key;
                    items.map(i=>i.props.color = v);
                    var changes = items.map(i=>[`${i.id}/props/color`, v]);
                    app.playlist_update(changes)
                },
                "render":(items, elem)=>{
                    add_class(elem, "color");
                    var colors = new Set(items.map(i=>i.props.color||"none"));
                    var inner = colors.has(color_key) ? ((colors.size == 1) ? `✓` : "-") : "";
                    var el = $(`<div class="color" style="background: ${color}; outline: 1px solid #ddd; text-align: center;">${inner}</div>`)[0];
                    elem.append(el);
                },
                "title": utils.capitalize(color_key),
            })
        }
        
        /*  move_to_bottom: new PlaylistCommand({
            "label": "Move to End",
            "description": "Move Selection to End",
            "icon": ()=>`<i class="fas fa-angle-double-${this.timeline_mode?"right":"down"}"></i>`,
            "visible": (items)=>items.length>0,
            "click": (items)=>{
                this.move_selection_to_end();
            },
            "shortcut": "Alt+End",
        }), */
        
        this.timeline_container_elem.addEventListener("wheel", (e)=>{
            if (!this.playlist_display_as_timeline) return;
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
            if (utils.dom.has_focus(this.timeline_container_elem)) {
                this.try_command_shortcut(e);
            }
        }, true);

        var on_scroll;
        // window.addEventListener("resize", ()=>this.#update_position());
        app.main_elem.addEventListener("scroll", on_scroll=()=>this.#update_position());
        var resize_observer = new ResizeObserver(()=>this.#update_position());
        var parent_el, last_current;

        this.on("update", async()=>{

            if (this.elem.parentElement != parent_el) {
                parent_el = this.elem.parentElement;
                if (parent_el) resize_observer.observe(parent_el);
            }
            if (!this.current || this.current._session != app.$._session) {
                this.open(null);
            }
            if (last_current != this.current) {
                if (this.playlist_display_as_timeline && this.clipping) {
                    this.set_timeline_view([this.clipping.start, this.clipping.end], this.time);
                }
            }

            var current = this.current;
            var current_ud = current._userdata;
            var duration = current_ud.duration;
            var timeline_duration = current_ud.timeline_duration;
            var self_and_parents = [app.$._session._current_playing_item, ...app.$._session._current_playing_item._parents];
            var a_index = self_and_parents.indexOf(current);
            var timeline_time = utils.sum(self_and_parents.slice(0, a_index).map(item=>utils.try(()=>item._userdata.timeline_start)||0)) + Math.min(app.$._session.time_pos, app.$._session._current_playing_item._userdata.timeline_duration);
            var time = utils.sum(self_and_parents.slice(0, a_index).map(item=>utils.try(()=>item._userdata.start)||0)) + Math.min(app.$._session.time_pos, app.$._session._current_playing_item._userdata.duration);
    
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

            var wait;
            if (this.sortables.some(s=>s.dragging)) {
                wait = Promise.all(this.sortables.map(s=>s.last_drag))
                    .then(()=>utils.timeout(500));
            } else {
                wait = Promise.resolve();
            }
            wait.then(()=>{
                this.#rebuild_items();
                this.#update_info();
            });
            last_current = this.current;
        });

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

        this.#tracks_hash = tracks_hash;
        this.#tracks = tracks;
        utils.dom.empty(this.tracks_elem);
        utils.dom.empty(this.headers_elem);
        utils.dom.empty(this.highlights_elem);
        this.sortables.forEach(s=>s.destroy());

        toggle_class(this.timeline_container_elem, "single-track", num_tracks == 1);

        this.sortables = tracks.map((t,i)=>{
            // var playlist_top = $(`<div class="playlist-top" title="${utils.capitalize(t.name)}">${t.icon}</div>`)[0];
            // playlist_track.append(playlist_top);
            var playlist_elem = $(`<ul class="playlist"></ul>`)[0];
            this.tracks_elem.append(playlist_elem);

            var playlist_header = $(`<div>${t.header}</div>`)[0];
            playlist_header.title = t.title || t.header;
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
                this.sync_positions();
            });
            return sortable;
        });
        if (this.sortables[0]) this.sortables[0].set_active_sortable_in_group();
    }

    /** @param {Element} elem */
    scroll_into_view(elem, opts) {
        opts = {
            force: false,
            ...opts
        };
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

        /* if (opts.force) {
            var key = (this.orientation === ResponsiveSortable.VERTICAL) ? "top" : "left"
            var r1 = elem.getBoundingClientRect();
            var r2 = this.tracks_elem.getBoundingClientRect();
            this.tracks_elem.scrollBy(0, r1[key] - r2[key]);
        } */
        /* var bottom = app.main_elem.offsetHeight-40;
        if (r.bottom > bottom) {
            app.main_elem.scrollBy(0, r.bottom-bottom);
        } */
    }

    #rebuild_items() {
        // console.log("rebuild", Date.now());
        let is_running = app.$._session._is_running;
        var current_playlist = this.current;
        var current_playlist_tracks = current_playlist._tracks;
        /** @type {PlaylistItem} */
        var current_item = app.$._session._current_playing_item;
        var current_item_parents = new Set(current_item._parents);

        this.set_tracks(current_playlist_tracks.length, current_playlist && current_playlist.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK);

        var new_items = [];
        var changed = false;
        this.sortables.forEach((sortable,i)=>{
            /** @type {PlaylistItem[]} */
            var items = current_playlist_tracks[i] || EMPTY_ARRAY;
            utils.dom.rebuild(sortable.el, items, {
                add: (item, elem, index)=>{
                    if (!elem) {
                        new_items.push(item);
                        elem = $(`<li class="item"><div><div class="clips"></div><div class="front"><span class="play-icons"></span><span class="icons"></span><span class="filename"></span><span class="extra"></span><span class="badges"></span><div class="duration"></div></div></div></li>`)[0];
                    }
                    var ud = item._userdata;
                    var is_current_item = item.id == current_item.id;
                    var is_current_ancestor = current_item_parents.has(item);
                    var is_cutting = !!(this.clipboard && this.clipboard.cutting && this.clipboard.items_set.has(item));
                    var is_buffering = app.media.buffering;
                    let media_info = item._media_info || EMPTY_OBJECT;
                    
                    var _hash = JSON.stringify([index, item, item._hash, is_current_item, is_current_ancestor, is_cutting, is_running, is_buffering, media_info]);
                    if (_hash === elem._hash) return;

                    elem._hash = _hash;
                    elem._item = item;
                    
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
                    var is_uploading = !!item.upload_id;
                    
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
                            if (is_buffering) play_icons.push(`<i class="fas fa-circle-notch fa-spin"></i>`);
                            else play_icons.push(`<i class="fas fa-play"></i>`);
                        } else {
                            play_icons.push(`<i class="fas fa-forward-step"></i>`);
                        }
                    } else {
                        play_icons.push(`<span class="numbering">${String(index+1).padStart(2,"0")}</span>`);
                    }
                    
                    if (!is_uploading) {
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
                        icon.title = item.filename;
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
                        let upload = item._upload;
                        let download = item._download;
                        let d = null, t = null;
                        if (download) {
                            d = download
                            t = "download";
                        } else if (upload) {
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
                    if (!duration_str) {
                        if (ud.duration || ud.media_duration) duration_str = utils.seconds_to_timespan_str(ud.duration || ud.children_duration, "h?:mm:ss");
                    }

                    set_inner_html(duration_elem, duration_str || "  -  ");
                    
                    if (problems.length) {
                        var problem_groups = utils.group_by(problems, p=>p.level);
                        var err_icon_html;
                        if (problem_groups.has(3)) err_icon_html = `<i class="fas fa-times" style="color:red;"></i>`;
                        else if (problem_groups.has(2)) err_icon_html = `<i class="fas fa-exclamation-triangle" style="color:orange;"></i>`;
                        else if (problem_groups.has(1)) err_icon_html = `<i class="fas fa-question-circle" style="color:#6495ED;"></i>`;
                        if (err_icon_html) {
                            let icon = $(err_icon_html)[0];
                            icon.title = problems.map(p=>" - "+p.text).join("\n");
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
                    elem.title = title_parts.join(" ");
                    toggle_class(elem, "current", is_current_item);
                    
                    changed = true;
    
                    return elem;
                },
                remove:(elem)=>{
                    var sortable = ResponsiveSortable.closest(elem);
                    if (sortable) sortable.deselect(elem);
                    elem.remove();
                    changed = true;
                }
            });
        });
        if (changed) {
            this.emit("change");
        }
        this.emit("rebuild");
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
        this.sync_positions();
    }
    move_selection_back() {
        var elems = this.get_selection();
        var first_index = Math.max(0,utils.dom.get_index(elems[0])-1);
        elems.forEach((e,i)=>utils.dom.insert_at(e.parentElement, e, first_index+i));
        this.scroll_into_view(elems[0]);
        this.sync_positions();
    }
    move_selection_forward() {
        var elems = this.get_selection();
        var last_index = Math.min(elems[0].parentElement.childElementCount, utils.dom.get_index(elems[elems.length-1])+2);
        elems.forEach((e,i)=>utils.dom.insert_at(e.parentElement, e, last_index));
        this.scroll_into_view(elems[elems.length-1])
        this.sync_positions();
    }
    move_selection_to_end() {
        var elems = this.get_selection();
        elems.forEach((e,i)=>e.parentElement.append(e));
        elems.forEach(e=>this.scroll_into_view(e));
        this.sync_positions();
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
    
    open_context_menu(e) {
        this.context_menu = new utils.dom.DropdownMenu({
            items: ()=>{
                var items = this.get_selection_datas();
                var c = this.commands;
                var menu_groups = [
                    [c.play, c.info, c.modify, c.rescan, c.reveal, c.split, c.rename, c.delete_item],
                    [c.download, c.cancel_download, c.cancel_upload],
                    [c.edit_playlist, c.breakdown_playlist, c.add_to_playlist],
                    [/* c.timeline_cursor_play,*/ c.slice_at_timeline_cursor, c.timeline_cursor_to_start, c.timeline_cursor_to_end],
                    [c.clipboard_copy, c.clipboard_cut, c.clipboard_paste, c.clipboard_clear],
                    [c.move_to_top, c.move_up, c.move_down, c.move_to_bottom],
                    [c.undo, c.redo],
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
                return menu_items;
            },
            params: ()=>this.get_selection_datas(),
            parent: document.body,
            x: e.clientX,
            y: e.clientY,
        });
        this.context_menu.show();
    }

    sync_positions() {
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
        var items = clipboard.items.filter(i=>!i._is_deleted);
        if (clipboard.cutting) {
            this.clipboard = null;
            app.playlist_move(items);
        } else {
            app.playlist_add(items);
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
        var orig_html = filename.innerHTML;
        var default_name = item._get_pretty_name({label:false});

        filename.contentEditable = true;
        set_inner_html(filename, item.props.label || default_name);
        filename.focus();
        window.getSelection().selectAllChildren(filename);
        var blur_listener, keydown_listener;
        filename.addEventListener("keydown", keydown_listener = (e)=>{
            if (e.key === "Escape") {
                filename.innerHTML = orig_html;
                filename.blur();
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                filename.blur();
            }
        });
        filename.addEventListener("blur", blur_listener = ()=>{
            filename.contentEditable = false;
            filename.removeEventListener("blur", blur_listener);
            filename.removeEventListener("keydown", keydown_listener);
            var new_name = filename.innerText.trim();
            if (!new_name || new_name == default_name) new_name = null;
            set_inner_html(filename, `<span>${new_name || default_name}</span>`);

            if (old_name != new_name) {
                app.playlist_update([[`${item.id}/props/label`, new_name]]);
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
            ResponsiveSortable.closest(elem).click(elem, false, i!=0);
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
        return this.get_selection().map(e=>utils.dom.get_index(e));
    }
    get_first_selected_data() {
        return this.get_selection_datas()[0];
    }

    /** @param {PlaylistItem} item */
    async open(item, selection = []) {
        if (!item) item = app.$._session.playlist["0"];
        if (!item._is_playlist) return;
        this.sortables.forEach(s=>s.forget_last_active());
        this.#current_id = item.id;
        this.cursor_position = null;
        item.__private.hash_on_open = item._calculate_contents_hash();
        this.once("rebuild", ()=>{
            this.set_selection(selection);
        });
        this.update();
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
        if (this.playlist_display_as_timeline) {
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

export class Area extends ui.Column {
    constructor(elem, settings) {
        super(elem, settings);
        add_class(this.elem, "area");
        add_class(this.elem, `area-${app.areas.length+1}`);
        app.areas.push(this);
    }
}

export class MainWebApp extends utils.EventEmitter {
    /** @type {MainWebApp} */
    static instance;

    get playlist_item_props_class() { return utils.try(()=>this.$.properties.playlist.__enumerable__.props); }
    get focused_element() { return this.root_elem.activeElement; }
    get dev_mode() { return this.$.conf["debug"] || new URLSearchParams(window.location.search.slice(1)).has("dev"); }
    get is_os_gui() { return this.$.sysinfo.platform.match(/^win/i); }
    
    $ = new Remote();

    constructor() {
        super();

        app = MainWebApp.instance = this;

        this.root = new ui.UI(document.body);

        Chart.register(zoomPlugin);
        // Chart.register(annotationPlugin);
        
        Sortable.mount(new MultiDrag(), CancelSortPlugin);
        
        window.onbeforeunload = (e)=>{
            if (ALL_XHRS.size) return `Uploads are in progress, leaving will abort the uploads.`;
            // return "";
        };

        if (IS_ELECTRON) {
            window.prompt = async (message, default_value)=>{
                var result = await fancybox_prompt(message, default_value);
                if (result) return result;
                else return null;
            };
        }

        this.settings_groups = {
            playlist: {
                title: "Playlist",
            },
            media_player: {
                title: "Media Player",
            },
            metrics: {
                title: "Stream Metrics",
            },
            misc: {
                title: "Misc.",
            },
        }
        this.settings_prop_defs = {
            "playlist_display_mode": {
                __group__: "playlist",
                __input__: "<select>",
                __title__: "Display Mode",
                __default__: 0,
                __options__: [[0, "List"], [1, "Timeline"]],
            },
            "playlist_sticky": {
                __group__: "playlist",
                __input__: "<select>",
                __title__: "Sticky",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "show_extra_playlist_icons": {
                __group__: "playlist",
                __input__: "<select>",
                __title__: "Show Codecs",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "wrap_playlist_items": {
                __group__: "playlist",
                __input__: "<select>",
                __title__: "Line Wrap",
                __default__: false,
                __options__: YES_OR_NO,
            },
            "show_live_feed": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Show Live Feed",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "show_player_info": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Show Live Feed Info",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "time_display_ms": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Show Milliseconds",
                __default__: false,
                __options__: YES_OR_NO,
            },
            "show_chapters": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Show Chapters in Seekbar",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "media_time_left_mode": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Seek Bar Time Remaining Mode",
                __default__: TimeLeftMode.TIME_LEFT,
                __options__: [[0, "Time Remaining"], [1, "Duration"]],
            },
            "media_seek_time_interpolation": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Seek Bar Time Interpolation",
                __default__: true,
                __options__: YES_OR_NO,
            },
            "show_metrics_info": {
                __group__: "metrics",
                __input__: "<select>",
                __title__: "Show Info",
                __default__: true,
                __options__: YES_OR_NO,
            },
            /* "pause_metrics": {
                __group__: "metrics",
                __input__: "<select>",
                __title__: "Pause",
                __default__: false,
                __options__: YES_OR_NO,
            }, */
            "sessions_display_mode": {
                __group__: "misc",
                __input__: "<select>",
                __title__: "Sessions Display Mode",
                __default__: "tabs",
                __options__: [["tabs","Tabs"],["select","Dropdown"]],
            },
            "open_file_manager_in_new_window": {
                __group__: "misc",
                __input__: "<select>",
                __title__: "Open File Manager in New Window",
                __default__: false,
                __options__: YES_OR_NO,
            },
        }
        var settings_defaults = Object.fromEntries(Object.entries(this.settings_prop_defs).map(([k,v])=>[k, v.__default__]));
        // console.log(settings_defaults);
        
        this.settings = new utils.dom.LocalStorageBucket("livestreamer-1.0", {
            ...settings_defaults,
            "layout": null,
            "session_order": null,
            "last_session_id": null
        });
        this.passwords = new utils.dom.LocalStorageBucket("livestreamer-passwords");

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
        /** @type {Record<PropertyKey,TargetConfigMenu>} */
        this.target_config_menus = {};
        this.advanced_functions = [];

        this.main_elem = this.elem.querySelector(".main");
        this.show_help_button = this.root_elem.querySelector("#show-help");
        this.show_config_button = this.root_elem.querySelector("#show-config");
        this.show_admin_button = this.root_elem.querySelector("#show-admin");
        toggle_class(this.show_admin_button, "d-none", true); // !app.user.is_admin
        this.session_elem = this.root_elem.querySelector("#session");
        this.session_controls_wrapper_elem = this.root_elem.querySelector(".session-controls-wrapper");
        this.session_controls_elem = this.root_elem.querySelector("#session-controls");
        this.session_load_save_elem = this.root_elem.querySelector("#session-load-save");
        new ui.UI(this.session_load_save_elem, {
            "hidden": this.$._session.type === SessionTypes.EXTERNAL
        })
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
        this.session_tabs_elem = this.root_elem.querySelector("#session-tabs");
        this.session_select = this.root_elem.querySelector("#session-select");
        this.users_elem = this.root_elem.querySelector("#users");
        this.request_loading_elem = this.root_elem.querySelector("#request-loading");
        
        var session_ui = new ui.Column();
        var row1 = new ui.Row();
        row1.append(new Area());
        var row2 = new ui.Row();
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
        this.configure_targets_menu = new TargetMenu();
        this.configure_external_session_menu = new ExternalSessionConfigurationMenu();
        this.user_config_menu = new UserConfigurationSettings();
        this.admin_menu = new AdminSettings();
        this.set_time_pos_menu = new SetTimePosSettings();
        this.playlist_info_menu = new InfoSettings();
        this.change_log_menu = new ChangeLog();
        this.split_menu = new SplitSettings();
        this.uploads_downloads_menu = new UploadsDownloadsMenu();
        
        // this.fonts_menu = new FontSettings();

        new LocalMediaServerTargetConfigMenu();
        new FileTargetConfigMenu();
        new GUITargetConfigMenu();

        this.session_password = new (class extends ui.UI {
            constructor(...a) {
                super(...a);
                let row = new ui.FlexRow();
                this.password = new ui.Property(`<input type="text">`, {
                    "label": "Password",
                    "default": "",
                    "reset": false,
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
                this.password.outer_el.append(button);
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
                        if (utils.dom.has_touch_screen() || e.target.closest("button,input,select")) return true;
                    }
                },
                onEnd: ()=>this.save_layout(),
                preventOnFilter: false,
            });
        }
        
        this.session_sortable = new ResponsiveSortable(this.session_tabs_elem, {
            fallbackTolerance: 3, // So that we can select items on mobile
            animation: 150,
            // filter: ".unmovable",
            handle: ".handle",
            onEnd: (evt)=>{
                if (this.$.conf["session_order_client"]) {
                    this.settings.set("session_order", [...this.session_tabs_elem.children].map(e=>e.dataset.id));
                } else {
                    this.request({
                        call: ["rearrange_sessions"],
                        arguments: [evt.oldIndex, evt.newIndex]
                    });
                }
            },
        });

        this.footer_buttons = new ui.Row().elem;
        this.main_elem.append(this.footer_buttons);
        set_style_property(this.footer_buttons, "justify-content", "end");

        {
            let row = new ui.Row({
                "gap": 0,
                "hidden": ()=>!(app.$.processes["file-manager"] || IS_ELECTRON)
            });
            
            if (!IS_ELECTRON) {
                row.append(
                    new ui.Button(`<button><i class="fas fa-folder-tree"></i></button>`, {
                        "click": ()=>{
                            app.file_system_info_menu.show();
                        },
                        "title": ()=>app.file_system_info_menu.modal_title
                    })
                )
                row.append(
                    new ui.Link(`<a class="button">File Manager</a>`, {
                        "href": ()=>get_file_manager_url(),
                        "click": (e)=>{
                            e.preventDefault();
                            open_file_manager({ new_window:true, standalone:true, hidden_id:"file-manager-standalone" });
                        }
                    })
                );
            }
            this.footer_buttons.append(row);
        }
        
        /* this.footer_buttons.append(
            new ui.Button(`<button>Font Manager</button>`, {
                "click": ()=>app.fonts_menu.show()
            })
        ) */
        this.footer_buttons.append(
            new ui.Button(`<button>Configure Targets</button>`, {
                "click": ()=>this.configure_targets_menu.show()
            }),
            new ui.Button(`<button>System Manager</button>`, {
                "click": ()=>this.system_manager.show()
            }),
            /* new ui.Button(`<button>Advanced Functions</button>`, {
                "click": ()=>this.advanced_functions_menu.show()
            }), */
            new ui.Button(`<button>Uploads & Downloads</button>`, {
                "click": ()=>this.uploads_downloads_menu.show()
            }),
            new ui.Button(`<button>Controls</button>`, {
                "click": ()=>this.keyboard_shortcuts_menu.show()
            }),
            new ui.Button(`<button>Change Log</button>`, {
                "click": ()=>this.change_log_menu.show(),
                /** @this {UI} */
                "update": function() {
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
            new ui.Button(`<button>Setup External Session</button>`, {
                "click": ()=>this.configure_external_session_menu.show()
            }),
        );
    
        this.loader.update({text:"Connecting..."});

        this.settings.on("change", (e)=>{
            var k = e.name;
            var v = e.new_value;
            console.log(k,v);
            if (k.includes(":")) {
                if (k.startsWith("drawer:")) {
                    var panel = this.panels[k.slice(7)];
                    if (panel) panel.toggle(!v);
                }
            } else {
                for (var w of [window, ...Object.values(windows)]) {
                    var body = w.document.body;
                    var type = typeof v;
                    var inputs = ["input", "select", "textarea"];
                    for (var c of inputs.map(i=>[...w.document.querySelectorAll(`${i}[data-setting__${k}]`)]).flat()) {
                        c.value = v;
                    }
                    if (type === "boolean") {
                        toggle_attribute(body, `data-setting__${k}`, v);
                        for (var c of [...w.document.querySelectorAll(`button[data-setting__${k}]`)]) {
                            if (v) delete c.dataset.toggled;
                            else c.dataset.toggled = 1;
                        }
                    } else if (type != "object" && type != "function") {
                        set_attribute(body, `data-setting__${k}`, v);
                    }
                }
            }
            this.update();
        });

        this.passwords.on("change", (e)=>{
            this.update();
        });

        this.root.elem.addEventListener("click", (e)=>{
            /** @type {HTMLElement} */
            var elem = e.target;
            var data_setting_prefix = "data-setting__";
            var data_setting_key;
            var get_data_setting_attribute = (e)=>{
                for (var attr of e.attributes) {
                    if (attr.nodeName.startsWith(data_setting_prefix)) {
                        data_setting_key = attr.nodeName.slice(data_setting_prefix.length);
                        return true;
                    }
                }
            }
            utils.dom.closest(elem, (e)=>e.matches("button") && get_data_setting_attribute(e));
            if (data_setting_key) {
                this.settings.toggle(data_setting_key);
            }
            // if (elem.matches("a")) {
            //     var url = utils.dom.get_anchor_url(e.target);
            //     var file_manager_url = utils.dom.get_url(null, "file-manager");
            //     if (url.host === file_manager_url.host && url.pathname === "/index.html") {
            //         console.log(utils.try_file_uri_to_path(url).toString());
            //         open_file_manager({start: utils.try_file_uri_to_path(url).toString()})
            //         console.log(e.target);
            //         e.preventDefault();
            //     }
            //     /* if (url.host === window.location.host && url.pathname === "/index.html" && url.hash) {
            //         this.try_attach_to(url.hash.slice(1));
            //         e.preventDefault();
            //     } */
            // }
        });

        this.session_select.addEventListener("change", ()=>{
            window.location.hash = `#${this.session_select.value}`;
        })
        
        Object.assign(Fancybox.defaults, {parentEl: this.body_elem});
        
        window.addEventListener("keydown", this.on_keydown = (e)=>{
            if (!isNaN(e.key) && e.ctrlKey) {
                var sessions = this.sessions_ordered;
                var i = +e.key-1;
                this.try_attach_to(sessions[i] ? sessions[i].id : null);
            } else if (e.key === "s" && e.ctrlKey) {
                this.save_session();
            } else if (e.key === "z" && e.ctrlKey) {
                this.playlist_undo();
            } else if (e.key === "y" && e.ctrlKey) {
                this.playlist_redo();
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
            this.session_config_menu.show(this.$._session);
        });

        this.destroy_session_button.addEventListener("click", (e)=>{
            if (confirm(`Are you sure you want to delete Session '${this.$._session.name}'?`)) {
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

        /** @type {Session} */
        var curr;
        this.session_tabs_elem.addEventListener("contextmenu", (e) => {
            var elem = this.session_sortable.get_item(e.target);
            if (!elem) return;
            e.preventDefault();
            curr = this.$.sessions[elem.dataset.id];
            var menu = new utils.dom.DropdownMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                    {
                        label: ()=>`ID: ${curr.id}`,
                        click: ()=>window.navigator.clipboard.writeText(curr.id),
                    }
                ]
            });
            menu.show();
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

        this.show_help_button.addEventListener("click", async (e)=>{
            e.preventDefault();
            this.toggle_help();
        });

        this.show_config_button.addEventListener("click", ()=>this.user_config_menu.show());

        this.show_admin_button.addEventListener("click", ()=>this.admin_menu.show());

        window.addEventListener("hashchange", ()=>{
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
        
        this.passwords.load();
        this.settings.load();
        
        var key = new URL(window.location.href).searchParams.get("ls_key");
        var ws_url = utils.dom.get_url(null, "main", true);
        var session_id = window.location.hash.slice(1) || this.settings.get("last_session_id");
        if (session_id) ws_url.searchParams.set("session_id", session_id);
        if (key) ws_url.searchParams.set("ls_key", key);

        this.ws = new utils.dom.WebSocket();
        this.ws.on("open", ()=>{
            this.$ = new Remote();
            this.$.on("update", (changes)=>this.#update(changes));
        });
        this.ws.on("data", (data)=>{
            if (data.$) this.$._push(data.$);
        });
        this.ws.on("close", ()=>{
            this.#update();
            this.loader.update({visible:true, text:"Lost connection..."});
            Fancybox.close(true);
        });
        
        this.tick_interval = setInterval(()=>this.tick(), 1000/10);
        
        this.update_layout();

        this.root.update();

        for (let p of plugins) {
            p.then((d)=>new (d.default)());
        }
        this.ws.connect(ws_url.toString());
    }

    update = utils.debounce(this.#update, 0);

    #update(changes = {}) {

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

        // if (this.$._last_session && !this.$.sessions[this.$._last_session.id]) {
        //     alert(`'${this.$._last_session.name}' was terminated internally or by another user.`);
        // }
        if (client_changes && "session_id" in client_changes && client_changes.session_id != last_session_id) {
            window.location.hash = client_changes.session_id || "";
        }

        utils.dom.set_dataset_value(this.session_elem, "session-type", this.$._session.type);
        toggle_class(this.session_elem, "d-none", is_null_session);
        toggle_class(this.session_inner_elem, "d-none", !has_access);
        toggle_class(this.session_controls_wrapper_elem, "d-none", is_null_session);
        toggle_class(this.no_sessions_elem, "d-none", !is_null_session && has_access);
        toggle_class(this.no_sessions_elem.querySelector(".no-session"), "d-none", !has_access);
        toggle_class(this.no_sessions_elem.querySelector(".no-access"), "d-none", has_access);
        toggle_class(this.no_sessions_elem.querySelector(".owner"), "d-none", has_access);
        set_inner_html(this.no_sessions_elem.querySelector(".owner"), `This session is owned by ${access_control._owners.map(u=>`[${u.username}]`).join(" | ")}`);
        this.session_password.hidden = (has_access || !requires_password);

        toggle_attribute(this.load_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.save_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.history_session_button, "disabled", !has_access || !has_ownership);
        
        toggle_class(this.sign_out_session_button, "d-none", has_ownership || !(requires_password && has_access));
        toggle_attribute(this.config_session_button, "disabled", !has_access || !has_ownership);
        toggle_attribute(this.destroy_session_button, "disabled", !has_ownership);

        toggle_class(this.app_log_section, "d-none", !this.$._client.is_admin);

        if (is_new_session) {
            this.session_logger.empty();
            this.session_password.password.reset();
        }

        this.#rebuild_sessions();
        this.#rebuild_clients();

        if (session_changes) {
            if (session_changes.logs) {
                this.session_logger.update_logs(Object.fromEntries(Object.keys(session_changes.logs).map(k=>[k,this.$._session.logs[k]])));
            }
            if (session_changes.stream){
                if (session_changes.stream.metrics) {
                    this.metrics._updates++;
                }
            }
        }
        
        if (changes.logs !== undefined) {
            if (this.app_logger) {
                this.app_logger.update_logs(Object.fromEntries(Object.keys(changes.logs).map(k=>[k,this.$.logs[k]])));
            }
        }
        if (changes.uploads) {
            for (var id in changes.uploads) {
                var ul = this.$.uploads[id];
                if (!ul || ul.status === UploadStatus.CANCELED) {
                    this.upload_queue.cancel(id);
                }
            }
        }

        {
            let ids = [];
            if (changes.downloads) {
                ids.push(...Object.keys(changes.downloads));
            }
            if (changes.uploads) {
                ids.push(...Object.keys(this.$._session.playlist).filter(id=>Object.keys(changes.uploads).includes(id)).map(i=>i.id));
            }
            if (changes.nms_sessions) {
                ids.push(...this.playlist.current._children.filter(i=>i.filename==="livestreamer://rtmp").map(i=>i.id));
            }
            if (session_changes) {
                if (session_changes.playlist) {
                    ids.push(...Object.keys(session_changes.playlist));
                }
                if (session_changes.media_info) {
                    ids.push(...Object.entries(this.$._session.playlist).filter(([id,item])=>item._filenames.some(f=>session_changes.media_info[f])).map(([id,item])=>id));
                }
                if (session_changes.playlist_id !== undefined) {
                    ids.push(this.playlist.current.id, this.$._session.playlist_id);
                }
            }
            for (var id of new Set(ids)) {
                var item = this.$._session.playlist[id];
                if (item) item.__private.clear_userdata();
            }
        }
        
        if (!utils.is_empty(changes)) {
            this.emit("change", changes);
        }

        this.media.update();
        this.root.update();
        this.tick();
    }

    get_media_server_base_url() {
        var host = this.$.hostname;
        var port = this.$.conf["rtmp_port"];
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
        this.update();
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
            var start = local_times ? 0 : ud.start;
            var duration = ud.duration;
            var end = start + duration;
            // var segment_start = start;
            var segment_end = start;
            for (var i = 0; i <= splits.length; i++) {
                var segment_start = segment_end;
                segment_end = (i < splits.length) ? splits[i] : end;
                var d = Math.max(0, segment_end - segment_start);
                // console.log(i, d);
                // var segment = [segment_start, segment_end];
                if (!(utils.almost_equal(segment_start, start) && utils.almost_equal(segment_end, end)) && segment_start >= start && segment_end <= end && d>0 && !utils.almost_equal(d, 0)) {
                    var new_item = item._copy();
                    new_item.props.clip_offset = clip_offset;
                    new_item.props.clip_loops = d / clip_length;
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
    async playlist_breakdown(items) {
        if (!Array.isArray(items)) items = [items];
        items = items.filter(item=>item._is_playlist);
        if (!items.length) return;

        // var affected_ids = [];
        var changes = {}
        items.forEach((item)=>{
            var children = item._children;
            children.forEach((c)=>{
                // affected_ids.push(c.id);
                changes[c.id] = {parent_id: item.parent_id, track_index: item.track_index};
            });
            var parent_items = item._parent._get_track(item.track_index);
            var i = parent_items.indexOf(item);
            parent_items.splice(i, 1, ...children);
            parent_items.forEach((p,i)=>{
                if (!changes[p.id]) changes[p.id] = {};
                changes[p.id].index = i;
            });
        });
        items.forEach((item)=>changes[item.id] = null);
        this.playlist_update(changes);
    }

    /** @typedef {{insert_pos:number, track_index:number, parent:PlaylistItem}} PlaylistInsertOptions */
    /** @param {PlaylistItem[]} items @param {PlaylistInsertOptions} opts */
    async playlist_move(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let {track_index, insert_pos, parent} = this.get_playlist_insert_options(opts);
        var old_session_id = items[0]._session.id;
        var new_session_id = parent._session.id;

        var all = items.map(i=>[{id:i.id, parent:parent.id}, ...i._descendents.map(d=>({id:d.id, parent:d.parent_id}))]).flat();
        var is_circular = utils.is_circular(all);
        if (is_circular) {
            alert("Detected circular parent-child loop. Aborting operation.");
            return;
        }

        var affected = new Set(items);
        var parent_items = parent._get_track(track_index);
        parent_items = parent_items.map(item=>affected.has(item)?null:item);
        if (old_session_id == new_session_id) {
            parent_items.splice(insert_pos, 0, ...items);
            parent_items = parent_items.filter(i=>i);
            var data = Object.fromEntries(parent_items.map((item,i)=>[item.id, {index:i, track_index, parent_id:parent.id}]));
            await this.playlist_update(data);
        } else {
            await new Promise.all([
                this.playlist_remove(items),
                this.playlist_add(items, {insert_pos, track_index})
            ]);
        }
    }

    /** @param {any[]} items @param {PlaylistInsertOptions} opts */
    playlist_add(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let {track_index, insert_pos, parent} = this.get_playlist_insert_options(opts);

        /** @type {PlaylistItem[]} */
        var new_items = [];
        var add_file = async (data, index, parent_id, track_index)=>{
            let id = utils.dom.uuid4();
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
                        filename = file.name;
                        file.id = id;
                        this.upload_queue.add(file, {
                            first_and_last_pieces_first: !!file.name.match(/\.mp4$/i),
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
        }).then(()=>{
            this.playlist.once("rebuild", ()=>{
                this.playlist.set_selection(new_items);
            });
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
        for (var [session_id, group] of utils.group_by(items, i=>i._session.id)) {
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
    async playlist_update(changes) {
        var session_id = app.$._session.id;
        changes = utils.tree_from_pathed_entries(changes);
        // recursviely remove any changes where identical to the original values.
        changes = cull_equal_props(changes, this.$.sessions[session_id].playlist);
        if (changes) {
            this.$._push([`sessions/${session_id}/playlist`, changes]);
            this.request({
                call: ["sessions", session_id, "playlist_update"],
                arguments: [changes]
            });
        }
    }

    async playlist_undo() {
        var h = this.$._session.playlist_history;
        if (h.position <= h.start) return;
        var session_id = app.$._session.id;
        // this.$._push([`sessions/${session_id}/playlist_history/pos`, h.position - 1]);
        this.request({
            call: ["sessions", session_id, "playlist_undo"],
        });
    }

    async playlist_redo() {
        var h = this.$._session.playlist_history;
        if (h.position >= h.end) return;
        var session_id = app.$._session.id;
        // this.$._push([`sessions/${session_id}/playlist_history/pos`, h.position + 1]);
        this.request({
            call: ["sessions", session_id, "playlist_redo"],
        });
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
        item = item ?? NULL_PLAYLIST_ITEM
        var options = {pause:false};
        var root_merged = item._root_merged_playlist;
        if (root_merged) {
            var t = 0;
            for (var p of [item, ...item._iterate_parents(root_merged)]) {
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
            [`sessions/${this.$._session.id}/time`, start],
            [`sessions/${app.$._session.id}/stream/mpv/time`, start]
        );
        
        return this.request({
            call: ["session","playlist_play"],
            arguments: [item.id, options]
        });
    }

    /** @param {string[]} uris */
    async navigate_to(uris) {
        if (!Array.isArray(uris)) uris = [uris];
        var urls = [...new Set(uris)].map((uri)=>utils.urlify(uri));
        for (var url of urls) {
            var is_file = url.protocol === "file:";
            if (IS_ELECTRON) {
                if (is_file) await electron.shell.showItemInFolder(utils.pathify(url));
                else await electron.shell.openExternal(url);
            } else {
                if (is_file) open_file_manager({start: utils.pathify(url)});
                else window.open(url, "_blank");
            }
        }
    }

    /** @param {number} t */
    seek(t, relative=false) {
        if (relative) t += this.$._session.time_pos;
        if (t < 0) t = 0;
        app.$._push(
            [`sessions/${app.$._session.id}/time_pos`, t],
            [`streams/${app.$._stream.id}/mpv/seeking`, true],
        );
        return this.request({
            call: ["session", "seek"],
            arguments: [t]
        })
    }

    seek_chapter(i, relative=false) {
        var chapters = this.$._session._current_chapters;
        if (relative) {
            var t = this.$._session.time_pos;
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
            insert_pos = (last_active) ? utils.dom.get_index(last_active) + 1 : num_items;
        }
        insert_pos = utils.clamp(insert_pos, 0, num_items);
        track_index = utils.clamp(track_index, 0, 1);
        return {parent, track_index, insert_pos};
    }

    // ---------------
    
    /** @param {Element} parent_elem @param {PlaylistItem} item */
    build_playlist_breadcrumbs(parent_elem, item, exclude_root=false, single=false) {
        var path = [item, ...item._parents].reverse().filter(p=>p);
        var path_hash = JSON.stringify([this.playlist.current.id, path.map(i=>[i.id, i._hash])]);
        if (parent_elem._path_hash === path_hash) return;
        parent_elem._path_hash = path_hash;
        utils.dom.empty(parent_elem);
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
            elem.title = name;
            if (i != path.length-1) {
                parent_elem.append($(`<span class="separator"></span>`)[0]);
            }
        });
        
        if (item._is_modifiable) {
            var a = $(`<a class="modify" href="javascript:void(0);" title="Modify..."><i class="fas fa-wrench"></i></a>`)[0];
            parent_elem.append(a);
            a.onclick = ()=>{
                app.playlist_modify_menu.show(item);
            }
        }
    }

    get_handover_sessions_options(include_none=true) {
        var sessions = this.sessions_ordered.filter(s=>s.type===SessionTypes.INTERNAL && !s._is_running);
        var options = sessions.map(s=>s.name).map((n,i)=>[sessions[i].id,n])
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

            if (opts.show_spinner) {
                this.$._pending_requests.add(ws_promise);
            }
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
                    if (opts.show_spinner) {
                        this.$._pending_requests.delete(ws_promise);
                    }
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
            window.history.replaceState({}, "", new_hash);
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

    tick() {
        toggle_class(this.body_elem, "is-touch", utils.dom.has_touch_screen());
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

        utils.dom.rebuild(this.users_elem, items, {
            add: (item, elem, i)=>{
                elem = $(`<span class="user"></span>`)[0];
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
                elem.title = `${item.username} (${utils.capitalize(item.type)})`;
                return elem;
            }
        });
    }

    get sessions_ordered() {
        if (this.$.conf["session_order_client"]) {
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
        utils.dom.rebuild(this.session_tabs_elem, items, {
            add: (item, elem, i)=>{
                if (!elem) elem = $(`<a class="session-tab"><div class="handle"><i class="fas fa-grip-lines"></i></div><span class="name"></span><span class="icons"></span></a>`)[0];
                var access_control = item.access_control;
                var has_access = access_control._self_has_access(app.passwords.get(item.id));
                var requires_password = access_control._self_requires_password;
                var is_active = item.id == session_id;
                var is_owner = access_control._self_is_owner;
                var state = item.stream.state;
                var hash = JSON.stringify([item.id, item.name, item.schedule_start_time, state, is_owner, is_active, has_access, requires_password]);
                if (elem._hash == hash) return;
                console.log(has_access, session_id);
                elem._hash = hash;

                var handle = elem.querySelector(".handle");
                // toggle_class(handle, "d-none", !access_control.self_can_edit)
                set_attribute(elem, "href", `#${item.id}`);
                elem.querySelector(".name").textContent = item.name;
                elem.title = item.name;
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
        set_select_options(this.session_select, [["","-",{style:{"display":"none"}}], ...[...this.session_tabs_elem.children].map(e=>e.option_data)]);
        set_value(this.session_select, this.$._client.session_id || "");
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
        var data = await this.request({
            call: ["session", "get_user_save_data"]
        });
        var name = `${utils.sanitize_filename(this.$._session.name)}-${utils.date_to_string()}`
        await save_local_file(`${name}.json`, JSON.stringify(data, null, "  "));
    }

    async toggle_help() {
        if (!this.help_container) {
            var a = $(await fetch("./help.html").then(d=>d.text()));
            this.help_container = $(`<div class="help"></div>`)[0];
            var iframe = $(`<iframe frameBorder="0">`)[0];
            iframe.src = "./help.html";
            var close_button = $(`<button class="close"><i class="fas fa-times"></i></button>`)[0];
            this.help_container.append(close_button, iframe);
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

    /** @param {string|URL} uri */
    filename_to_elfinder_hash(uri) {
        uri = utils.urlify(uri).toString();
        var volume = Object.values(this.$.volumes).find(v=>uri.startsWith(v.uri) || v.uri == (uri+"/"));
        if (volume) {
            var relpath = decodeURIComponent(uri.slice(volume.uri.length));
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

    stream_restart(ids) {
        app.request({
            call: ["stream", "restart"],
            arguments: [ids]
        });
    }

    destroy() {
        this.removeAllListeners();
        // ui.destroy();
        // window.removeEventListener("keydown", this.on_keydown);
        // window.removeEventListener("hashchange", this.on_hashchange);
        // window.removeEventListener("beforeunload", this.beforeunload);
        // this.playlist.destroy();
    }
};
export default MainWebApp;