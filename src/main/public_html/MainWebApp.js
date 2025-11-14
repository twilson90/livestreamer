import * as utils from "../../utils/exports.js";
import * as dom from "../../utils/dom/exports.js";
import * as ui from "../../utils/dom/ui/exports.js";
import { jQuery, $ } from '../../jquery-global.js';
import 'jquery-ui/dist/jquery-ui.js';
import 'jquery-ui/dist/themes/base/jquery-ui.css';
import noUiSlider from 'nouislider';
import "nouislider/dist/nouislider.css";
import Cookies from 'js-cookie';
import mpegts from 'mpegts.js';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import Hammer from 'hammerjs';
import Sortable, { MultiDrag } from 'sortablejs';
import Color from 'color';
import { terminalCodesToHtml } from "terminal-codes-to-html";
import ResizeObserver from 'resize-observer-polyfill';

import * as constants from "../../core/constants.js";
import { get_default_stream, get_auto_background_mode } from "../shared.js";
import filters from "../filters/exports.js";
import { InternalSessionProps, PlaylistItemProps, PlaylistItemPropsProps, SessionProps } from "../InternalSessionProps.js";
import { ResponsiveSortable, CancelSortPlugin, RememberScrollPositionsPlugin, MyAutoScrollPlugin } from './ResponsiveSortable.js';
const { OverlayScrollbars } = dom;

import "overlayscrollbars/overlayscrollbars.css";
import "../../utils/dom/dom.scss";
import "../../utils/dom/ui/ui.scss";
import "./style.scss";

/** @import {API as noUiSliderAPI} from "nouislider" */
/** @import {MediaInfo, FilterInput, Filter, MediaInfoStreamEx} from "../exports.js" */
/** @import {Log} from "../../core/exports.js" */

/** @type {MainWebApp} */
export let app;

export { ui, utils, jQuery, $, noUiSlider, mpegts, Chart, Hammer, Sortable, MultiDrag }

// if (window.videojs) window.videojs.options.autoplay = true;
// export const WS_MIN_WAIT = 1000;
export const WS_MIN_WAIT = 0;

export const IMAGE_DURATION = 0.040;
export const CROP_LIMIT = 0.4;
export const IS_ELECTRON = /electron/i.test(navigator.userAgent);

export const LOGS_MAX_PER_LEVEL = 256;
export const ZERO_DURATION = 1;
export const VOLUME_STEP = 5;
export const MAX_CLIP_SEGMENTS = 128;
export const EMPTY_OBJECT = Object.freeze({});
export const EMPTY_ARRAY = Object.freeze([]);
export const ALL_XHRS = new Set();
export const PLAYLIST_ZOOM_MIN = 0.01;
export const PLAYLIST_ZOOM_MAX = 200;
export const PLAYLIST_ZOOM_BASE = 1.3333;

export const { Observer } = utils;
export const YES_OR_NO = [[false, "No"], [true, "Yes"]];

export const UPLOAD_STATUS = { STARTED: 1, FINISHED: 2, CANCELLED: 3, ERROR: 4 };
export const PLAYLIST_VIEW = { LIST: "list", TIMELINE: "timeline" };
export const PLAYLIST_MODE = { NORMAL: 0, MERGED: 1, DUAL_TRACK: 2 };
let disk_warn_shown = false;

const default_request_opts = {
    show_spinner: true,
    show_loader: false,
}

const buffer_duration_opts = {
    "label": "Buffer Duration",
    "step": 0.1,
    "min": 0,
    "max": 60,
    "suffix": `secs`,
    "info": "Buffer duration in seconds. If set, the stream will be buffered for the specified duration (roughly). Helps with latency and stability.",
}

// --------------------------------------------------------------------

export function replace_undefined_with_null(obj) {
    utils.walk(obj, function (k, v, path) {
        if (v === undefined) this[k] = null;
    });
    return obj;
}

export function time_to_minutes(s) {
    return Math.round(s / (60 * 1000));
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

const VALIDATORS = (() => {
    /** @this {ui.InputProperty} */
    let media_type = function (type) {
        var value = this.value;
        if (!value) return true;
        if (value.startsWith("livestreamer://")) return true;
        var mi = app.media_info[value] || app.$._session.media_info[value];
        if (!mi || !mi.exists) return "Media does not exist.";
        if (type) {
            if (!mi.streams) return `No streams detected.`;
            if (!mi.streams.find(s => s.type === type)) return `No ${type} streams detected.`;
        }
        return true;
    };
    return {
        ...ui.validators,
        media_exists: function () { return media_type.apply(this, []); },
        media_video: function () { return media_type.apply(this, ["video"]); },
        media_audio: function () { return media_type.apply(this, ["audio"]); },
        media_subtitle: function () { return media_type.apply(this, ["subtitle"]); },
    };
})();

/** @type {Record<PropertyKey,Window>} */
export const windows = {};

// returns selected file paths
export const default_file_manager_options = {
    files: false,
    folders: false,
    multiple: false,
}

export const graph_colors = [
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

export const item_colors = {
    "none": "",
    "red": "#d76262",
    "orange": "#fc8d62",
    "yellow": "#ffd92f",
    "green": "#a6d854",
    "blue": "#8da0cb",
    "turquoise": "#66c2a5",
    "magenta": "#e78ac3",
    "beige": "#e5c494",
};

{
    for (let k in item_colors) {
        if (!item_colors[k]) continue;
        item_colors[k] = Color(item_colors[k]).mix(Color("#fff"), 0.5).hex();
    }
}

/* var children_map = new Map();
export const parent_map = new Map();
export function toggle_parent(elem, v) {
    if (v && !elem.parentElement) {
        var p = parent_map[elem];
        var new_children = children_map[p].filter(e=>!!e.parentElement || e === elem);
        dom.insert_at(p, elem, new_children.indexOf(elem));
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
    CANCELLED: 3,
    // ERROR: 4,
}

export class UploadFileChunk {
    /** @type {Blob} */
    #blob;
    constructor(blob) {
        this.#blob = blob;
        this.id = (blob && blob.id) || dom.uuid4();
        this.path = (blob && blob.path) || blob.name;
        this.last_modified = (blob && blob.lastModified) || 0;
        this.start = 0;
        this.length = blob.size;
    }
    get original_blob() { return this.#blob; }
    get end() { return this.start + this.length; }
    get blob() { return this.#blob.slice(this.start, this.end); }
    split(chunk_size, first_and_last_pieces_first = false) {
        var chunks = [];
        var length = this.length;
        var start = this.start;
        var end = this.end;
        var num_chunks = Math.ceil(length / chunk_size);
        if (num_chunks > 2 && first_and_last_pieces_first) {
            chunks.push(Object.assign(this.clone(), { start, length: chunk_size }));
            chunks.push(Object.assign(this.clone(), { start: end - chunk_size, length: chunk_size }));
            start += chunk_size;
            end -= chunk_size;
        }
        for (var b = start; b < end; b += chunk_size) {
            chunks.push(Object.assign(this.clone(), { start: b, length: Math.min(end - b, chunk_size) }));
        }
        return chunks;
    }
    clone() {
        return Object.assign(new UploadFileChunk(this.#blob), this);
    }
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
        let chunks = files.map(f => new UploadFileChunk(f));
        for (var c of chunks) {
            if (opts.dir) c.path = utils.join_paths(opts.dir, c.path);
            if (opts.media) c.media = true;
            if (opts.session) c.session = opts.session;
        }
        chunks = chunks.map(f => f.split(this.opts.chunk_size, opts.first_and_last_pieces_first)).flat()
        this.chunks.push(...chunks);
        setTimeout(() => {
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

        form_data.append('files[]', c.blob, c.path);

        while (!done) {
            let ts = Date.now();
            let xhr = new XMLHttpRequest();
            xhr.id = c.id;
            xhr.progress = 0;
            this.xhrs.add(xhr);
            ALL_XHRS.add(xhr);
            let response = await new Promise((resolve) => {
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        xhr.progress = e.loaded;
                    }
                });
                xhr.addEventListener("loadend", (e) => {
                    resolve(xhr.readyState == 4 && utils.try_catch(() => JSON.parse(xhr.responseText)));
                });
                let url = new URL(location.origin);
                if (c.media) url.searchParams.set("media", "1");
                url.searchParams.set("start", c.start);
                url.searchParams.set("filesize", c.original_blob.size);
                url.searchParams.set("mtime", c.last_modified);
                url.searchParams.set("id", c.id);
                url.searchParams.set("session_id", c.session || 0);
                xhr.open("PUT", url.toString(), true);
                xhr.send(form_data);
            });
            this.xhrs.delete(xhr);
            ALL_XHRS.delete(xhr);
            let msg = `Chunk ${ci} [${Date.now() - ts}ms]`;
            done = true;
            if (response && response.error) {
                console.warn(`${msg} failed: ${response.error}`);
            } else if (xhr.cancelled || !response || response.status === UploadStatus.CANCELLED) {
                console.warn(`${msg} failed. Cancelled.`);
            } else if (response && !response.error) {
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
        this.chunks = this.chunks.filter(c => c.id !== id);
        for (let xhr of this.xhrs) {
            if (xhr.id === id) {
                xhr.cancelled = true;
                xhr.abort();
            }
        }
    }
}

export class FileDrop extends utils.EventEmitter {
    /** @param {HTMLElement} elem */
    constructor(elem) {
        super();
        var i = 0;
        var is_files = (e) => {
            return [...e.dataTransfer.items].some(i => i.kind === "file");
        }
        dom.add_class(elem, "drop-area");
        elem.addEventListener("drop", async (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
            dom.remove_class(elem, "file-over");
            i--;
            let entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry());
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
            dom.add_class(elem, "file-over");
        });
        elem.addEventListener("dragleave", (e) => {
            if (!is_files(e)) return;
            e.preventDefault();
            e.stopPropagation();
            i--;
            if (i == 0) dom.remove_class(elem, "file-over")
        });
    }
}

export function round_ms(num) {
    return +num.toFixed(3)
}

// removes properties from o1 if o2 has exact same property (recursive). If both identical returns null.
export function cull_equal_props(o1, o2) {
    var cull = (o1, o2) => {
        if (Array.isArray(o2)) {
            return JSON.stringify(o1) === JSON.stringify(o2);
        } else if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
            for (var k of Object.keys(o1)) {
                if (cull(o1[k], o2[k])) delete o1[k];
            }
            return utils.is_empty(o1);
        } else {
            return (o1 === o2);
        }
    }
    return cull(o1, o2) ? null : o1;
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

/** @param {URL|string} uri */
export function pretty_uri_basename(orig) {
    var uri = utils.urlify(orig);
    if (uri) {
        var pathname = decodeURIComponent(uri.pathname.split("/").pop());
        if (uri.search) pathname += uri.search;
        return pathname;
    }
    return orig;
}

export function rect_clamp_point(rect, pt) {
    return { x: utils.clamp(pt.x, rect.x, rect.x + rect.width), y: utils.clamp(pt.y, rect.y, rect.y + rect.height) };
}

export function ondrag(elem, handler) {
    elem.draggable = false;
    // elem.onpointerdown = ()=>false;
    elem.addEventListener("pointerdown", (e) => {
        var onmove = handler(e);
        var onup = () => {
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

/** @param {Clipping} clipping */
export function get_clip_segments(clipping) {
    var { start, end, duration, offset } = clipping;
    var segments = [];
    var length = Math.max(0, end - start);
    var t = utils.loop(start + offset, start, end);
    var n = duration / length;
    // console.log(n)
    if (length != 0 && n < MAX_CLIP_SEGMENTS) {
        while (duration > 1e-6) {
            var e = Math.min(t + length, t + duration, end);
            var d = e - t;
            segments.push({ start: t, end: e, duration: d });
            duration -= d;
            if (e == end) t = 0;
        }
    }
    return segments;
}

async function read_file(file, encoding = "utf-8") {
    if (file instanceof File) {
        return dom.read_file(file, { encoding })
    } else if (IS_ELECTRON) {
        return fs.readFileSync(file.path, encoding);
    }
    throw new Error(`Cannot read file '${file}'`);
}
async function save_local_file(filename, text) {
    if (IS_ELECTRON) {
        var result = await electron.showSaveDialog({
            defaultPath: filename,
        });
        if (result.filePath) {
            fs.writeFileSync(result.filePath, text);
            return true;
        }
        return false;
    } else {
        dom.download(filename, text);
        return true;
    }
}


export function get_video_size(w, h, interlaced) {
    var ratio = w / h;
    var height = Math.round(ratio <= (16 / 9) ? h : w / (16 / 9));
    var text;
    if (height == 1440) text = "2K";
    else if (height == 2160) text = "4K";
    else text = `${height}${interlaced ? "i" : "p"}`;
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

/** @this {ui.InputProperty} */
function background_mode_info() {
    if (this.value == "embedded") return `Shows the currently playing audio file's embedded artwork.`;
    if (this.value == "external") return `Shows the external artwork relative to the audio file (a file named AlbumArt.jpg, Cover.jpg, etc.)`;
}

export function create_file_start_end_properties(settings) {
    settings = {
        type: "video",
        name: "video",
        label: "Video File",
        hidden: false,
        default: undefined,
        ...settings,
    }
    var get_file_duration = () => (app.media_info[file.value] ?? app.$._session.media_info[file.value])?.duration ?? 0;
    var is_file_image = () => get_file_duration() <= IMAGE_DURATION;

    var filter = ["image", "video"]
    if (settings.type == "audio") filter = ["audio", "video"];
    var file = new FileProperty({
        "name": `${settings.name}`,
        "label": `${settings.label}`,
        "file.options": { files: true, filter },
        "file.check_media": true,
        "hidden": settings.hidden,
        "default": settings.default,
    });
    file.on("media_info", () => {
        start.reset();
        end.reset();
    })

    var start = new ui.TimeSpanProperty({
        "name": `${settings.name}_start`,
        "label": `${settings.label} Loop Start Time`,
        "timespan.format": "h:mm:ss.SSS",
        "min": 0,
        "max": get_file_duration,
        "hidden": () => file.is_hidden || is_file_image(),
        "default": 0,
        "width": 140,
    });

    var end = new ui.TimeSpanProperty({
        "name": `${settings.name}_end`,
        "label": `${settings.label} Loop End Time`,
        "timespan.format": "h:mm:ss.SSS",
        "min": 0,
        "max": get_file_duration,
        "hidden": () => file.is_hidden || is_file_image(),
        "default": get_file_duration,
        "width": 140,
    });

    return { file, start, end };
}

export class TicksBar {
    static tick_times = [0.1, 0.5, 1, 5, 15, 60, 5 * 60, 15 * 60, 60 * 60, 4 * 60 * 60, 12 * 60 * 60, 24 * 60 * 60];
    static tick_heights = ["2px", "4px", "6px", "8px"];
    static max_ticks = 100;

    get duration() { return this.end - this.start; }
    constructor(elem, opts) {
        opts = Object.assign({
            hover_elem: null,
            placement: "bottom",
            show_numbers: true,
            modifier: (html) => html,
        }, opts)
        this.opts = opts;
        this.start = 0;
        this.end = 0;
        this.elem = elem || $(`<div></div>`)[0];
        dom.add_class(this.elem, "ticks-bar");
        this.elem.dataset.placement = opts.placement;
        if (!opts.hover_elem) opts.hover_elem = elem;

        this.ticks_elem = $(`<div class="ticks"></div>`)[0];
        var cursor_elem = $(`<div class="cursor"></div>`)[0];
        var seek_time = $(`<div class="seek-time"></div>`)[0];

        this.elem.append(this.ticks_elem, cursor_elem, seek_time);

        var update_seek_time = (e) => {
            var data = this.parse_event(e);
            seek_time.style.left = `${data.pt.x}px`;
            seek_time.style.top = `${data.rect.y}px`;
            cursor_elem.style.left = `${data.pt.x - data.rect.x}px`;
            var html = `<div>${utils.seconds_to_timespan_str(data.time, app.user_time_format)}</div>`;
            dom.set_inner_html(seek_time, `<div>${opts.modifier(html, data.time)}</div>`);
        }

        this.hover_listener = new dom.TouchListener(opts.hover_elem, {
            mode: "hover",
            start: (e) => {
                // console.log("in")
                dom.toggle_class(this.elem, "hover", true);
                update_seek_time(e);
            },
            move: (e) => {
                // console.log("move")
                update_seek_time(e);
            },
            end: (e) => {
                // console.log("end")
                dom.toggle_class(this.elem, "hover", false);
            }
        });
    }

    parse_event(e) {
        var rect = new utils.Rectangle(this.elem.getBoundingClientRect());
        var pt = { x: e.clientX, y: e.clientY }
        if (e.touches) pt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        var pt = rect_clamp_point(rect, pt);
        var time = this.start + (pt.x - rect.x) / rect.width * this.duration;
        return { time, pt, rect };
    };

    update(start, end) {
        if (this.start == start && this.end == end) return;
        this.start = start;
        this.end = end;

        dom.toggle_class(this.elem, "no-duration", this.duration == 0);

        var ticks = [];
        var duration = end - start;

        var max_tick_time = 8 * TicksBar.tick_times[TicksBar.tick_times.length - 1];

        if (duration != 0 && duration < max_tick_time) {
            var min_i, num_ticks, min_divisor;
            for (min_i = 0; min_i < TicksBar.tick_times.length; min_i++) {
                var min_divisor = TicksBar.tick_times[min_i];
                num_ticks = duration / min_divisor;
                if (num_ticks < TicksBar.max_ticks) break;
            }
            var max_i = utils.clamp(min_i + TicksBar.tick_heights.length - 1, 0, TicksBar.tick_times.length - 1);
            // var tis = [];
            for (var t = start; t <= end; t += min_divisor) {
                var t_offset = t % min_divisor;
                var tr = t - t_offset;
                var tx = ((tr - start) / duration * 100).toFixed(3);
                var ti;
                for (ti = max_i; ti > min_i; ti--) {
                    if ((Math.floor(tr / min_divisor) * min_divisor) % TicksBar.tick_times[ti] == 0) break;
                }
                // tis.push(ti);
                var ti0 = ti - min_i;
                var th = TicksBar.tick_heights[ti0];
                var text = "";
                if (this.opts.show_numbers) {
                    if ((ti >= min_i + 2) || (num_ticks < TicksBar.max_ticks * 0.25 && ti >= min_i + 1)) {
                        text = `<span>${utils.ms_to_shorthand_str(tr * 1000, utils.log(Math.ceil(1 / TicksBar.tick_times[ti]), 10)).replace(/\s+/g, "")}</span>`;
                    }
                }
                ticks.push(`<div class="tick" style="left:${tx}%;height:${th}">${text}</div>`);
            }
        }
        dom.set_inner_html(this.ticks_elem, ticks.join(""));
    }
}

export class PlaylistCommand {
    /** @typedef {function(PlaylistItem$[])} PLCFunc */
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
        return shortcut && shortcut.replace(/\|/g, " / ").replace(/\w+/g, (m) => `[${m}]`).replace(/\s*([\+\|])\s*/g, (_, m) => ` ${m} `).split(/([A-Z][a-z]+)/).filter(a => a).join(" ");
    }
}

// -----------------------------

const EMPTY_CHAPTERS = Object.freeze([]);

export class Media {
    time_pos = 0;
    playback_speed = 1;
    duration = 0;
    chapters = [];
    seekable = false;
    seeking = false;
    buffering = false;
    running = false;
    #cache = {};

    update() {
        var session = app.$._session;
        var stream = app.$._session._stream;
        // var item = session._current_playlist_item;
        var running = session._is_running;
        var loaded = running ? !!stream.player.loaded : true;
        var seeking = running ? !!(loaded && stream.player.seeking) : false;
        var buffering = (seeking || !loaded);
        var seekable = running ? !!stream.player.seekable : true;

        this.buffering = buffering;
        this.seeking = seeking;
        this.running = running;

        this.fps = running ? stream.player.current_fps : 0;
        this.playback_speed = running ? stream.player.playback_speed : 1;
        this.time_pos = loaded ? session.time_pos : 0;
        this.paused = running ? !!stream.player.paused : false;
        this.duration = running ? stream.player.duration : session._current_playlist_item._duration;
        this.chapters = loaded ? session._current_playlist_item._userdata.chapters : EMPTY_CHAPTERS;
        this.seekable = loaded ? (this.duration != 0 && seekable) : false;
        this.status = running ? (loaded ? "Playing" : "Loading") : "Pending";
        this.ranges = session._current_seekable_ranges;
        // this.#last_seeks = stream.ctx.seeks;
        this.#cache = {};
    }
    get curr_chapters() {
        var session = app.$._session;
        return this.#cache["curr_chapters"] = this.#cache["curr_chapters"] ?? session._get_current_chapters_at_time(this.time_pos);
    }
    get time_left() {
        return Math.max(0, this.duration - this.time_pos);
    }
    get do_live_seek() {
        return false;
    }
}

class Progress$ extends utils.remote.ProxyID$ {
    bytes = 0;
    total = 0;
    speed = 0;
    cancelled = false;
    status = 0;
    stage = 0;
    stages = 0;
}


/** @typedef {{url:string,rect:utils.Rectangle}} Crop$ */
/** @typedef {{crops:Crop$[],combined:utils.Rectangle,width:number,height:number}} DetectedCrop$ */
/** @typedef {{start:number,end:number,duration:number,offset:number}} Clipping */
export class Remote$ extends utils.remote.Proxy$ {
    client_id = "";
    clients = utils.remote.Collection$(() => new Client$()).__proxy__;
    sessions = utils.remote.Collection$(() => new Session$()).__proxy__;
    targets = utils.remote.Collection$(() => new Target$()).__proxy__;
    session_streams = utils.remote.Collection$(() => new SessionStream$()).__proxy__;
    uploads = utils.remote.Collection$(() => new Progress$()).__proxy__;
    downloads = utils.remote.Collection$(() => new Progress$()).__proxy__;
    volumes = utils.remote.Collection$(() => new Volume$()).__proxy__;
    nms_sessions = {};
    change_log = {};
    logs = LogProxy$(() => app.logger);
    fonts = {};
    processes = {};
    sysinfo = new class {
        platform = "";
        memory = {
            used: 0,
            free: 0,
            total: 0,
        };
        processes = {};
    };
    disk = {
        free: 0,
        used: 0,
        total: 0,
        is_low: false,
    };
    conf = {};
    /** @type {Record<string,DetectedCrop$>} */
    detected_crops = {};
    ts = 0;

    _pending_requests = new Set();
    _pending_loader_requests = new Set();

    #user_ts = Date.now();
    get _now() {
        return Date.now() + this.ts - this.#user_ts;
    }

    _refresh_ping() {
        return app.ws.ping();
    }
    get _ping() {
        return app.ws.last_ping;
    }
    get _session() {
        return this.sessions[this._client.session_id] || this.sessions[utils.remote.Null$];
    }
    get _client() {
        return this.clients[this.client_id] || this.clients[utils.remote.Null$];
    }
    get _stream() {
        return this._session._stream;
    }
    get _targets() {
        var targets = Object.values(this.targets);
        targets = targets.filter(t => t.locked ? true : t.access_control._self_has_access);
        utils.sort(targets, t => !t.locked, t => t.ts);
        return Object.fromEntries(targets.map(t => [t.id, t]));
    }
}

export class Client$ extends utils.remote.ProxyID$ {
    session_id = "";
    user = {
        user_id: 0,
        is_admin: false,
        username: null,
        email: null,
    };
}

export class Target$ extends utils.remote.ProxyID$ {
    name = ""
    description = ""
    rtmp_host = ""
    rtmp_key = ""
    url = ""
    access_control = new AccessControl$();
    ts = 0
    limit = 0
    locked = false
    opts = {};

    get _stream_targets() {
        return Object.values(app.$.session_streams).map(st => st.stream_targets[this.id]).filter(st => st);
    }
    get _active_stream_targets() {
        return this._stream_targets.filter(s => s._is_running);
    }
    get _in_use() {
        return !!this._active_stream_targets.length;
    }
    get _can_edit() {
        return !this.locked && this.access_control._self_has_ownership;
    }
}

export class StreamTarget$ extends utils.remote.ProxyID$ {
    state = "stopped";
    stream_id = "";
    target_id = "";

    /** @type {Live$} */
    live;

    get _connected_nms_session() {
        return Object.values(app.$.nms_sessions).filter(s => s.publishStreamPath.split("/").pop() === this.id);
    }

    get _is_running() {
        return this.state === "started";
    }
    get _session() {
        return this._stream._session;
    }
    get _stream() {
        return app.$.session_streams[this.stream_id] || app.$.session_streams[utils.remote.Null$];
    }
    get _target() {
        return app.$.targets[this.target_id] || app.$.targets[utils.remote.Null$];
    }
}
class SessionPlayer$ extends utils.remote.Proxy$ {
    item = {};
    preloaded = false;
    loaded = false;
    seeking = false;
    seekable = false;
    paused = false;
    duration = 0;
    chapters = [];
    time_pos = 0;
    seekable_ranges = [];
    playback_speed = 1;
    current_fps = 0;
    avsync = 0;
    fps = 0;
    interpolation = false;
    deinterlacing = false;
    video_bitrate = 0;
    audio_bitrate = 0;
    aspect_ratio = 0;
}

export class Volume$ extends utils.remote.ProxyID$ {
    name = "";
    driver = "";
    root = "";
    access_control = new AccessControl$();
    locked = false;
    index = -1;
}

export class SessionStream$ extends utils.remote.ProxyID$ {
    start_ts = 0;
    stop_ts = 0;
    state = "stopped";
    metrics = {};
    session_id = "";
    targets = [];
    target_opts = {};
    stream_targets = utils.remote.Collection$(() => new StreamTarget$()).__proxy__;
    test = false;
    bitrate = 0;
    publish_stream_path;
    restart = 0;
    /** @type {SessionPlayer$} */
    player = new SessionPlayer$().__proxy__;
    fps = 0;
    buffer_duration = 0;
    resolution = "1280x720";

    /** @type {Live$} */
    get _live() {
        return Object.values(this.stream_targets).find(st => st.live)?.live;
    }

    get _is_only_gui() {
        this.player
        return !!(Object.keys(this.targets).length == 1 && this.targets.includes("gui"));
    }
    get _internal_nms_session() {
        return Object.values(app.$.nms_sessions).find(s => s.publishStreamPath == this.publish_stream_path);
    }
    get _connected_nms_sessions() {
        return Object.values(this.stream_targets).map(st => st._connected_nms_session).filter(s => s);
    }
    get _session() {
        return app.$.sessions[this.session_id] || app.$.sessions[utils.remote.Null$];
    }
    get _is_running() {
        return this.state !== "stopped";
    }
    get _run_time() {
        return app.$._now - this.start_ts;
    }
    get _width() { return +this.resolution.split("x")[0]; }
    get _height() { return +this.resolution.split("x")[1]; }
}
/** @typedef {{username:string, access:string, suspended:boolean, password:string}} AccessControlUser */
export class AccessControl$ extends utils.remote.Proxy$ {
    static ACCESS_ORDER = { "owner": 1, "allow": 2, "deny": 3 };
    static get DEFAULT_VALUE() { return { "*": { "access": "allow" } }; }

    constructor(data) {
        super();
        Object.assign(this.__proxy__, AccessControl$.DEFAULT_VALUE, data);
    }

    get _users() {
        var users = Object.entries(this.__proxy__).map(([username, data]) => {
            delete data.username; // incase username was accidentally saved
            return { username, ...data };
        });
        return utils.sort(users, v => (v.username == "*") ? 0 : 1, v => v.access == "owner" ? 0 : 1, v => AccessControl$.ACCESS_ORDER[v.access], v => v.username.toLowerCase());
    }

    get _owners() { return this._users.filter(d => d.access === "owner"); }

    _edit(username, data) {
        var user = this.__proxy__[username];
        if (data == null) {
            if (user && user.access === "owner" && username === app.$._client.user.username && this._owners.length > 1) {
                if (!confirm("Deleting your ownership may revoke access. Are you sure?")) return false;
            }
            delete this.__proxy__[username];
        } else {
            if (!this.__proxy__[username]) this.__proxy__[username] = {};
            Object.assign(this.__proxy__[username], data);
        }
        if (this._owners.length == 0) {
            Object.assign(this.__proxy__, AccessControl$.DEFAULT_VALUE);
        }
        return true;
    }

    _delete(username) {
        this._edit(username, null);
    }

    get _self_has_ownership() {
        return this._owners.length == 0 || this._has_ownership();
    }

    get _self_requires_password() {
        return this._requires_password(app.$._client.user.username);
    }

    get _self_has_access() {
        return this._has_access(app.$._client.user.username, app.passwords.get(app.$._session.id));
    }

    _requires_password(username) {
        if (this._has_ownership(username)) return false;
        let user = this.__proxy__[username];
        if (user && user.password) return true;
        let global = this.__proxy__["*"];
        if (global && global.password) return true;
        return false;
    }
    _has_ownership(username, ignore_admin = false) {
        if (!username) username = app.$._client.user.username;
        if (!ignore_admin && app.$._client.user.is_admin) return true;
        let user = this.__proxy__[username];
        if (user) {
            if (user.access === "owner") return true;
        }
        let global = this.__proxy__["*"];
        if (global) {
            if (global.access === "owner") return true;
        }
        return false;
    }
    _has_access(username, password) {
        if (this._has_ownership(username)) return true;
        let user = this.__proxy__[username];
        if (user) {
            if (user.password && user.password !== password) return false;
            if (user.access === "allow") return true;
        }
        let global = this.__proxy__["*"];
        if (global) {
            if (global.password && global.password !== password) return false;
            if (global.access === "allow") return true;
        }
        return false;
    }
    _claim() {
        this._edit(app.$._client.user.username, { access: "owner" });
    }
}

/** @param {() => LogPanel} logger @returns {Record<string,Log>} */
function LogProxy$(logger) {
    return (new class extends utils.remote.Proxy$ {
        constructor() {
            super(new class extends utils.remote.Collection$Handler {
                set(target, prop, value) {
                    logger().add_log(value);
                    return super.set(target, prop, value);
                }
            });
        }
    }).__proxy__;
}
export class Session$ extends utils.remote.ProxyID$ {
    type = "";
    index = 0;
    playlist_id = "";
    time_pos = 0;
    create_ts = 0;
    logs = LogProxy$(() => app.session_logger);
    downloads = {};
    access_control = new AccessControl$();
    player_default_override = {};
    stream_settings = {};
    /** @type {Record<string,MediaInfo>} */
    media_info = {};
    name = "";
    background_mode = "";
    volume_target = 100;
    volume_speed = 2;
    fade_out_speed = 2;
    stream_id = "";
    files_dir = "";
    playlist_info = utils.remote.Collection$(() => new PlaylistInfo$()).__proxy__;
    /** @type {PlaylistHistory$} */
    playlist_history = new PlaylistHistory$().__proxy__;
    gui_props = {};

    constructor() {
        super();
        var _this = this;
        /** @type {Record<string,PlaylistItem$>} */
        this.playlist = new (class extends utils.remote.Proxy$ {

            constructor() {
                super(new class extends utils.remote.Collection$Handler {
                    constructor() {
                        super(() => new PlaylistItem$(null));
                    }
                    /** @param {Record<string,PlaylistItem$>} target @param {string} prop @param {PlaylistItem$} value */
                    set(target, prop, value) {
                        if (prop === "0") return false;
                        var result = super.set(target, prop, value);
                        target[prop]._private.session = _this.__proxy__;
                        var parent = target[prop]._parent;
                        if (parent) parent._private.children = null;
                        return result;
                    }
                    /** @param {Record<string,PlaylistItem$>} target @param {string} prop */
                    deleteProperty(target, prop) {
                        if (prop === "0") return false;
                        if (target[prop]) target[prop]._parent._private.children = null;
                        return super.deleteProperty(target, prop);
                    }
                });

                /** @type {PlaylistItem$} */
                var root = new PlaylistItem$({ id: "0", parent_id: null }).__proxy__;
                root._private.session = _this.__proxy__;
                this["0"] = root;
            }
        })().__proxy__;
    }

    get _has_access() {
        var is_null_session = this._is_null;
        var access_control = this.access_control;
        return is_null_session || access_control._self_has_access
    }
    /** @returns {PlaylistItem$} */
    get _current_playlist_item() {
        return this.playlist[this.playlist_id] || this.playlist[utils.remote.Null$];
    }
    get _is_running() {
        return this._stream._is_running;
    }
    get _current_seekable_ranges() {
        var stream = this._stream;
        if (stream._is_running) return stream.player.seekable_ranges;
        return [];
    }
    _get_current_chapters_at_time(t) {
        return this._current_playlist_item._userdata.chapters.filter(c => t >= c.start && t < c.end);
    }
    _get_current_chapter_at_time(t) {
        return this._get_current_chapters_at_time(t).pop();
    }
    _get_connected_nms_session_with_appname(...appnames) {
        return Object.values(app.$.nms_sessions).find(s => appnames.includes(s.appname) && s.publishStreamPath.split("/").pop() === this.id);
    }
    get _stream() {
        return app.$.session_streams[this.stream_id] || app.$.session_streams[utils.remote.Null$];
    }
}

class PlaylistInfo$ extends utils.remote.Proxy$ {
    filenames = [];
}

class PlaylistHistory$ extends utils.remote.Proxy$ {
    position = 0;
    start = 0;
    end = 0;
    stack = {};
    get _size() { return this.end - this.start; }
    get _next() { return this.stack[this.position]; }
    get _prev() { return this.stack[this.position - 1]; }
}

class PlaylistItemPrivate$ {
    /** @type {Session$} */
    session;
    num_user_updates = 0;
    /** @type {PlaylistItemUserData$} */
    userdata;
    /** @type {PlaylistItem$[]} */
    children;
}

export class PlaylistItem$ extends utils.remote.ProxyID$ {
    parent_id = "0";
    filename = "";
    index = 0;
    track_index = 0;
    props = {};
    upload_id = null;
    /** @type {PlaylistItem$[]} In very specific case, playlist item can embed children */
    _embedded_children;
    _session_id = "";

    #private = new PlaylistItemPrivate$();
    get _private() { return this.#private; }

    /** @param {any} data */
    constructor(data) {
        super();
        this.__proxy_handler__.on("change", (target, prop, value) => {
            if (this._is_connected) {
                this._clear_userdata();
                if (prop == "parent_id") {
                    let old_parent = this._parent;
                    let new_parent = this._session.playlist[value];
                    if (old_parent) {
                        old_parent._private.children = null;
                    }
                    if (new_parent) {
                        new_parent._private.children = null;
                    }
                } else if (prop == "track_index" || prop == "index") {
                    let parent = this._parent;
                    if (parent) parent._private.children = null;
                }
            }
        });
        if (data) Object.assign(this, data);
        if (this._embedded_children) this._embedded_children = this._embedded_children.map(c => new PlaylistItem$(c));
    }
    /** @returns {Session$} */
    get _session() {
        return app.$.sessions[this._session_id] || this._private.session || app.$.sessions[utils.remote.Null$];
    }
    /** @returns {PlaylistItemUserData$} */
    get _userdata() {
        if (!this._private.userdata) {
            this._private.userdata = new PlaylistItemUserData$(this);
            this._private.num_user_updates++;
        }
        return this._private.userdata;
    }
    get _hash() {
        return this._private.num_user_updates;
    }
    get _parent() {
        return this._session.playlist[this.parent_id];
    }
    get _media_info() {
        return this._session.media_info[this.filename] ?? app.media_info[this.filename];
    }
    get _is_deleted() {
        return !this._session.playlist[this.id];
    }
    get _is_connected() {
        return this._session.playlist[this.id] === this.__proxy__;
    }
    get _is_playlist() {
        return this._is_root || this.filename === "livestreamer://playlist" || this._has_children;
    }
    get _is_current() {
        return this.id === this._session._current_playlist_item.id;
    }
    get _is_descendent_of_current() {
        for (var i of this._session._current_playlist_item._iterate_children(null, true)) {
            if (i.id === this.id) return true;
        }
        return false;
    }
    get _is_ancestor_of_current() {
        for (var i of this._session._current_playlist_item._iterate_parents()) {
            if (i.id === this.id) return true;
        }
        return false;
    }
    get _is_currently_playing() {
        var session = this._session;
        var stream = session._stream;
        return stream._is_running && this.id === session._current_playlist_item.id;
    }
    get _is_root() {
        return this.id == "0";
    }
    get _is_modifiable() {
        return !this._is_root && !this._is_null;
    }
    get _detected_crops() {
        return app.$.detected_crops[this.id];
    }
    get _crop() {
        var vals = this.props.crop || [0, 0, 0, 0];
        return new utils.Rectangle({ left: vals[0], top: vals[1], right: 1 - vals[2], bottom: 1 - vals[3] });
    }
    /* get _is_mergable() {
        if (this._is_playlist) return true;
        if (this.filename == "livestreamer://empty" || this.filename == "livestreamer://exit") return true;
        if (this._url.protocol === "file:") {
            if ((this._media_info||EMPTY_OBJECT).exists) return true;
        }
        return false;
    } */
    get _is_merged() {
        return this._is_merged_playlist || !!this._root_merged_playlist;
    }
    get _has_children() {
        return this._children.length != 0;
    }
    _calculate_contents_hash() {
        return hash(JSON.stringify([this, this._children.map(c => c._calculate_contents_hash())]))
    }
    /** @returns {Generator<PlaylistItem$, void>} */
    *_iterate_children(track_index = null, recursive = false) {
        if (!this.id) return;
        var children = this._children;
        if (track_index != null) children = children.filter(i => track_index == null || i.track_index == track_index);
        for (var item of children) {
            yield item;
            if (recursive) yield* item._iterate_children(null, true);
        }
    }
    /** @returns {PlaylistItem$[]} */
    get _children() {
        if (!this.id) return [];
        if (!this._private.children) {
            var children = this._embedded_children || Object.values(this._session.playlist).filter(i => this.id == i.parent_id);
            children.sort((a, b) => (a.track_index - b.track_index) || (a.index - b.index));
            this._private.children = children;
        }
        return [...this._private.children];
    }
    get _descendents() {
        return [...this._iterate_children(null, true)];
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
        return this._info?.filenames ?? [];
    }
    get _related_media_infos() {
        return this._filenames.filter(f => !f.startsWith("livestreamer://")).map(f => this._session.media_info[f]).filter(mi => mi);
    }
    /** @returns {boolean} */
    get _is_processing() {
        return this._related_media_infos.some(mi => mi.processing) || this._children.some(c => c._is_processing);
    }
    get _parents() {
        return [...this._iterate_parents()].filter(p => p);
    }
    get _parent_track() {
        return this._parent._get_track(this.track_index);
    }
    _get_track(t) {
        return [...this._iterate_children(t)];
    }
    /** @returns {PlaylistItem$[][]} */
    get _tracks() {
        var tracks = [];
        if (this.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK) {
            for (var i = 0; i < 2; i++) tracks.push([...this._iterate_children(i)]);
        } else {
            tracks[0] = [...this._iterate_children()];
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
    get _is_remote() {
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
        if (this._url.protocol === "file:" && IS_ELECTRON) return true;
        return false;
    }
    async _navigate_to() {
        if (!this._is_navigatable) return;
        var url = this._url;
        if (IS_ELECTRON) {
            if (url.protocol.match(/^https?:$/)) return electron.openExternal(this._uri);
            else if (url.protocol === "file:") return electron.showItemInFolder(utils.pathify(this._uri));
        }
        if (url.protocol.match(/^https?:$/)) return window.open(url, "_blank");
        return app.open_file_manager({ start: this.filename });
    }
    get _uri() {
        return utils.is_uri(this.filename) ? this.filename : utils.urlify(this.filename).toString();
    }
    get _url() {
        return new URL(this._uri);
    }
    get _download() {
        return app.$.downloads[this.id];
    }
    get _upload() {
        return app.$.uploads[this.upload_id];
    }
    get _is_downloadable() {
        return !this._download && this._url.protocol.match(/^https?:$/) && !this._is_playlist;
    }
    get _is_splittable() {
        return this._userdata.media_duration > 0 && !this._is_playlist;
    }
    get _duration() {
        return this._userdata.duration;
    }
    get _is_scannable() {
        return !this.filename.startsWith("livestreamer://") || this._is_playlist;
    }
    get _elfinder_hash() {
        return app.uri_to_elfinder_hash(this._uri);
    }
    /** @param {PlaylistItem$[]} selection */
    _get_nearest_not_in_selection(selection) {
        let selection_set = new Set(selection);
        let next = this;
        while (next && selection_set.has(next)) {
            next = next._get_adjacent_sibling(1);
        }
        if (next) return next;
        let prev = this;
        while (prev && selection_set.has(prev)) {
            prev = prev._get_adjacent_sibling(-1);
        }
        if (prev) return prev;
    }
    _get_adjacent_sibling(a = 1) {
        a = a > 0 ? 1 : -1;
        var parent = this._parent;
        return parent && parent._tracks[this.track_index][this.index + a];
    }
    _get_adjacent(a = 1, skip_playlists = true) {
        /** @type {PlaylistItem$} */
        var next;
        if (a > 0) {
            if (this._has_children && !this._is_merged_playlist) {
                next = this._children[0];
            } else {
                next = this._get_adjacent_sibling(1);
                if (!next) next = this._parents.map(p => p._get_adjacent_sibling(1)).find(p => p);
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

    get _is_special() { return !!this.filename.match(/^livestreamer:/); }
    get _ls_path() { return this._is_special ? this._url.host : undefined; }

    _get_pretty_name(opts) {
        opts = Object.assign({
            label: true,
            ext: true
        }, opts);
        if (opts.label && this.props.label) {
            return this.props.label;
        }
        if (this._is_root) return "[Root]";
        if (!this.filename || this._is_null) return "[Nothing]";
        var mi = this._media_info || EMPTY_OBJECT;
        if (mi.name) return mi.name;
        var filename = this.filename;
        if (filename.match(/^livestreamer:/)) {
            var type = filename.replace("livestreamer://", "");
            if (type === "intertitle" && this.props.title_text) return (this.props.title_text || "").replace(/\n+/g, " • ");
            if (type === "macro") {
                return `[${["macro", this.props.function].filter(p => p).join(":")}]`;
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
    /** @param {PlaylistItem$} until @returns {Iterable<PlaylistItem$>} */
    *_iterate_parents(until) {
        var item = this;
        while (!item._is_root) {
            item = item._parent;
            if (until === item) break;
            if (item) yield item;
        }
    }
    /** @returns {this | {children: PlaylistItem$[]}} */
    _copy(include_children = false) {
        var data = utils.json_copy(this);
        if (include_children) data._embedded_children = this._children.map(c => c._copy(true));
        data._session_id = this._session.id;
        return new PlaylistItem$(data);
    }
    _clear_userdata() {
        this._private.userdata = null;
        var parent = this._parent;
        if (parent) parent._clear_userdata();
    }
}

export class ParsedPlaylistItem$ extends PlaylistItem$ {
    map = {
        video: {},
        audio: {},
        subtitle: {},
        files: [],
        streams: [],
    };
}
class PlaylistItemUserData$ {
    timeline_start = 0;
    timeline_end = 0;
    timeline_duration = 0;
    start = 0;
    end = 0;
    duration = 0;
    media_duration = 0;
    children_duration = 0;
    chapters = [];
    is_processing = false;
    is_modified = false;
    name;

    /** @param {PlaylistItem$} item */
    constructor(item) {
        let media_info = item._media_info || EMPTY_OBJECT;
        let children = item._children;
        var is_playlist = item._is_playlist;
        // let root_merged_playlist = item._root_merged_playlist;
        var is_merged = item._is_merged;

        let name = item._get_pretty_name();

        let media_duration = Math.max(0, round_ms(media_info.duration || 0));
        if (media_duration <= IMAGE_DURATION) media_duration = 0;
        let children_duration = 0;
        let timeline_duration = media_duration;
        if (children.length) {
            /** @param {PlaylistItem$[]} t */
            var get_track_duration = (t, tl = false) => {
                var total = 0;
                var key = tl ? "timeline_duration" : "duration";
                for (var i of t) {
                    if (i.filename === "livestreamer://exit") break;
                    total += i._userdata[key];
                }
                return total;
            }
            var track_durations = item._tracks.map((t) => get_track_duration(t));
            var track_timeline_durations = item._tracks.map((t) => get_track_duration(t, true));
            if (item.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK && item.props.playlist_end_on_shortest_track && track_durations.every(t => t > 0)) {
                children_duration = Math.min(...track_durations);
                timeline_duration = Math.min(...track_timeline_durations);
            } else {
                children_duration = Math.max(...track_durations);
                timeline_duration = Math.max(...track_timeline_durations);
            }
            media_duration = Math.max(0, children_duration);
        }
        let duration = Math.max(0, item.props.duration || media_duration);
        let clipping;
        {
            let start = item.props.clip_start || 0;
            let end = item.props.clip_end || duration;
            let loops = item.props.clip_loops ?? 1;
            let length = Math.max(0, end - start);
            let offset = ((item.props.clip_offset || 0) % length) || 0;
            if (start != 0 || end != duration || loops != 1 || offset != 0) {
                duration = Math.max(0, length * loops);
                clipping = { start, end, length, duration, offset, loops };
            }
        }
        timeline_duration = round_ms(Math.max(ZERO_DURATION, duration));

        var chapters;
        if (is_playlist) {
            chapters = [];
            for (var items of item._tracks) {
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
                    if (is_merged) {
                        chapters.push(new Chapter$({ id: c.id, start: cud.start, end: cud.end }));
                    }
                }
            }
        } else {
            chapters = utils.json_copy((media_info.chapters || EMPTY_ARRAY).map(c => new Chapter$(c)));
        }
        if (chapters) {
            var min = 0
            var max = Number.POSITIVE_INFINITY;
            if (clipping) {
                var segments = get_clip_segments(clipping);
                if (segments.length == 1) {
                    min = segments[0].start;
                    max = segments[0].end;
                } else {
                    var t = 0;
                    chapters = segments.map((s, index) => {
                        var start = t;
                        t += s.duration;
                        return new Chapter$({ start, end: t, title: `${name}` });
                    });
                }
            }
            chapters = chapters.filter((c) => c.end >= min && c.start <= max);
            chapters.sort((a, b) => a.start - b.start);
            chapters.forEach((c, i) => {
                c.index = i;
                c.start = Math.max(0, c.start - min);
                c.end = Math.min(max - min, c.end - min);
                if (!c.id && !c.title) c.title = `Chapter ${i + 1}`;
            });
        }

        var props = new Set(Object.keys(item.props));
        props.delete("label");
        props.delete("color");

        this.name = name;
        this.is_modified = !!(props.size && !item._is_special);
        this.duration = duration || 0;
        this.media_duration = media_duration || 0;
        this.children_duration = children_duration || 0;
        this.timeline_duration = timeline_duration || 0;
        this.clipping = clipping;
        this.chapters = chapters;
    }
}

export class Chapter$ {
    index = 0;
    start = 0;
    end = 0;
    id = "";
    constructor(data) {
        Object.assign(this, data);
    }
}

/** @param {PlaylistItem$[]} items */
function get_items_title_html(items) {
    items = items.filter(i => i);
    if (items.length > 1) return `${items.length} Files`;
    if (items.length == 1) {
        return `<i>${items[0]._get_pretty_name()}</i>`;
    }
    return `[No Item]`;
}

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
        dom.toggle_display(this.crop_border_elem, !!rect2);
        this.detected_crop_border_elem = this.elem.querySelector(".detected-crop-border");
        this.content_elem = this.elem.querySelector(".crop-preview");
        this.img_elem = this.elem.querySelector("img");
        this.orig_rect = rect;
        this.orig_crop_rect = rect2;
        /** @type {HTMLElement} */
        this.ui_elem = this.elem.querySelector(".ui-area");

        var legend_elem = $(`<div class="legend"></div>`)[0];

        var add_legend = (name, clazz) => {
            var elem = $(`<div><div class="${clazz}" style="width:15px;height:15px"></div><span>${name}</span></div>`)[0]
            legend_elem.append(elem);
        }

        add_legend("Crop Area", "crop-border");

        if (editable) {
            if (rect2) {
                add_legend("Detected Crop Area", "detected-crop-border");
                this.append(legend_elem);
            }

            var b = new utils.Rectangle(0, 0, 1, 1);

            var setup_drag = (el, keys, constrain = false) => {
                var get_coords = (e) => {
                    var client_rect = this.content_elem.getBoundingClientRect();
                    var x = e.clientX - client_rect.left;
                    var y = e.clientY - client_rect.top;
                    return { x, y };
                }
                $(el).on("mousedown", (e) => {
                    var rect = this.rect.clone();
                    var { x: x0, y: y0 } = get_coords(e)
                    var onmousemove = (e) => {
                        var { x: x1, y: y1 } = get_coords(e)
                        var [dx, dy] = [x1 - x0, y1 - y0];
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
                    $(document).one("mouseup", (e) => {
                        $(document).off("mousemove", onmousemove);
                    });
                });
            }

            this.drag_rect_elem = $(`<div class="drag-rect"></div>`)[0];
            this.drag_rect_elem.ondblclick = () => {
                this.update_crop(b);
            }
            this.ui_elem.append(this.drag_rect_elem);
            setup_drag(this.drag_rect_elem, ["x", "y"], true)

            var edges = ["top", "right", "bottom", "left"];
            edges.forEach((key, i) => {
                var edge_elem = $(`<div class="drag-edge ${key}"></div>`)[0];
                this.edges[key] = edge_elem;
                this.ui_elem.append(edge_elem);
                setup_drag(edge_elem, [key]);
            });

            var corners = ["top-right", "bottom-right", "bottom-left", "top-left"];
            corners.forEach((key, i) => {
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
            "top-left": "nw-resize"
        };
        var edge_cursors = {
            "top": "n-resize",
            "right": "e-resize",
            "bottom": "s-resize",
            "left": "w-resize"
        };

        var fix_key = (k, r) => {
            if (k === "top") return r[k] > r.bottom ? "bottom" : k;
            if (k === "bottom") return r[k] < r.top ? "top" : k;
            if (k === "left") return r[k] > r.right ? "right" : k;
            if (k === "right") return r[k] < r.left ? "left" : k;
            return k;
        };

        $(this.drag_rect_elem).css({
            top: `${r.top * 100}%`,
            left: `${r.left * 100}%`,
            width: `${r.width * 100}%`,
            height: `${r.height * 100}%`,
        })

        for (var k in this.corners) {
            var [k0, k1] = k.split("-");
            $(this.corners[k]).css({
                top: `${r[k0] * 100}%`,
                left: `${r[k1] * 100}%`,
                cursor: corner_cursors[`${fix_key(k0, r)}-${fix_key(k1, r)}`],
            });
        }
        for (var k in this.edges) {
            var x, y, d;
            if (k == "top") [x, y, d] = [r.left, r.top, "width"];
            else if (k == "bottom") [x, y, d] = [r.left, r.bottom, "width"];
            else if (k == "left") [x, y, d] = [r.left, r.top, "height"];
            else if (k == "right") [x, y, d] = [r.right, r.top, "height"];
            $(this.edges[k]).css({
                top: `${y * 100}%`,
                left: `${x * 100}%`,
                [d]: `${r[d] * 100}%`,
                cursor: edge_cursors[fix_key(k, r)]
            });
        }

        // var client_rect = this.content_elem.getBoundingClientRect();
        // this.ui_elem.style.setProperty("--tw", `${client_rect.width * this.rect.width}px`)
        // this.ui_elem.style.setProperty("--th", `${client_rect.height * this.rect.height}px`)

        dom.set_inner_html(this.black_elem, [
            `<div style="left:0;width:${this.rect.left * 100}%;top:0;bottom:0"></div>`,
            `<div style="left:${this.rect.right * 100}%;right:0;top:0;bottom:0"></div>`,
            `<div style="left:0;right:0;top:0;height:${this.rect.top * 100}%"></div>`,
            `<div style="left:0;right:0;top:${this.rect.bottom * 100}%;bottom:0"></div>`,
        ].join(""));

        if (this.crop_border_elem) {
            set_crop_border(this.crop_border_elem, r);
        }

        if (this.info_elem) {
            let html = ["left", "top", "right", "bottom", "width", "height"].map((e, i) => {
                var v = (i != 2 && i != 3) ? r[e] : 1 - r[e];
                return `<span>${e}=${(v * 100).toFixed(2)}%</span>`;
            }).join("");
            dom.set_inner_html(this.info_elem, html);
        }

        this.emit("change");
    }
}

/** @param {Rectangle} rect */
function set_crop_border(elem, rect) {
    $(elem).css({
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
    });
}
export class SelectableList extends ui.UI {
    /** @type {HTMLElement} */
    #selected;
    get selected() { return this.#selected; }
    get selected_index() { return this.items.indexOf(this.#selected); }
    constructor(elem, settings) {
        super(elem, {
            ...settings,
        });
        dom.add_class(elem, "selectable-list");
        dom.set_attribute(elem, "tabindex", "-1");
        $(elem).disableSelection();

        elem.addEventListener("click", (e) => {
            var tr = this.items.find(elem => elem.contains(e.target));
            if (!tr) return;
            this.toggle(tr);
        });

        var on_keydown;
        window.addEventListener("keydown", on_keydown = (e) => {
            if (!dom.has_focus(this.elem)) return;
            var items = this.items;
            var index = items.indexOf(this.#selected);
            if (e.key === "ArrowUp") {
                index--;
            } else if (e.key === "ArrowDown") {
                index++;
            } else {
                return;
            }
            e.preventDefault();
            index = utils.clamp(index, 0, items.length - 1);
            this.select(items[index]);
        });

        this.on("destroy", () => {
            window.removeEventListener("keydown", on_keydown);
        });
    }
    get items() {
        return Array.from(this.elem.children);
    }
    /** @param {HTMLElement} item */
    toggle(item) {
        if (this.#selected === item) this.select(null);
        else this.select(item);
    }
    /** @param {HTMLElement} item */
    select(item) {
        this.elem.focus();
        if (this.#selected === item) return;
        if (this.#selected) {
            dom.remove_class(this.#selected, "selected");
            this.emit("deselect", this.#selected);
        }
        this.#selected = item;
        if (this.#selected) {
            dom.add_class(this.#selected, "selected");
            this.#selected.scrollIntoView({ block: "nearest", inline: "nearest" })
            this.emit("select", this.#selected);
        }
        this.emit("selection_change");
    }
}


//---------------------------------------------------------------------------------

export function get_rect_pt_percent(rect, pt) {
    return { x: (pt.x - rect.x) / rect.width, y: (pt.y - rect.y) / rect.height };
}

class JSONElement {
    /** @type {Record<PropertyKey,JSONElement>} */
    children = {};

    get has_children() {
        for (var k in this.children) return true;
        return false;
    }

    constructor(key, data, parent) {
        this.key = key;
        this.data = data;
        this.type = typeof this.data;
        var is_array = Array.isArray(this.data);
        if (is_array) this.type = "array";
        else if (this.data === null) this.type = "null";
        this.elem = document.createElement("div");
        dom.add_class(this.elem, "json-node");
        this.value_elem = document.createElement("div");
        dom.add_class(this.value_elem, "json-value");
        var prefix = "";
        var suffix = "";
        if (key) prefix = key + ": ";
        if (this.type == "array") {
            prefix += "[";
            suffix += "]";
        } else if (this.type == "object") {
            prefix += "{";
            suffix += "}";
        }
        var prefix_elem = document.createElement("span");
        dom.add_class(prefix_elem, "json-prefix");
        prefix_elem.innerText = prefix;

        var suffix_elem = document.createElement("span");
        dom.add_class(suffix_elem, "json-suffix");
        suffix_elem.innerText = suffix;

        var empty = false;
        if (this.type == "array" || this.type == "object") {
            empty = true;
            for (var k in this.data) {
                var child = new JSONElement(is_array ? null : k, data[k], this);
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
            dom.add_class(placeholder_elem, "json-placeholder");
            placeholder_elem.innerText = `${children.length} items`;
            if (collapsible) {
                placeholder_elem.onclick = () => this.toggle();
                prefix_elem.onclick = () => this.toggle();
                suffix_elem.onclick = () => this.toggle();
            }
        }

        this.elem.append(prefix_elem);
        this.elem.append(this.value_elem);
        if (placeholder_elem) this.elem.append(placeholder_elem);
        this.elem.append(suffix_elem);

        this.elem.dataset.jsonType = this.type;
        dom.toggle_class(this.elem, "collapsible", collapsible);
        dom.toggle_class(this.elem, "empty", empty);

        Object.assign(this.elem.style, {
            "font-family": "monospace",
            "font-size": "12px",
            "word-break": "break-all"
        });
    }
    toggle(value) {
        if (!this.has_children) return;
        dom.toggle_class(this.elem, "collapsed", value);
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

class JSONRoot extends JSONElement {
    constructor(key, data, collapsed_children = false) {
        super(key, data);
        if (collapsed_children) {
            for (var c of Object.values(this.children)) {
                c.toggle();
            }
        }
    }
}
export class JSONContainer extends ui.UI {
    constructor(data, collapsed_children = false) {
        var json_root = new JSONRoot(null, data, collapsed_children);
        super(json_root.elem);
        this._json_root = json_root;
    }
}

// -----------------------------------------------------------

/** @extends {ui.EditModal<ExpandedTargetsProperty>} */
export class TargetConfigMenu extends ui.EditModal {
    get _target() { return app.$.targets[this._target_id]; }

    /** @param {string} target_id @param {ExpandedTargetsProperty} prop */
    constructor(target_id, title, prop) {
        super({
            "modal.title": `Configure <i>${title}</i>`,
            "modal.apply": () => {
                var value = prop.targets_prop.opts.value;
                value[target_id] = { ...this.props.raw_value };
                prop.targets_prop.opts.set_value(value, { trigger: true });
            },
            "modal.items": [prop.targets_prop.opts.value[target_id]],
        });
        this._target_id = target_id;

        var _this = this;

        /** @this {ui.InputProperty} */
        this._get_default = function () {
            return _this._target.opts[this.name];
        }

        this.config();
    }

    config() { }
}

export class LocalMediaServerTargetConfigMenu extends TargetConfigMenu {
    constructor(prop) {
        super("local", `Local Media Server`, prop);
    }
    config() {
        var use_hardware = new ui.InputProperty(`<select>`, {
            "name": "use_hardware",
            "label": "Use Hardware",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "If enabled, hardware will be used for video transcoding. If there is no hardware decoding support, it will fallback to software.",
        });
        this.props.append(use_hardware);
        var use_hevc = new ui.InputProperty(`<select>`, {
            "name": "use_hevc",
            "label": "Use HEVC",
            "options": YES_OR_NO,
            "default": this._get_default,
            "info": "Use the modern HEVC video codec (incompatible with older browsers & firefox)"
        });
        this.props.append(use_hevc);
        /* var fps_passthrough = new ui.InputProperty(`<select>`, {
            "name": "fps_passthrough",
            "label": "FPS Passthrough",
            "options": YES_OR_NO,
            "default": this._get_default,
        });
        this.props.append(fps_passthrough); */
    }
}

export class FileTargetConfigMenu extends TargetConfigMenu {
    constructor(prop) {
        super("file", `File`, prop);
    }
    config() {
        var keywords = {
            "session": "Name of the session",
            "unix": "Unix timestamp",
            "date": "Date timestamp"

        }
        var filename = new ui.InputProperty(`<input type="text">`, {
            "name": "filename",
            "label": "Output File Name",
            "default": this._get_default,
            "info": `<span>The name of the file which will be output to your session directory.<br>Special keywords:</span><ul>${Object.entries(keywords).map(([k, v]) => `<li style="margin:0">${k} => ${v}</li>`).join("")}</ul>`
        });
        this.props.append(filename);
        var format = new ui.InputProperty(`<select>`, {
            "name": "format",
            "label": "Output Format",
            "default": "flv",
            "options": [["flv", "flv"], ["matroska", "matroska"], ["mp4", "mp4"]]
        });
        this.props.append(format);
        var re = new ui.InputProperty(`<select>`, {
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
    constructor(prop) {
        super("gui", `GUI`, prop);
    }
    config() {
    }
}
export class UserConfigurationSettings extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Client Configuration",
            "modal.apply": () => {
                var value = this.props.value;
                for (var k in value) {
                    app.settings.set(k, value[k]);
                }
            }
        });

        var groups = utils.group_by(Object.entries(app.settings_prop_defs), ([k, v]) => v.__group__);
        var group_keys = Object.keys(app.settings_groups);
        group_keys.forEach((k, i) => {
            var box = new ui.Box({ header: app.settings_groups[k].title, collapsible: true, collapsed: false });
            var row = new ui.FlexRow();
            for (var [name, def] of groups.get(k)) {
                var prop_settings = {
                    "name": name,
                    "label": def.__title__,
                    "title": def.__title__,
                    "options": def.__options__,
                    "default": def.__default__,
                    "data": (_, k) => app.settings.get(k[0])
                };
                if (def.__info__) prop_settings.info = def.__info__;

                row.append(new ui.InputProperty(def.__input__, prop_settings));
            }
            box.content.append(row);
            this.props.append(box);
        });
        var ping = new ui.InputProperty(`<input type="text">`, {
            "label": "Client Ping",
            "readonly": true,
            "default": () => `${app.$._ping} ms`,
            "reset": false,
        });
        this.props.append(ping);
        this.ping_button = new ui.Button(`<button><i class="fas fa-arrows-rotate"></i></button>`, {
            "click": async () => {
                await app.$._refresh_ping();
                ping.update_next_frame();
            },
            "title": "Refresh Ping",
        });
        ping.outer_el.append(this.ping_button);


        var reset_button = new ui.Button(`<button>Reset</button>`, {
            "click": () => this.props.reset()
        });
        this.footer.append(reset_button);

        var reset_layout_button = new ui.Button(`<button>Reset Layout</button>`, {
            "click": () => {
                app.settings.set("layout", null);
                app.update_layout();
            }
        });
        this.footer.append(reset_layout_button);
        var logout_button = new ui.Button(`<button>Log Out</button>`, {
            "click": async () => {
                Cookies.remove("livestreamer_auth");
                var request = new XMLHttpRequest();
                request.onloadend = () => window.location.reload();
                request.open("get", "/unauthorise", false, "false", "false");
                request.send();
            }
        });
        this.footer.append(logout_button);
    }
}
export class KeyboardShortcutsMenu extends ui.Modal {
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
                ...app.playlist.all_commands.filter(c => c.options.view === PLAYLIST_VIEW.LIST && c.shortcut()).map(c => [c.shortcut_alt(), c.description_or_label()])
            ],
            "Playlist (Timeline Mode)": [
                [`[Arrow Left] / [Arrow Right]`, `Select Previous / Next Item`],
                [`Mouse Wheel Up / Down`, `Zoom In & Out`],
                [`Left Click Tick Bar`, `Place Timeline Cursor`],
                ...app.playlist.all_commands.filter(c => c.options.view === PLAYLIST_VIEW.TIMELINE && c.shortcut()).map(c => [c.shortcut_alt(), c.description_or_label()])
            ]
        };
        //.replace("+", `<i class="fas fa-plus"></i>`)
        var html = Object.entries(sections).map(([name, s]) => `<table class="keyboard-shortcuts"><tr><th colspan="2">${name}</th></tr>${s.map(line => `<tr>${line.map(l => `<td>${l.replace(/\[(.+?)\]/g, `<span class="keyboard-key">$1</span>`)}</td>`).join("")}</tr>`).join("")}</table>`).join("");
        var tables = $(html);
        this.props.append(...tables);
    }
}

class FileManagerVolumeConfigurationMenu extends ui.EditModal {
    /** @param {ui.PropertyList} list_item */
    constructor(list_item) {
        var is_new = !list_item;
        super({
            "modal.title": is_new ? "New Volume" : `Edit '${list_item.value.name}'`,
            "modal.auto_apply": !is_new,
            "modal.apply": () => {
                var value = { ...this.props.value, ...subprops.value };
                if (is_new) {
                    app.request("add_volume", [value]);
                } else {
                    app.request("edit_volume", [list_item.value.id, value]);
                }
            },
            "modal.allow_invalid": false,
            "modal.items": [list_item?.value],
        });

        var name = new ui.InputProperty(`<input type="text">`, {
            "name": "name",
            "label": "Name",
            "valid": VALIDATORS.not_empty,
        });

        var opts = [];
        if (app.$._client.user.is_admin) opts.push(["LocalFileSystem", "Local File System"]);
        opts.push(["FTP", "FTP"]);

        var driver = new ui.InputProperty(`<select></select>`, {
            "name": "driver",
            "label": "Type",
            "options": opts,
            "default": opts[0][0],
        });
        driver.on("change", (e) => {
            if (e.trigger) rebuild();
        });

        var subprops = new ui.PropertyGroup();
        var rebuild = () => {
            subprops.empty();
            if (driver.value == "LocalFileSystem") {
                let root = new ui.InputProperty(`<input type="text">`, {
                    "name": "root",
                    "label": "Root",
                    "valid": VALIDATORS.not_empty,
                });
                subprops.append(root);
            } else if (driver.value == "FTP") {
                let sftp = new ui.InputProperty(`<select></select>`, {
                    "name": "sftp",
                    "label": "SFTP",
                    "options": YES_OR_NO,
                    "default": false,
                });
                sftp.on("change", (e) => {
                    if (e.trigger) port.set_value(sftp.value ? 22 : 21);
                });
                let host = new ui.InputProperty(`<input type="text">`, {
                    "name": "host",
                    "label": "Host",
                    "valid": VALIDATORS.not_empty,
                });
                let port = new ui.InputProperty(`<input type="number">`, {
                    "name": "port",
                    "label": "Port",
                    "default": () => sftp.value ? 22 : 21,
                    "valid": VALIDATORS.not_empty,
                });
                let username = new ui.InputProperty(`<input type="text">`, {
                    "name": "username",
                    "label": "Username",
                    "default": "",
                });
                let password = new ui.InputProperty(`<input type="password">`, {
                    "name": "password",
                    "label": "Password",
                    "default": "",
                });
                let path = new ui.InputProperty(`<input type="text">`, {
                    "name": "path",
                    "label": "Path",
                    "default": "/",
                    "valid": VALIDATORS.not_empty,
                });
                subprops.layout = [
                    sftp,
                    [host, port],
                    [username, password],
                    path
                ];
            }
        }

        this.props.append(name, driver, new ui.Separator(), subprops);

        var access_control = new AccessControlProperty({
            "name": "access_control",
            "label": "Access Control",
        });
        this.props.append(access_control);

        rebuild();
    }
}

export class FileManagerVolumesMenu extends ui.Modal {
    constructor() {
        super({
            "modal.title": "File Manager Volumes",
        });

        let can_edit = (list_item) => {
            var volume = app.$.volumes[list_item?.value?.id];
            return !volume?.locked && volume?.access_control._self_has_access;
        };

        for (let locked of [true, false]) {
            let list = new ui.PropertyList({
                "label": locked ? "Default Volumes" : "User Volumes",
                "empty": "No volumes",
                "item_size": 25,
                "vertical": true,
                "data": () => Object.fromEntries(Object.entries(app.$.volumes).filter(([_, v]) => v.locked == locked)),
                "new": () => {
                    return new FileManagerVolumeConfigurationMenu().show();
                },
                "can_add": !locked,
                "can_move": false,
                "can_delete": can_edit,
                "reset": false,
                "readonly": locked,
                "clipboard": false,
                ui(list_item) {
                    list_item.buttons.prepend(
                        new ui.Button(`<button title="Edit"><i class="fas fa-wrench"></i></button>`, {
                            click() {
                                new FileManagerVolumeConfigurationMenu(list_item).show();
                            },
                            disabled: () => !can_edit(list_item),
                            hidden: () => locked,
                        })
                    );
                    var e = new ui.UI(`<span class="volume-list-item"></span>`, {
                        content: () => {
                            if (!list_item.value) return;
                            var html = list_item.value.name;
                            if (list_item.value.locked) {
                                html += `<i class="fas fa-lock"></i>`;
                            }
                            return html;
                        },
                    });
                    list_item.props.append(e);
                },
            });
            if (!locked) {
                list.on("list.delete", (id) => {
                    app.request("delete_volume", [id]);
                });
            }
            this.props.append(list);
        }
    }
}
// export class FileSystemInfoMenu extends ui.Modal {
//     constructor() {
//         super({
//             "modal.title": "Local File System Tree",
//             "modal.width": "80%",
//         });
//         var uid = 0;
//         var nodes = [];
//         var percent_fraction_digits=1;
//         var path_join = (...parts)=>parts.join("/").replace(/\/+/g, "/");
//         var process = (d, parent, icon)=>{
//             var node = {};
//             node.id = ++uid;
//             nodes[node.id] = node;
//             let level = parent.level+1;
//             node.level = level;
//             node.parent = parent;
//             node.name = d[0];

//             node.path = (icon == "files") ? parent.path : path_join(parent.path, node.name);

//             if (typeof d[1] === "object") {
//                 var children = d[1];
//                 node.icon = icon || "folder";
//                 node.isdir = true;
//                 node.folders = 0;
//                 node.files = 0;
//                 node.size = 0;
//                 node.children = [];
//                 children.sort((a,b)=>(typeof b[1]==="object"?1:0)-(typeof a[1]==="object"?1:0));
//                 var i=0, len=children.length;
//                 var f = children.findIndex(c=>typeof c[1]!=="object");
//                 if (f < 1) f = len;
//                 for (;i<f;i++) {
//                     node.children.push(process(children[i], node));
//                 }
//                 if (i<len) {
//                     var files = children.slice(i);
//                     if (files.length == 1) {
//                         var f = files[0];
//                         node.children.push(process(files[0], node));
//                     } else {
//                         node.children.push(process([`[${files.length} Files]`, files], node, "files"));
//                     }
//                 }
//                 for (var c of node.children) {
//                     if (c.isdir) {
//                         node.folders += c.folders + 1;
//                         node.files += c.files;
//                     } else {
//                         node.files++;
//                     }
//                     node.size += c.size;
//                 }
//             } else {
//                 node.icon = icon || "file";
//                 node.size = d[1] || 0;
//             }
//             return node;
//         };
//         var create_bar = (p)=>{
//             var outer = document.createElement("div");
//             dom.add_class(outer, "percent-bar");
//             var inner = document.createElement("div");
//             var text = document.createElement("span");
//             inner.style.width = `${p*100}%`;
//             outer.append(inner, text);
//             text.innerText = p === undefined ? "-" : (p*100).toLocaleString(undefined, {minimumFractionDigits:percent_fraction_digits,maximumFractionDigits:percent_fraction_digits})+"%";
//             return outer;
//         }
//         var process2 = (node, parent, root_node)=>{
//             if (parent) {
//                 node.percent = (node.size / parent.size) || 0;
//             }
//             node.total_percent = (node.size / root_node.size) || 0;
//             if (node.isdir) {
//                 for (var c of node.children) {
//                     process2(c, node, root_node);
//                 }
//             }
//         };

//         var init = async()=> {
//             dom.remove_children(tbody);
//             for (let id in app.$.volumes) {
//                 if (app.$.volumes[id].driver !== "LocalFileSystem") continue;
//                 var volume = app.$.volumes[id];
//                 var loading_el = $(`<tr><td colspan="6"><i class="fas fa-sync fa-spin"></i> Loading...</td></tr>`)[0];
//                 tbody.append(loading_el);
//                 var r = await app.request("analyze_local_file_system_volume", [id]);
//                 loading_el.remove();
//                 var root_node = process(r, {path:volume.root.split("/").slice(0, -1).join("/"), level:-1}, "drive");
//                 root_node.name = volume.name
//                 process2(root_node, null, root_node);
//                 render(root_node);
//                 tbody.append(root_node.el);
//                 root_node.toggle();
//             }
//         };

//         var render = (node)=>{
//             if (node.el) return;
//             var row_el = document.createElement("tr");
//             tbody.append(row_el);

//             var name_outer_el = document.createElement("td");
//             dom.add_class(name_outer_el, "name");

//             var name_inner_el = document.createElement("div");
//             name_inner_el.style.display="flex";
//             name_inner_el.style.alignItems="center";
//             name_inner_el.style.gap="5px";
//             name_inner_el.style.paddingLeft = `${node.level * 10}px`;

//             var name_el = document.createElement("a");
//             name_el.href = get_file_manager_url({start:node.path});
//             name_el.target = "_blank";
//             name_el.innerText = node.name;
//             name_el.onclick = (e)=>{
//                 e.preventDefault();
//                 app.open_file_manager({start:node.path});
//             }

//             var arrow_el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
//             dom.set_inner_html(arrow_el, `<use href="icons.svg#chevron-right"></use>`);
//             dom.add_class(arrow_el, "arrow");
//             name_inner_el.append(arrow_el);
//             if (!node.isdir) arrow_el.style.visibility = "hidden";

//             var icon_el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
//             dom.set_inner_html(icon_el, `<use href="icons.svg#${node.icon}"></use>`);
//             name_inner_el.append(icon_el, name_el);
//             name_outer_el.append(name_inner_el);

//             var size_el = document.createElement("td");
//             dom.add_class(size_el, "size");
//             size_el.innerText = utils.format_bytes(node.size, true);
//             var files_el = document.createElement("td");
//             dom.add_class(files_el, "files");
//             files_el.innerText = node.isdir ? node.files.toLocaleString() : "-";
//             var folders_el = document.createElement("td");
//             dom.add_class(folders_el, "folders");
//             folders_el.innerText = node.isdir ? node.folders.toLocaleString() : "-";
//             var percent_el = document.createElement("td");
//             dom.add_class(percent_el, "percent");
//             percent_el.append(create_bar(node.percent));
//             var percent_total_el = document.createElement("td");
//             dom.add_class(percent_total_el, "percent-total");
//             percent_total_el.append(create_bar(node.total_percent));

//             row_el.append(name_outer_el, size_el, files_el, folders_el, percent_total_el, percent_el);
//             node.el = row_el;

//             if (node.isdir) {
//                 node.open = false;
//                 node.toggle = ()=>{
//                     var open = node.open = !node.open;
//                     dom.toggle_class(row_el, "open", open);
//                     var next = node;
//                     if (!node.sorted) {
//                         node.sorted = true;
//                         node.children.sort((a,b)=>b.size-a.size);
//                     }
//                     for (var c of node.children) {
//                         render(c);
//                         next.el.after(c.el);
//                         next = c;
//                     }
//                     var update = (n)=>{
//                         if (!n.isdir) return;
//                         var next = n;
//                         for (var c of n.children) {
//                             if (!c.el) continue;
//                             var o = open && n.open;
//                             if (o && !c.el.parentElement) {
//                                 next.el.after(c.el);
//                                 next = c;
//                             } else if (!o && c.el.parentElement) {
//                                 c.el.remove();
//                             }
//                             // c.el.style.display = (open && n.open)?"":"none";
//                             update(c);
//                         }
//                     }
//                     update(node);
//                 }
//                 arrow_el.style.cursor = "pointer";
//                 arrow_el.onclick = node.toggle;
//             }
//             return node;
//         }

//         // -------------------------------

//         var table = document.createElement("table");
//         dom.add_class(table, "files");
//         var th = document.createElement("thead");
//         table.append(th);
//         var tr = document.createElement("tr");
//         tr.append(...["Name", "Size", "Files", "Folders", "% Total", "% Parent"].map((c)=>{
//             var td = document.createElement("td");
//             dom.set_inner_html(td, c);
//             return td;
//         }))
//         th.append(tr);
//         var tbody = document.createElement("tbody");
//         table.append(tbody);
//         this.props.append(table);

//         var refresh_button = new ui.Button(`<button>Refresh</button>`, {
//             "click":()=>init()
//         });
//         this.footer.append(refresh_button)

//         this.on("show", ()=>{
//             init();
//         })
//     }
// }

class Bar extends ui.UI {
    constructor(settings) {
        super(null, settings);
        this.append(new ui.FlexRow()).append(this.label = new ui.Label({ content: () => this.get_setting("label") }));
        this.bar = new ui.UI($(`<div class="bar"></div>`)[0]);
        this.append(new ui.FlexRow()).append(this.bar);
        this.on("update", () => {
            var x = this.get_setting("value");
            var n = this.get_setting("total");
            var format = (x) => this.get_setting("format", x);
            var inner = $(`<div class="inner"></div>`)[0];
            var percent = (n == undefined) ? x : x / n;
            inner.style.width = `${Math.round(percent * 1000) / 10}%`;
            var str = (n == undefined) ? format(x || 0) : `${format(x || 0)} / ${format(n || 0)}`;
            var text = $(`<div class="text">${str}</div>`)[0];
            this.bar.empty().append(inner, text);
        });
    }
}
class Process extends ui.Column {
    constructor(name) {
        super({ gap: 5 });

        var is_running = () => app.$.processes[name].status == "online"

        var row = this.append(new ui.Row());
        dom.add_class(this.elem, "process");
        var info_ui = row.append(new ui.UI(null, { flex: 1 }));
        var name_ui = info_ui.append(new ui.UI());
        var description_ui = info_ui.append(new ui.UI());
        var buttons_ui = row.append(new ui.Row({ gap: 5 }));
        var stats_ui = this.append(new ui.Row({ justify: "right" }));
        var restart_button = new ui.Button(`<button>RESTART</button>`, {
            "content": () => is_running() ? "RESTART" : "START",
            "click_async": async () => {
                await app.request(`module_restart`, [name]);
            }
        });
        var stop_button = new ui.Button(`<button>STOP</button>`, {
            "click_async": async () => {
                await app.request(`module_stop`, [name]);
            },
            hidden: () => !is_running()
        });
        var buttons = [restart_button, stop_button];
        if (name === "main" || name === "core") buttons = [restart_button];
        buttons_ui.append(...buttons);

        this.on("update", () => {
            var conf_name = app.$.processes[name]["title"];
            var conf_desc = app.$.processes[name]["description"];
            var p = app.$.processes[name];
            var color = null;
            if (p.status.match(/(online|launch)/)) color = "#0a0";
            else if (p.status.match(/stop/)) color = "#666";
            else if (p.status.match(/error/)) color = "f00";
            dom.set_inner_html(name_ui.elem, `${conf_name} [<span class="status">${p.status.toUpperCase()}</span>]`);
            var status_el = name_ui.elem.querySelector(".status");
            status_el.style.color = color;
            name_ui.elem.style["font-weight"] = "bold";
            dom.set_inner_html(description_ui.elem, conf_desc);

            if (name == "core") {
                stats_ui.elem.style.display = "none";
                return;
            }
            var pinfo = app.$.sysinfo.processes[p.pid] || {};
            var cpu = Number((pinfo.cpu || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
            var mem = utils.format_bytes(pinfo.memory || 0, true);
            var uptime = utils.ms_to_human_readable_str(pinfo.elapsed || 0);
            var s = {
                "CPU": cpu,
                "Memory": mem,
                "Transfer rate": `↑ ${utils.format_bytes(pinfo.sent || 0, true)}ps ↓ ${utils.format_bytes(pinfo.received || 0, true)}ps`,
                "Uptime": uptime,
            };
            dom.set_inner_html(stats_ui.elem, Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(" | "));
        })
    }
}

export class SystemManagerMenu extends ui.Modal {
    constructor() {
        super({
            "modal.title": "System Manager",
        });
        var uptime = this.props.append(new ui.UI(null, {
            "update": () => {
                dom.set_inner_html(uptime.elem, `System uptime: ${utils.ms_to_human_readable_str(app.$.sysinfo.uptime * 1000)}`);
            }
        }));
        var transfer = this.props.append(new ui.UI(null, {
            "update": () => {
                dom.set_inner_html(transfer.elem, `Transfer rate: ↑ ${utils.format_bytes(app.$.sysinfo.sent, true)}ps ↓ ${utils.format_bytes(app.$.sysinfo.received, true)}ps`);
            }
        }));
        this.props.append(new Bar({
            label: "Disk",
            value: () => app.$.disk.used,
            total: () => app.$.disk.total,
            format: (x) => utils.format_bytes(x, true)
        }));
        this.props.append(new Bar({
            label: "Memory",
            value: () => app.$.sysinfo.memory.total - app.$.sysinfo.memory.free,
            total: () => app.$.sysinfo.memory.total,
            format: (x) => utils.format_bytes(x, true)
        }));
        this.props.append(new Bar({
            label: "CPU Usage",
            value: () => app.$.sysinfo.cpu_avg,
            format: (x) => Number(x * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
        }));

        var process_wrapper = new ui.UI();
        process_wrapper.append(`<label>Processes</label>`)
        var process_container = new ui.FlexColumn({ gap: 5 });
        process_wrapper.append(process_container);
        this.props.append(process_wrapper);

        this.on("update", () => {
            var processes = Object.keys(app.$.processes);
            // utils.sort(processes, (p)=>p==="main"?0:1);
            dom.rebuild(process_container.elem, processes, {
                id_callback: (p) => p,
                add: (p, elem, i) => {
                    if (!elem) elem = new Process(p).elem;
                    return elem;
                }
            });
        });

        this.on("before-show", () => {
            app.request("subscribe_sysinfo", [true]);
        })
        this.on("hide", () => {
            app.request("subscribe_sysinfo", [false]);
        })
    }
}

/** @typedef {import("../../media-server/exports.js").Live$} Live$ */

class LiveUI extends ui.Box {
    /** @param {Live$} live */
    constructor(live) {
        super({
            header: `Live #${live.id}`,
            collapsible: true,
            collapsed: true
        });
        this.elem.classList.add("live-ui");
        var ts = Date.now();
        var stats = $(`<div class="stats"></div>`)[0];
        this.content.append(stats);

        var destroyed = false;
        var stopped = false;
        var row = new ui.FlexRow();
        var stop_button = new ui.Button(`<button>Stop Live</button>`, {
            "click_async": async () => {
                await app.request("stop_live", [live.id]);
                stopped = true;
                this.update();
            },
            "hidden": () => stopped || live.state == "stopped"
        });
        var destroy_button = new ui.Button(`<button>Destroy Live</button>`, {
            "click_async": async () => {
                if (window.confirm("Are you sure you want to destroy this live?")) {
                    await app.request("destroy_live", [live.id]);
                    destroyed = true;
                    this.update();
                }
            },
            "hidden": () => destroyed
        });
        row.append(stop_button, destroy_button);
        this.content.append(row);

        this.on("update", () => {
            var is_ended = (live.state == "stopped");
            var props = {
                "Is Live": live.is_live ? "Yes" : "No",
                "Started": new Date(live.start_ts).toLocaleString(),
                "Ended": is_ended ? new Date(live.stop_ts).toLocaleString() : "",
                "Stop Reason": is_ended ? live.stop_reason : "",
                "Duration": utils.ms_to_human_readable_str(live.duration),
                "Segment Duration": utils.ms_to_human_readable_str(live.segment_duration * 1000),
                "Segments": `${Math.max(...Object.values(live.segments)) || 0}`,
                "Last Active": live.ts ? new Date(live.ts).toLocaleString() : "",
                "Expires In": live.ts ? utils.ms_to_human_readable_str(live.ts + (app.$.conf["media_expire_time"] * 1000) - ts) : "",
                "Size on Disk": utils.format_bytes(live.size, true),
                "Link": `<a href="${live.url}" target="_blank">${live.url}</a>`,
            };
            var html;
            if (destroyed) {
                html = `<p>Destroyed</p>`;
            } else {
                html = Object.entries(props).filter(([k, v]) => v).map(([k, v]) => `<p><span><b>${k}</b>:</span><span>${v}</span></p>`).join("");
            }
            dom.set_inner_html(stats, html);
        });
    }
}

export class LiveManagerMenu extends ui.Modal {
    constructor() {
        super({
            "modal.title": "Live Manager",
            "modal.load": () => {
                refresh();
            }
        });

        /** @type {Live$[]} */
        var lives = [];
        var refresh = async () => {
            lives = await app.request("get_lives");
            this.update();
        };
        var rebuild = () => {
            var filtered = lives.filter(l => filter.value == "all" || (filter.value == "live" && l.is_live) || (filter.value == "ended" && !l.is_live));
            var sorted = filtered.sort((a, b) => sorting.value == "asc" ? a.ts - b.ts : b.ts - a.ts);
            dom.rebuild(list, sorted, {
                add: (d, elem, i) => new LiveUI(d).elem
            });
        };

        var row = new ui.FlexRow();
        this.props.append(row);

        var filter = new ui.InputProperty(`<select>`, {
            "label": "Filter",
            "options": [["all", "All"], ["live", "Live"], ["ended", "Ended"]],
            "default": "all",
        });

        var sorting = new ui.InputProperty(`<select>`, {
            "label": "Sort",
            "options": [["desc", "Descending"], ["asc", "Ascending"]],
            "default": "desc",
        });

        var refresh_button = new ui.Button(`<button>Refresh <i class="fas fa-sync"></i></button>`, {
            "click_async": refresh
        });
        row.append(filter, sorting, refresh_button);

        var list = $(`<div class="live-list"></div>`)[0];
        this.props.append(list);

        var last_hash = "";
        this.on("update", () => {
            var hash = JSON.stringify({ filter: filter.value, sorting: sorting.value, lives });
            if (hash != last_hash) {
                last_hash = hash;
                rebuild();
            }
        });
    }
}

/** @extends {ui.Modal<string>} */
export class FileManagerMenu extends ui.Modal {
    constructor(url) {
        super({
            "modal.title": "",
            "modal.width": "100%",
            "modal.close": false,
        });
        Object.assign(this.modal_elem.style, {
            "height": "100%",
            "min-height": "200px",
        });
        Object.assign(this.content.elem.style, {
            "padding": 0,
            "height": "100%",
        });
        this.props.elem.style.height = "100%";
        /** @type {HTMLIFrameElement} */
        this.iframe = $(`<iframe allowfullscreen="allowfullscreen" allow="autoplay; fullscreen" scrolling="auto" width="100%" height="100%" frameBorder="0"></iframe>`)[0];
        this.props.elem.append(this.iframe);

        this.on("before-show", () => {
            this.iframe.src = url;
        });
    }
}


export class ScheduleGeneratorMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Schedule Generator",
            "modal.items": () => [app.settings.get("schedule_generator") || {}],
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.start_time = new ui.InputProperty(`<input type="time">`, {
                "name": "start_time",
                "label": "Start Time",
                "default": () => "00:00" //new Date().toLocaleTimeString().slice(0,5)
            }),
            this.time_rounding = new ui.InputProperty(`<select>`, {
                "name": "time_rounding",
                "label": "Time Rounding",
                "default": 5 * 60,
                "options": [[1 * 60, "None"], [5 * 60, "5 mins"], [10 * 60, "10 mins"], [15 * 60, "15 mins"]],
            }),
            this.min_duration_filter = new ui.InputProperty(`<select>`, {
                "name": "min_duration_filter",
                "label": "Minimum Duration Filter",
                "default": 0,
                "options": [[0, "None"], ...[10, 30, 1 * 60, 2 * 60, 5 * 60, 10 * 60].map(f => [f, utils.seconds_to_human_readable_str(f)])],
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
            this.remove_ext = new ui.InputProperty(`<select>`, {
                "name": "remove_ext",
                "label": "Remove File Extensions",
                "default": true,
                "options": YES_OR_NO,
            }),
            this.use_labels = new ui.InputProperty(`<select>`, {
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

        this.props.on("change", (e) => {
            if (!e.name || !e.trigger) return;
            app.settings.set("schedule_generator", this.props.raw_value);
        });

        this.on("update", () => {
            var day = 60 * 60 * 24;
            var t = this.start_time.value;
            var time = utils.timespan_str_to_seconds(t, "hh:mm");
            var r = this.time_rounding.value;
            var min = this.min_duration_filter.value;
            var rows = [];
            var add_line = (name) => {
                var time_r = Math.round(time / r) * r;
                time_r %= day;
                var time_str = utils.seconds_to_timespan_str(time_r, "hh:mm");
                rows.push(`${time_str} - ${name}`);
            };
            /** @param {PlaylistItem$} item */
            var walk = (item) => {
                if (!item._is_normal_playlist) {
                    var t = item._userdata.duration;
                    if (t && t >= min) {
                        var name = item._get_pretty_name({ ext: !this.remove_ext.value, label: this.use_labels.value });
                        add_line(name);
                    }
                    time += t;
                }
                if (!item._is_merged_playlist) {
                    for (var c of item._children) walk(c);
                }
            }
            app.$._session.playlist["0"]._children.forEach(c => walk(c));
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

/* export class FontSettings extends EditModal {
    constructor() {
        super({
            "modal.title": `Font Manager`,
        });

        dom.add_class(this.elem, "font-manager");

        var row = this.props.append(new ui.FlexRow());
        
        var left_elem = $(`<div class="left"></div>`)[0];
        var list_wrapper = $(`<div class="content" data-overlayscrollbars-initialize></div>`)[0];
        var list_inner = OverlayScrollbars(list_wrapper, {}).elements().viewport;
        var list = new SelectableList();
        list_inner.append(list.elem);
        var left_footer_elem = $(`<div class="footer"></div>`)[0];
        left_elem.append(list_wrapper, left_footer_elem);
        left_elem.style.height="300px";
        left_elem.style.display="flex";
        list.elem.style.flex = "1";

        var right_elem = $(`<div class="right"></div>`)[0];
        var info_wrapper = $(`<div class="content" data-overlayscrollbars-initialize></div>`)[0]
        var info_elem = OverlayScrollbars(info_wrapper, {}).elements().viewport;
        var right_footer_elem = $(`<div class="footer"></div>`)[0];
        right_elem.append(info_wrapper, right_footer_elem);

        row.append(left_elem, right_elem);

        // app.load_font
        var fd = new FileDrop(list.elem);
        fd.on("drop", (files)=>{
            app.upload_queue.add(files, {dir:"/fonts"});
        })
        
        var add_button = new ui.Button(`<button>Add New Font</button>`, {
            "click":async ()=>{
                var files = dom.upload(`application/font-sfnt,application/font-sfnt`, true)
                app.upload_queue.add(files, {dir:"/fonts"});
            },
            "disabled":()=>!list.selected,
        });

        left_footer_elem.append(add_button);
        
        var delete_button = new ui.Button(`<button>Delete</button>`, {
            "click":async ()=>{
                await app.request("delete_font", [list.selected.id]);
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
            // dom.empty(info_elem);
        });

        this.on("before-show", async ()=>{
            list.select(null);
        });
    }

    destroy() {
        super.destroy();
        list.destroy();
    }
} */

/** @extends {ui.EditModal<PlaylistItem$>} */
export class SplitMenu extends ui.EditModal {
    constructor(items) {
        super({
            "modal.title": () => `Split ${get_items_title_html(items)}`,
            "modal.ok": "Split",
            "modal.auto_apply": false,
            "modal.apply": () => {
                app.playlist_split(this.items, this.get_splits(), true);
                this.time_list.set_value([]);
            },
            "modal.items": items,
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.split_type = new ui.InputProperty(`<select>`, {
                "name": "split_type",
                "label": "Split Method",
                "options": [["total", "# of Parts"], ["duration", "Duration"], ["time_list", "List of Time Codes"], ["every_chapter", "Every Chapter"], ["chapter_list", "List of Chapters"]],
                "default": "time_list",
            })
        );

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.total = new ui.InputProperty(`<input type="number"></input>`, {
                "name": "total",
                "label": "# of Parts",
                "info": `Number of pieces (evenly split)`,
                "default": 1,
                "min": 1,
                "hidden": () => this.split_type.value != "total",
            }),
            this.duration = new ui.TimeSpanProperty({
                "name": "duration",
                "label": "Duration",
                "timespan.format": "h:mm:ss.SSS",
                "info": `Every specified time span`,
                "default": 0,
                "min": 0,
                "hidden": () => this.split_type.value != "duration",
            }),
            this.time_list = new ui.TextAreaProperty({
                "name": "time_list",
                "label": "List of Time Codes",
                "info": `Comma separated list of time-codes like '1:03, 00:30:00, 1:02:57.333'`,
                "textarea.rows": 1,
                "textarea.grow": true,
                "textarea.return_blur": true,
                "default": [],
                "hidden": () => this.split_type.value != "time_list",
            }),
            this.chapter_list = new ui.TextAreaProperty({
                "name": "chapter_list",
                "label": "Chapter List",
                "info": `Comma separated list of chapters (zero-based) like '0, 1, 5, 6'`,
                "textarea.rows": 1,
                "textarea.grow": true,
                "textarea.return_blur": true,
                "default": [],
                "hidden": () => this.split_type.value != "chapter_list",
            })
        );

        var delimiter_regex = /[,;|\s]+/;
        var pos_int = v => Math.floor(Math.abs(parseFloat(v))) || 0;
        this.total.input_modifiers.push(v => pos_int(v));
        this.total.output_modifiers.push(v => String(v));
        var valid_time = (v) => v && v > 0 && v < this.seek.get_setting("seek.duration");
        var valid_chapter = (v) => this.seek.get_setting("seek.chapters")[v] !== undefined;
        this.time_list.input_modifiers.push(v => {
            return [...v.split(delimiter_regex)].map(v => utils.timespan_str_to_seconds(v)).filter(valid_time)
        });
        this.time_list.output_modifiers.push(v => {
            if (v.length == 1 && !v[0]) return "";
            return v.map(v => utils.seconds_to_timespan_str(v, "h?:mm:ss.SSS")).join(", ")
        });
        this.chapter_list.input_modifiers.push(v => [...v.split(delimiter_regex)].map(v => pos_int(v)).filter(valid_chapter));
        this.chapter_list.output_modifiers.push(v => v.join(", "));

        [this.split_type, this.total, this.duration, this.time_list, this.chapter_list].forEach(p => {
            p.on("change", (e) => {
                if (e.trigger) this.update_markers();
            })
        });

        var row = this.props.append(new ui.FlexRow());
        row.append(
            this.seek = new SeekBar({
                "label": () => `Timeline [${utils.seconds_to_timespan_str(this.seek.get_setting("seek.duration"), app.user_time_format)}]`,
                "info": `Add markers to the list with mouse click, click marker to remove, click & drag marker to move.`,
                "seek.add_markers": true,
                // "seek.show_times": false,
            })
        )
        this.seek.on("markers-change", () => {
            this.split_type.set_value("time_list");
            var times = this.seek.get_setting("seek.markers").map(m => m.time);
            times = utils.sort(times);
            this.time_list.set_value(times);
        });

        this.on("show", () => {
            this.seek.settings["seek.duration"] = this.items[0]._userdata.duration;
            this.settings["seek.chapters"] = this.items[0]._userdata.chapters;
            this.update_markers();
        });
    }

    get_splits() {
        var max = 128;
        var d = this.seek.get_setting("seek.duration");
        var chapters = this.seek.get_setting("seek.chapters");
        if (this.split_type.value == "total") {
            var v = this.total.value;
            var n = v ? Math.min(max, v) : 1;
            return [...Array(n - 1)].map((_, i) => (d / n) * (i + 1));
        }
        if (this.split_type.value == "duration") {
            var v = this.duration.value;
            var n = v ? Math.min(max, Math.floor(d / v)) : 0;
            return [...Array(n)].map((_, i) => v * (i + 1));
        }
        if (this.split_type.value == "time_list") {
            return this.time_list.value;
        }
        if (this.split_type.value == "every_chapter") {
            chapters = chapters.map(c => c.start);
            chapters = chapters.filter(t => t > 1 && t < d - 1);
            return chapters;
        }
        if (this.split_type.value == "chapter_list") {
            return chapters.filter((c, i) => this.chapter_list.value.includes(i)).map(c => c.start);
        }
    }

    update_markers() {
        this.seek.clear_markers();
        this.get_splits().forEach(t => this.seek.add_marker(t));
        this.update();
    };
}

/** @extends {ui.EditModal<PlaylistItem$>} */
export class CropEditMenu extends ui.EditModal {
    /** @param {ui.MultiInputProperty} crop_property @param {DetectedCrop$} data @param {Rectangle} rect */
    constructor(crop_property, data, index) {
        super({
            "modal.title": "Crop Editor",
            "modal.ok": "Save",
            "modal.apply": () => {
                var new_val = [cp.rect.left, cp.rect.top, 1 - cp.rect.right, 1 - cp.rect.bottom];
                crop_property.set_value(new_val, { trigger: true });
            }
        });

        let vals = crop_property.value;
        let rect = new utils.Rectangle({ left: vals[0], top: vals[1], right: 1 - vals[2], bottom: 1 - vals[3] });

        var default_rect = new utils.Rectangle(0, 0, 1, 1);
        var detected_crop_rect = new utils.Rectangle(0, 0, 1, 1);

        var reset_button = new ui.Button(`<button>Set to Detected</button>`, {
            "disabled": () => cp.rect.equals(detected_crop_rect),
            "click": () => cp.update_crop(detected_crop_rect),
        })
        var reset_button2 = new ui.Button(`<button>Reset</button>`, {
            "disabled": () => cp.rect.equals(default_rect),
            "click": () => cp.update_crop(default_rect),
        })
        this.footer.append(reset_button, reset_button2);

        var container = $(`<div class="crop-editor-container"></div>`)[0];
        var crop_container = $(`<div></div>`)[0];
        /** @type {CropPreview} */
        var cp;
        container.append(crop_container);

        var row = new ButtonGroup();
        row.elem.style.margin = "auto";
        var left = new ui.Button(`<button class="icon"><i class="fas fa-arrow-left"></i></button>`, {
            "title": "Previous",
            "flex": "none",
            "click": () => update(index - 1)
        })
        var page = new ui.InputProperty(`<span contenteditable="true">`, {
            "width": "50px",
        });
        var right = new ui.Button(`<button class="icon"><i class="fas fa-arrow-right"></i></button>`, {
            "title": "Next",
            "flex": "none",
            "click": () => update(index + 1)
        })
        row.append(left, page, right);
        container.append(row);
        this.props.append(container);

        var update = (i) => {
            dom.remove_children(crop_container);
            index = i = utils.loop(i, 0, data.crops.length);
            var c = data.crops[i];
            detected_crop_rect = c.rect;
            if (cp) rect = cp.rect;
            cp = new CropPreview(c.url, c.rect, rect, true, data.width, data.height);
            cp.on("change", () => {
                this.update()
            });
            crop_container.append(cp);
            page.value = `${i + 1} / ${data.crops.length}`;
            this.update();
        };
        page.on("change", (e) => {
            if (e.trigger) update(parseInt(e.value) - 1);
        });
        update(index);
    }

}


/** @extends {ui.EditModal<Session$>} */
export class ScheduleStreamMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Schedule Stream Start",
            "modal.apply": () => {
                app.request("session_update_values", [this.props.value]);
            },
            "modal.items": [app.$._session],
        });

        this.schedule_start_time = new ui.DateTimeProperty({
            "name": "schedule_start_time",
            "label": function () {
                var n = `Start Date/Time`;
                if (this.value) {
                    n += ` (<i>${utils.time_diff_readable(Date.now(), new Date(this.value)) || "-"}</i>)`;
                }
                return n;
            },
            "default": null,
            "datetime.after_now": true,
        })

        var row = this.props.append(new ui.FlexRow());
        row.append(this.schedule_start_time);

        var interval = setInterval(() => {
            this.update();
        }, 1000);

        this.on("destroy", () => {
            clearInterval(interval);
        });
    }
}

/** @extends {ui.EditModal<Session$>} */
export class SessionConfigurationMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Session Configuration",
            "modal.apply": () => {
                app.request("session_update_values", [this.props.value]);
            },
            "modal.items": [app.$._session],
        });

        function _get_property_opts(name, cb) {
            var p = InternalSessionProps[name];
            return get_property_opts(p, cb);
        }

        this.name = new ui.InputProperty(`<input type="text">`, {
            ..._get_property_opts("name"),
            "name": "name",
            "label": "Session Name",
            "default": app.$._session.name,
            "nullify_default": false,
        });
        this.name.validators.push(VALIDATORS.not_empty);

        /* this.default_stream_title = new ui.Property(`<input type="text">`, {
            "name": "default_stream_title",
            "label": "Default Stream Title",
            "placeholder":()=>this.name.value,
            "reset": true,
        }); */

        this.create_ts = new ui.InputProperty(`<input type="text">`, {
            "label": "Creation Date",
            "readonly": true,
            "default": () => new Date(this.item.create_ts).toLocaleString(),
        });

        this.stream_host = new ui.InputProperty(`<input type="text">`, {
            "label": "Stream Host",
            "readonly": true,
            "copy": true,
            "info": "Connect and stream to dynamic RTMP playlist items. Use this RTMP host and key in OBS or your streaming software of preference",
            "default": () => app.$.conf["rtmp_server_url"],
        });

        this.stream_key = new ui.TextAreaProperty({
            "label": "Stream Key",
            "textarea.rows": 1,
            "textarea.grow": true,
            "textarea.break_all": true,
            "readonly": true,
            "copy": true,
            "default": () => `session/${app.$._session.id}`,
        });
        this.background_mode = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("background_mode"),
            "name": "background_mode",
            "label": "Background Mode",
        });

        this.background_color = new ui.InputProperty(`<input type="color">`, {
            ..._get_property_opts("background_color"),
            "name": "background_color",
            "label": "Background Color",
        });

        var video_file_props = create_file_start_end_properties({
            "type": "video",
            ..._get_property_opts("video_file"),
            "name": "video_file",
            "label": "Background File",
            "hidden": () => this.background_mode.value !== "file",
        })
        this.video_file = video_file_props.file;
        this.video_file_start = video_file_props.start;
        this.video_file_end = video_file_props.end;

        this.files_dir = new FileProperty({
            ..._get_property_opts("files_dir"),
            "name": "files_dir",
            "label": "Session Directory",
            "info": "Your preferred location for storing any uploaded / downloaded files.",
            "file.options": { folders: true },
            "file.check_media": true,
        });
        this.files_dir.validators.push(VALIDATORS.media_exists);

        this.access_control = new AccessControlProperty({
            ..._get_property_opts("access_control"),
            "name": "access_control",
            "label": "Access Control",
            "info": "Owners: Full access.\nAllowed: Full access but cannot edit session confugration, delete the session, load/save session files or access history.\nDenied: No access rights whatsoever.",
        });
        this.props.on("update", () => {
            var layout = [
                [this.name],
                // [this.default_stream_title],
                [this.create_ts]
            ];
            if (this.props.item.type === constants.SessionTypes.INTERNAL) {
                layout.push(
                    [this.stream_host], [this.stream_key],
                    [this.background_mode, this.background_color],
                    [this.video_file, this.video_file_start, this.video_file_end],
                    [this.files_dir],
                    [this.auto_reconnect, this.auto_reconnect_delay, this.auto_reconnect_max_attempts],
                );
                if (!IS_ELECTRON) {
                    layout.push([this.access_control]);
                }
            }
            this.props.layout = layout;
        });
    }
}

export class AdminMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Admin",
        });
    }
}

export class ChangeLogMenu extends ui.Modal {
    constructor() {
        var html;
        super({
            "modal.title": "Change Log",
            "modal.min-width": "750px",
            "modal.load": async () => {
                html = await (await (fetch("./changes.md"))).text();
            },
        });
        this.on("before-show", () => {
            dom.set_inner_html(this.props.elem, `<div>${html}</div>`);
            Object.assign(this.props.elem.style, {
                // "font-family": "monospace",
                "font-size": "16px",
            });
            app.settings.set("last_change_log", app.$.change_log.mtime);
        })
    }
}

export class UploadsDownloadsMenu extends ui.Modal {
    constructor() {
        super({
            "modal.title": "Uploads / Downloads",
            "modal.width": "70%",
        });
        var types = ["uploads", "downloads"];
        this.on("update", () => {
            var content = new ui.UI();
            var stats = types.map(t => `Total ${t.slice(0, -1)} rate: ${utils.format_bytes(utils.sum(Object.values(app.$[t]).map(u => u.speed)), true) + "ps"}`).join(" | ");
            content.append(...$(`<div>${stats}</div>`));
            Object.assign(this.props.elem.style, { "white-space": "pre-wrap", "word-break": "break-all", "font-family": "monospace" });
            for (var type of types) {
                var rows = [];
                var header = {
                    "dest_path": {
                        name: "Filename",
                    },
                    "rate": {
                        name: "Rate",
                        style: "white-space: nowrap",
                    },
                    "bytes": {
                        name: utils.capitalize(type.slice(0, -1)) + "ed",
                        style: "white-space: nowrap",
                    },
                    "total": {
                        name: "Total",
                        style: "white-space: nowrap",
                    },
                    "progress": {
                        name: "Progress",
                        style: "white-space: nowrap",
                    }
                };
                for (var [id, u] of Object.entries(app.$[type])) {
                    rows.push({
                        id,
                        ...u,
                        rate: utils.format_bytes(u.speed, true) + "ps",
                        bytes: utils.format_bytes(u.bytes, true),
                        total: utils.format_bytes(u.total, true),
                        progress: `${((u.bytes / u.total) * 100).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
                    });
                }
                var table = dom.build_table(rows, { header, empty: `No active ${type}` });
                content.append(table);
            }
            dom.sync_dom(this.props.elem, content.elem, { attrs: false });
        });
    }
}

export class MediaInfoLine extends ui.UI {
    constructor(key, value, type) {
        super();
        if (type == "bytes") {
            value = +value ? utils.format_bytes(+value, true) : "Unknown";
        } else if (type == "bitrate") {
            value = +value ? utils.format_bits(+value, true) + "ps" : "Unknown";
        } else if (type == "boolean") {
            value = value ? "Yes" : "No";
        } else if (type == "format") {
            value = String(value).split(/,\s*/).join(", ");
        } else if (type == "timespan") {
            value = utils.seconds_to_timespan_str(+value);
        } else if (type == "datetime") {
            value = new Date(+value).toLocaleString();
        } else if (type == "fps") {
            value = (+value).toFixed(3).replace(/\.?0+$/, "");
        }
        this.elem.classList.add("media-info-line");
        this.elem.innerHTML = `<span class="key">${key}:</span><span class="value">${value}</span>`
    }
}

export class PlaylistItemInfoMenu extends ui.Modal {
    /** @param {PlaylistItem$[]} items */
    constructor(items, all_collapsed = false) {

        var name;
        if (items.length == 1) {
            name = `<i>${items[0]._get_pretty_name()}</i>`;
        } else {
            name = `[${items.length} Items]`
        }
        super({
            "modal.title": name,
        });

        var simple_toggle = new ui.Button("<button>Simple</button>", {
            click: () => {
                app.settings.toggle("playlist_item_info_simple");
                update();
            }
        })
        this.props.append(simple_toggle);

        var container = new ui.UI();
        container.elem.classList.add("playlist-item-info");
        this.props.append(container);

        var update = () => {
            container.empty();
            var simple = app.settings.get("playlist_item_info_simple");
            if (simple) {
                for (var item of items) {
                    let mi = item._media_info;
                    var box = new ui.Box({ header: mi.filename });
                    // box.content.append(new MediaInfoLine(`File Name`, mi.filename));
                    box.content.append(new MediaInfoLine(`File Exists`, mi.exists, "boolean"))
                    if (mi.exists) {
                        box.content.append(new MediaInfoLine(`File Size`, mi.size, "bytes"));
                        box.content.append(new MediaInfoLine(`Last Modified`, mi.mtime, "datetime"));
                        box.content.append(new MediaInfoLine(`Duration`, mi.duration, "timespan"));
                        box.content.append(new MediaInfoLine(`Format`, mi.format, "format"));;
                        box.content.append(new MediaInfoLine(`Bit Rate`, mi.bitrate, "bitrate"));
                        if (mi.chapters && mi.chapters.length) {
                            let chapters = new ui.Box({ header: `Chapters` })
                            for (var c of mi.chapters) {
                                chapters.content.append(new MediaInfoLine(c.title, utils.seconds_to_timespan_str(c.start)));
                            }
                            box.content.append(chapters);
                        }
                        if (mi.streams && mi.streams.length) {
                            let streams = new ui.Box({ header: `Streams` })
                            for (var s of mi.streams) {
                                let box = new ui.Box()
                                let flags = { forced: s.forced, default: s.default, albumart: s.albumart, interlaced: s.interlaced };
                                let flags_arr = Object.entries(flags).filter(([k, v]) => v).map(([k, v]) => utils.capitalize(k));
                                if (s.title) {
                                    box.content.append(new MediaInfoLine(`Title`, utils.capitalize(s.title)));
                                }
                                box.content.append(new MediaInfoLine(`Type`, utils.capitalize(s.type)));
                                box.content.append(new MediaInfoLine(`Codec`, s.codec));
                                box.content.append(new MediaInfoLine(`Bit Rate`, s.bitrate, "bitrate"));
                                if (s.fps) {
                                    box.content.append(new MediaInfoLine(`Frame Rate`, s.fps, "fps"));
                                }
                                if (s.duration) {
                                    box.content.append(new MediaInfoLine(`Duration`, s.duration, "timespan"));
                                }
                                if (flags_arr.length) {
                                    box.content.append(new MediaInfoLine(`Flags`, flags_arr.join(", ")));
                                }
                                // autocomplete 
                                if (s.width && s.height) {
                                    box.content.append(new MediaInfoLine(`Resolution`, `${s.width}x${s.height}`));
                                }
                                if (s.field_order) {
                                    box.content.append(new MediaInfoLine(`Field Order`, utils.capitalize(s.field_order)));
                                }
                                if (s.sar && s.sar != 1) {
                                    box.content.append(new MediaInfoLine(`Sample Aspect Ratio`, utils.float_to_fraction(s.sar)));
                                }
                                if (s.dar) {
                                    box.content.append(new MediaInfoLine(`Display Aspect Ratio`, utils.float_to_fraction(s.dar)));
                                }
                                if (s.channels) {
                                    box.content.append(new MediaInfoLine(`Audio Channels`, s.channels.toLocaleString()));
                                }
                                streams.content.append(box);
                            }
                            box.content.append(streams);
                        }
                    }
                    container.append(box);
                }
            } else {

                var special_keys = {
                    "_media_info": {
                        label: "media_info",
                        expanded: true
                    },
                    "_info": "info",
                    "_userdata": "userdata"
                };
                special_keys = Object.fromEntries(Object.entries(special_keys).map(([k, o]) => (typeof o === "object") ? [k, o] : [k, { label: o, expanded: false }]));

                let data = items.map(item => {
                    var copy = {};
                    for (var k in item) {
                        if (k.startsWith("_")) continue;
                        copy[k] = item[k];
                    }
                    for (var k in special_keys) {
                        var o = special_keys[k];
                        copy[o.label] = item[k];
                    }
                    return copy;
                })

                if (data.length == 1) {
                    data = data[0];
                }

                var json = new JSONContainer(data, all_collapsed);
                var json_root = json._json_root;

                for (let k in special_keys) {
                    let o = special_keys[k];
                    let n = json_root.find(o.label);
                    if (n && !o.expanded) {
                        n.toggle(true);
                    }
                }
                container.append(json);
            }
            simple_toggle.settings.content = simple ? "Simple Mode" : "Expert Mode";
            simple_toggle.update();
        }
        update();
    }
}

export class SetTimePosMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Precise Seek",
            "modal.width": "400px",
            "modal.ok": "Seek",
            "modal.apply": () => {
                app.seek(time_pos.value);
            }
        });
        var chapter_select = new ui.InputProperty(`<select>`, {
            "label": "Chapter",
            "options": () => {
                return app.$._session._current_playlist_item._userdata.chapters.map((c, i) => [i, app.chapter_to_string(c, true)])
            },
            "reset": false,
            "hidden": () => app.$._session._current_playlist_item._userdata.chapters.length == 0,
        });
        var time_pos = new ui.TimeSpanProperty({
            "label": "Time",
            "timespan.format": () => "h:mm:ss.SSS",
            "min": 0,
            "reset": false,
        })
        var row = this.props.append(new ui.FlexRow());
        row.append(chapter_select, time_pos);
        time_pos.on("change", (e) => {
            chapter_select.set_value((app.$._session._get_current_chapter_at_time(e.value) || EMPTY_OBJECT).index);
        })
        chapter_select.on("change", (e) => {
            if (!e.trigger) return;
            var c = app.$._session._current_playlist_item._userdata.chapters[e.value];
            time_pos.set_values(c.start);
        })
        time_pos.set_value(app.$._session.time_pos);
    }
}

export class SetVolumeSettings extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Precise Volume Adjustment",
            "modal.apply": () => {
                app.media_player.volume.set_value(volume_input.value, { trigger: true });
                app.media_player.volume_speed.set_value(volume_speed.value, { trigger: true });
            }
        });

        //<div style="padding:0 5px; border-left: 1px solid #aaa; border-bottom: 1px solid #aaa;">
        var volume_input = new ui.InputProperty(`<input type="number">`, {
            "label": "Volume (%)",
            "data": app.$._session.volume_target,
            ...get_property_opts(InternalSessionProps.volume_target),
        });
        volume_input.on("change", (e) => {
            if (e.trigger) volume_slider.set_value(e.value);
        })

        var volume_speed = new ui.InputProperty(`<input type="number">`, {
            "label": "Volume Transition Speed",
            ...get_property_opts(InternalSessionProps.volume_speed),
            "data": app.$._session.volume_speed,
        });

        var volume_slider = new ui.InputProperty(`<input type="range">`, {
            "label": "Volume (%)", //  style="margin-right:5px"
            "step": 1,
            "min": 0,
            "max": 200,
            "reset": false,
            "dblclick": () => volume_slider.reset(),
            "data": app.$._session.volume_target,
        });
        volume_slider.set_value(app.$._session.volume_target);
        volume_slider.on("change", (e) => {
            volume_input.set_value(e.value, { trigger: false });
        })
        this.props.layout = [
            [volume_input, volume_speed],
            [volume_slider],
        ]
    }
}

export class FadeOutSettings extends ui.Modal {
    constructor() {
        super({
            "modal.title": "Fade To Next Item",
        });

        var fade_out_speed = new ui.InputProperty(`<input type="number">`, {
            "name": "fade_out_speed",
            "label": "Fade Out Speed",
            ...get_property_opts(InternalSessionProps.fade_out_speed),
            "data": app.$._session.fade_out_speed,
        });

        var fade_in_speed = new ui.InputProperty(`<input type="number">`, {
            "name": "fade_in_speed",
            "label": "Fade In Speed",
            ...get_property_opts(InternalSessionProps.fade_in_speed),
            "data": app.$._session.fade_in_speed,
        });

        var onchange = (e) => {
            if (e.trigger) {
                app.request("update_player_controls", {
                    [e.name]: e.value
                });
            }
        };
        fade_out_speed.on("change", onchange);
        fade_in_speed.on("change", onchange);

        var fade_button = new ui.Button(`<button>Fade To Next Item</button>`, {
            "click_async": () => {
                var fadeout = fade_out_speed.value;
                var fadein = fade_in_speed.value;
                var update_fade_button = (t) => {
                    if (t < 0) {
                        fade_button.settings.content = `Fade To Next Item`;
                    } else {
                        var out = t >= fadein;
                        var s = Math.abs(t - fadein);
                        fade_button.settings.content = `Fading ${out ? "Out" : "In"} (${s}s)... <i class="fas fa-spinner fa-pulse"></i>`;
                    }
                    fade_button.update();
                };
                return new Promise((resolve) => {
                    app.request("fade_out_in", [fadeout, fadein]);
                    var t = fadeout + fadein;
                    update_fade_button(t);
                    var int_id = setInterval(() => {
                        update_fade_button(--t);
                        if (t < 0) {
                            clearInterval(int_id);
                            resolve();
                        }
                    }, 1000);
                });
            }
        });

        this.props.layout = [
            [fade_out_speed, fade_in_speed],
            [fade_button],
        ];
    }
}

export class ExternalSessionConfigurationMenu extends ui.Modal {
    /** @param {ui.InputProperty} prop */
    constructor() {
        super({
            "modal.title": "Setup External Session",
            "modal.items": () => [app.settings.get("external-session-config") || {}],
        });

        var row = this.props.append(new ui.FlexRow());
        dom.set_inner_html(row.elem, `Setup your streaming software to stream to cabtv and restream to multiple targets.`);

        var row = this.props.append(new ui.FlexRow());
        dom.set_inner_html(row.elem, `<hr/>`);

        this.stream_name = new ui.InputProperty(`<input type="text">`, {
            "name": "name",
            "label": "Name",
            "default": () => `${app.$._client.user.username}'s Stream`,
            "placeholder": () => `CAB TV`,
            "info": "This must be a unique name to identify your stream."
        });
        this.props.append(this.stream_name);

        this.stream_targets = new TargetsProperty({
            "name": "targets",
            "label": "Target(s)",
            "allow_empty": false,
            "reset": true,
            "show_in_use": false,
            "opts_name": "target_opts",
            "default": SessionProps.stream_settings.targets.__default__,
        });
        this.props.append(this.stream_targets, this.stream_targets.opts);

        var input_props = [
            this.stream_name,
            this.stream_targets,
        ]

        this.props.append(new ui.Separator());

        this.output_host = new ui.InputProperty(`<input type="text">`, {
            "label": "Stream Host",
            "readonly": true,
            "copy": true,
            "reset": false,
            "disabled": () => !input_props.every(i => i.is_valid),
        });
        this.props.append(this.output_host);

        this.output_key = new ui.TextAreaProperty({
            "label": "Stream Key",
            "textarea.rows": 1,
            "textarea.grow": true,
            "textarea.break_all": true,
            "readonly": true,
            "copy": true,
            "reset": false,
            "disabled": () => !input_props.every(i => i.is_valid)
        });
        this.props.append(this.output_key);

        var host, key, old_hash;
        this.on("post_update", () => {
            var hash = JSON.stringify(this.props.value);
            if (hash === old_hash) return;
            old_hash = hash;

            var name = this.stream_name.value.trim();
            var url = new URL(app.$.conf["rtmp_server_url"]);
            url.pathname = "/external";
            host = url.toString();

            var params = new URLSearchParams();
            if (name) params.set("name", name)
            params.set("targets", this.stream_targets.value.join(","));
            params.set("target_opts", JSON.stringify(this.stream_targets.opts.value));
            var query_str = params.toString();
            key = `${app.$._client.ip_hash}`;
            if (query_str) key += "?" + query_str;

            this.output_host.set_values(host);
            this.output_key.set_values(key);
        });

        this.props.on("change", (e) => {
            if (e.trigger) {
                app.settings.set("external-session-config", this.props.raw_value);
            }
        })
    }
}

export const TimeLeftMode = {
    TIME_LEFT: 0,
    DURATION: 1,
}

/** @extends {Modal<Target$>} */
export class EditTargetMenu extends ui.EditModal {
    /** @param {Target$} target */
    constructor(target) {
        var is_new = !target.id;
        super({
            "modal.title": () => is_new ? "New Target" : `Edit <i>${target.name}</i>`,
            "modal.items": [target],
            "modal.auto_apply": !is_new,
            "modal.apply": () => {
                if (is_new) {
                    app.request("create_target", [this.props.value]);
                } else {
                    app.request("update_target", [target.id, this.props.value]);
                }
            }
        });

        var row = this.props.append(new ui.FlexRow());
        this.name = new ui.InputProperty(`<input type="text">`, {
            "name": "name",
            "label": "Name",
            "reset": false,
            "default": "",
            "placeholder": "My Stream",
        });
        this.name.validators.push(VALIDATORS.not_empty, (v) => {
            return Object.values(app.$.targets).filter((t) => t != target).map(t => t.name).includes(v) ? "Name already exists." : true
        });
        row.append(this.name)

        var row = this.props.append(new ui.FlexRow());
        this.description = new ui.TextAreaProperty({
            "name": "description",
            "label": "Description",
            "textarea.rows": 2,
            "textarea.grow": true,
            "reset": false,
            "default": "",
        });
        row.append(this.description)

        var row = this.props.append(new ui.FlexRow());
        this.rtmp_host = new ui.InputProperty(`<input type="url">`, {
            "name": "rtmp_host",
            "label": "Stream Host",
            "reset": false,
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
            "reset": false,
            "default": "",
            "placeholder": ""
        });
        row.append(this.rtmp_host, this.rtmp_key);

        var row = this.props.append(new ui.FlexRow());
        this.url = new ui.InputProperty(`<input type="url">`, {
            "name": "url",
            "label": "View URL",
            "reset": false,
            "info": "The public URL to view your channel's livestream.",
            "default": "",
            "placeholder": "https://streaming-service.com/my-channel",
        });
        this.url.validators.push((v) => !v || VALIDATORS.url(v));
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

        this.on("show", () => {
            if (is_new) this.access_control._claim();
        });
    }
}

/** @extends {Modal<TargetsProperty>} */
export class TargetsMenu extends ui.EditModal {
    /** @param {TargetsProperty} prop */
    constructor(prop) {
        super({
            "modal.title": "Targets",
            // "modal.close": !prop,
            "modal.auto_apply": !prop,
            "modal.footer": !!prop,
            "modal.ok": !!prop,
            "modal.cancel": !!prop,
            "modal.apply": () => {
                if (prop) prop.set_value(this.targets.value, { trigger: true });
            },
        });

        this.targets = new ExpandedTargetsProperty(prop);
        this.props.append(this.targets);

        this.on("show", () => {
            this.targets.set_value(prop ? prop.value : null);
        });
    }
}

class ExpandedTargetsPropertyItem extends ui.UI {
    /** @param {ExpandedTargetsProperty} parent @param {Target$} target */
    constructor(parent, target) {
        var elem = $(`<div></div>`)[0];

        super(elem);

        /** @type {HTMLLabelElement} */
        var label_el = $(`<span></span>`)[0];

        var checkbox_input = $(`<input type="checkbox">`)[0];
        var text_wrapper_elem = $(`<div class="text-wrapper"></div>`)[0];
        checkbox_input.onchange = () => {
            parent.update_target_ids();
        };
        var checkbox = new ui.UI(checkbox_input, {
            "hidden": () => !parent.is_editing,
        });

        label_el.append(checkbox, text_wrapper_elem);

        var up_button = new ui.Button(`<button class="icon button"><i class="fas fa-arrow-up"></i></button>`, {
            "click": () => {
                dom.move(elem, -1);
                parent.update_target_ids();
            },
            "hidden": () => parent.enabled_target_ids.length < 2 || !parent.enabled_target_ids.includes(target.id),
            "disabled": () => parent.enabled_target_ids.indexOf(target.id) == 0,
            "title": "Move Up",
        });

        var down_button = new ui.Button(`<button class="icon button"><i class="fas fa-arrow-down"></i></button>`, {
            "click": () => {
                dom.move(elem, 1);
                parent.update_target_ids();
            },
            "hidden": () => parent.enabled_target_ids.length < 2 || !parent.enabled_target_ids.includes(target.id),
            "disabled": () => parent.enabled_target_ids.indexOf(target.id) == parent.enabled_target_ids.length - 1,
            "title": "Move Down",
        });

        var get_config_menu = () => {
            return new (app.target_config_menus[target.id])(parent);
        };

        var has_config_menu = () => {
            if (target.id === "gui" && app.is_headless) return false;
            return !!app.target_config_menus[target.id];
        };

        var config_button = new ui.Button(`<button class="icon button"><i class="fas fa-cog"></i></button>`, {
            "hidden": () => !parent.is_editing || !has_config_menu(),
            "click": () => get_config_menu().show(),
            "title": "Configure",
        });

        var is_restartable = () => {
            if (!parent.is_editing) return false;
            var stream = app.$._session._stream;
            if (!stream || !stream._is_running) return false;
            return target.id in stream.stream_targets;
        }

        var restart_button = new ui.Button(`<button class="icon button"><i class="fas fa-sync"></i></button>`, {
            "hidden": () => !is_restartable(),
            "click_async": () => app.restart_targets([target.id]),
            "title": "Restart",
        });

        var edit_button = new ui.Button(`<button class="icon button"><i class="fas fa-edit"></i></button>`, {
            "click": async () => {
                await new EditTargetMenu(target).show();
                console.log("SHOWN");
                this.update();
            },
            "hidden": () => !target._can_edit,
            "title": "Edit",
        });

        var delete_button = new ui.Button(`<button class="icon button"><i class="fas fa-trash-can"></i></button>`, {
            "click": () => {
                if (confirm(`Are you sure you want to delete Target '${target.name}'?`)) {
                    app.request("delete_target", [target.id]);
                }
            },
            "hidden": () => !target._can_edit,
            "title": "Delete",
        });

        var buttons = new ButtonGroup();
        buttons.append(edit_button, config_button, delete_button, up_button, down_button, restart_button);
        elem.append(label_el, buttons);

        var name_elem = $(`<span class="name"></span>`)[0];
        var description_elem = $(`<div class="description"></div>`)[0];
        text_wrapper_elem.append(name_elem, description_elem);
        var checkbox_input = elem.querySelector(`input[type="checkbox"]`);

        this.on("update", () => {
            var parts = [target.name || target.id];
            var show_in_use = parent.get_setting("show_in_use");
            if (show_in_use && target._in_use) parts.push(`<span class="flashing-slow">[Currently In Use]</span>`);
            if (target.locked) parts.push(` <i class="fas fa-lock"></i>`);
            if (target.builtin) parts.push(` <i class="fas fa-star"></i>`);
            if (target.url) parts.push(`<a href="${target.url}" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i></a>`);
            dom.set_inner_html(name_elem, parts.join(" "));
            dom.set_inner_html(description_elem, utils.convert_links_to_html(target.description || ""));
            checkbox_input.checked = parent.enabled_target_ids.includes(target.id);
        });
    }
}
export class ExpandedTargetsProperty extends ui.Property {
    /** @type {string[]} */
    get values() {
        var available_targets = this.available_targets;
        return super.values.map(v => (v ? [...v] : []).filter(v => available_targets.find(t => t.id == v)));
    }
    get available_targets() {
        return Object.values(app.$._targets);
    }
    get available_target_ids() {
        return this.available_targets.map(t => t.id);
    }
    get enabled_target_ids() {
        return this.value;
    }
    get disabled_targets_ids() {
        return [...utils.set_difference(this.available_target_ids, new Set(this.enabled_target_ids))];
    }
    get enabled_targets() {
        return this.enabled_target_ids.map(id => this.get_target(id));
    }
    get disabled_targets() {
        return this.disabled_targets_ids.map(id => this.get_target(id));
    }
    get is_editing() {
        return !!this.targets_prop;
    }
    get_target(id) {
        return app.$._targets[id];
    }

    /** @param {TargetsProperty} prop */
    constructor(prop) {
        super({
            "show_in_use": () => prop ? prop.get_setting("show_in_use") : false,
        });

        this.targets_prop = prop;

        dom.add_class(this.elem, "target-config");

        this.disabled_list = new ui.UI(`<div></div>`, { class: "target-list" });
        this.enabled_list = new ui.UI(`<div></div>`, { class: "target-list" });

        var new_button = new ui.Button(`<button>New Target <i class="fas fa-plus"></i></button>`, {
            "flex": 1,
            "click": async () => {
                await new EditTargetMenu({}).show();
                console.log("SHOWN");
                this.update();
            },
            "title": "New Target",
        });

        /** @param {Target$} target */
        var add = (target, elem, i) => {
            elem = elem || new ExpandedTargetsPropertyItem(this, target).elem;
            return elem;
        };

        this.on("update", () => {
            var enabled_targets = this.enabled_targets;
            var disabled_targets = this.disabled_targets;
            var style = `display: flex; justify-content: center; padding: 10px;`

            if (this.is_editing) {
                dom.rebuild(this.enabled_list.elem, enabled_targets, { add });
                if (enabled_targets.length == 0) {
                    dom.set_inner_html(this.enabled_list.elem, `<span style="${style}">No Targets Selected.</span>`);
                }
            }
            dom.rebuild(this.disabled_list.elem, disabled_targets, { add });
            if (disabled_targets.length == 0) {
                dom.set_inner_html(this.disabled_list.elem, `<span style="${style}">No Remaining Targets.</span>`);
            }

            var layout = [];
            if (this.is_editing) {
                layout.push(
                    [this.enabled_list],
                    "-----"
                );
            }
            layout.push(
                [this.disabled_list],
                [new_button],
            );
            this.layout = layout;
        });
    }

    update_target_ids() {
        var enabled_ids = [...this.enabled_list.elem.children, ...this.disabled_list.elem.children].filter(e => e.dataset.id && e.querySelector("input").checked).map(e => e.dataset.id);
        var new_value = [...enabled_ids];
        this.set_value(new_value);
    }
}

/** 
 * @template ItemType 
 * @template {string[]} [ValueType=string[]]
 * @template {ui.InputPropertySettings<ItemType,ValueType,TargetsProperty>} [Settings=ui.InputPropertySettings<ItemType,ValueType,TargetsProperty>]
 * @template {ui.InputPropertyEvents} [Events=ui.InputPropertyEvents]
 * @extends {ui.InputProperty<ItemType,ValueType,Settings,Events>} 
 */
export class TargetsProperty extends ui.InputProperty {
    get values() {
        return super.values.map(v => v || []);
    }

    /** @param {Settings} settings */
    constructor(settings) {
        var input = $(`<div class="fake-input"></div>`)[0];
        input.style.cursor = "pointer";

        super(input, {
            "reset": false,
            "prefix": `<i class="far fa-circle-dot"></i>`,
            "show_in_use": true,
            // "allow_empty": false,
            "auto_apply": true,
            "opts_name": "",
            ...settings,
            "readonly": true,
        });

        this.opts = new ui.Property({
            "name": this.get_setting("opts_name"),
            "default": {},
            "hidden": true,
        });

        // if (!this.get_setting("allow_empty")) {
        //     this.validators.push(()=>(this.value.length == 0) ? "No targets selected" : true);
        // }

        input.onclick = (e) => {
            new TargetsMenu(this).show();
        }

        this.output_modifiers.push((ids) => {
            var str = (ids && ids.length) ? ids.length == 1 ? (app.$.targets[ids[0]] || EMPTY_OBJECT).name : `${ids.length} Targets` : `None`
            // return str;
            var html = `<span>${str}</span>`
            // if (this.has_opts) html += ` <i class="fas fa-wrench"></i>`
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
            "disabled": () => !this.get_setting("seek.seekable"),
            //-----
            "seek.time_pos": 0,
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

        var set_hover_chapters = (chapters) => {
            var indices = new Set(chapters.map(c => +c.index));
            [...this.chapters_elem.children].forEach(e => {
                dom.toggle_class(e, "hover", indices.has(+e.dataset.index));
            });
        };

        var get_current_chapters = (t) => {
            var chapters = this.get_setting("seek.chapters");
            if (chapters.length <= 1) return [];
            return chapters.filter(c => t >= c.start && t < c.end);
        }

        this.ticks_bar = new TicksBar(this.ticks_bar_elem, {
            hover_elem: this.seek_elem,
            placement: "bottom",
            show_numbers: false,
            modifier: (html, t) => {
                // console.log(html, t);
                var curr_chapters = get_current_chapters(t);
                if (curr_chapters.length) {
                    html = curr_chapters.map(c => `<div class="chapter">${app.chapter_to_string(c)}</div>`).join("") + html;
                }
                return html;
            }
        });

        var hover_listener = new dom.TouchListener(this.seek_elem, {
            mode: "hover",
            start: (e) => {
                var data = this.ticks_bar.parse_event(e);
                set_hover_chapters(get_current_chapters(data.time));
            },
            move: (e) => {
                var data = this.ticks_bar.parse_event(e);
                set_hover_chapters(get_current_chapters(data.time));
            },
            end: (e) => {
                set_hover_chapters([]);
            }
        });
        var last_time;
        var seek_listener = new dom.TouchListener(this.seek_elem, {
            start: (e) => {
                last_time = this.ticks_bar.parse_event(e).time;
                this.seek_elem.focus();
                this.#seek_pos = last_time;
                this.#seeking = true;
                this.emit("seek-start", { time: last_time });
                this.update();
            },
            move: (e) => {
                last_time = this.ticks_bar.parse_event(e).time;
                this.#seek_pos = last_time;
                this.emit("seeking", { time: last_time });
                this.update();
            },
            end: (e) => {
                last_time = this.ticks_bar.parse_event(e).time;
                this.#seeking = false;
                this.emit("seek-end", { time: last_time });
                this.update();
            }
        });

        var curr_marker, moving_curr_marker, curr_marker_start_x;
        var marker_listener = new dom.TouchListener(this.seek_elem, {
            start: (e) => {
                this.seek_elem.focus();
                var data = this.ticks_bar.parse_event(e);
                curr_marker_start_x = data.pt.x;
                curr_marker = null;
                moving_curr_marker = false;
                var marker_elem = e.target.closest(".marker");
                if (marker_elem) {
                    curr_marker = this.get_setting("seek.markers").find(m => m.id == marker_elem.dataset.id);
                }
                if (!curr_marker) {
                    curr_marker = this.add_marker(data.time);
                    if (curr_marker) {
                        moving_curr_marker = true;
                        this.emit("markers-change");
                    }
                }
            },
            move: (e) => {
                var m = this.ticks_bar.parse_event(e);
                if (curr_marker_start_x != null && Math.abs(curr_marker_start_x - m.pt.x) > 8) {
                    curr_marker_start_x = null;
                    moving_curr_marker = true;
                }
                if (moving_curr_marker) {
                    curr_marker.time = m.time;
                    this.emit("markers-change");
                    this.update();
                }
            },
            end: (e) => {
                if (curr_marker && !moving_curr_marker) {
                    this.remove_marker(curr_marker);
                    this.emit("markers-change");
                }
                curr_marker = null;
                moving_curr_marker = false;
            }
        });

        this.time_left_elem.style.cursor = "pointer";
        this.time_left_elem.addEventListener("click", () => {
            var time_left_mode = (this.get_setting("seek.time_pos_left_mode") + 1) % 2;
            this.emit("time_left_mode", time_left_mode);
        });

        this.on("render", () => {
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

            dom.toggle_attribute(this.seek_elem, "disabled", !seekable)
            this.elem.style.cursor = show_markers ? "copy" : "";
            dom.toggle_display(this.bar_elem, !show_markers);
            this.markers_elem.style.display = show_markers ? "" : "none";

            var ranges_hash = JSON.stringify([duration, ranges]);
            if (this._ranges_hash != ranges_hash) {
                this._ranges_hash = ranges_hash;
                dom.remove_children(this.ranges_elem);
                if (duration && ranges) {
                    for (var r of ranges) {
                        var e = $(`<div class="range"></div>`)[0];
                        e.style.left = `${r.start / duration * 100}%`;
                        e.style.width = `${(r.end - r.start) / duration * 100}%`;
                        this.ranges_elem.appendChild(e);
                    }
                }
            }

            dom.toggle_class(this.seek_elem, "buffering", buffering);

            var markers_hash = JSON.stringify([markers, duration]);
            if (this._markers_hash != markers_hash) {
                this._markers_hash = markers_hash;
                dom.remove_children(this.markers_elem);
                if (duration) {
                    for (var m of markers) {
                        var e = $(`<div class="marker"><div></div></div>`)[0];
                        e.style.left = `${m.time / duration * 100}%`;
                        e.dataset.id = m.id;
                        this.markers_elem.appendChild(e);
                    }
                }
            }

            var chapters_hash = JSON.stringify([chapters, duration]);
            if (this._chapters_hash != chapters_hash) {
                this._chapters_hash = chapters_hash;
                dom.remove_children(this.chapters_elem);
                if (duration && chapters.length > 1) {
                    chapters.forEach((c, i) => {
                        var d = Math.max(0, c.end - c.start);
                        var e = $(`<div class="chapter"></div>`)[0];
                        e.style.left = `${c.start / duration * 100}%`;
                        e.style.width = `${d / duration * 100}%`;
                        dom.set_style_property(e, "z-index", i + 1);
                        e.dataset.index = c.index;
                        this.chapters_elem.appendChild(e);
                    });
                }
            }

            this.ticks_bar.update(0, duration);
        });

        this.on("destroy", () => {
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
        this.bar_elem.style.width = `${p * 100}%`;

        var time_left_mode = this.get_setting("seek.time_pos_left_mode");
        var time_left = duration ? (duration - time_pos) : 0;
        this.time_elem.style.display = show_times ? "" : "none";
        this.time_left_elem.style.display = show_times ? "" : "none";
        dom.set_text(this.time_elem, `${utils.seconds_to_timespan_str(time_pos, app.user_time_format)}`);
        var time_left_str = "";
        if (time_left_mode === TimeLeftMode.TIME_LEFT) time_left_str = `-${utils.seconds_to_timespan_str(Math.max(0, time_left), app.user_time_format)}`;
        else if (time_left_mode === TimeLeftMode.DURATION) time_left_str = utils.seconds_to_timespan_str(Math.max(0, duration), app.user_time_format)
        dom.set_text(this.time_left_elem, time_left_str);
    }

    clear_markers() {
        this.settings["seek.markers"] = [];
        this.update_next_frame();
    }
    add_marker(t) {
        if (!this._marker_id) this._marker_id = 0;
        var markers = this.get_setting("seek.markers");
        if (markers.length > 128) return;
        var marker = { time: t, id: ++this._marker_id };
        markers.push(marker);
        this.settings["seek.markers"] = markers;
        this.update_next_frame();
        return marker;
    }
    remove_marker(m) {
        var markers = this.get_setting("seek.markers");
        utils.array_remove(markers, m);
        this.settings["seek.markers"] = markers;
        this.update_next_frame();
    }
}
export class MediaSeekBar extends SeekBar {
    constructor() {
        super({
            "seek.time_pos_left_mode": () => app.settings.get("media_time_left_mode"),
        });

        var seek_time = 0, last_seek_time, seeking_interval;
        var cleanup = () => {
            clearInterval(seeking_interval);
        }
        this.on("seek-start", (e) => {
            seek_time = e.time;
            cleanup();
            seeking_interval = setInterval(() => {
                if (seek_time != last_seek_time && app.media.do_live_seek) {
                    app.seek(seek_time);
                    last_seek_time = seek_time;
                }
            }, 100);
        });
        this.on("seeking", (e) => {
            seek_time = e.time;
        });
        this.on("seek-end", (e) => {
            seek_time = e.time;
            cleanup();
            if (seek_time != last_seek_time) {
                app.seek(seek_time)
            }
        });
        this.on("time_left_mode", (v) => {
            app.settings.set("media_time_left_mode", v);
        });

        var is_playing = () => app.$._session._is_running && !app.media.paused && !app.media.buffering;
        this.on("update", () => {
            var time = app.media.time_pos;
            var paused = !is_playing();

            Object.assign(this.settings, {
                "seek.time_pos": time,
                "seek.seekable": app.media.seekable,
                "seek.duration": app.media.duration,
                "seek.chapters": app.media.chapters,
                "seek.ranges": app.media.ranges,
                "seek.buffering": app.media.buffering,
            });

        })
    }
}

/** @extends {EditModal<SessionStream$>} */
export class StreamConfigurationMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Stream Configuration",
            "modal.items": [app.$._session._stream],
            "modal.auto_apply": false,
            "modal.apply": () => {
                app.request("stream_update_values", [this.props.value]);
            },
        });
        var title_ui = new ui.InputProperty(`<input type="text">`, {
            "name": "title",
            "label": "Title",
            // "reset": false
        });
        this.props.append(title_ui);

        var row = new ui.FlexRow({
            "align": "end",
        });

        function _get_property_opts(name, cb) {
            var p = InternalSessionProps.stream_settings[name];
            return get_property_opts(p, cb);
        }

        var targets = new TargetsProperty({
            ..._get_property_opts("targets"),
            "name": "targets",
            "label": "Target(s)",
            // "allow_empty": true,
            "auto_apply": false,
            "opts_name": "target_opts",
        });

        var restart_button = new ui.Button(`<button><i class="fas fa-sync"></i></button>`, {
            "hidden": () => !app.$._session._stream._is_running,
            "click_async": () => app.restart_targets(),
            "title": "Restart Stream Targets",
            "flex": 0
        });
        targets.outer_el.append(restart_button);

        row.append(targets, targets.opts)
        this.props.append(row);

        var buffer_duration = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("buffer_duration"),
            ...buffer_duration_opts,
            "name": "buffer_duration",
            "hidden": () => app.$._session.type == constants.SessionTypes.EXTERNAL
        });
        this.props.append(buffer_duration);

        var fps = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("fps"),
            "name": "fps",
            "label": "Frame Rate",
        });
        this.props.append(fps);
    }
}
export class HandoverSessionMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Handover Session",
            "modal.items": [app.$._session],
            "modal.auto_apply": false,
            "modal.ok": "Handover",
            "modal.apply": () => {
                app.request("handover", [handover_stream_property.value]);
            },
        });
        var row = this.props.append(new ui.FlexRow());
        var handover_stream_property = new ui.InputProperty(`<select>`, {
            "label": "Session",
            "options": () => app.get_handover_sessions_options(),
            "reset": false,
            "info": "To seamlessly hand off to another session, select the session in the dropdown and click OK. Without interruption, the livestream will immediately start playing from the current playlist position in the selected stream."
        })
        row.append(handover_stream_property);
    }
}

export class SavePlaylistMenu extends ui.Modal {
    constructor() {
        super({
            "modal.title": () => `Save Playlist <i>${playlist_name}</i>`,
            "modal.items": [app.settings.get("save_playlist_settings") || {}],
        });

        this.props.on("change", (e) => {
            if (!e.name || !e.trigger) return;
            app.settings.set("save_playlist_settings", this.props.raw_value);
        });

        var playlist_name = app.playlist.current._get_pretty_name() || app.$._session.name;
        var filename = `${utils.sanitize_filename(playlist_name)}-${utils.date_to_string()}`;

        var row = this.props.append(new ui.FlexRow());
        this.playlist_save_file = new ui.InputProperty(`<input type="text">`, {
            "name": "playlist-save-file",
            "label": "Filename",
            flex: 2,
            "default": () => filename,
        });
        this.playlist_save_file.validators.push(VALIDATORS.not_empty);
        row.append(this.playlist_save_file);

        this.playlist_save_format = new ui.InputProperty(`<select></select>`, {
            "name": "playlist-save-format",
            "label": "Format",
            "default": "json",
            "options": [["json", "JSON"], ["text", "Simple Text"]],
            "hidden": true,
        });
        row.append(this.playlist_save_format);

        this.playlist_save_children = new ui.InputProperty(`<select></select>`, {
            "name": "playlist-save-children",
            "label": "Include Nested Playlists",
            "default": true,
            "options": YES_OR_NO,
        });
        row.append(this.playlist_save_children);

        this.playlist_json_spaces = new ui.InputProperty(`<input type="number">`, {
            "name": "playlist-json-spaces",
            "label": "JSON spaces",
            "default": 2,
            "min": 0,
            "max": 10,
            "hidden": () => this.playlist_save_format.value != "json"
        });
        row.append(this.playlist_json_spaces);

        var row = this.props.append(new ui.FlexRow());
        this.playlist_save_dir = new FileProperty({
            "name": "playlist-save-dir",
            "label": "Remote Save Directory",
            "file.options": { folders: true },
            "file.check_media": true,
            "default": app.$._session.dir,
        });
        this.playlist_save_dir.validators.push(VALIDATORS.not_empty);
        row.append(this.playlist_save_dir);

        var save_local_button = new ui.Button(`<button>Save (Local)</button>`, {
            "click": () => {
                save_local_file(this.playlist_save_file.value + "." + this.playlist_save_format.value, serialize());
                this.hide();
            }
        });
        var save_remote_button = new ui.Button(`<button>Save (Remote)</button>`, {
            "disabled": () => !this.props.is_valid,
            "click": () => {
                app.request("save_file", [this.playlist_save_dir.value + "/" + this.playlist_save_file.value, serialize()]);
                this.hide();
            }
        });
        this.footer.append(save_local_button, save_remote_button.elem);

        var row = this.props.append(new ui.FlexRow());
        var last_hash;

        var preview_content = $(`<div class="text-block"></div>`)[0];
        this.preview = new ui.InputProperty(preview_content, {
            "label": "Preview",
            "update": () => {
                var hash = JSON.stringify([app.playlist.current.id, ...[this.playlist_save_format, this.playlist_save_children, this.playlist_json_spaces].map(p => p.value)]);
                if (hash != last_hash) render_preview();
                last_hash = hash;
            },
            "reset": false,
        });
        row.append(this.preview);

        var serialize = () => {
            if (this.playlist_save_format.value != "json") return;
            /** @param {PlaylistItem$} item */
            var process = (item) => {
                var o = { filename: item.filename };
                if (!utils.is_empty(item.props)) o.props = item.props;
                var children = item._children;
                if (this.playlist_save_children.value && children.length) {
                    o.children = children.map(c => process(c));
                }
                return o;
            }
            var items = app.playlist.current._children.map(i => process(i));
            var json = JSON.stringify(items, null, this.playlist_json_spaces.value ? " ".repeat(this.playlist_json_spaces.value) : undefined);
            return "// livestreamer playlist\n" + json;
        }

        var render_preview = () => {
            preview_content.innerText = serialize();
        }
        render_preview();
    }
}

export class HistoryMenu extends ui.Modal {
    history = [];
    constructor() {

        var table_data = {
            "Time": (data) => {
                var mtime = new Date(data.mtime);
                var e = $(`<span>${utils.time_diff_readable(new Date(), mtime) || "-"}</span>`)[0];
                e.title = mtime.toLocaleString();
                return e;
            },
            "Current Changes": (data) => {
                return data.curr.length.toLocaleString();
            },
            "Previous Changes": (data) => {
                if (!data.prev) return "-";
                return data.prev.length.toLocaleString();
            },
        };
        var wrapper_elem = $(`<div class="autosave-history"></div>`)[0];
        var table_wrapper = $(`<div class="table-wrapper" data-overlayscrollbars-initialize></div>`)[0];
        var table_inner = OverlayScrollbars(table_wrapper, {}).elements().viewport;
        /** @type {HTMLTableElement} */
        var table = $(`<table><thead></thead><tbody></tbody></table>`)[0];
        var thead = table.querySelector("thead");
        var thead_tr = $(`<tr></tr>`)[0];
        var tbody = table.tBodies[0];
        Object.keys(table_data).forEach(k => {
            $(thead_tr).append(`<th>${k}</th>`);
        });
        thead.append(thead_tr);
        var table_col = new ui.Column({ class: "table-column" });
        table_inner.append(table);
        table_col.append(table_wrapper);

        var info_col = new ui.Column({ class: "info-column" });
        var info_wrapper_elem = $(`<div class="info-wrapper"></div>`)[0];
        var info_outer = $(`<div class="info" data-overlayscrollbars-initialize></div>`)[0];
        var info_inner = OverlayScrollbars(info_outer, {}).elements().viewport;
        info_wrapper_elem.append(info_outer);
        var info_footer_elem = $(`<div class="footer"></div>`)[0];
        info_wrapper_elem.append(info_footer_elem);
        info_col.append(info_wrapper_elem)

        var history = [];
        var load = async () => {
            history = await app.request("get_autosave_history");
            dom.remove_children(table.tBodies[0]);

            history.forEach((data) => {
                var values = Object.values(table_data).map(d => d(data));
                var tr = $(`<tr></tr>`)[0];
                tr.dataset.filename = data.filename;
                for (var v of values) {
                    var td = $(`<td></td>`)[0];
                    $(td).append(v);
                    tr.append(td);
                }
                table.tBodies[0].append(tr);
            });
        };

        super({
            "modal.title": () => `History [${history.length}]`,
            "modal.min-width": "900px",
            "modal.load": load,
        });

        wrapper_elem.append(table_col, info_col);
        this.props.append(wrapper_elem);

        var loading = false;
        var load_button = new ui.Button(`<button>Load</button>`, {
            "click": async () => {
                loading = true;
                await app.request("load_session_autosave", [history[selectable_list.selected_index].filename]);
                loading = false;
                this.hide();
            },
            "disabled": () => !selectable_list.selected && !loading,
        });
        info_footer_elem.append(load_button)
        var selectable_list = new SelectableList(tbody);
        this.on("update", () => {
            var i = selectable_list.selected_index;
            var data = history[i];
            dom.remove_children(info_inner);
            if (data) {
                info_inner.append(`<div><h3>Time</h3><span>${new Date(data.mtime).toLocaleString()}</span></div>`);
                for (var k of ["curr", "prev"]) {
                    var entries = data[k];
                    var title = k == "prev" ? "Previous Changes" : "Current Changes"
                    var box = $(`<div><h3>${title}</h3><ul></ul></div>`)[0];
                    info_inner.append(box);
                    var ul = box.querySelector("ul");
                    if (!entries || entries.length == 0) {
                        $(ul).append(`<li>No changes.</li>`);
                    } else {
                        entries.forEach(([path, v]) => {
                            // path = path.map(p=>p.replace(/^_+/,""));
                            if (path[0] == "player") path.shift();
                            var from = (typeof v[2] === "object" && v[2] !== null) ? "Object" : v[2];
                            var to = (typeof v[1] === "object" && v[1] !== null) ? "Object" : v[1];
                            $(ul).append(`<li><i>[${path.join("•")}]</i>\n<strong>(${from}) => (${to})</strong></li>`);
                        });
                    }
                }
            } else {
                info_inner.append(`<div class="empty">Select a record from the list.</div>`);
            }
        });
        selectable_list.on("selection_change", () => this.update());
        this.on("destroy", () => {
            selectable_list.destroy();
        });
    }
}

export class PlaylistAddURLMenu extends ui.EditModal {
    constructor() {
        super({
            "modal.title": "Add URLs to Playlist",
            "modal.return_value": () => {
                return urls.value.split(/\n+/).map(s => s.trim()).filter(s => s);
            }
        });
        var urls = new ui.InputProperty(`<textarea style="height:180px;white-space:pre"></textarea>`, {
            "default": "",
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
            "reset": false,
        })
        var row = this.props.append(new ui.FlexRow());
        row.append(urls);

        var row = this.props.append(new ui.FlexRow());
        row.append(...$(`<span>If you're having problems downloading some media it might be due to geo-blocking in the server's locale, try <a href="https://oleksis.github.io/youtube-dl-gui/" target="_blank">yt-dlg</a> to download the media in your locale and upload to the server.</span>`));
    }
};

/** @extends {ui.EditModal<PlaylistItem$>} */
export class PlaylistItemModifyMenu extends ui.EditModal {

    get changes() {
        var exclude = [["props", "label"], ["props", "color"]];
        return super.changes.map(changes => changes.filter(({ path }) => exclude.every(p => !utils.array_starts_with(path, p))))
    }

    /** @param {PlaylistItem$[]} items */
    constructor(items) {
        var is_new = items.length == 1 && !items[0].id;
        super({
            "modal.width": 720,
            "modal.title": () => is_new ? `New Playlist Item` : `Modify ${get_items_title_html(this.props.items)}`,
            "modal.auto_apply": !is_new,
            "modal.apply": () => {
                if (is_new) {
                    var value = this.props.raw_value;
                    value.props = Object.fromEntries(Object.entries(value.props).filter(([k, v]) => v != undefined));
                    app.playlist_add(value);
                    return;
                }
                // if (app.$._session._is_running && this.props.items.some(d=>d._is_currently_playing) && this.changes.some(c=>c.length)) {
                //     // app.alert_for_reload_of_current_item();
                //     // app.prompt_for_reload_of_current_item();
                // }
                if (reset) {
                    let d = Object.fromEntries(this.items.map((item, i) => [item.id, { props: {} }]));
                    app.playlist_update(d, { replace_props: true });
                } else {
                    let d = Object.fromEntries(this.items.map((item, i) => [item.id, this.props.raw_values[i]]));
                    app.playlist_update(d);
                }
            },
            "modal.items": items,
        });

        /** @type {FileProperty<PlaylistItemUI>} */
        let filename = new FileProperty({
            "name": "filename",
            "label": "Path / URI",
            "default": (item) => item.filename,
            "file.check_media": true,
            "nullify_default": false,
        });
        filename.validators.push(VALIDATORS.not_empty);

        let props_group = this.props_group = new MediaPropertyGroup(MediaSettingsMode.custom, false, filename);

        this.props.append(filename);
        this.props.append(new ui.Separator());
        this.props.append(props_group);

        var reset = false;
        this.on("before-show", () => {
            reset = false;
        });
        this.reset_button = new ui.Button(`<button>Reset</button>`, {
            "click": () => {
                reset = true;
                this.hide();
                // filename.reset();
                // this.props.reset();
            },
            "hidden": () => is_new,
        })
        this.footer.append(
            this.reset_button
        );
    }
}

const MediaSettingsMode = {
    "current": 0,
    "selected": 1,
    "all": 2,
    "custom": 3,
}

/** @extends {ui.PropertyGroup<PlaylistItem$>} */
export class MediaPropertyGroup extends ui.PropertyGroup {
    /** @param {number} mode @param {boolean} simple @param {FileProperty<PlaylistItemUI,string>} filename */
    constructor(mode, simple, filename) {
        super({
            "name": (mode == MediaSettingsMode.all) ? "" : "props",
            "items": () => {
                if (mode == MediaSettingsMode.current) return [app.$._session._current_playlist_item];
                if (mode == MediaSettingsMode.selected) {
                    let items = app.playlist.get_selected_items();
                    if (!items.length) items = [app.$._session.playlist[utils.remote.Null$]];
                    return items;
                }
                if (mode == MediaSettingsMode.all) {
                    return [app.$._session.player_default_override];
                }
            },
            "disabled": () => {
                return mode === MediaSettingsMode.custom ? false : (this.items.every(i => i._is_null));
            }
        });

        var _this = this;

        /** @param {MediaInfoStreamEx} s */
        let stream_to_text = (s, i, use_prefix = true) => {
            if (!s) return "None";
            var parts = [];
            var title = s.title;
            if (s.albumart) title = "Album Art (Still Image)";
            if (!title) title = `Track ${i}`
            if (use_prefix) title = `${i}. ${title}`;
            parts.push(title);
            if (s.language && s.language != "und") parts.push(s.language);
            return parts.join(" | ")
        }

        /**  @param {string} type */
        let get_stream_options = (type) => {
            /** @param {PlaylistItem$} item */
            return (item) => {
                if (mode == MediaSettingsMode.all) return [];
                item = item || this.item;

                let media_info = item._media_info;
                var streams = (item._media_info?.streams ?? []).filter(s => s.type == type);
                let default_stream = get_default_stream(streams, type);
                var has_albumart = streams.find(s => s.albumart);
                var session = app.$._session;
                let video_file = this.video_file?.value ?? item?.props.video_file;
                let audio_file = this.audio_file?.value ?? item?.props.audio_file;
                let subtitle_file = this.subtitle_file?.value ?? item?.props.subtitle_file;
                var background_mode = this.background_mode?.value ?? item?.props.background_mode ?? "auto";
                if (background_mode == "auto") {
                    background_mode = get_auto_background_mode(item, media_info)
                }

                var add_stream = (title, stype) => {
                    if (stype != type) return;
                    var stream = { title: title ?? "None", type: stype };
                    streams.push(stream);
                    default_stream = stream;
                };

                for (var s of media_info?.streams ?? []) {
                    if (s.type == type) {
                        add_stream(s);
                    }
                }
                if (!streams.filter(s => s.type == "video" && !s.albumart).length) {
                    add_stream(null, "video");
                }
                if (!streams.filter(s => s.type == "audio")) {
                    add_stream(null, "audio");
                }
                if (background_mode == "embedded" && has_albumart) {
                    add_stream("Album Art", "video");
                } else if (background_mode == "file") {
                    add_stream(utils.basename(session.$.background_file), "video");
                } else if (background_mode == "logo") {
                    add_stream("Logo", "video");
                } else if (background_mode === "none") {
                    add_stream(null, "video");
                }
                if (video_file) {
                    add_stream(utils.basename(video_file), "video");
                }
                if (audio_file) {
                    add_stream(utils.basename(audio_file), "audio");
                }
                if (subtitle_file) {
                    add_stream(utils.basename(subtitle_file), "subtitle");
                }

                var options = [];
                let indeterminate_option = { value: "", text: "-", hidden: true };
                options.push(indeterminate_option);
                var i = 1;
                for (let s of streams) {
                    let value = s ? i : false;
                    let text = stream_to_text(s, i, false);
                    if (background_mode) text = "Background";
                    let hidden = !!s?.albumart;
                    if (s == default_stream) {
                        options.unshift({ value: "auto", text: `Auto [${text}]` });
                    }
                    text = stream_to_text(s, i, true);
                    options.push({ value, text, hidden });
                    if (s != null) i++;
                }
                if (options.length == 1 && options[0] === indeterminate_option) {
                    indeterminate_option.hidden = false;
                }
                return options;
            }
        };

        let _get_property_opts = function (name, cb) {
            var path = name.split("/");
            let prop;
            if (mode === MediaSettingsMode.all) {
                prop = utils.try_catch(() => utils.reflect.get(InternalSessionProps.player_default_override, [...path]));
            } else {
                prop = utils.try_catch(() => utils.reflect.get(PlaylistItemPropsProps, [...path]));
            }
            var opts = get_property_opts(prop, cb);
            if ("default" in opts) {
                if (mode !== MediaSettingsMode.all) {
                    opts.default = utils.reflect.get(app.$._session.player_default_override, path) ?? opts.default;
                }
            }
            return opts;
        }

        this.aspect_ratio = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("aspect_ratio"),
            "name": "aspect_ratio",
            "label": "Aspect Ratio",
        });

        this.deinterlace_mode = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("deinterlace_mode"),
            "name": "deinterlace_mode",
            "label": "Deinterlace",
        });

        this.vid_override = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("vid_override"),
            "name": "vid_override",
            "label": "Video Track",
            "options": get_stream_options("video"),
            "disabled": () => this.items.length > 1,
            "hidden": () => mode === MediaSettingsMode.all,
        });

        this.aid_override = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("aid_override"),
            "name": "aid_override",
            "label": "Audio Track",
            "options": get_stream_options("audio"),
            "disabled": () => this.items.length > 1,
            "hidden": () => mode === MediaSettingsMode.all,
        });

        this.audio_delay = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("audio_delay"),
            "name": "audio_delay",
            "label": "Audio Delay",
            "suffix": "secs",
            "info": "Positive values delay the audio playback, while negative values make the audio play earlier relative to the video.",
        });

        this.audio_channels = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("audio_channels"),
            "name": "audio_channels",
            "label": "Audio Channels",
        });

        this.sid_override = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("sid_override"),
            "name": "sid_override",
            "label": "Subtitle Track",
            "options": get_stream_options("subtitle"),
            "disabled": () => this.items.length > 1,
            "hidden": () => mode === MediaSettingsMode.all,
        });

        this.subtitle_delay = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("sub_delay"),
            "name": "sub_delay",
            "label": "Subtitle Delay",
            "suffix": `secs`,
        });

        this.subtitle_scale = new ui.InputProperty(`<input type="text">`, {
            ..._get_property_opts("sub_scale"),
            "name": "sub_scale",
            "label": "Subtitle Scale",
            "precision": 2,
            "suffix": "%",
        });
        this.subtitle_scale.input_modifiers.push((v) => +v / 100);
        this.subtitle_scale.output_modifiers.push((v) => +v * 100);

        this.subtitle_pos = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("sub_pos"),
            "name": "sub_pos",
            "label": "Subtitle Position",
            "suffix": "%",
            "info": `The vertical position of the subtitle in % of the screen height. 100 is the original position, which is often not the absolute bottom of the screen, but with some margin between the bottom and the subtitle. Values above 100 move the subtitle further down.`
        });

        this.volume_normalization = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("volume_normalization"),
            "name": "volume_normalization",
            "label": "Volume Normalization",
        });

        this.volume_multiplier = new ui.InputProperty(`<input type="text">`, {
            ..._get_property_opts("volume_multiplier"),
            "name": "volume_multiplier",
            "label": "Volume Multiplier",
            "suffix": "%",
            "precision": 2,
        });
        this.volume_multiplier.input_modifiers.push((v) => v / 100);
        this.volume_multiplier.output_modifiers.push((v) => v * 100);

        this.interpolation = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("interpolation_mode"),
            "label": "Interpolation",
            "name": "interpolation_mode",
            "info": "Blends frames to reduce judder due to mismatched frame rates."
        });

        this.auto_interpolation_rate = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("auto_interpolation_rate"),
            "name": "auto_interpolation_rate",
            "label": "Auto Interpolation Target FPS",
            "hidden": () => true,
            "disabled": () => this.interpolation.value !== "auto",
        });

        this.brightness = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("brightness"),
            "label": "Brightness",
            "name": "brightness",
        });

        this.contrast = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("contrast"),
            "label": "Contrast",
            "name": "contrast",
        });

        this.saturation = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("saturation"),
            "label": "Saturation",
            "name": "saturation",
        });

        this.gamma = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("gamma"),
            "label": "Gamma",
            "name": "gamma",
        });

        /* this.hue = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("hue"),
            "label": "Hue",
            "name": "hue",
        }); */

        this.correct_pts = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("correct_pts"),
            "label": "Fix PTS",
            "name": "correct_pts"
        });

        var create_filter = (pre) => {
            var name = pre ? "pre_filters" : "filters";
            /** @type {ui.PropertyList<PlaylistItem$,FilterInput>} */
            var list = new ui.PropertyList({
                ..._get_property_opts(name),
                "name": name,
                "label": pre ? "Pre-Filters" : "Filters",
                "empty": "No filters",
                "item_size": 25,
                "vertical": true,
                "copy_id": "filter",
                "new": () => {
                    return new FilterConfigurationMenu().show();
                },
                ui(list_item) {
                    list_item.buttons.prepend(
                        new ui.Button(`<button title="Edit"><i class="fas fa-wrench"></i></button>`, {
                            click() {
                                new FilterConfigurationMenu(list_item).show();
                            },
                        }),
                        new ui.Button(`<button title="Toggle"><i class="fas fa-eye"></i><i class="fas fa-eye-slash"></i></button>`, {
                            click() {
                                var val = list_item.value || {};
                                list_item.set_value({ ...val, active: !val.active }, { trigger: true });
                            },
                            update() {
                                var val = list_item.value || {};
                                dom.toggle_display(this.elem.querySelector(".fa-eye"), val.active);
                                dom.toggle_display(this.elem.querySelector(".fa-eye-slash"), !val.active);
                                this.elem.toggleAttribute("data-toggled", !val.active);
                            }
                        })
                    );
                    var e = new ui.UI(`<span class="filter-list-item"></span>`, {
                        "update": () => {
                            var str = "";
                            var value = list_item.value || {};
                            /** @type {Filter} */
                            var f = filters[value.name];
                            if (f) {
                                str = `<i class="fas ${f.type === "audio" ? "fa-music" : "fa-film"}"></i>${f.descriptive_name}`;
                            } else {
                                str = `-`;
                            }
                            dom.toggle_class(e.elem, "disabled", !value.active);
                            dom.set_inner_html(e.elem, str);
                        }
                    })
                    list_item.props.append(e);
                },
                "hidden": () => {
                    if (pre && mode === MediaSettingsMode.all) return false;
                    if (!pre && mode !== MediaSettingsMode.all) return false;
                    return true;
                },
            });
            return list;
        }
        this.filters = create_filter(false);
        this.pre_filters = create_filter(true);

        this.loop = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("loop_file"),
            "name": "loop_file",
            "label": "Loop",
        });

        if (!simple) {
            /** @param {PlaylistItem$} item */
            let get_default_duration = (item) => {
                return item ? item._userdata.media_duration : 0;
            };

            this.playlist_mode = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("playlist_mode"),
                "name": "playlist_mode",
                "label": "Playlist Mode",
                "info": `Setting to 'Merged' or '2-Track', the media player will attempt to merge the playlist's contents as if it were a single file, with each item represented as a chapter. A merged playlist may only include local files (ie, no URIs or special items).`,
            });

            this.playlist_end_on_shortest_track = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("playlist_end_on_shortest_track"),
                "name": "playlist_end_on_shortest_track",
                "label": "End Playlist on Shortest Track",
                "info": `Enabling sets the item to end when the track with the shortest duration ends. Disabling will pad the shortest track to match the duration of the longer track.`,
                "hidden": () => !this.items.every(i => i.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK),
            });

            this.playlist_revert_to_video_track_audio = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("playlist_revert_to_video_track_audio"),
                "name": "playlist_revert_to_video_track_audio",
                "label": "Revert to Video Track Audio",
                "info": `If the audio track is shorter than the video track, revert to the audio supplied in the video track.`,
                "disabled": () => this.items.every(i => i.props.playlist_end_on_shortest_track),
                "hidden": () => !this.items.every(i => i.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK),
            });

            this.clip_start = new ui.TimeSpanProperty({
                ..._get_property_opts("clip_start"),
                "name": "clip_start",
                "label": "Clip Start",
                "timespan.format": "h:mm:ss.SSS",
                "max": (item) => this.clip_end.value || get_default_duration(item),
                "default": 0,
            });

            this.clip_end = new ui.TimeSpanProperty({
                ..._get_property_opts("clip_end"),
                "name": "clip_end",
                "label": "Clip End",
                "timespan.format": "h:mm:ss.SSS",
                "min": () => (this.clip_start.value || 0),
                "max": get_default_duration,
                "default": get_default_duration,
            });

            this.clip_length = new ui.TimeSpanProperty({
                ..._get_property_opts("clip_length"),
                "label": "Clip Length",
                "timespan.format": "h:mm:ss.SSS",
                "reset": false,
                "min": 0,
                "max": (item) => get_default_duration(item) - (this.clip_start.value || 0),
            });

            var get_clip_lengths = () => {
                var start_values = this.clip_start.values;
                var end_values = this.clip_end.values;
                return end_values.map((_, i) => end_values[i] - start_values[i]);
            };

            this.clip_offset = new ui.TimeSpanProperty({
                ..._get_property_opts("clip_offset"),
                "name": "clip_offset",
                "label": "Clip Offset",
                "timespan.format": "h:mm:ss.SSS",
            });

            this.clip_loops = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("clip_loops"),
                "name": "clip_loops",
                "label": "Clip Loops",
                "precision": 8,
            });
            // this.clip_loops.output_modifiers.push(v=>v.toFixed(6).replace(/0+$/, ""));

            this.total_duration = new ui.TimeSpanProperty({
                "label": "Total Duration",
                "reset": false,
                "min": 0,
                "timespan.format": "h:mm:ss.SSS",
            });

            this.start_end_time_range = new RangeProperty({
                "min": 0,
                "max": get_default_duration,
                "step": 0.001,
                "hidden": () => this.clip_start.is_indeterminate || this.clip_end.is_indeterminate || this.items.some(i => get_default_duration(i) == 0),
                "reset": false,
                "title": `Clip Range`,
            });
            var update_clip_length = () => {
                var start_values = this.clip_start.values;
                var end_values = this.clip_end.values;
                var ranges = start_values.map((_, i) => [start_values[i], end_values[i]]);
                this.start_end_time_range.set_values(ranges);
                this.clip_length.set_values(get_clip_lengths());
                update_total_duration();
            };
            var update_total_duration = () => {
                var clip_loop_values = this.clip_loops.values;
                var values = get_clip_lengths().map((v, i) => v * clip_loop_values[i]);
                this.total_duration.set_values(values);
            };
            this.on("post_update", () => {
                update_clip_length();
            });
            /* this.clip_end.on("change", ()=>{
                update_clip_length();
            });
            this.clip_loops.on("change", (e)=>{
                update_total_duration();
            }); */
            this.clip_length.on("change", (e) => {
                if (e.trigger) this.clip_end.set_value(this.clip_start.value + e.value, { trigger: true });
            });
            this.total_duration.on("change", (e) => {
                if (e.trigger) this.clip_loops.set_value(e.value / get_clip_lengths(), { trigger: true });
            });
            this.start_end_time_range.on("change", (e) => {
                if (this.clip_start.is_indeterminate) return;
                if (this.clip_end.is_indeterminate) return;
                var trigger = e.trigger;
                this.clip_start.set_value(e.value[0], { trigger });
                this.clip_end.set_value(e.value[1], { trigger });
            });

            // -------------------------------------

            this.fade_in_time = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("fade_in"),
                "name": "fade_in",
                "label": "Fade In Duration",
                "suffix": "secs",
            })

            this.fade_out_time = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("fade_out"),
                "name": "fade_out",
                "label": "Fade Out Duration",
                "suffix": "secs",
            });

            // var background_mode_prop = ()=>PlaylistItemPropsProps.background_mode;
            this.background_mode = new ui.InputProperty(`<select></select>`, {
                ..._get_property_opts("background_mode", (opts) => {
                    var options = opts.options
                    /** @this {ui.InputProperty} */
                    /** @param {PlaylistItem$} item */
                    opts.options = function (item) {
                        if (item._is_special) {
                            options = options.filter(o => !["embedded", "external"].includes(o[0]));
                        }
                        // } else {
                        // utils.sort(options, o=>o[0]==background_mode_prop().__default__ ? 0 : 1);
                        var default_opt = options.find(o => o[0] == "default") || options.find(o => o[0] == null);
                        var background_mode_option = InternalSessionProps.background_mode.__options__.find(o => o[0] == app.$._session.background_mode);
                        if (default_opt && background_mode_option) {
                            default_opt[1] = `Default Background (${background_mode_option[1]})`;
                        }
                        var auto_option = options.find(o => o[0] == "auto");
                        var ao = get_auto_background_mode(item, item._media_info);
                        var auto_option_link = options.find(o => o[0] == ao);
                        auto_option[1] = `Auto (${auto_option_link ? auto_option_link[1] : "-"})`;

                        return options;
                    }
                    return opts;
                }),
                "name": "background_mode",
                "info": background_mode_info,
                "label": "Background Mode",
            });

            this.background_color = new ui.InputProperty(`<input type="color">`, {
                ..._get_property_opts("background_color"),
                "name": `background_color`,
                "label": "Background Color",
            });
            var video_file_props = create_file_start_end_properties({
                "type": "video",
                ..._get_property_opts("video_file"),
                "name": "video_file",
                "label": "Video File",
            });
            this.video_file = video_file_props.file;
            this.video_file_start = video_file_props.start;
            this.video_file_end = video_file_props.end;

            var audio_file_props = create_file_start_end_properties({
                "type": "audio",
                ..._get_property_opts("audio_file"),
                "name": "audio_file",
                "label": "Audio File",
            });
            this.audio_file = audio_file_props.file;
            this.audio_file_start = audio_file_props.start;
            this.audio_file_end = audio_file_props.end;
            this.audio_file.validators.push(VALIDATORS.media_audio);

            this.subtitle_file = new FileProperty({
                ..._get_property_opts("subtitle_file"),
                "name": "subtitle_file",
                "label": "Subtitle File",
                "file.options": { files: true, filter: ["text"] },
                "file.check_media": true,
            })
            this.subtitle_file.validators.push(VALIDATORS.media_subtitle);

            this.crop = new ui.MultiInputProperty({
                ..._get_property_opts("crop"),
                "name": "crop",
                "label": "Crop",
                "props": ["left", "up", "right", "down"].map((dir, i) => {
                    var p = new ui.InputProperty(`<input type="text">`, {
                        "name": i,
                        "reset": false,
                        "default": 0,
                        "step": 0.01,
                        "min": 0,
                        "max": 1,
                        "precision": 4,
                        "prefix": `<i class="fa-solid fa-arrow-${dir}"></i>`,
                        "suffix": `%`,
                    });
                    p.input_modifiers.push((v) => v / 100);
                    p.output_modifiers.push((v) => v * 100);
                    return p;
                })
            });
            this.crop.on("change", (e) => {
                this.detected_crops_images.update();
            });

            /** @type {DetectedCrop$} */
            var last_detected_crop = null;
            this.auto_crop_button = new ui.Button(null, {
                "flex": 0,
                "content": () => this.auto_crop_button.async_click_promise ? `Detecting <i class="fas fa-sync fa-spin"></i>` : `Detect`,
                "click_async": async () => {
                    last_detected_crop = await app.request("detect_crop", [_this.item.id, _this.clip_start.value], {
                        show_spinner: false,
                        timeout: 0
                    }).catch(utils.noop);
                    if (!last_detected_crop) return;
                    var r = new utils.Rectangle(last_detected_crop.combined);
                    this.crop.set_value([r.left, r.top, 1 - r.right, 1 - r.bottom], { trigger: true });
                    this.update();
                },
                "hidden": () => {
                    var info = get_info();
                    return !info.is_normal || info.is_remote;
                }
            });
            this.crop.buttons_el.append(this.auto_crop_button);

            var old_hash;
            var crop_el = $(`<div class="crop-image-container"></div>`)[0];
            this.detected_crops_images = new ui.UI(crop_el, {
                "hidden": () => {
                    return _this.items.length != 1 || !(last_detected_crop || _this.item._detected_crops);
                },
                /** @this {ui.InputProperty} */
                "update": () => {
                    var data = last_detected_crop || _this.item._detected_crops;
                    var hash = JSON.stringify([data, this.crop.value, _this.item.id]);
                    if (hash === old_hash) return;
                    old_hash = hash;

                    dom.remove_children(crop_el);
                    if (data && _this.items.length == 1) {
                        data.crops.forEach((d, i) => {
                            var v = this.crop.value
                            var r = new utils.Rectangle({ left: v[0], top: v[1], right: 1 - v[2], bottom: 1 - v[3] });
                            var p = new CropPreview(d.url, d.rect, r, false, data.width, data.height);
                            var container = $(`<div></div>`)[0];
                            container.appendChild(p.elem);
                            crop_el.appendChild(container);
                            p.elem.onclick = () => new CropEditMenu(this.crop, data, i).show();
                        });
                    }
                }
            });

            // -------------------------------------

            this.duration = new ui.TimeSpanProperty({
                ..._get_property_opts("duration", (opts) => {
                    var orig_default = opts.default;
                    opts.default = () => {
                        if (_this.items.some(i => i._root_merged_playlist)) return 60;
                        return orig_default;
                    }
                    return opts;
                }),
                "name": "duration",
                "label": "Duration",
                "timespan.zero_infinity": () => {
                    return !this.items.some(i => i._root_merged_playlist);
                },
                "timespan.format": "h:mm:ss.SSS",
            });

            // -------------------------------------

            this.title_text = new ui.TextAreaProperty({
                ..._get_property_opts("title_text"),
                "name": "title_text",
                "label": "Text",
                "placeholder": "Insert Text Here",
                "reset": false,
                "textarea.rows": 3,
                "textarea.grow": true,
            });
            this.title_text.validators.push(VALIDATORS.not_empty);

            //Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

            this.title_font = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("title_font"),
                "name": "title_font",
                "label": "Font",
            });
            /* this.title_font.group_elem.append(new ui.Button(`<button><i class="fas fa-plus"></i></button>`, {
                "title": `Add New Font...`,
                "click": ()=>{
                    app.font_menu.show()
                }
            })) */

            this.title_size = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("title_size"),
                "name": "title_size",
                "label": "Size",
            });
            this.title_color = new ui.InputProperty(`<input type="color">`, {
                ..._get_property_opts("title_color"),
                "name": "title_color",
                "label": "Color",
            });
            this.title_style = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("title_style"),
                "name": "title_style",
                "label": "Style",
            });
            this.title_alignment = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("title_alignment"),
                "name": "title_alignment",
                "label": "Alignment",
            });
            this.title_spacing = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("title_spacing"),
                "name": "title_spacing",
                "label": "Letter Spacing",
            });
            this.title_outline_thickness = new ui.InputProperty(`<input type="number"></div>`, {
                ..._get_property_opts("title_outline_thickness"),
                "name": "title_outline_thickness",
                "label": "Outline Thickness",
                "precision": 1,
            });
            this.title_outline_color = new ui.InputProperty(`<input type="color">`, {
                ..._get_property_opts("title_outline_color"),
                "name": "title_outline_color",
                "label": "Outline Color",
            });
            this.title_shadow_depth = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("title_shadow_depth"),
                "name": "title_shadow_depth",
                "label": "Shadow Depth",
                "precision": 1,
            });
            this.title_shadow_color = new ui.InputProperty(`<input type="color">`, {
                ..._get_property_opts("title_shadow_color"),
                "name": "title_shadow_color",
                "label": "Shadow Color",
            });
            this.title_underline = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("title_underline"),
                "name": "title_underline",
                "label": "Underline",
            });
            this.title_rotation = new ui.MultiInputProperty({
                ..._get_property_opts("title_rotation"),
                "name": "title_rotation",
                "label": "3D Rotation (degrees)",
                props: ["x", "y", "z"].map((n, i) => {
                    return new ui.InputProperty(`<input type="number">`, {
                        "name": i,
                        "reset": false,
                        "default": 0,
                        "suffix": n,
                    })
                })
            });
            this.title_margin = new ui.InputProperty(`<input type="number">`, {
                ..._get_property_opts("title_margin"),
                "name": "title_margin",
                "label": "Margin",
            });

            var alignments = ["bottom left", "bottom center", "bottom right", "center left", "center", "center right", "top left", "top center", "top right"];

            (() => {
                var _title_hash, _anim_hash;
                var title_preview_content_el = $(`<div class="title-preview"></div>`)[0];
                this.title_preview = new ui.InputProperty(title_preview_content_el, {
                    "label": "Preview",
                    "setup": () => { },
                    "reset": false,
                    "update": () => {
                        var hash = JSON.stringify([this.title_text, this.title_size, this.title_color, this.title_style, this.title_alignment, this.title_spacing, this.title_outline_thickness, this.title_outline_color, this.title_shadow_depth, this.title_shadow_color, this.title_underline, this.title_rotation, this.title_margin, this.background_mode, this.background_color, this.video_file, this.video_file_start, this.video_file_end].map(p => p.value));
                        if (_title_hash != hash) {
                            _title_hash = hash;
                            update_preview();
                        }
                        var hash = JSON.stringify([this.duration, this.fade_in_time, this.fade_out_time].map(p => p.value));
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
                    "overflow": "hidden",
                    "border": "1px solid #ddd",
                });
                title_preview_content_el.onclick = () => {
                    restart_animation();
                }

                var timeline_elem = $(`<div class="timeline"><div></div></div>`)[0];
                Object.assign(timeline_elem.style, {
                    "z-index": 10,
                    "width": "100%",
                    "bottom": 0,
                    "height": "6px",
                    "background": "rgba(0,0,0,0.2)",
                    "position": "absolute",
                });
                Object.assign(timeline_elem.firstElementChild.style, {
                    "height": "100%",
                    "background": "#fff",
                    "opacity": 0.8,
                });
                title_preview_content_el.append(timeline_elem);

                var padding = $(`<div></div>`)[0];
                Object.assign(padding.style, {
                    "position": "absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                });
                title_preview_content_el.append(padding);

                var black_overlay = $(`<div></div>`)[0];
                Object.assign(black_overlay.style, {
                    "position": "absolute",
                    "top": 0,
                    "width": "100%",
                    "height": "100%",
                    "background": "black",
                    "z-index": 5,
                });
                title_preview_content_el.append(black_overlay);

                var inner = $(`<div></div>`)[0];
                Object.assign(inner.style, {
                    "position": "relative",
                    "width": "100%",
                    "height": "100%",
                });
                padding.append(inner);

                var title_preview_style;

                var container = $(`<div class="preview-container"></div>`)[0];
                Object.assign(container.style, {
                    "position": "absolute",
                    "top": 0,
                    "bottom": 0,
                    "left": 0,
                    "right": 0,
                    "z-index": 2,
                });
                inner.append(container);

                var [w, h] = [384, 288];
                var svg = $(`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
                    <defs>
                        <filter id="shadow">
                            <feDropShadow dx="0" dy="0" stdDeviation="0" />
                        </filter>
                    </defs>
                    <text></text>
                </svg>`)[0];
                svg.style.width = "100%";
                svg.style.height = "100%";
                /** @type {SVGTextElement} */
                var svg_text = svg.querySelector("text");
                container.append(svg);

                title_preview_content_el.onanimationend = () => {
                    setTimeout(() => restart_animation(), 500);
                };

                var restart_animation = () => {
                    var duration = this.duration.value || Number.MAX_SAFE_INTEGER;
                    if (!title_preview_style) {
                        title_preview_style = $(`<style></style>`)[0];
                        document.body.append(title_preview_style);
                    }
                    let style_text = `
                    @keyframes title-preview-timeline {
                        0% { width:0; }
                        100% { width:100%; }
                    }`;

                    var fade_in_duration_percent = Math.max(0, this.fade_in_time.value / duration);
                    var lines1 = [
                        `0% { opacity:0; }`,
                        `${fade_in_duration_percent * 100}% { opacity:1; }`
                    ];
                    var lines2 = [
                        `0% { opacity:1; }`,
                        `${fade_in_duration_percent * 100}% { opacity:0; }`
                    ];
                    if (this.fade_out_time.value) {
                        var fade_out_duration_percent = 1 - Math.max(0, this.fade_out_time.value / duration);
                        lines1.push(`${fade_out_duration_percent * 100}% { opacity:1; }`, `100% { opacity:0; }`);
                        lines2.push(`${fade_out_duration_percent * 100}% { opacity:0; }`, `100% { opacity:1; }`);
                    } else {
                        lines1.push(`100% { opacity:1; }`);
                        lines2.push(`100% { opacity:0; }`);
                    }
                    style_text += "\n" + `@keyframes title-preview-fade { ${lines1.join(" ")} }`
                    style_text += "\n" + `@keyframes black-overlay-fade { ${lines2.join(" ")} }`;
                    black_overlay.style.animation = `black-overlay-fade linear ${duration}s 1 forwards`;

                    title_preview_style.textContent = style_text;
                    dom.set_style_property(timeline_elem.firstElementChild, "animation", duration ? `title-preview-timeline linear ${duration}s 1 forwards` : "");
                    dom.restart_animation(title_preview_content_el);
                }
                var update_preview = () => {
                    Object.assign(title_preview_content_el.style, {
                        "background": this.background_color.value || app.$._session.background_color || "#000000",
                    });
                    var margin = this.title_margin.value || 0;
                    var style = (this.title_style.value || "");
                    var lines = (this.title_text.value || "").split(/\n/);
                    var ha = (this.title_alignment.value - 1) % 3;
                    var va = Math.floor((this.title_alignment.value - 1) / 3);
                    svg_text.innerHTML = "";
                    lines.forEach((line, i) => {
                        var tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                        tspan.innerHTML = (line.trim()) ? line : "&nbsp;";
                        tspan.setAttribute("x", ["0%", "50%", "100%"][ha]);
                        tspan.setAttribute("dy", i ? this.title_size.value : 0);
                        tspan.style.whiteSpace = "pre-wrap";
                        svg_text.append(tspan);
                    });

                    Object.assign(svg.style, {
                        "transition": "all 0.5s",
                        "user-select": "none",
                    });
                    if (this.title_shadow_depth.value) {
                        svg_text.style.filter = "url(#shadow)";
                    }
                    svg_text.setAttribute("y", 0);
                    svg_text.setAttribute("text-anchor", ["start", "middle", "end"][ha]);
                    svg_text.setAttribute("stroke-width", this.title_outline_thickness.value);
                    svg_text.setAttribute("stroke", this.title_outline_color.value ? this.title_outline_color.value : "none");
                    svg_text.setAttribute("fill", this.title_color.value);
                    svg_text.setAttribute("font-size", `${this.title_size.value}`);
                    svg_text.setAttribute("font-weight", style.includes("bold") ? "bold" : "normal");
                    svg_text.setAttribute("font-style", style.includes("italic") ? "italic" : "normal");
                    svg_text.setAttribute("font-family", this.title_font.value);
                    svg_text.setAttribute("letter-spacing", `${this.title_spacing.value}px`);
                    svg_text.setAttribute("text-decoration", this.title_underline.value ? "underline" : "none");

                    var fe = svg.querySelector("filter#shadow feDropShadow");
                    fe.setAttribute("dx", this.title_shadow_depth.value);
                    fe.setAttribute("dy", this.title_shadow_depth.value);
                    fe.setAttribute("flood-color", this.title_shadow_color.value);

                    var bbox = svg_text.getBBox();

                    svg_text.setAttribute("x", [margin, (w - bbox.width) / 2, w - bbox.width - margin][ha]);
                    svg_text.setAttribute("y", [h - bbox.height - margin, (h - bbox.height) / 2, margin][va] - bbox.y);

                    var rotation = this.title_rotation.value || [0, 0, 0];
                    title_preview_content_el.querySelectorAll(".preview-container").forEach(e => {
                        Object.assign(e.style, {
                            "transition": "all 0.5s",
                            "transform-origin": alignments[this.title_alignment.value - 1],
                            "transform-style": "preserve-3d",
                            "transform": `perspective(100px) rotateY(${rotation[1]}deg) rotateX(${rotation[0]}deg) rotateZ(${rotation[2]}deg)`,
                        });
                    })
                }
            })();

            // -------------------------------------

            this.macro_function = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("function"),
                "name": "function",
                "label": "Function",
            });
            // this.macro_function.validators.push(VALIDATORS.not_empty);

            this.macro_handover_session = new ui.InputProperty(`<select>`, {
                ..._get_property_opts("function_handover_session"),
                "name": "function_handover_session",
                "label": "Handover Session",
                "options": () => app.get_handover_sessions_options(),
                "reset": true,
                "hidden": () => this.macro_function.value != "handover"
            });
            this.macro_handover_session.validators.push(VALIDATORS.not_empty);

            // -------------------------------------

            this.label = new ui.InputProperty(`<input type="text">`, {
                ..._get_property_opts("label"),
                "name": "label",
                "label": "Label",
                /** @param {PlaylistItem$} item */
                "default": (item) => item._get_pretty_name({ label: false }) || "",
                // "placeholder": ()=>this.item._get_pretty_name({label:false})||"",
            });
            // this.label.output_modifiers.push((v)=>v?v:this.item._get_pretty_name({label:false}));


            this.color = new ui.InputProperty(`<select></select>`, {
                ..._get_property_opts("color"),
                "name": "color",
                "label": "Item Color",
                "options": Object.keys(item_colors).map(k => {
                    return { value: k, text: utils.capitalize(k), style: { "background-color": item_colors[k] || "#fff" } };
                }),
                "update": function () {
                    dom.set_style_property(this.input, "background-color", item_colors[this.value || "none"]);
                },
                "default": "none",
            });
        }

        var get_info = () => {
            let types = filename.values.map((filename, i) => {
                if (filename === "livestreamer://empty") return "empty";
                if (filename === "livestreamer://macro") return "macro";
                if (filename === "livestreamer://exit") return "exit";
                if (filename === "livestreamer://intertitle") return "intertitle";
                if (filename === "livestreamer://rtmp") return "rtmp";
                if (filename === "livestreamer://playlist" || this.items[i]._is_playlist) return "playlist";
                return "normal";
            });

            let is_playlist = types.every(t => t === "playlist");
            let is_empty = types.every(t => t === "empty");
            let is_macro = types.every(t => t === "macro");
            let is_intertitle = types.every(t => t === "intertitle");
            let is_rtmp = types.every(t => t === "rtmp");
            let is_normal = types.every(t => t === "normal");

            // var is_2_track_playlist = items.every(i=>i._num_tracks == 2);
            let is_merged_playlist = this.playlist_mode.values.every(v => v);
            let is_parent_merged = this.items.every(i => i._root_merged_playlist);
            let is_image = filename.values.every(filename => utils.try_catch(() => app.$._session.media_info[filename].duration <= IMAGE_DURATION));
            let is_remote = filename.values.every(filename => filename.match(/^(rtmps?|https?):\/\//));

            return {
                is_playlist,
                is_empty,
                is_macro,
                is_intertitle,
                is_rtmp,
                is_normal,
                is_merged_playlist,
                is_parent_merged,
                is_image,
                is_remote,
            }
        }

        var update_layout = () => {
            var layout = [];
            var get_default_layout = (is_empty) => {
                var layout = [];
                layout.push([this.vid_override, this.aspect_ratio, this.deinterlace_mode, this.interpolation, this.auto_interpolation_rate, this.correct_pts]);
                layout.push([this.brightness, this.contrast, this.saturation, this.gamma]); // , this.hue
                layout.push([this.aid_override, this.audio_delay, this.audio_channels]);
                layout.push([this.sid_override, this.subtitle_delay, this.subtitle_scale, this.subtitle_pos]);
                layout.push([this.loop, this.volume_normalization, this.volume_multiplier]);
                layout.push([this.pre_filters, this.filters]);
                return layout;
            }

            if (simple) {
                layout.push(...get_default_layout());
            } else {
                var info = get_info();
                var clip_layout = [
                    [this.clip_start, this.clip_end, ...(this.clip_length ? [this.clip_length] : [])],
                    [this.start_end_time_range],
                    [this.clip_offset, this.clip_loops, this.total_duration],
                ];
                var crop_layout = [
                    [this.crop]
                ];
                let add_files_layout = [
                    [this.background_mode, this.background_color],
                    [this.video_file, this.video_file_start, this.video_file_end],
                    [this.audio_file, this.audio_file_start, this.audio_file_end],
                    [this.subtitle_file]
                ]
                if (info.is_normal && !info.is_remote) {
                    crop_layout.push(this.detected_crops_images);
                }
                if (info.is_normal || info.is_empty || info.is_rtmp) {
                    if (info.is_empty || info.is_image || info.is_rtmp) {
                        layout.push([this.duration]);
                        layout.push("---");
                    } else {
                        layout.push(...clip_layout);
                        layout.push("---");
                    }
                    layout.push([this.fade_in_time, this.fade_out_time]);
                    if (!info.is_parent_merged) {
                        layout.push(...add_files_layout);
                        layout.push(...crop_layout);
                        layout.push("---");
                        layout.push(...get_default_layout())
                    }
                } else if (info.is_playlist) {
                    // layout.push([this.filename]);
                    layout.push([this.playlist_mode, this.playlist_end_on_shortest_track, this.playlist_revert_to_video_track_audio]);
                    if (info.is_merged_playlist) {
                        layout.push("---");
                        layout.push(...clip_layout);
                        layout.push("---");
                        layout.push([this.fade_in_time, this.fade_out_time]);
                        layout.push(...add_files_layout);
                        layout.push(...crop_layout);
                        layout.push("---");
                        layout.push(...get_default_layout());
                    }
                } else if (info.is_intertitle) {
                    layout.push([this.title_text]);
                    layout.push([this.duration, this.fade_in_time, this.fade_out_time]);
                    layout.push([this.title_font, this.title_size, this.title_color]);
                    layout.push([this.title_style, this.title_alignment, this.title_spacing]);
                    layout.push([this.title_underline, this.title_margin]);
                    layout.push([this.title_rotation]);
                    layout.push([this.title_outline_thickness, this.title_outline_color, this.title_shadow_depth, this.title_shadow_color]);
                    layout.push([this.background_color]);
                    layout.push([this.title_preview]);
                    layout.push("---");
                    layout.push([this.audio_file]);
                } else if (info.is_macro) {
                    layout.push([this.macro_function]);
                    layout.push([this.macro_handover_session]);
                } else if (info.is_rtmp) {

                }
                if (layout.length) layout.push("---");
                layout.push([this.label, this.color]);
            }
            this.layout = layout;
        };
        /* this.on("update", ()=>{
            console.log("change", Date.now());
            update_layout();
        }); */
        var debounced_update_layout = dom.debounce_next_frame(update_layout, 0);
        this.on("post_update", () => {
            debounced_update_layout();
        });
    }
}

/**
 * @template ItemType
 * @template {string} [ValueType=string]
 * @template {FileProperty<ItemType,ValueType>} [ThisType=FileProperty<ItemType,ValueType>]
 * @typedef {ui.InputPropertySettings<ItemType,ValueType,ThisType> & {
 *  "file.options": ui.UISetting<ThisType,FileManagerOptions>,
 *  "file.check_media": ui.UISetting<ThisType,boolean>,
 * }} FilePropertySettings
 */

/** 
 * @template ItemType 
 * @template {string} [ValueType=string]
 * @template {FilePropertySettings<ItemType,ValueType,FileProperty>} [Settings=FilePropertySettings<ItemType,ValueType,FileProperty>]
 * @template {ui.InputPropertyEvents} [Events=ui.InputPropertyEvents]
 * @extends {ui.InputProperty<ItemType,ValueType,Settings,Events>} 
 */
export class FileProperty extends ui.InputProperty {

    /** @param {Settings} settings */
    constructor(settings = {}) {
        settings = {
            "file.options": { files: true, folders: false, multiple: false },
            "file.check_media": false,
            "placeholder": () => `Choose a ${this.get_setting("file.options").folders ? "directory" : "file"}...`,
            ...settings
        }
        var input = $(`<input type="text">`)[0];
        super(input, settings);
        var input2 = $(`<input type="text">`)[0];
        input.parentElement.append(input2)
        // input2.style.pointerEvents = "none";
        var update_inputs = (has_focus) => {
            input2.style.display = has_focus ? "none" : "";
            this.input.style.display = has_focus ? "" : "none"
        };
        update_inputs(false);
        input2.addEventListener("focus", (e) => {
            update_inputs(true);
            this.input.focus();
            this.input.scrollLeft = Number.MAX_SAFE_INTEGER;
            this.input.setSelectionRange(this.input.value.length, this.input.value.length);
        }, { capture: true });
        this.input.addEventListener("blur", (e) => {
            update_inputs(false);
        }, { capture: true });

        var browse_button = new ui.Button(`<button><i class="fas fa-folder-open"></i></button>`, {
            title: "Browse",
            click: async (e) => {
                /** @type {FileManagerOptions} */
                var file_options = { id: this.name_id, start: this.value, ...this.get_setting("file.options") };
                var paths = await app.open_file_manager(file_options);
                if (!paths) return;
                this.set_values(paths[0], { trigger: true });
            }
        });
        this.validators.push(() => {
            if (!this.get_setting("file.check_media")) return true;
            var valid = VALIDATORS.media_exists.apply(this);
            if (valid !== true) return valid;
            return true;
        });
        this.buttons_el.prepend(browse_button);
        // var last_has_focus;
        this.on("change", async (e) => {
            if (!this.get_setting("file.check_media")) return;
            if (e.trigger) {
                app.get_media_info(this.value).then(info => {
                    this.update()
                    this.emit("media_info", info);
                });
            }
        });
        /* this.on("render", ()=>{
            var value = this.input.value;
            this.input.setSelectionRange(value.length, value.length);
        }); */
        this.on("render", () => {
            var value = this.value;
            var has_focus = dom.has_focus(this.input);
            console.log("has_focus", has_focus);
            if (value && !value.startsWith("livestreamer://")) value = pretty_uri_basename(value);
            input2.value = value || "";
            input2.placeholder = this.get_setting("placeholder");
            // input2.scrollLeft = Number.MAX_SAFE_INTEGER;
            // if (this.input.value != value) this.input.value = value;
            // if (has_focus && !last_has_focus) {
            //     this.input.scrollLeft = Number.MAX_SAFE_INTEGER;
            //     // dom.set_selection_range(this.input, value.length, value.length);
            //     this.input.setSelectionRange(value.length, value.length);
            // }
            // last_has_focus = has_focus;
        });
    }
}

export class FilterConfigurationMenu extends ui.EditModal {
    /** @param {ui.PropertyListItem} list_item */
    constructor(list_item) {
        var is_new = !list_item;
        super({
            "modal.title": "Configure Filter",
            "modal.apply": () => {
                if (is_new) return;
                list_item.set_value(this.props.value, { trigger: true });
            },
            "modal.items": () => {
                if (!is_new) return [list_item.value];
            },
            "modal.auto_apply": !is_new,
            "modal.return_value": () => this.props.value
        });

        var orig_filter = is_new ? {} : list_item.value;

        var row = new ui.FlexRow();
        var filter_name = new ui.InputProperty(`<select>`, {
            name: "name",
            label: "Filter",
            options: [
                { value: "", text: "-", hidden: true, default: true },
                ...[...utils.group_by(utils.sort(Object.values(filters), f => f.type === "video" ? -1 : 1), f => f.type)].map(([type, filters]) => ({ group: utils.capitalize(type), options: filters.map(f => ({ text: f.descriptive_name, value: f.name })) }))
            ],
            reset: false,
        });
        filter_name.validators.push(VALIDATORS.not_empty);
        var filter_active = new ui.InputProperty(`<select>`, {
            name: "active",
            label: "Active",
            default: true,
            reset: false,
            options: YES_OR_NO,
            reset: false,
        });
        var filter_type = new ui.InputProperty(`<input>`, {
            readonly: true,
            label: "Type",
            reset: false,
        });
        var filter_description = new ui.InputProperty(`<input>`, {
            readonly: true,
            label: "Description",
            reset: false,
        });
        row.append(filter_name, filter_active, filter_type);
        this.props.append(row);
        this.props.append(filter_description);

        var filter_props_container = new ui.PropertyGroup({
            "name": "props",
        });
        this.props.append(filter_props_container);

        var get_preset_key = (props) => {
            return JSON.stringify(Object.entries(props).sort((([k0, v0], [k1, v1]) => k0 == k1 ? 0 : k0 < k1 ? -1 : 1)))
        }

        var old_hash;
        filter_name.on("change", () => {
            filter_props_container.update();
        });

        filter_props_container.on("update", () => {
            var hash = JSON.stringify(filter_name.value);
            if (hash === old_hash) return;
            old_hash = hash;

            /** @type {ui.InputProperty} */
            var presets;
            /** @type {Filter} */
            var filter_def = filters[filter_name.value];
            if (!filter_def) return;
            var preset_map = Object.fromEntries(Object.keys(filter_def.presets).map(k => [get_preset_key(filter_def.presets[k]), k]));

            filter_type.set_value(utils.capitalize(filter_def.type));
            filter_description.set_value(filter_def.description);

            if (utils.is_empty(filter_def.props)) return;

            presets = new ui.InputProperty(`<select>`, {
                label: "Preset",
                default: "default",
                options: [{ value: "", text: "-", hidden: true, default: true }, ...Object.keys(filter_def.presets).map(k => [k, k])],
                reset: false,
            });

            presets.on("change", (e) => {
                if (e.trigger) {
                    var props = filter_props_container.named_property_map;
                    var preset = filter_def.presets[presets.value];
                    for (var k in props) {
                        props[k].set_value(preset[k], { trigger: true });
                    }
                }
            });

            var layout = ["-----"];
            if (Object.keys(filter_def.presets).length > 1) {
                layout.push(presets, "-----");
            }

            for (let name in filter_def.props) {
                let p = filter_def.props[name];
                /** @type {ui.InputProperty} */
                let prop;
                let default_prop_def = {
                    name,
                    label: p.__name__,
                    default: p.__default__,
                    info: p.__description__,
                    data: (_, path) => {
                        if (filter_name.value == orig_filter.name) return utils.reflect.get(orig_filter, path)
                    }
                };
                if (p.__options__) {
                    prop = new ui.InputProperty(`<select>`, {
                        ...default_prop_def,
                        options: p.__options__,
                    });
                } else if (p.__type__ === "boolean") {
                    prop = new ui.InputProperty(`<select>`, {
                        ...default_prop_def,
                        options: YES_OR_NO
                    });
                } else if (p.__type__ === "color") {
                    prop = new ui.InputProperty(`<input type="color">`, {
                        ...default_prop_def,
                    });
                } else if (p.__type__ === "number") {
                    prop = new ui.InputProperty(`<input type="number">`, {
                        ...default_prop_def,
                        min: p.__min__,
                        max: p.__max__,
                        step: p.__step__ || 1,
                    });
                } else {
                    prop = new ui.InputProperty(`<input type="text">`, {
                        ...default_prop_def,
                    });
                }
                layout.push(prop);
            }

            var update_preset = utils.debounce(() => {
                var pk = get_preset_key(filter_props_container.value);
                var k = preset_map[pk];
                presets.set_value(k || "");
            });
            filter_props_container.on("change", (e) => {
                update_preset();
            });
            filter_props_container.layout = layout;
        });
    }
}

export class EditAccessControlMemberMenu extends ui.EditModal {
    /** @param {AccessControlProperty} prop @param {AccessControlUser} data */
    constructor(prop, data) {
        var is_new = utils.is_empty(data);
        super({
            "modal.title": "Edit Access Control",
            "modal.auto_apply": !is_new,
            "modal.apply": () => {
                var value = prop.value;
                value[this.username.value] = this.props.value;
                prop.set_value(value);
            },
            "modal.items": [data],
        });

        var row = this.props.append(new ui.FlexRow());
        this.username = new ui.InputProperty(`<input type="text">`, {
            "name": "username",
            "label": "Username",
            "default": "",
            "disabled": () => !is_new,
            "reset": false,
        });
        this.username.validators.push(VALIDATORS.not_empty);
        this.username.validators.push((v) => (is_new && prop.value[v]) ? "Username already registered" : true);
        this.access = new ui.InputProperty(`<select>`, {
            "name": "access",
            "label": "Access",
            "default": "allow",
            "options": () => {
                return [["owner", { disabled: data.username == "*" }], "allow", "deny"]
            },
        });
        this.password = new ui.InputProperty(`<input type="text">`, {
            "name": "password",
            "label": "Password",
            "default": "",
            "hidden": () => this.access.value !== "allow" || data.username != "*",
        });
        this.suspended = new ui.InputProperty(`<select>`, {
            "name": "suspended",
            "label": "Suspended",
            "default": false,
            "options": YES_OR_NO,
            "disabled": () => data.username != "*" && this.access.value === "owner" && data.username === app.$._client.user.username,
            "hidden": () => data.username == "*",
        });

        row.append(this.username, this.access);

        if (prop.get_setting("access.allow_passwords")) row.append(this.password);
        row.append(this.suspended);
    }
}

/** 
 * @template ItemType 
 * @template {AccessControl$} [ValueType=AccessControl$] 
 * @template {ui.InputPropertySettings<ItemType,ValueType,AccessControlProperty>} [Settings=ui.InputPropertySettings<ItemType,ValueType,AccessControlProperty>]
 * @extends {ui.InputProperty<ItemType,ValueType,Settings>} 
 */
export class AccessControlProperty extends ui.InputProperty {
    get values() {
        return super.values.map(v => new AccessControl$(v));
    }
    /** @param {Settings} settings */
    constructor(settings) {
        var elem = $(`<div class="access-control"></div>`)[0];
        super(elem, {
            "reset": false,
            "hidden": () => !this.value._self_has_ownership,
            "access.allow_passwords": true,
            ...settings
        });

        var columns = {
            "Username": (data) => $(`<span>${data.username}</span>`)[0],
            "Access": (data) => {
                var str = String(data.access).toUpperCase();
                if (data.access === "allow" && data.password) str += " [Password Protected]";
                return str;
            },
            // "Password": (data)=>data.password ? ("*".repeat(data.password ? data.password.length : 0)) : "-",
            "Controls": (data) => {
                var ac = this.value;
                var edit_button, delete_button, suspend_button;
                if (ac._owners.length == 0) return;
                if (ac._self_has_ownership) {
                    edit_button = $(`<button class="mini icon" title="Edit"><i class="fas fa-wrench"></i></button>`)[0];
                    edit_button.onclick = () => {
                        new EditAccessControlMemberMenu(this, data).show();
                    };
                    edit_button.disabled = data.access == "owner" && ac._owners.length < 2;
                    if (data.username !== "*" && data.access !== "owner") {
                        suspend_button = $(`<button class="mini icon" title="${data.suspended ? "Unsuspend" : "Suspend"}"><i style="opacity:${data.suspended ? 0.5 : 1.0};"class="far fa-pause-circle"></i></button>`)[0];
                        suspend_button.onclick = () => {
                            ac._edit(data.username, { suspended: !data.suspended });
                            this.set_value(ac, { trigger: true });
                        };
                    }
                    if (data.username !== "*") {
                        delete_button = $(`<button class="mini icon" title="Delete"><i class="fas fa-trash-alt"></i></button>`)[0];
                        delete_button.onclick = () => {
                            ac._delete(data.username);
                            this.set_value(ac, { trigger: true });
                        };
                    }
                }
                var $buttons = $(`<div class="control-buttons"></div>`);
                $buttons.append([edit_button, suspend_button, delete_button].filter(e => !!e));
                return $buttons[0];
            }
        };
        var table_elem = $(`<table></table>`)[0];
        var thead_elem = $(`<thead></thead>`)[0];
        var tbody_elem = $(`<tbody></tbody>`)[0];
        var tfoot_elem = $(`<tfoot><tr><td></td></tr></tfoot>`)[0];
        var add_button = $(`<button class="claim-ownership"></button>`)[0];
        table_elem.append(thead_elem);
        table_elem.append(tbody_elem);
        table_elem.append(tfoot_elem);
        elem.append(table_elem);
        var footer_cell = tfoot_elem.querySelector("td");
        dom.set_attribute(footer_cell, "colspan", Object.keys(columns).length);
        footer_cell.style.padding = 0;
        footer_cell.append(add_button);
        add_button.addEventListener("click", async () => {
            var ac = this.value;
            if (ac._owners.length == 0) {
                this._claim();
            } else {
                new EditAccessControlMemberMenu(this, {}).show();
            }
        });
        thead_elem.append($(`<tr>${Object.keys(columns).map(c => `<th>${c}</th>`)}</tr>`)[0]);
        var old_hash;
        this.on("render", () => {
            var ac = this.value;
            var hash = JSON.stringify(ac);
            if (hash === old_hash) return;
            old_hash = hash;

            dom.remove_children(tbody_elem);
            add_button.innerText = add_button.title = ac._owners.length == 0 ? "Claim Ownership" : "Add User";
            dom.toggle_attribute(add_button, "disabled", !ac._self_has_ownership);
            for (let user of ac._users) {
                var tr = $(`<tr></tr>`)[0];
                if (user.suspended) tr.style.color = "rgba(0,0,0,0.4)";
                tbody_elem.append(tr);
                $(Object.values(columns).map(column_cb => column_cb(user))).toArray().forEach(c => {
                    var td = $(`<td></td>`)[0];
                    $(td).append(c);
                    tr.append(td);
                });
            }
        });
    }

    _claim() {
        var ac = this.value;
        ac._claim();
        this.set_value(ac, { trigger: true });
    }
}

/** 
 * @template ItemType 
 * @template {[number,number]} [ValueType=[number,number]]
 * @template {ui.InputPropertySettings<ItemType,ValueType,RangeProperty>} [Settings=ui.InputPropertySettings<ItemType,ValueType,RangeProperty>]
 * @template {ui.PropertyEvents} [Events=ui.PropertyEvents]
 * @extends {ui.InputProperty<ItemType, ValueType, Settings, Events>} 
 */
export class RangeProperty extends ui.InputProperty {
    get is_disabled() { return super.is_disabled || this.is_indeterminate; }

    /** @param {Settings} settings */
    constructor(settings) {
        var input = $(`<div class="ui-slider-range"></div>`)[0];
        input.style.width = "100%";
        input.style.padding = "0 10px";
        /** @type {noUiSliderAPI} */
        var slider;

        slider = noUiSlider.create(input, {
            start: [0, 1],
            connect: true,
            behaviour: 'drag',
            range: { 'min': 0, 'max': 1 },
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
        var value;
        var debounced_update_value = dom.debounce_next_frame(() => this.set_value(value));
        var debounced_update_value_trigger = dom.debounce_next_frame(() => this.set_value(value, { trigger: true }));
        slider.on("slide", (_values) => {
            value = _values.map(v => +v);
            debounced_update_value();
        });
        slider.on("end", (_values) => {
            value = _values.map(v => +v);
            debounced_update_value_trigger();
        });
        settings = {
            "min": 0,
            "max": 1,
            "step": 1,
            "spinner": false,
            "setup": false,
            ...settings
        }
        settings.default = settings.default ?? ((item) => [this.get_setting("min", item), this.get_setting("max", item)]);
        super(input, settings);

        this.elem.classList.add("range-property");

        var last_hash;
        this.on("render", (e) => {
            var is_indeterminate = this.is_indeterminate;
            var min, max, step, value;
            if (is_indeterminate) {
                min = 0;
                max = 1;
                step = 0;
                value = [0, 1];
            } else {
                let item = this.item;
                min = this.get_setting("min", item) || 0;
                max = this.get_setting("max", item) || 1;
                step = this.get_setting("step", item);
                value = this.value;
            }
            var hash = JSON.stringify([value, step, min, max]);
            if (last_hash !== hash) {
                last_hash = hash;
                slider.updateOptions({ step, range: { min, max } });
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
    constructor(id, settings) {
        super({
            "panel.title": "",
            "panel.collapsible": true,
            "panel.draggable": true,
            ...settings
        });
        this.panel_id = id;
        app.panels[this.panel_id] = this;

        dom.add_class(this.elem, "drawer");
        this.elem.dataset.id = this.panel_id;
        var header_container_elem = $(`<div class="header"><div class="inner"></div><div class="collapse-arrow"><i class="fas fa-chevron-down"></i></div></div>`)[0];
        this.body_elem = $(`<div class="body"></div>`)[0];
        this.body = new ui.UI(this.body_elem);
        this.header = new ui.UI(header_container_elem);
        this.header_elem = header_container_elem.querySelector(".inner");
        this.collapse_arrow_elem = header_container_elem.querySelector(".collapse-arrow");

        var title_elem = $(`<span></span>`)[0];
        this.header_elem.append(title_elem, $(`<span class="gap"></span>`)[0]);

        this.elem.append(header_container_elem, this.body_elem);

        header_container_elem.addEventListener("click", (e) => {
            var collapsible = this.get_setting("panel.collapsible");
            if (!collapsible) return;
            if (e.target != header_container_elem) return;
            var setting_id = `drawer:${this.panel_id}`;
            if (app.settings.get(setting_id) === undefined) app.settings.set(setting_id, false);
            else app.settings.toggle(setting_id);
        });

        this.on("render", () => {
            dom.set_inner_html(title_elem, this.get_setting("panel.title") || "");
            dom.toggle_attribute(this.elem, "data-collapsible", !!this.get_setting("panel.collapsible"));
            dom.toggle_class(this.elem, "not-draggable", !this.get_setting("panel.draggable"));
        });
    }

    /** @param {ui.PropertyGroup} props */
    add_reset_button(props, opts) {
        if (this.reset_button) this.reset_button.remove();
        var opts = {
            "disabled": utils.noop,
            ...opts,
        }
        var g = $(`<div class="button-group"></div>`)[0];
        var reset_button = new ui.Button(`<button class="reset mini icon" title="Reset"><i class="fas fa-undo"></i></button>`, {
            "disabled": () => props.is_default || !!opts.disabled(),
            "click": () => props.reset(),
        })
        props.on("post_update", (e) => {
            reset_button.update();
        });
        g.append(reset_button)
        this.reset_button = g;
        this.header_elem.append(g);
    }

    toggle(value) {
        dom.toggle_class(this.elem, "hide", value)
    }

    get is_collapsed() {
        return this.elem.classList.contains("hide");
    }
}

export class SessionStreamSettings extends Panel {
    constructor() {
        super("session-stream-settings", {
            "panel.title": "Stream Settings",
        });
        this.props = new ui.PropertyGroup({
            "items": () => [app.$._session.stream_settings],
            // "disabled": ()=>app.$.session.is_running,
        });
        this.body.append(this.props);
        dom.add_class(this.props.elem, "session-stream-settings");

        var restart_elem = $(`<span>Restarting... [<span class="restart-time"></span>] <a class="restart-cancel" href="javascript:void(0)">Cancel</a></span>`)[0];
        restart_elem.querySelector(".restart-cancel").onclick = () => {
            app.request("stop_stream");
        };

        this.stream_props_ui = new ui.Row({
            "class": "stream-properties",
            "align": "end",
            "hidden": () => app.$._session._is_running || app.$._session.type !== constants.SessionTypes.INTERNAL
        })
        this.info_ui = new ui.UI(null, {
            "class": "stream-info",
            "hidden": () => !app.$._session._is_running
        });
        this.props.append(this.stream_props_ui, this.info_ui);

        var stream_info_el = $(`<span class="stream-info"></span>`)[0];
        this.info_ui.append(stream_info_el);

        this.header_elem.append(restart_elem);

        this.toggle_streaming_button = new ui.Button(`<button class="mini">Start/Stop Streaming</button>`, {
            "id": "toggle-streaming",
            "title": "Start/Stop Streaming",
            "hover": () => {
                return !app.$._session._is_running && !this.props.is_valid;
            },
            "disabled": () => {
                return !app.$._session._is_running && !this.props.is_valid;
            },
            // "update":()=>{
            //     this.toggle_streaming_button.update_settings({"disabled": !app.$._session._is_running && !this.props.valid_visible})
            // },
            "click": (e) => {
                if (app.$._session._is_running) {
                    app.request("stop_stream");
                } else {
                    var msg = "Another stream is already running, playback of all streams may by slower than realtime.\nAre you sure you want to start streaming?";
                    if (Object.values(app.$.session_streams).filter(s => s._is_running).length == 0 || confirm(msg)) {
                        app.start_stream();
                        // app.$.push([`sessions/${app.$.session.id}/core/state`, "starting"]);
                    }
                    // app.$.push([`sessions/${app.$.session.id}/core/state`, "stopping"]);
                }
            },
            "content": () => {
                var state = app.$._session._stream.state;
                if (state === constants.State.STOPPED) state = `START <i class="fas fa-play"></i>`;
                else if (state === constants.State.STARTED) state = `STOP <i class="fas fa-stop"></i>`;
                else if (state === constants.State.STOPPING) state = `Stopping...`;
                else if (state === constants.State.STARTING) state = `Starting...`;
                return state;
                // if (app.$._session.stream.restart) state = `Restarting (${app.$._session.stream.restart}s)...`;
                // this.toggle_streaming_button.elem.classList.toggle("started", (state === constants.State.STARTING || state === constants.State.STARTED));
                // this.toggle_streaming_button.elem.innerHTML = `<span>${state}</span>`;
            },
        });
        this.schedule_stream_button = new ui.Button(`<button class="mini">Schedule</button>`, {
            "id": "schedule-stream",
            "click": (e) => {
                new ScheduleStreamMenu().show();
            },
            "disabled": () => !this.props.is_valid,
            "hidden": () => app.$._session._is_running || app.$._session.type == constants.SessionTypes.EXTERNAL
        });
        this.handover_button = new ui.Button(`<button class="mini">Handover</button>`, {
            "id": "handover-button",
            "click": async (e) => {
                new HandoverSessionMenu().show();
            },
            "hidden": () => !app.$._session._is_running || app.$._session.type == constants.SessionTypes.EXTERNAL
        });
        this.config_button = new ui.Button(`<button class="mini icon"><i class="fas fa-cog"></i></button>`, {
            "id": "config-button",
            "title": "Stream Configuration",
            "click": async (e) => {
                new StreamConfigurationMenu().show();
            },
            "hidden": () => !app.$._session._is_running
        });

        this.test_button = new ui.Button(`<button class="mini">TEST</button>`, {
            "disabled": () => !app.$.processes["media-server"],
            "title": () => `Starts a test stream. ` + (app.$.conf["test_stream_low_settings"] ? `Ignores h264 preset, bitrates & resolution settings, uses a medium quality preset instead.` : `Ignores targets.`),
            "click": () => {
                app.start_stream(true);
            },
            "hidden": () => app.$._session._is_running
        });

        var button_group2 = new ui.UI(`<div class="button-group"></div>`);
        button_group2.append(this.schedule_stream_button, this.test_button, this.toggle_streaming_button, this.handover_button, this.config_button, this.mpv_button);
        this.header_elem.append(button_group2);

        this.add_reset_button(this.props, { "disabled": () => app.$._session._is_running });

        function _get_property_opts(name, cb) {
            var p = InternalSessionProps.stream_settings[name];
            return get_property_opts(p, cb);
        }

        this.gui = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("gui"),
            "name": "gui",
            "label": "GUI",
            "hidden": app.is_headless,
        });
        this.stream_props_ui.append(this.gui);

        this.targets = new TargetsProperty({
            ..._get_property_opts("targets"),
            "name": "targets",
            "label": "Target(s)",
            "reset": true,
            "hidden": () => this.gui.value,
            // "allow_empty": false,
            "opts_name": "target_opts",
            width: 200,
        });

        this.stream_props_ui.append(this.targets, this.targets.opts);

        this.title = new ui.InputProperty(`<input type="text">`, {
            ..._get_property_opts("title"),
            "name": "title",
            "label": "Title",
            "hidden": () => this.gui.value,
            "placeholder": () =>/* app.$.session.default_stream_title || */ app.$._session.name,
            width: 200,
        });
        this.stream_props_ui.append(this.title)

        this.h264_preset = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("h264_preset"),
            "name": "h264_preset",
            "label": "h264 Preset",
            "hidden": () => this.gui.value,
        });
        this.stream_props_ui.append(this.h264_preset)

        this.video_bitrate = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("video_bitrate"),
            "name": "video_bitrate",
            "label": "Video Bitrate",
            "suffix": `kbps`,
            "hidden": () => this.gui.value,
            width: 140,
        });
        this.stream_props_ui.append(this.video_bitrate)

        this.audio_bitrate = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("audio_bitrate"),
            "name": "audio_bitrate",
            "label": "Audio Bitrate",
            "suffix": `kbps`,
            "hidden": () => this.gui.value,
            width: 140,
        });
        this.stream_props_ui.append(this.audio_bitrate)

        this.stream_resolution = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("resolution"),
            "name": "resolution",
            "label": "Resolution",
            "hidden": () => this.gui.value,
            width: 140,
        });
        this.stream_props_ui.append(this.stream_resolution)

        this.fps = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("fps"),
            "name": "fps",
            "label": "Frame Rate",
            "hidden": () => this.gui.value,
        });
        this.stream_props_ui.append(this.fps)

        this.buffer_duration = new ui.InputProperty(`<input type="number">`, {
            ..._get_property_opts("buffer_duration"),
            ...buffer_duration_opts,
            "name": "buffer_duration",
            "hidden": () => this.gui.value,
            width: 140,
        });
        this.stream_props_ui.append(this.buffer_duration);

        this.use_hardware = new ui.InputProperty(`<select></select>`, {
            ..._get_property_opts("use_hardware"),
            "name": "use_hardware",
            "label": "Hardware Decoding",
            "hidden": () => this.gui.value || !app.$.conf["mpv_hwdec"],
            "info": "If enabled, hardware decoding will be used for video playback. If there is no hardware decoding support, it will fallback to software decoding.",
            width: 140,
        });
        this.stream_props_ui.append(this.use_hardware);

        this.props.on("change", (e) => {
            if (!e.name || !e.trigger) return;
            app.$._session.stream_settings[e.name] = e.value;
            app.update();
            app.request("stream_settings_update_values", [{ [e.name]: e.value }]);
        });

        this.on("render", () => {
            var session = app.$._session;
            var stream = session._stream;

            var state;
            if (stream.state === "stopped") state = `Start`;
            else if (stream.state === "started") state = `Stop`;
            else if (stream.state === "stopping") state = `Stopping...`;
            else if (stream.state === "starting") state = `Starting...`;
            dom.set_text(this.toggle_streaming_button, state);

            var restart_time = stream.restart;
            dom.toggle_display(restart_elem, restart_time != 0);
            dom.set_text(restart_elem.querySelector(".restart-time"), `${restart_time}s`);

            var stream_info = {};
            stream_info["ID"] = `${stream.id}`;
            if (session.type === constants.SessionTypes.INTERNAL) {
                stream_info["h264 Preset"] = `${stream["h264_preset"]}`;
                stream_info["Video Bitrate"] = `${stream["video_bitrate"]}Kbps`;
                stream_info["Audio Bitrate"] = `${stream["audio_bitrate"]}Kbps`;
                stream_info["Resolution"] = `${stream["resolution"]}`;
                if (stream["re"]) {
                    stream_info["Realtime"] = `${stream["re"] ? "Yes" : "No"}`;
                }
                if (stream["filename_evaluated"]) {
                    stream_info["Output Path"] = stream["filename_evaluated"] || "-";
                }
                stream_info["Frame Rate"] = `${stream["fps"] || "Variable"}`;
                stream_info["Buffer Duration"] = `${stream["buffer_duration"]} secs`;
                stream_info["Hardware Decoding"] = `${stream["use_hardware"] ? "Yes" : "No"}`;
            } else {
                var nms_session = session._get_connected_nms_session_with_appname("livestream", "external");
                if (nms_session) {
                    stream_info["Resolution"] = `${nms_session.videoWidth}x${nms_session.videoHeight}`;
                    stream_info["Frame Rate"] = `${nms_session["videoFps"]}`;
                }
            }
            // if (!stream["test"]) {
            stream_info["Target(s)"] = (stream.targets || []).map((id) => `${id} <span style="color:${stream.stream_targets[id] ? "#00f" : "f00"}">[${stream.stream_targets[id] ? "OK" : "NOT FOUND"}]</span>`).join(", ") || `<span style="color:#00f">NONE</span>`;
            if (stream.title) {
                stream_info["Title"] = stream.title;
            }
            // }
            var live = stream._live;
            if (live) {
                if (live.url) {
                    stream_info["Live URL"] = `<a href="${live.url}" target="_blank">${live.url}</a>`;
                }
                if (live.manifest_url) {
                    stream_info["Live Manifest URL"] = `<a href="${live.manifest_url}" target="_blank">${live.manifest_url}</a>`;
                }
                /* if (live.thumbnail_url) {
                    stream_info["Thumbnail"] = `<a href="${live.thumbnail_url}" target="_blank">${new URL(live.thumbnail_url).pathname}</a>`;
                } */
            }
            if (stream.rtmp_url) stream_info["RTMP URL"] = `<a href="${stream.rtmp_url.toString()}" target="_blank">${stream.rtmp_url}</a>`;
            if (stream.socket) stream_info["Socket"] = stream.socket;
            stream_info["Output Bit Rate"] = utils.format_bits(stream.bitrate * 8) + "ps";
            stream_info["Run Time"] = session._is_running ? utils.ms_to_timespan_str(stream._run_time) : 0;

            dom.rebuild(stream_info_el, Object.keys(stream_info), {
                id_callback: (k) => k,
                add: (k, elem, index) => {
                    if (!elem) elem = $(`<span></span>`)[0];
                    var v = stream_info[k];
                    if (elem.__hash !== v) {
                        elem.__hash = v;
                        elem.innerHTML = `<span class="key">${k}</span>: <span class="value">${v}</span>`;
                    }
                    return elem;
                }
            });

        })
    }
}

export class MPVGUIControls extends ui.PropertyGroup {
    constructor() {
        var stream = ()=>app.$._session._stream;

        super({
            "hidden":()=>!stream().gui && !app.stream_settings.gui.value,
            "items": () => {
                return [app.$._session.gui_props]
            },
        });

        var box = new ui.Box({
            header: "GUI Controls"
        });

        this.osc = new ui.InputProperty(`<select>`, {
            "name": "osc",
            "label": "OSC",
            "options": [
                [false, "Disabled"],
                [true, "Enabled"],
            ],
            "default": true,
        });

        this.fullscreen = new ui.InputProperty(`<select>`, {
            "name": "fullscreen",
            "label": "Fullscreen",
            "options": [
                [false, "Disabled"],
                [true, "Enabled"],
            ],
            "default": false,
        });

        this.audio_pitch_correction = new ui.InputProperty(`<select>`, {
            "name": "audio-pitch-correction",
            "label": "Audio Pitch Correction",
            "options": [
                [false, "Disabled"],
                [true, "Enabled"],
            ],
            "default": false,
        });

        this.playback_speed = new ui.InputProperty(`<input type="range">`, {
            "label": "Speed",
            "min": -1,
            "max": 1,
            "default": 0,
            "step": 0.001,
            "dblclick": () => this.playback_speed.reset(),
            "change_on_input": true,
            "reset": false,
        });
        var min_speed = 0.2;
        var max_speed = 5;

        var slider_to_value = v=>{
            if (v < 0) {
                return Math.pow(10, v);
            } else {
                return Math.pow(max_speed, v);
            }
        };
        var value_to_slider = v=>{
            if (v < 1) {
                return Math.log10(v);
            } else {
                return Math.log(v) / Math.log(max_speed);
            }
        }

        this.playback_speed_num = new ui.InputProperty(`<input type="number">`, {
            "name": "speed",
            "label": "Speed (Numeric)",
            "min": 0.1,
            "max": 10,
            "default": 1,
            "step": 0.1,
            "width": 100,
            "precision": 3,
        });

        this.playback_speed.on("change", (e) => {
            if (!e.trigger) return;
            this.playback_speed_num.set_value(slider_to_value(e.value), {trigger:true});
        });
        this.playback_speed_num.on("change", (e)=>{
            if (!e.trigger) return;
            this.playback_speed.set_value(value_to_slider(e.value), {trigger:false});
        })

        box.layout = [
            this.osc, this.fullscreen, this.audio_pitch_correction,
            [this.playback_speed, this.playback_speed_num]
        ];
        this.append(box)

        this.on("change", (e) => {
            if (!e.name || !e.trigger) return;
            app.request("set_gui_property", [e.name, e.value]);
        });
    }
}

export class MediaPlayerPanel extends Panel {
    get buffer_duration() {
        try {
            return (this.flv_player._media_element.buffered.end(0) || 0) - (this.flv_player.currentTime || 0);
        } catch (e) {
            return 0;
        }
    }

    constructor() {
        super("media-player", {
            "panel.title": "Media Player",
        });
        this.props = new ui.PropertyGroup({
            "items": () => [app.$._session],
        });
        this.body_elem.append(this.props);

        dom.add_class(this.elem, "player-interface-wrapper");

        var bg = $(
            `<div class="button-group">
                <button class="show_live_feed mini icon" data-setting__show_live_feed title="Show/Hide Live Feed"><i class="fas fa-tv"></i></button>
                <button class="time_display_ms mini icon" data-setting__time_display_ms title="Show/Hide Milliseconds"><span style="font-size:9px">MS</span></button>
                <button class="show_chapters mini icon" data-setting__show_chapters title="Show/Hide Chapters"><i class="fas fa-bookmark"></i></button>
            </div>`
        )[0];
        this.header_elem.append(bg);

        this.live_feed_container_elem = $(
            `<div class="live-feed-container">
                <div class="live-feed">
                    <div class="video-wrapper"></div>
                    <div class="overlay">
                        <div class="button-group">
                            <button class="mini icon reload" title="Reload"><i class="fas fa-sync"></i></button>
                            <button class="mini icon popout" title="Pop-out Player"><i class="fas fa-external-link-alt"></i></button>
                            <button class="mini icon" data-setting__show_player_info title="Toggle Player Info"><i class="fas fa-circle-info"></i></button>
                        </div>
                    </div>
                    <span class="info"></span>
                    <span class="empty">No live feed currently available</span>
                </div>
            </div>`
        )[0];
        this.props.append(this.live_feed_container_elem);

        this.toggle_live_feed_button = new ui.Button(`<button class="">Show Live Feed</button>`, {
            "hidden": () => {
                return app.settings.get("show_live_feed")
            },
            "click": () => {
                app.settings.toggle("show_live_feed");
            }
        });
        var row = new ui.FlexRow();
        row.append(this.toggle_live_feed_button);
        this.live_feed_container_elem.append(row);

        var media_ui = new ui.UI(`<div class="ui-wrapper"></div>`, {
            "hidden": () => app.$._session.type === constants.SessionTypes.EXTERNAL,
        });
        this.props.append(media_ui);

        this.live_feed_elem = this.elem.querySelector(".live-feed");
        this.live_feed_video_wrapper = this.live_feed_elem.querySelector(".video-wrapper");
        this.live_feed_overlay_elem = this.live_feed_elem.querySelector(".overlay");
        this.live_feed_info_elem = this.live_feed_elem.querySelector(".info");
        this.live_feed_empty_elem = this.live_feed_elem.querySelector(".empty");
        this.live_feed_reload_button = this.live_feed_elem.querySelector("button.reload");
        this.live_feed_popout_button = this.live_feed_elem.querySelector("button.popout");

        this.live_feed_popout_button.addEventListener("click", async (e) => {
            var id = app.$._session.id;
            var w = windows["test-" + id];
            if (w && !w.closed) {
                w.focus();
            } else {
                var [width, height] = app.$._session._stream["resolution"].split("x").map(i => parseInt(i));
                var ratio = width / height;
                height = Math.min(720, height);
                width = height * ratio;
                // yay this works well.
                var test_url = new URL("/blank.html", this.$.conf.main_url);
                w = windows["test-" + id] = window.open(test_url, id, `width=${width},height=${height},scrollbars=1,resizable=1`);
                w.onload = () => {
                    w.document.head.append($(`<title>Test Stream ${id}</title>`)[0]);
                    /* await */ dom.clone_document_head(document.head, w.document.head);
                    var style = w.document.createElement("style");
                    style.textContent =
                        `body { padding: 0; margin: 0; }
video { width: 100% !important; height: 100% !important; }`;
                    //+"\n"+dom.get_all_css(document, true);
                    w.document.head.append(style);
                    let root = new Root();
                    w.document.body.append(root.elem);

                    [...window.document.body.attributes].forEach(({ name, value }) => w.document.body.setAttribute(name, value));

                    root.append(this.live_feed_elem);
                    this.live_feed_elem.classList.add("popout");
                    this.update_player(true);
                    app.setup_events(root.elem);

                    w.addEventListener("unload", (e) => {
                        delete windows["test-" + id];
                        root.destroy();
                        this.live_feed_elem.classList.remove("popout");
                        this.live_feed_container_elem.append(this.live_feed_elem);
                        this.update_player(true);
                    });
                }
            }
        });
        this.live_feed_reload_button.addEventListener("click", (e) => {
            this.update_player(true);
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

        var player_inline_elem = new ui.Row({ class: "player-inline" }).elem;
        media_ui.append(player_inline_elem);

        this.prev_button = new ui.Button(`<button><i class="fas fa-step-backward"></i></button>`, {
            "title": "Previous Playlist Item",
            "class": "player-button",
            "click": (e) => {
                app.playlist_play(app.$._session._current_playlist_item._previous);
            },
            "disabled": () => !app.$._session._current_playlist_item._previous
        });
        this.backward_button = new ui.Button(`<button><i class="fas fa-backward"></i></button>`, {
            "title": "-30 Seconds",
            "class": "player-button",
            "click": (e) => {
                app.seek(-30, true);
            },
            "disabled": () => !app.media.seekable || app.media.time_pos <= 0,
        });
        this.toggle_play_pause_button = new ui.Button(null, {
            "title": "Play/Pause",
            "class": "player-button",
            "content": () => app.$._session._stream.player.paused ? `<i class="fas fa-play"></i>` : `<i class="fas fa-pause"></i>`,
            "click": (e) => {
                var new_pause = !app.$._session._stream.player.paused;
                app.$._session._stream.player.paused = new_pause;
                app.update();
                if (new_pause) app.request("pause");
                else app.request("resume");
            },
            "disabled": () => !app.$._session._is_running,
        });
        this.forward_button = new ui.Button(`<button><i class="fas fa-forward"></i></button>`, {
            "title": "+30 Seconds",
            "class": "player-button",
            "click": (e) => {
                app.seek(30, true);
            },
            "disabled": () => !app.media.seekable || app.media.time_left <= 0,
        });
        this.next_button = new ui.Button(`<button><i class="fas fa-step-forward"></i></button>`, {
            "title": "Next Playlist Item",
            "class": "player-button",
            "click": (e) => {
                app.playlist_play(app.$._session._current_playlist_item._next);
            },
            "disabled": () => !app.$._session._current_playlist_item._next
        });
        this.prev_chapter_button = new ui.Button(`<button><i class="fas fa-fast-backward"></i></button>`, {
            "title": "Previous Chapter",
            "class": "player-button",
            "click": (e) => {
                app.seek_chapter(-1, true)
            },
            "disabled": () => app.media.chapters.length == 0 || app.media.time_pos <= app.media.chapters[0].start,
            "hidden": () => !app.settings.get("show_chapters") || app.media.chapters.length == 0
        });
        this.next_chapter_button = new ui.Button(`<button><i class="fas fa-fast-forward"></i></button>`, {
            "title": "Next Chapter",
            "class": "player-button",
            "click": (e) => {
                app.seek_chapter(1, true)
            },
            "disabled": () => app.media.chapters.length == 0 || app.media.time_pos >= app.media.chapters[app.media.chapters.length - 1].start,
            "hidden": () => !app.settings.get("show_chapters") || app.media.chapters.length == 0
        });

        this.fade_out_button = new ui.Button(`<button><span style="font-size:9px">FADE</span></button>`, {
            "title": "Fade To Next",
            "class": "player-button",
            "click": (e) => {
                // app.request("fade_out");
                new FadeOutSettings().show();
            },
            "disabled": () => !app.$._session._is_running || app.$._session._current_playlist_item._is_null,
        });
        this.reload_button = new ui.Button(`<button><i class="fas fa-sync"></i></button>`, {
            "title": "Reload",
            "class": "player-button",
            "click": (e) => {
                app.request("playlist_reload_current", [true]);
            },
            "disabled": () => !app.$._session._is_running || app.$._session._current_playlist_item._is_null,
        });
        this.set_time_button = new ui.Button(`<button><i class="far fa-clock"></i></button>`, {
            "title": "Precise Seek",
            "class": "player-button",
            "click": (e) => {
                new SetTimePosMenu().show();
            },
            "disabled": () => !app.media.seekable,
        });

        var player_controls_elem = new ui.UI(`<div class="player-button-wrapper"></div>`);
        player_controls_elem.append(this.prev_button, this.prev_chapter_button, this.backward_button, this.toggle_play_pause_button, this.forward_button, this.next_chapter_button, this.next_button);
        player_inline_elem.append(player_controls_elem);

        var extra_controls_elem = new ui.UI(`<div class="player-button-wrapper"></div>`);
        extra_controls_elem.append(this.reload_button, this.set_time_button, this.fade_out_button);
        player_inline_elem.append(extra_controls_elem);

        var volume_wrapper = new ui.UI(`<div class="player-volume-wrapper"></div>`);
        media_ui.append(volume_wrapper);

        this.gui_props = new MPVGUIControls();
        media_ui.append(this.gui_props);

        this.volume = new ui.InputProperty(`<input id="volume" type="range" value="100" title="Volume" style="width:100px">`, {
            "name": "volume_target",
            ...get_property_opts(InternalSessionProps.volume_target),
            "reset": false,
            "dblclick": () => this.volume.reset(),
        });
        this.volume.elem.style.width = "100px";
        this.volume.elem.style.minWidth = "auto";
        this.volume_speed = new ui.InputProperty(`<input type="number">`, {
            "name": "volume_speed",
            "title": "Volume Transition Speed",
            ...get_property_opts(InternalSessionProps.volume_speed),
            "reset": false,
            "hidden": true,
        });
        /** @param {ui.PropertyChangeEvent} e */
        var on_player_controls_change = (e) => {
            if (e.trigger) {
                var v = {
                    volume_target: this.volume.value,
                    volume_speed: this.volume_speed.value,
                };
                Object.assign(app.$._session, v);
                app.update();
                app.request("update_player_controls", [v]);
            }
            this.set_volume_button.update();
        }
        this.volume.on("change", (e) => on_player_controls_change(e));
        this.volume_speed.on("change", (e) => on_player_controls_change(e));

        this.vol_down_button = new ui.Button(`<button><i class="fas fa-volume-down"></i></button>`, {
            "class": "player-button",
            "title": "Volume - 5%",
            "disabled": () => this.volume.value <= this.volume.get_setting("min"),
            "click": (e) => {
                this.volume.set_values(utils.ceil_to_factor(this.volume.value - VOLUME_STEP, VOLUME_STEP), { trigger: true });
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
            "class": "player-button",
            "content": () => `<span style="font-size:9px">${Math.round(this.volume.value)}%</span>`,
            "click": (e) => {
                new SetVolumeSettings().show();
            }
        });

        this.vol_up_button = new ui.Button(`<button><i class="fas fa-volume-up"></i></button>`, {
            "class": "player-button",
            "title": "Volume + 5%",
            "disabled": () => this.volume.value >= this.volume.get_setting("max"),
            "click": (e) => {
                this.volume.set_values(utils.floor_to_factor(this.volume.value + VOLUME_STEP, VOLUME_STEP), { trigger: true });
            }
        })
        volume_wrapper.append(this.set_volume_button, this.vol_down_button, this.volume, this.vol_up_button /*,this.mute_button */, this.volume_speed);

        this.stats_elem = $(`<div class="stats"></div>`)[0];
        media_ui.append(this.stats_elem);

        // this.fader_controls_elem = $(`<div class="fader-controls"></div>`)[0];
        // this.body.append(this.fader_controls_elem);

        // var wrap = new dom.WrapDetector(player_inline_elem);

        var update_interval = setInterval(() => {
            if (this.buffer_duration < 0) {
                setTimeout(() => {
                    if (this.buffer_duration < 0 && this.flv_player) this.update_player(true);
                }, 1000);
            }
            this.update_player();
        }, 500);

        this.on("destroy", () => {
            clearInterval(update_interval);
        });

        this.on("update", () => {
            var stream = app.$._session._stream;
            var started = stream._is_running;
            dom.set_inner_html(this.status_prefix_elem, `${app.media.status}: `);
            build_playlist_breadcrumbs(this.status_path_elem, app.$._session._current_playlist_item, true, true);

            if (started) {
                var stats = {};
                var av = stream.player.avsync || 0;
                stats["A/V"] = {
                    "value": (av > 0 ? `+` : ``) + av.toFixed(3),
                    "info": "Audio / Video Sync"
                };
                stats["FPS"] = {
                    "value": (+stream.player.fps || app.media.fps || stream.fps || 0).toFixed(2),
                    "info": "Frame Rate"
                };
                stats["INTRP"] = {
                    "value": stream.player.interpolation ? "On" : "Off",
                    "info": "Interpolation"
                };
                stats["DEINT"] = {
                    "value": stream.player.deinterlacing ? "On" : "Off",
                    "info": "Deinterlacing"
                };
                stats["V-RATE"] = {
                    "value": utils.format_bits((stream.player.video_bitrate || 0)) + "ps",
                    "info": "Video Bitrate"
                };
                stats["A-RATE"] = {
                    "value": utils.format_bits((stream.player.audio_bitrate || 0)) + "ps",
                    "info": "Audio Bitrate"
                };
                stats["ASPECT"] = {
                    "value": utils.nearest_aspect_ratio(stream.player.aspect_ratio).name,
                    "info": "Aspect Ratio"
                };
                dom.rebuild(this.stats_elem, Object.entries(stats), {
                    add: ([k, v], elem, index) => {
                        elem = elem || $(`<span>${k}: <span class="value"></span></span>`)[0];
                        var el = elem.querySelector(".value");
                        el.innerHTML = v.value;
                        elem.title = v.info;
                        return elem;
                    },
                    id_callback: (item) => item[0],
                });
            }
            dom.toggle_display(this.stats_elem, started);

            var ar = stream._width / stream._height;
            this.elem.style.setProperty("--aspect-ratio", ar)
            dom.toggle_display(this.live_feed_info_elem, app.settings.get("show_player_info"));
            dom.toggle_class(this.elem, "chapters-available", app.media.chapters.length > 0);

            if (app.media.chapters.length) {
                let html = `Chapter(s): ` + (app.media.curr_chapters.map(c => app.chapter_to_string(c)).join(" | ") || "-");
                dom.set_inner_html(this.chapters_elem, `<span>${html}</span>`);
            }
            dom.toggle_display(this.chapters_elem, app.media.chapters.length != 0);
            this.update_player();
        });
    }

    async update_player(force_reinit) {
        var was_muted = this.video_el ? this.video_el.muted : true;
        var session = app.$._session;
        var stream = session._stream;
        var has_started = session._is_running;
        var gui = has_started ? stream.gui : app.stream_settings.gui.value;
        var show = !!(app.settings.get("show_live_feed") && !this.is_collapsed && !document.hidden);
        var is_popped_out = !!windows["test-" + session.id];
        var url = location.protocol === "https:" ? stream.wss_url : stream.ws_url;
        var is_playable = !!(has_started && url);
        var buffer_duration = this.buffer_duration;

        dom.toggle_display(this.live_feed_container_elem, !gui);
        dom.toggle_class(this.live_feed_elem, "live-feed-available", is_playable);
        dom.toggle_display(this.live_feed_elem, show);
        dom.toggle_display(this.live_feed_popout_button, !is_popped_out);

        dom.toggle_display(this.live_feed_empty_elem, !is_playable);
        dom.set_inner_html(this.live_feed_empty_elem, this.video_el ? "Stream has ended" : "Stream has not started");
        // this.live_feed_popout_button.dataset.toggled = is_popped_out;

        dom.set_inner_html(this.live_feed_info_elem, `Buffered: ${buffer_duration ? buffer_duration.toFixed(2) : "-"} secs`);

        if (url !== this.live_feed_url) force_reinit = true;

        var init_flv_video = is_playable && show;

        if (!force_reinit && !!this.flv_player == init_flv_video) return;

        if (this.flv_player) {
            this.flv_player.pause();
            this.flv_player.unload();
            this.flv_player.detachMediaElement();
            this.flv_player.destroy();
            this.flv_player = null
        }

        if (init_flv_video) {
            this.video_el = this.video_el ?? this.live_feed_elem.ownerDocument.createElement("video");
            this.video_el.controls = true;
            this.video_el.autoplay = false;
            this.video_el.muted = was_muted;
            this.video_el.volume = +(localStorage.getItem("livestreamer.media-player-volume") || 1);
            this.video_el.onvolumechange = (e) => {
                localStorage.setItem("livestreamer.media-player-volume", this.video_el.volume);
            };
            this.video_el.addEventListener('loadedmetadata', (e) => {
                // set_style_property(this.live_feed_container_elem, "--aspect-ratio", this.video_el.videoWidth / this.video_el.videoHeight)
            });
            this.live_feed_video_wrapper.append(this.video_el);

            this.live_feed_url = url;
            this.flv_player = mpegts.createPlayer({
                type: "flv",
                url,
                hasAudio: true,
                hasVideo: true,
                isLive: true,
                // deferLoadAfterSourceOpen: false,
            }, {
                isLive: true,
                // liveSync: true,
                // liveSyncTargetLatency: 5,
                // liveSyncMaxLatency: 10,
                // enableStashBuffer: false,
                // enableWorker: true,
                // enableWorkerForMSE:true,
                // accurateSeek: true,
                // fixAudioTimestampGap:false,
                // autoCleanupMaxBackwardDuration: 10,
                // autoCleanupMaxForwardDuration: 10,
                // autoCleanupSourceBuffer: true,
            });

            /* this.flv_player.on(mpegts.Events.MEDIA_INFO, (s)=>{
                this.flv_media_info = s;
                // console.log(s);
            }) */
            // var initialized = false;
            /* this.flv_player.on(mpegts.Events.STATISTICS_INFO, (s)=>{
                this.flv_statistics = s;
                if (!initialized) {
                    if (this.buffer_duration > 1) {
                        this.flv_player.play();
                        initialized = true;
                    }
                }
            }) */
            this.flv_player.attachMediaElement(this.video_el);
            this.flv_player.load();
            this.flv_player.play().catch(utils.noop);
        }
    }
}

export class MediaSettingsPanel extends Panel {

    mode = MediaSettingsMode.current;

    set_mode(k) {
        this.mode = k;
        dom.remove_children(this.group_wrapper_elem);
        this.group = new MediaPropertyGroup(k, true);
        this.group.on("change", (e) => {
            if (!e.name || !e.trigger) return;
            if (this.mode === MediaSettingsMode.all) {
                app.$._session.player_default_override[e.name] = e.raw_value;
                app.update();
                app.request("set_player_default_override", [e.name, e.raw_value]);
            } else {
                app.playlist_update(Object.fromEntries(this.group.items.map(i => [i.id, { props: { [e.name]: e.raw_value } }])), { register_history: false });
            }
        });
        this.group_wrapper_elem.append(this.group);
        this.add_reset_button(this.group);
        this.update();
    }

    constructor() {
        super("media-settings", {
            "panel.title": "Media Settings",
            "hidden": () => app.$._session.type === constants.SessionTypes.EXTERNAL,
        });

        var mode_info = {
            [MediaSettingsMode.current]: {
                "title": "Current",
            },
            [MediaSettingsMode.selected]: {
                "title": "Selected",
            },
            [MediaSettingsMode.all]: {
                "title": "Defaults",
            }
        }

        var _this = this;
        var toggle_buttons = $(`<div class="button-group"></div>`)[0];
        var buttons = Object.keys(mode_info).map(k => {
            k = +k;
            return new ui.Button(`<button class="mini">${mode_info[k].title}</button>`, {
                title: mode_info[k].title,
                click() {
                    _this.set_mode(k);
                },
                update() {
                    if (_this.mode == k) delete this.elem.dataset.toggled;
                    else this.elem.dataset.toggled = 1;
                }
            })
        })
        toggle_buttons.append(...buttons);
        this.header_elem.append(toggle_buttons);

        app.playlist.on("selection_change", () => {
            if (this.mode === MediaSettingsMode.selected) {
                this.set_mode(this.mode);
            }
        });

        // var info_elem = $(`<div class="info"></div>`)[0];
        // this.body.append(info_elem);
        // this.on("update", ()=>{
        //     var txt = "";
        //     /** @type {PlaylistItem[]} */
        //     var items = group.items;
        //     if (group.mode === MediaSettingsMode.all) {
        //         txt = "Default settings for all items";
        //     } else if (group.mode === MediaSettingsMode.selected) {
        //         txt = `Selected item${items.length>1?"s":""} [${items.length == 1 ? items[0]._get_pretty_name() : items.length}]`;
        //     } else if (group.mode === MediaSettingsMode.current) {
        //         txt = `Current item [${items[0]._get_pretty_name()}]`;
        //     }
        //     var items = group.items;
        //     dom.set_inner_html(info_elem, txt);
        // });

        this.group_wrapper_elem = $(`<div class="group-wrapper"></div>`)[0];
        this.body.append(this.group_wrapper_elem);

        this.set_mode(MediaSettingsMode.current);
    }
}

export class LogPanel extends Panel {
    /** @type { Record<string,Log[]> } */
    #pending_logs = {};
    #get_logs;

    constructor(id, name, get_logs) {
        super(id, {
            "panel.title": name,
        });
        dom.add_class(this.body_elem, "no-padding");
        this.#get_logs = get_logs;
        this.logs_wrapper = $(`<div data-darkmode="true" class="logs-wrapper"></div>`)[0];
        var logs_outer = $(`<div class="logs" data-overlayscrollbars-initialize></div>`)[0];
        this.logs_inner = OverlayScrollbars(logs_outer, {}).elements().viewport;

        this.logs_wrapper.append(logs_outer);
        this.body_elem.append(this.logs_wrapper);

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
                // style: { "font-weight": "bold" },
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

        /** @type { Record<string,utils.Queue<HTMLElement>> } */
        this._registered_logs = {};
        this._last_log_id = 0;
        this._default_logger_settings = {
            dates: false,
            times: true,
            ...Object.fromEntries(Object.entries(this._levels).map(([k, v]) => [k, v.default]))
        };
        this._logger_settings = utils.json_copy(this._default_logger_settings)
        this.i = 0;

        this.storage_name = `log-viewer-settings:${this.panel_id}`;
        $(this.logs_wrapper).resizable({ handles: "s" });

        var button_defs = [
            [
                {
                    key: "dates",
                    inner: `<button><i class="fas fa-calendar"></i></button>`,
                    title: "Show Dates",
                },
                {
                    key: "times",
                    inner: `<button><i class="fas fa-clock"></i></button>`,
                    title: "Show Times",
                }
            ],
            Object.entries(this._levels)
                .map(([k, v]) => ({
                    key: k,
                    inner: `<button>${v.icon}</button>`,
                    title: v.title,
                }))
        ];

        this.header_elem.append(...button_defs.map(g => {
            var group_elem = $(`<div class="button-group"></div>`)[0];
            group_elem.append(...g.map(b => {
                var button = new ui.Button(b.inner, {
                    "title": b.title,
                    "click": () => {
                        if (b.click) b.click();
                        this._logger_settings[b.key] = !this._logger_settings[b.key];
                        this.save();
                        this.update();
                    },
                    "render": () => {
                        if (this._logger_settings[b.key]) delete button.elem.dataset.toggled;
                        else button.elem.dataset.toggled = 1;
                    }
                });
                button.elem.classList.add("mini", "icon");
                return button;
            }))
            return group_elem;
        }));

        this.load();

        var last_logs;
        var id = 0;
        this.on("render", () => {
            var scroll_bottom = dom.scroll_pos_from_bottom(this.logs_inner);
            for (var k in this._logger_settings) {
                dom.toggle_attribute(this.logs_wrapper, `data-show-${k}`, this._logger_settings[k]);
            }
            var logs = this.#get_logs();
            if (logs != last_logs) {
                last_logs = logs;
                dom.set_inner_html(this.logs_inner, "");
                utils.clear(this._registered_logs);
                this._last_log_elem = null;
                this._last_log_id = 0;
                this.#pending_logs = {};
                for (var log of Object.values(logs)) {
                    if (!this.#pending_logs[log.level]) this.#pending_logs[log.level] = [];
                    this.#pending_logs[log.level].push(log);
                }
            }

            for (let level in this.#pending_logs) {
                for (let log of this.#pending_logs[level].slice(-LOGS_MAX_PER_LEVEL)) {
                    let log_hash = JSON.stringify([log.message, log.prefix, log.level]);
                    /** @type {HTMLElement} */
                    let log_elem;
                    if (this._last_log_elem && this._last_log_elem._log_hash === log_hash) {
                        log_elem = this._last_log_elem;
                    } else {
                        log_elem = $(`<p><span class="date"></span><span class="time"></span><span class="level"></span><span class="number"></span><span class="prefix"></span><span class="message"></span></p>`)[0];
                        this.i++;
                        if (!this._registered_logs[log.level]) this._registered_logs[log.level] = new utils.Queue();
                        this._registered_logs[log.level].push(log_elem);
                    }
                    let d = new Date(log.ts);
                    log_elem.dataset.number = +(log_elem.dataset.number || 0) + 1;
                    log_elem.dataset.level = log.level;
                    log_elem.querySelector(".date").textContent = `[${d.toLocaleDateString("en-GB")}]`;
                    log_elem.querySelector(".time").textContent = `[${d.toLocaleTimeString("en-GB")}]`;
                    log_elem.querySelector(".number").textContent = (+log_elem.dataset.number > 1) ? log_elem.dataset.number : "";
                    log_elem.querySelector(".prefix").textContent = log.prefix.map(p => `[${p}]`).join("");

                    let level_icon_elem = log_elem.querySelector(".level");
                    let message_elem = log_elem.querySelector(".message");
                    let message_html = "";

                    let level_ob = this._levels[log.level];
                    if (level_ob.color) log_elem.style.color = level_ob.color;
                    if (level_ob.style) Object.assign(log_elem.style, level_ob.style);
                    message_html += terminalCodesToHtml(log.message).replace(/\n/g, "<br>");
                    message_elem.innerHTML = message_html;
                    log_elem._log_hash = log_hash
                    this._last_log_elem = log_elem;
                    level_icon_elem.innerHTML = level_ob.icon;
                    level_icon_elem.title = level_ob.title;

                    this.logs_inner.append(log_elem);

                    if (this._registered_logs[log.level].length > LOGS_MAX_PER_LEVEL) {
                        var first = this._registered_logs[log.level].peek();
                        first.remove();
                        this._registered_logs[log.level].shift();
                    }
                }
                utils.clear(this.#pending_logs[level]);
            }
            if (scroll_bottom < 10) dom.scroll_y_percent(this.logs_inner, 1);
        });
    }

    /** @param {Log} log */
    add_log(log) {
        if (!this.#pending_logs[log.level]) this.#pending_logs[log.level] = [];
        this.#pending_logs[log.level].push(log);
    }

    save() {
        app.settings.set(this.storage_name, this._logger_settings);
    }

    load() {
        this._logger_settings = utils.json_copy({ ...this._default_logger_settings, ...app.settings.get(this.storage_name) });
    }
}

export class StreamMetricsPanel extends Panel {
    #mode = "";
    #zooming = false;
    #panning = false;
    #init_view_len = 60
    #last_data_max = 0;
    _updates = 0;
    constructor() {
        super("stream-metrics", {
            "panel.title": "Stream Metrics",
        });

        this.body_elem.classList.add("chart-wrapper", "no-padding");
        this.body_elem.style.gap = 0;

        var modes = {
            "speed": {
                "html": `<span>SPEED</span>`,
                "title": `Speed`
            },
            "bitrate": {
                "html": `<span>BITRATE</span>`,
                "title": `Bitrate`,
            }
        };

        var make_button_group = (o, onclick) => {
            var button_group = $(`<div class="button-group">`)[0];
            Object.entries(o).forEach(([t, d]) => {
                var button = $(`<button class="mini" title="${d.title}">${d.html}</button>`)[0];
                button.onclick = () => onclick(t);
                button_group.append(button);
                d.button = button;
            });
            this.header_elem.append(button_group);
        }

        make_button_group(modes, (mode) => set_mode(mode));

        var toggle_button = (o, value) => {
            for (var [key, d] of Object.entries(o)) {
                d.button.toggleAttribute("data-toggled", value != key);
            }
        }

        var set_mode = (mode) => {
            if (this.#mode === mode) return;
            this.#mode = mode;
            toggle_button(modes, mode);
            this.update_next_frame();
        };

        set_mode("speed");

        var inner_el = $(`<div class="chart-inner"></div>`)[0];
        /** @type {HTMLCanvasElement} */
        this.canvas = $(`<canvas id="chart"></canvas>`)[0];
        var chart_info_outer = $(`<div class="chart-info" data-overlayscrollbars-initialize></div>`)[0];
        this.chart_info_inner = OverlayScrollbars(chart_info_outer, {}).elements().viewport;

        inner_el.append(this.canvas)
        this.body_elem.append(inner_el, chart_info_outer);

        var button_group = $(`<div class="button-group">`)[0];
        button_group.append($(`<button class="mini icon" data-setting__show_metrics_info title="Toggle Encoder Info"><i class="fas fa-info-circle"></i></button>`)[0]);
        this.header_elem.append(button_group);

        this.on("render", () => {
            this.#update_chart();
            if (!this.#panning && !this.#zooming) {
                this.#update_info();
            }
        });
        this.canvas.ondblclick = () => {
            this.#update_pan(true);
        };
        var x_to_timespan = (value) => {
            value = +value;
            return utils.ms_to_timespan_str(value * 1000, "hh:mm:ss")
        }
        this.chart = new Chart(this.canvas, {
            type: "line",
            data: {},
            options: {
                normalized: true,
                parsing: false,
                spanGaps: true,
                onHover: (e) => {
                    this.canvas.style.cursor = "crosshair"
                },
                animation: false,
                maintainAspectRatio: false,
                responsive: true,
                scales: {
                    x: {
                        // display: 'auto',
                        type: "linear",
                        min: 0,
                        max: this.#init_view_len,
                        ticks: {
                            // count: 6,
                            // stepSize: 5,
                            autoSkip: false,
                            includeBounds: true,
                            // autoSkipPadding
                            // autoSkip: true,
                            // maxRotation: 0,
                            callback: (value, index, values) => {
                                if (index == 0 || index == values.length - 1) return null;
                                return x_to_timespan(value);
                            }
                        },
                    },
                    y: {
                        // display: 'auto',
                        type: "linear",
                        ticks: {
                            callback: (value, index, values) => {
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
                                minRange: 10
                            },
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                            threshold: 1,
                            onPanStart: (c, ...args) => {
                                this.#panning = true;
                                this.update();
                            },
                            onPanComplete: (c) => {
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
                            onZoomStart: () => {
                                this.#zooming = true;
                                this.update();
                            },
                            onZoomComplete: (c) => {
                                this.#zooming = false;
                                this.update();
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (ctxs) => {
                                return ctxs.map(ctx => x_to_timespan(ctx.raw.x)).join(", ");
                            },
                            label: (ctx) => {
                                return `${this.#parse_key(ctx.dataset.label)[0]}: ${this.#format_value(ctx.raw.y)}`;
                            }
                        }
                    },
                    legend: {
                        labels: {
                            boxWidth: Chart.defaults.font.size,
                            generateLabels: (c) => {
                                var items = Chart.defaults.plugins.legend.labels.generateLabels(c);
                                for (var i of items) {
                                    i.text = this.#parse_key(i.text)[0];
                                }
                                return items;
                            }
                        },
                        onHover: () => {
                            this.canvas.style.cursor = "pointer";
                        },
                        onLeave: () => {
                            this.canvas.style.cursor = "";
                        },
                        onClick: (e, legendItem, legend) => {
                            Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                            this.update();
                        }
                    },
                    /* decimation: {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: 1000
                    }, */
                    decimation: {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: 512,
                        threshold: 512
                    },
                }
            }
        });
    }

    get data_range() {
        return {
            min: this.chart.data.datasets.length ? Math.min(...this.chart.data.datasets.map(dataset => {
                var data = dataset._data ?? dataset.data;
                return data.length ? data[0].x : 0;
            })) : 0,
            max: Math.max(0, ...this.chart.data.datasets.map(dataset => {
                var data = dataset._data ?? dataset.data;
                return data.length ? data[data.length - 1].x : 0;
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

        var reinit_hash = JSON.stringify([app.$._session._stream.id, app.$._session.id]);
        if (this._reinit_hash != reinit_hash) {
            this._reinit_hash = reinit_hash;
            this.chart.data.datasets = [];
            this.#last_data_max = 0;
            reset = true;
        }

        let metrics = app.$._session._stream.metrics;
        let raw_data = Object.fromEntries(Object.entries(metrics).filter(([k, v]) => k.split(":").pop() === this.#mode));
        var data_hash = JSON.stringify([mode_hash, reinit_hash, Object.entries(raw_data).map(([k, g]) => [k, g.min, g.max])]);
        if (this._data_hash === data_hash) return;
        this._data_hash = data_hash;

        this.chart.data.datasets = Object.entries(raw_data).map(([key, d], i) => {
            let { min, max, data } = d;
            let dataset = this.chart.data.datasets.find(d => d.label == key);
            dataset = dataset ?? {
                label: key,
                borderWidth: 1.0,
                pointRadius: 1.5,
                pointHitRadius: 2,
                pointStyle: "rect",
                fill: false,
                tension: 0.5,
                borderJoinStyle: "round",
                data: [],
                borderColor: graph_colors[i % graph_colors.length]
            };
            // min = Math.max(min,+utils.first_key(data));
            let dataset_data = dataset._data ?? dataset.data;
            var last_x = dataset_data.length ? dataset_data[dataset_data.length - 1].x + 1 : min;
            for (var i = last_x; i < max; i++) {
                let d = { x: i, y: data[i] };
                dataset.data.push(d);
                if (dataset._data) dataset._data.push(d);
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
        if (type == "bitrate") return utils.format_bits(value * 8) + "ps";
    }
    #update_pan(reset = false) {
        if (!this.chart.scales.x) return;
        if (reset) this.chart.resetZoom();

        var pan_min = this.chart.scales.x._range.min;
        var pan_max = this.chart.scales.x._range.max;
        var pan_len = pan_max - pan_min;
        var { min, max } = this.data_range;
        var limits_min = min;
        var limits_max = Math.max(min + this.#init_view_len, max);
        var follow = (max > this.#last_data_max && pan_max >= this.#last_data_max && pan_max < max);
        if (this.#last_data_max == 0 && max > 0) reset = true;

        this.chart.options.plugins.zoom.limits.x.min = limits_min;
        this.chart.options.plugins.zoom.limits.x.max = limits_max;

        if (reset) this.chart.zoomScale("x", { min: Math.max(min, limits_max - pan_len), max: Math.max(limits_max, max) });
        else if (follow) this.chart.zoomScale("x", { min: Math.max(min, max - pan_len), max: max });

        var enabled = max > 0;
        this.chart.options.plugins.zoom.pan.enabled = enabled;
        this.chart.options.plugins.zoom.zoom.wheel.enabled = enabled;
        this.chart.options.plugins.zoom.zoom.pinch.enabled = enabled;

        this.#last_data_max = max;
    }

    #update_info() {
        this.chart.update("zoom"); // not sure why this is necessary. segments is balls.
        var info_rows = [];
        for (var i = 0; i < this.chart.data.datasets.length; i++) {
            let dataset = this.chart.data.datasets[i];
            if (!dataset.data.length) continue;
            var meta = this.chart.getDatasetMeta(i);
            var { start, end } = meta.dataset.segments[0];
            var visible_data = dataset.data.slice(start, end + 1);
            var y_values = visible_data.map(d => d.y);
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
            var table = dom.build_table(info_rows);
            dom.set_children(this.chart_info_inner, [table]);
        }
    }
}
export class PlaylistPanel extends Panel {

    /** @type {any[]} */
    #tracks;
    #tracks_hash;
    #is_fullscreen = false;

    /** @type {{items: PlaylistItem$[], cutting: boolean}} */
    clipboard;

    get active_sortable() { return this.sortables.find(s => s.is_active_sortable_in_group()) || this.sortables[0]; }
    get active_track_index() { return this.sortables.indexOf(this.active_sortable); }
    get timeline_width() { return Math.max(...[...this.tracks_elem.children].map(t => t.lastElementChild ? t.lastElementChild.offsetLeft + t.lastElementChild.offsetWidth : 0)); }
    get tracks() { return this.#tracks; }
    get orientation() { return this.playlist_display_as_timeline ? ResponsiveSortable.HORIZONTAL : ResponsiveSortable.VERTICAL; }
    get playlist_display_as_timeline() { return this.playlist_display_mode_select.value == 1; }
    get selection() { return this.active_sortable.get_selection(); }

    #current_id;
    /** @returns {PlaylistItem$} */
    get current() { return app.$._session.playlist[this.#current_id] || app.$._session.playlist["0"]; }

    /** @type {dom.DropdownMenu} */
    context_menu;

    /** @param {Element} elem */
    constructor() {
        super("playlist", {
            "panel.title": "Playlist",
            "panel.collapsible": false,
            "panel.draggable": () => !this.#is_fullscreen,
            "hidden": () => app.$._session.type === constants.SessionTypes.EXTERNAL,
            // "update_children": false,
        });

        this.clipping = null;

        this.clipboard = utils.try_catch(() => JSON.parse(localStorage.getItem("playlist-clipboard")));

        this.playlist_time_total_elem = $(`<span class="playlist-time-total" title='Playlist Total Duration'></span>`)[0];
        // this.playlist_time_left_elem = $(`<span class="playlist-time-left" title='Playlist Time Remaining'></span>`)[0];

        this.header_elem.children[0].insertAdjacentElement("afterend", this.playlist_time_total_elem);
        // this.playlist_time_total_elem.insertAdjacentElement("afterend", this.playlist_time_left_elem);

        this.body_elem.innerHTML =
            `<div class="playlist-header">
    <div class="playlist-path-wrapper">
        <button class="back icon mini"><i class="fas fa-arrow-left"></i></button>
        <div class="playlist-path-outer">
            <span class="playlist-path"></span>
        </div>
    </div>
    <div class="playlist-info-wrapper">
        <span class="info-text"></span>
        <button class="toggle-selection mini"></button>
    </div>
</div>
<div class="playlist-content">
    <div class="timeline-container" tabindex="-1">
        <div class="timeline-headers"></div>
        <div class="timeline-and-ticks-wrapper">
            <div class="timeline-ticks"></div>
            <div class="timeline-wrapper">
                <div class="timeline-tracks"></div>
                <div class="timeline-overlay">
                    <div class="timeline-playhead" style="--color:rgb(185,0,0);--triangle-size:3px"><div class="tri top-right"></div><div class="tri top-left"></div></div>
                    <div class="timeline-cursor" style="--color:black;--triangle-size:3px"><div class="tri top-right"></div><div class="tri top-left"></div><div class="tri bottom-right"></div><div class="tri bottom-left"></div></div>
                    <div class="timeline-limits"></div>
                    <div class="timeline-highlights"></div>
                </div>
            </div>
        </div>
    </div>
    <div class="playlist-buttons-wrapper">
        <div class="playlist-buttons">
            <button id="pl-add-file" title="Add Files...">Add Files...</button>
            <button id="pl-add-url" title="Add URLs...">Add URLs...</button>
            <button id="pl-upload-file" title="Upload...">Upload...</button>
            <button class="icon" id="pl-add-other" title="Other..."><i class="fas fa-ellipsis-v"></i></button>
        </div>
    </div>
</div>`
        dom.add_class(this.body_elem, "playlist-body");
        dom.add_class(this.elem, "playlist-wrapper");

        this.zoom = 1.0;
        /** @type {ResponsiveSortable[]} */
        this.sortables = [];
        this.duration = 0;
        this.time = null;

        var timeline_controls = $(`<div class="timeline-controls button-group"></div>`)[0];
        timeline_controls.append(...$(
            `<button class="playlist-goto-playhead mini icon" title="Go to Playhead"><i class="fas fa-map-marker"></i></button>`
        ));
        this.header_elem.append(timeline_controls);

        var timeline_controls = $(`<div class="timeline-controls button-group"></div>`)[0];
        timeline_controls.append(...$(
            `<input class="playlist-zoom-input mini" type="text"></input>
            <button class="playlist-zoom-into mini icon" title="Zoom Into Selection"><i class="fas fa-arrows-alt-h"></i></button>
            <button class="playlist-zoom-out mini icon" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
            <button class="playlist-zoom-in mini icon" title="Zoom In"><i class="fas fa-search-plus"></i></button>`
        ));
        this.header_elem.append(timeline_controls);

        var buttons = $(`<div class="button-group"></div>`)[0];
        buttons.append(...$(
            `<select data-setting__playlist_display_mode class="playlist-display-mode mini" title="Playlist Display Mode">
                <option default value="0">List</option>
                <option value="1">Timeline</option>
            </select>`
        ));
        this.header_elem.append(buttons);

        var buttons = $(`<div class="button-group"></div>`)[0];
        buttons.append(...$(
            `<button class="mini icon" data-setting__playlist_sticky title="Toggle Sticky Mode"><i class="fas fa-thumbtack"></i></button>
            <button class="mini icon" data-setting__wrap_playlist_items title="Toggle Line Wrap"><i class="fas fa-level-down-alt"></i></button>
            <button class="mini icon" data-setting__show_extra_playlist_icons title="Toggle Media Info Icons"><i class="far fa-play-circle"></i></button>
            <button class="mini icon fullscreen" title="Toggle Fullscreen"><i class="fas fa-expand"></i><i class="fas fa-compress"></i></button>`
        ));

        var fullscreen_button = buttons.querySelector("button.fullscreen");
        fullscreen_button.addEventListener("click", () => {
            this.toggle_fullscreen();
        });
        this.header_elem.append(buttons);

        {
            let build_title = (text, e) => {
                if (e && e.name) text += ` "${e.name}"`;
                return text;
            }
            let g = $(`<div class="button-group"></div>`)[0]
            var undo = new ui.Button(`<button class="mini icon"><i class="fas fa-undo"></i></button>`, {
                "disabled": () => !app.$._session.playlist_history._prev,
                "click": () => app.playlist_undo(),
                "title": () => build_title(`Playlist Undo [Ctrl+Z]`, app.$._session.playlist_history._prev),
            });
            var redo = new ui.Button(`<button class="mini icon"><i class="fas fa-redo"></i></button>`, {
                "disabled": () => !app.$._session.playlist_history._next,
                "click": () => app.playlist_redo(),
                "title": () => build_title(`Playlist Redo [Ctrl+Y]`, app.$._session.playlist_history._next),
            });
            g.append(undo, redo)
            this.header_elem.append(g);
        }

        this.timeline_container_elem = this.elem.querySelector(".timeline-container");
        this.wrapper_elem = this.elem.querySelector(".timeline-and-ticks-wrapper");
        var tracks_outer = this.elem.querySelector(".timeline-tracks");

        this.os = OverlayScrollbars(tracks_outer, {
            "update": {
                "ignoreMutation": () => true,
            },
            /* "scrollbars": {
                autoHide: "never",
            } */
        });
        this.tracks_elem = this.os.elements().viewport;

        // this.tracks_elem = tracks_outer;
        // this.tracks_elem.style.overflow = "auto";
        // this.tracks_elem.classList.add("thin-scrollbar");

        this.tracks_elem.removeAttribute("tabindex");
        this.ticks_elem = this.elem.querySelector(".timeline-ticks");
        this.headers_elem = this.elem.querySelector(".timeline-headers");
        this.overlay_elem = this.elem.querySelector(".timeline-overlay");
        this.ticks_elem.title = `Place Timeline Cursor`;

        this.playhead_elem = this.elem.querySelector(".timeline-playhead");
        this.cursor_elem = this.elem.querySelector(".timeline-cursor");
        this.limits_elem = this.elem.querySelector(".timeline-limits");
        this.highlights_elem = this.elem.querySelector(".timeline-highlights");

        this.playlist_info_wrapper_elem = this.elem.querySelector(".playlist-info-wrapper");

        // this.pl_toggle_sticky_button = this.playlist_wrapper_elem.querySelector(".playlist_sticky");
        this.playlist_display_mode_select = this.elem.querySelector(".playlist-display-mode");
        this.playlist_zoom_in_button = this.elem.querySelector(".playlist-zoom-in");
        this.playlist_zoom_out_button = this.elem.querySelector(".playlist-zoom-out");
        this.playlist_zoom_into_button = this.elem.querySelector(".playlist-zoom-into");
        this.playlist_goto_playhead_button = this.elem.querySelector(".playlist-goto-playhead");
        this.playlist_info_text = this.elem.querySelector(".info-text");
        this.playlist_path = this.elem.querySelector(".playlist-path");
        this.playlist_back_button = this.elem.querySelector("button.back");
        this.toggle_selection_button = this.elem.querySelector(".toggle-selection");
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

        this.playlist_back_button.addEventListener("click", () => {
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

        this.playlist_zoom_input.addEventListener("change", () => {
            this.set_timeline_view(parseFloat(this.playlist_zoom_input.value) / 100);
        })

        this.playlist_zoom_in_button.addEventListener("click", (e) => {
            this.inc_timeline_zoom(1);
        });
        this.playlist_zoom_out_button.addEventListener("click", (e) => {
            this.inc_timeline_zoom(-1);
        });
        this.playlist_zoom_into_button.addEventListener("click", (e) => {
            this.zoom_into_selected_playlist_items();
        });
        this.playlist_goto_playhead_button.addEventListener("click", (e) => {
            this.scroll_to_playhead();
        });
        this.playlist_display_mode_select.addEventListener("change", (e) => {
            app.settings.set("playlist_display_mode", +this.playlist_display_mode_select.value);
            this.sortables.forEach(s => s.orientation = this.orientation);
            this.update();
            this.scroll_to_playhead();
        });
        app.settings.on("change", (e) => {
            if (e.name === "playlist_display_mode") {
                if (this.playlist_display_mode_select.value != e.new_value) {
                    this.playlist_display_mode_select.value = e.new_value;
                    this.playlist_display_mode_select.dispatchEvent(new Event("change"));
                }
            }
        })
        this.pl_add_file_button.addEventListener("click", async (e) => {
            var paths = await app.open_file_manager({
                id: "load-file",
                files: true,
                multiple: true
            }, true);
            if (paths) app.playlist_add(paths);
        });
        if (IS_ELECTRON) this.pl_upload_file_button.style.display = "none";
        this.pl_upload_file_button.addEventListener("click", async (e) => {
            var files = await dom.open_file_dialog({ multiple: true }) // directories:true
            app.playlist_add(files.map(file => ({ file })));
        });

        this.pl_add_url_button.addEventListener("click", async (e) => {
            var urls = await new PlaylistAddURLMenu().show();
            if (urls && urls.length) {
                app.playlist_add(urls);
            }
        });

        this.commands = {
            play: new PlaylistCommand({
                "label": "Play",
                "icon": `<i class="fas fa-play"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    app.playlist_play(items[0]);
                },
                "shortcut": "P",
            }),
            info: new PlaylistCommand({
                "label": "Information",
                "icon": `<i class="fas fa-info-circle"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    new PlaylistItemInfoMenu(items).show();
                },
                "shortcut": "I",
            }),
            modify: new PlaylistCommand({
                "label": "Modify...",
                "icon": `<i class="fas fa-sliders-h"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    if (items.length == 0 || !items.every(i => i._is_modifiable)) return;
                    new PlaylistItemModifyMenu(items).show();
                },
                "shortcut": "M",
            }),
            delete_item: new PlaylistCommand({
                "label": "Delete",
                "icon": `<i class="fas fa-trash-alt"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    app.playlist_remove(items);
                },
                "shortcut": "Delete",
            }),
            rescan: new PlaylistCommand({
                "label": "Rescan",
                "description": "Rescans the media for information",
                "icon": `<i class="fas fa-sync-alt"></i>`,
                "visible": (items) => items.some(i => i._is_scannable),
                // "disabled": (items)=>!items.every(i=>i.is_scannable),
                "click": (items) => {
                    app.playlist_rescan(items);
                },
                "shortcut": "R",
            }),
            reveal: new PlaylistCommand({
                "label": "Navigate To",
                "description": "File: Open the File Manager | URL: Open the source URL",
                "icon": `<i class="fas fa-arrow-up-right-from-square"></i>`,
                "visible": (items) => items.length && items.some(i => i._is_navigatable),
                "disabled": (items) => !items.every(i => i._is_navigatable),
                "click": (items) => {
                    if (items.length) items[0]._navigate_to();
                },
                "shortcut": "Ctrl+F",
            }),
            download: new PlaylistCommand({
                "label": "Download",
                "description": "Download the source onto disk",
                "icon": `<i class="fas fa-download"></i>`,
                "visible": (items) => items.some(i => i._is_downloadable),
                // "disabled": (items)=>!items.every(i=>i.is_downloadable),
                "click": (items) => {
                    app.playlist_download(items);
                },
            }),
            cancel_download: new PlaylistCommand({
                "label": "Cancel Download",
                "icon": `<i class="fas fa-ban"></i>`,
                "visible": (items) => items.some(i => i._download),
                "click": (items) => {
                    app.playlist_cancel_download(items);
                }
            }),
            cancel_upload: new PlaylistCommand({
                "label": "Cancel Upload",
                "icon": `<i class="fas fa-ban"></i>`,
                "visible": (items) => items.some(i => i._upload && i._upload.status == UPLOAD_STATUS.STARTED),
                "click": (items) => {
                    app.playlist_cancel_upload(items);
                }
            }),
            rename: new PlaylistCommand({
                "label": "Rename",
                "icon": `<i class="fas fa-i-cursor"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    if (items[0]) this.rename(items[0]);
                },
                "shortcut": "F2",
            }),
            edit_playlist: new PlaylistCommand({
                "label": "Enter Playlist",
                "icon": `<i class="fas fa-right-to-bracket"></i>`,
                "visible": (items) => items.length && items.every(i => i._is_playlist),
                // "disabled": (items)=>!items.every(i=>i.is_playlist),
                "click": (items) => {
                    if (items[0]) this.open(items[0]);
                },
                "shortcut": "Enter",
            }),
            add_to_playlist: new PlaylistCommand({
                "label": "Add to New Playlist",
                "icon": `<i class="far fa-object-group"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    app.playlist_group(items);
                },
                "shortcut": "Ctrl+G",
            }),
            breakdown_playlist: new PlaylistCommand({
                "label": "Breakdown Playlist",
                "icon": `<i class="far fa-object-ungroup"></i>`,
                "visible": (items) => {
                    return items.length > 0 && items.every(i => i._is_playlist)
                },
                // "disabled": (items)=>!items.every(i=>i.is_playlist),
                "click": (items) => {
                    app.playlist_breakdown(items);
                },
                "shortcut": "Ctrl+U",
            }),
            split: new PlaylistCommand({
                "label": "Split...",
                "icon": `<i class="fas fa-sitemap" style="transform:rotate(-90deg);"></i>`,
                "visible": (items) => items.some(i => i._is_splittable),
                "disabled": (items) => !items.every(i => i._is_splittable),
                "click": (items) => {
                    new SplitMenu(items).show();
                }
            }),
            slice_at_timeline_cursor: new PlaylistCommand({
                "label": "Slice at Timeline Cursor",
                "icon": `<i class="fas fa-slash"></i>`,
                "visible": (items) => this.playlist_display_as_timeline && this.cursor_position != null,
                "disabled": (items) => !items.every(i => i._is_splittable),
                "click": (items) => {
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
                "visible": (items) => items.length > 0 && this.playlist_display_as_timeline,
                "click": (items) => {
                    this.cursor_position = Math.min(...items.map(i => i._userdata.timeline_start));
                    this.#update_view();
                },
                "mode": PLAYLIST_VIEW.TIMELINE,
            }),
            timeline_cursor_to_end: new PlaylistCommand({
                "label": "Set Timeline Cursor to End",
                "icon": `<i class="fas fa-arrow-right-to-bracket"></i>`,
                "visible": (items) => items.length > 0 && this.playlist_display_as_timeline,
                "click": (items) => {
                    this.cursor_position = Math.max(...items.map(i => i._userdata.timeline_end));
                    this.#update_view();
                },
                "mode": PLAYLIST_VIEW.TIMELINE,
            }),
            clipboard_copy: new PlaylistCommand({
                "label": "Copy to clipboard",
                "icon": `<i class="fas fa-copy"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.clipboard_copy(false)
                },
                "shortcut": "Ctrl+C",
            }),
            clipboard_cut: new PlaylistCommand({
                "label": "Cut to clipboard",
                "icon": `<i class="fas fa-cut"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.clipboard_copy(true)
                },
                "shortcut": "Ctrl+X",
            }),
            clipboard_paste: new PlaylistCommand({
                "label": "Paste",
                "description": "Paste from Clipboard",
                "icon": `<i class="fas fa-paste"></i>`,
                // "visible": (items)=>true,
                "visible": (items) => !!this.clipboard,
                "click": (items) => {
                    this.clipboard_paste();
                },
                "shortcut": "Ctrl+V",
            }),
            clipboard_clear: new PlaylistCommand({
                "label": "Clear Clipboard",
                "icon": `<i class="far fa-clipboard"></i>`,
                "visible": (items) => !!this.clipboard,
                "click": (items) => {
                    this.clipboard_clear();
                },
            }),
            move_to_top: new PlaylistCommand({
                "label": "Move to Start",
                "icon": () => `<i class="fas fa-angle-double-${this.playlist_display_as_timeline ? "left" : "up"}"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.move_selection_to_start();
                },
                "shortcut": "Alt+Home",
            }),
            move_up: new PlaylistCommand({
                "label": "Move Back",
                "icon": () => `<i class="fas fa-angle-${this.playlist_display_as_timeline ? "left" : "up"}"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.move_selection_back();
                },
                "shortcut": () => `Alt+Arrow${this.playlist_display_as_timeline ? "Left" : "Up"}`,
            }),
            move_down: new PlaylistCommand({
                "label": "Move Forward",
                "icon": () => `<i class="fas fa-angle-${this.playlist_display_as_timeline ? "right" : "down"}"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.move_selection_forward();
                },
                "shortcut": () => `Alt+Arrow${this.playlist_display_as_timeline ? "Right" : "Down"}`,
            }),
            move_to_bottom: new PlaylistCommand({
                "label": "Move to End",
                "icon": () => `<i class="fas fa-angle-double-${this.playlist_display_as_timeline ? "right" : "down"}"></i>`,
                "visible": (items) => items.length > 0,
                "click": (items) => {
                    this.move_selection_to_end();
                },
                "shortcut": "Alt+End",
            }),
            undo: new PlaylistCommand({
                "label": "Undo",
                "description": "Undo the previous recorded action",
                "icon": () => `<i class="fas fa-arrow-left"></i>`,
                "disabled": () => !app.$._session.playlist_history._prev,
                "click": () => app.playlist_undo(),
                "visible": false,
                "shortcut": "Ctrl+Z",
            }),
            redo: new PlaylistCommand({
                "label": "Redo",
                "description": "Redo the next recorded action",
                "icon": () => `<i class="fas fa-arrow-right"></i>`,
                "disabled": () => !app.$._session.playlist_history._next,
                "click": () => app.playlist_redo(),
                "visible": false,
                "shortcut": "Ctrl+Y",
            }),
            focus: new PlaylistCommand({
                "label": "Focus",
                "click": (items) => {
                    this.zoom_into_selected_playlist_items()
                },
                "shortcut": "F",
                mode: PLAYLIST_VIEW.TIMELINE,
            }),
            playlist_back: new PlaylistCommand({
                "label": "Parent Playlist",
                "icon": `<i class="fas fa-arrow-left"></i>`,
                "click": (items) => {
                    this.back();
                },
                "shortcut": "Backspace",
            }),
            // ------------------------------
            add_playlist: new PlaylistCommand({
                "label": () => "Add Empty Playlist",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": () => {
                    app.playlist_add({
                        filename: "livestreamer://playlist",
                    });
                }
            }),
            add_rtmp: new PlaylistCommand({
                "label": () => "Add RTMP Stream",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": () => {
                    app.playlist_add({
                        filename: "livestreamer://rtmp",
                    });
                },
                "disabled": () => !!this.current._is_merged
            }),
            add_playlist_exit: new PlaylistCommand({
                "label": () => "Add Playlist Exit",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async () => {
                    await app.playlist_add({
                        filename: "livestreamer://exit",
                    });
                },
                "visible": () => !!this.current._parent
            }),
            add_empty: new PlaylistCommand({
                "label": () => "Add Empty",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": () => {
                    var item = new PlaylistItem$({
                        filename: "livestreamer://empty",
                        props: {
                            // background_mode: "default",
                            duration: 60,
                        }
                    });
                    new PlaylistItemModifyMenu([item]).show();
                }
            }),
            add_intertitle: new PlaylistCommand({
                "label": () => "Add Intertitle",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async () => {
                    var item = new PlaylistItem$({
                        filename: "livestreamer://intertitle",
                        props: {
                            duration: 5,
                            fade_in: 1,
                            fade_out: 1,
                        }
                    });
                    new PlaylistItemModifyMenu([item]).show();
                },
                "disabled": () => !!this.current._is_merged
            }),
            add_macro: new PlaylistCommand({
                "label": () => "Add Macro",
                "icon": `<i class="fas fa-plus"></i>`,
                "click": async () => {
                    var item = new PlaylistItem$({
                        filename: "livestreamer://macro",
                    });
                    new PlaylistItemModifyMenu([item]).show();
                },
                "disabled": () => !!this.current._is_merged
            }),
            unload_current: new PlaylistCommand({
                "label": () => "Unload Current File",
                "icon": `<i class="fas fa-minus-circle"></i>`,
                "disabled": () => app.$._session._current_playlist_item._is_null,
                "click": () => app.playlist_play(),
            }),
            rescan_all: new PlaylistCommand({
                "label": () => "Rescan All",
                "icon": `<i class="fas fa-sync-alt"></i>`,
                // "click": ()=>app.playlist_rescan_all(),
                "click": () => app.playlist_rescan(this.current._children),
            }),
            save_playlist: new PlaylistCommand({
                "label": () => "Save Playlist...",
                "icon": `<i class="fas fa-save"></i>`,
                "click": () => new SavePlaylistMenu().show(),
            }),
            generate_schedule: new PlaylistCommand({
                "label": () => "Generate Schedule...",
                "icon": `<i class="fas fa-calendar-alt"></i>`,
                "click": () => new ScheduleGeneratorMenu().show()
            })
        }

        var menu = new dom.DropdownMenu({
            target: this.pl_add_other_button,
            trigger: "click",
            parent: app.elem,
            items: () => {
                var c = this.commands;
                return [
                    c.add_empty,
                    c.add_playlist,
                    c.add_rtmp,
                    c.add_intertitle,
                    c.add_macro,
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
                "click": (items) => {
                    var v = color_key === "none" ? null : color_key;
                    items.map(i => i.props.color = v);
                    app.update_next_frame();
                    var changes = Object.fromEntries(items.map(i => ([i.id, { props: { color: v } }])));
                    app.playlist_update(changes)
                },
                "render": (items, elem) => {
                    dom.add_class(elem, "color");
                    var colors = new Set(items.map(i => i.props.color || "none"));
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

        this.timeline_container_elem.addEventListener("wheel", (e) => {
            if (!this.playlist_display_as_timeline) return;
            e.preventDefault();
            var d = e.shiftKey ? 0.25 : 1;
            if (e.deltaY > 0) d *= -1;
            this.inc_timeline_zoom(d, e);
        });

        this.tracks_elem.addEventListener("scroll", () => this.#update_view());

        ondrag(this.timeline_container_elem, (e) => {
            if (e.button == 0 && e.altKey) {
                var orig_e = e;
                var pos = [this.tracks_elem.scrollLeft, this.tracks_elem.scrollTop];
                return (e) => {
                    this.tracks_elem.scrollLeft = pos[0] + orig_e.clientX - e.clientX;
                    this.tracks_elem.scrollTop = pos[1] + orig_e.clientY - e.clientY;
                }
            }
        });

        {
            this.timeline_container_elem.addEventListener('touchmove', (e) => {
                if (e.touches.length > 1) e.preventDefault();
            });
            let mc = new Hammer.Manager(this.timeline_container_elem, { touchAction: 'none', cssProps: { userSelect: "auto" } });
            let pinch = new Hammer.Pinch({ enable: true });
            mc.add([pinch]);
            let x_percent;
            let init_zoom;
            mc.on("pinchstart", (e) => {
                var r = this.timeline_container_elem.getBoundingClientRect();
                init_zoom = this.zoom;
                x_percent = (e.center.x - r.x) / r.width;
            });
            mc.on("pinchmove", (e) => {
                this.set_timeline_view(init_zoom * e.scale, null, x_percent);
            });
        }

        // this.ticks_elem.style.cursor = "none" // "text";
        this.ticks_elem.addEventListener("click", (e) => {
            var data = this.ticks_bar.parse_event(e);
            this.cursor_position = data.time;
            this.#update_view();
        });

        window.addEventListener("keydown", this.on_keydown = (e) => {
            if (dom.has_focus(this.timeline_container_elem)) {
                this.try_command_shortcut(e);
            }
        }, true);

        var on_scroll;
        // window.addEventListener("resize", ()=>this.#update_position());
        app.main_elem.addEventListener("scroll", on_scroll = () => this.#update_position());
        var resize_observer = new ResizeObserver(() => this.#update_position());
        var parent_el, last_current;

        this.on("update", () => {

            this.elem.dataset.level = this.current._parents.length;

            if (this.elem.parentElement != parent_el) {
                parent_el = this.elem.parentElement;
                if (parent_el) resize_observer.observe(parent_el);
            }
            if (!this.current || this.current._session.id != app.$._session.id) {
                this.open(app.$._session.playlist["0"], [], false);
            }
            if (last_current != this.current) {
                if (this.playlist_display_as_timeline && this.clipping) {
                    this.set_timeline_view([this.clipping.start, this.clipping.end], this.time);
                }
            }

            this.#rebuild_items();
            last_current = this.current;
        });

        this.on("render", () => {
            var current = this.current;
            var current_ud = current._userdata;
            var duration = current_ud.duration;
            var timeline_duration = current_ud.timeline_duration;
            var self_and_parents = [app.$._session._current_playlist_item, ...app.$._session._current_playlist_item._parents];
            var a_index = self_and_parents.indexOf(current);
            var timeline_time = utils.sum(self_and_parents.slice(0, a_index).map(item => utils.try_catch(() => item._userdata.timeline_start) || 0)) + Math.min(app.$._session.time_pos, app.$._session._current_playlist_item._userdata.timeline_duration);
            var time = utils.sum(self_and_parents.slice(0, a_index).map(item => utils.try_catch(() => item._userdata.start) || 0)) + Math.min(app.$._session.time_pos, app.$._session._current_playlist_item._userdata.duration);

            this.time = timeline_time;
            this.duration = timeline_duration;
            this.clipping = current_ud.clipping;
            if (this.clipping) {
                this.clip_time = utils.loop(this.time + this.clipping.offset + this.clipping.start, this.clipping.start, this.clipping.end);
            } else {
                this.clip_time = this.time;
            }

            this.playlist_back_button.disabled = !current._parent;

            dom.set_inner_html(this.playlist_time_total_elem, `(${utils.seconds_to_timespan_str(duration)})`);
            // dom.set_inner_html(this.playlist_time_left_elem, `[-${utils.seconds_to_timespan_str(duration-time)}]`);

            // this.playlist_time_left_elem.style.display = current === app.$._session.playlist["0"] ? "" : "none"

            build_playlist_breadcrumbs(this.playlist_path, current);

            this.#update_position();
            this.#update_view();
            this.#update_info();
        });

        this.on("destroy", () => {
            resize_observer.disconnect();
            app.main_elem.removeEventListener("scroll", on_scroll);
            this.sortables.forEach(s => s.destroy());
            this.sortables = [];
        });

        this.set_tracks(1);
    }

    toggle_fullscreen(val) {
        if (val === undefined) val = !this.#is_fullscreen;
        this.#is_fullscreen = val;
        this.elem.classList.toggle("fullscreen", this.#is_fullscreen);
        this.update();
    }

    update_scroll() {
        if (this.os) this.os.update(true);
    }
    debounced_update_scroll = dom.debounce_next_frame(() => this.update_scroll(true));

    set_tracks(num_tracks, is_2_track) {
        var tracks = (is_2_track) ? [{
            title: "Video Track",
            header: `<i class="fas fa-film"></i>`,
        }, {
            title: "Audio Track",
            header: `<i class="fas fa-music"></i>`,
        }] : [];
        num_tracks = Math.max(1, num_tracks);
        for (var i = 0; i < num_tracks; i++) {
            if (!tracks[i]) tracks[i] = { header: `Track ${i + 1}` };
        }
        var tracks_hash = JSON.stringify(tracks);
        if (tracks_hash == this.#tracks_hash) return;

        this.#tracks_hash = tracks_hash;
        this.#tracks = tracks;
        dom.remove_children(this.tracks_elem);
        dom.remove_children(this.headers_elem);
        dom.remove_children(this.highlights_elem);
        this.sortables.forEach(s => s.destroy());

        dom.toggle_class(this.timeline_container_elem, "single-track", num_tracks == 1);

        this.sortables = tracks.map((t, i) => {
            // var playlist_top = $(`<div class="playlist-top" title="${utils.capitalize(t.name)}">${t.icon}</div>`)[0];
            // playlist_track.append(playlist_top);
            var playlist_elem = $(`<ul class="playlist"></ul>`)[0];
            this.tracks_elem.append(playlist_elem);

            var playlist_header = $(`<div>${t.header}</div>`)[0];
            playlist_header.title = t.title || t.header;
            playlist_header.onclick = () => sortable.set_active_sortable_in_group();
            this.headers_elem.append(playlist_header);

            var playlist_highlight = $(`<div></div>`)[0];
            this.highlights_elem.append(playlist_highlight);

            var sortable = new ResponsiveSortable(playlist_elem, {
                group: 'playlist-tracks',
                // handle: ".handle",
                filter: ".item-dropdown",
                scroll: true,
                multiDrag: true, // Enable multi-drag
                fallbackTolerance: 3, // So that we can select items on mobile
                animation: 150,
                avoidImplicitDeselect: true, // true - if you don't want to deselect items on outside click
            });
            sortable.orientation = this.orientation;
            var debounced_selection_change = utils.debounce(() => this.emit("selection_change"), 0);
            sortable.el.addEventListener("select", (evt) => {
                this.update_next_frame();
                debounced_selection_change();
            });
            sortable.el.addEventListener("unchoose", (e) => {
                this.scroll_into_view(e.item);
            });
            sortable.el.addEventListener("deselect", (evt) => {
                this.update_next_frame();
                debounced_selection_change();
            });
            sortable.el.addEventListener("active-change", (e) => {
                dom.toggle_class(playlist_header, "active", e.active);
                dom.toggle_class(playlist_highlight, "active", e.active);
            });
            sortable.el.addEventListener("end", (evt) => {
                this.sync_positions();
            });
            sortable.el.addEventListener("start", (evt) => {
                app.blocking_updates.add(sortable.dragging_promise);
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
        elem.scrollIntoView({ block: "nearest", inline: "nearest" });

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
        var current_playlist = this.current;
        current_playlist._private.children = null;

        var current_playlist_tracks = current_playlist._tracks;

        this.set_tracks(current_playlist_tracks.length, current_playlist && current_playlist.props.playlist_mode == PLAYLIST_MODE.DUAL_TRACK);

        this.sortables.forEach((sortable, i) => {
            /** @type {PlaylistItem$[]} */
            var items = current_playlist_tracks[i] || EMPTY_ARRAY;
            dom.rebuild(sortable.el, items, {
                add: (item, elem, index) => {
                    return elem || new PlaylistItemUI(app.$._session, item.id).elem;
                },
                remove: (elem) => {
                    var sortable = ResponsiveSortable.closest(elem);
                    if (sortable) sortable.deselect(elem);
                    elem.remove();
                }
            });
        });
    }


    /** @returns {PlaylistCommand[]} */
    get all_commands() {
        return Object.values(this.commands);
    }

    back() {
        var current = this.current;
        var parent = current._parent;
        if (!parent) return;
        if (app.$._session._is_running && current == app.$._session._current_playlist_item && current._calculate_contents_hash() != current._private.hash_on_open) {
            app.alert_for_reload_of_current_item();
        }
        this.open(parent, [current]);
    }

    move_selection_to_start() {
        var elems = this.get_selection();
        elems.reverse();
        elems.forEach((e, i) => e.parentElement.prepend(e));
        elems.forEach(e => this.scroll_into_view(e));
        this.sync_positions();
    }
    move_selection_back() {
        var elems = this.get_selection();
        var first_index = Math.max(0, dom.get_index(elems[0]) - 1);
        elems.forEach((e, i) => dom.insert_at(e.parentElement, e, first_index + i));
        this.scroll_into_view(elems[0]);
        this.sync_positions();
    }
    move_selection_forward() {
        var elems = this.get_selection();
        var last_index = Math.min(elems[0].parentElement.childElementCount, dom.get_index(elems[elems.length - 1]) + 2);
        elems.forEach((e, i) => dom.insert_at(e.parentElement, e, last_index));
        this.scroll_into_view(elems[elems.length - 1])
        this.sync_positions();
    }
    move_selection_to_end() {
        var elems = this.get_selection();
        elems.forEach((e, i) => e.parentElement.append(e));
        elems.forEach(e => this.scroll_into_view(e));
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
            for (var keys of shortcut.split("|")) {
                var keys = keys.split("+").map(k => k.trim());
                var keys_lower = new Set([...keys, ...keys.map(k => k.toLowerCase())]);
                if (keys_lower.has("ctrl") == e.ctrlKey && keys_lower.has("alt") == e.altKey && keys_lower.has("shift") == e.shiftKey && keys_lower.has(e.key.toLowerCase())) {
                    if (this.context_menu) this.context_menu.toggle(false);
                    c.click(this.get_selected_items());
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
        this.context_menu = new dom.DropdownMenu({
            trigger: false,
            parent: app.elem,
            items: () => {
                var items = this.get_selected_items();
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
                    menu_groups.push([Object.keys(c).filter(c => c.startsWith("color_")).map(k => c[k])]);
                }
                var menu_items = [];
                for (var g of menu_groups) {
                    if (g.flat().some(i => i.visible(items))) {
                        if (menu_items.length) menu_items.push("-----");
                        menu_items.push(...g);
                    }
                }
                return menu_items;
            },
            params: () => this.get_selected_items(),
            position: { x: e.clientX, y: e.clientY },
            tippy_opts: {
                placement: "auto-start",
            }
        });
        this.context_menu.toggle(true);
    }

    sync_positions() {
        var playlist_changes = {};
        this.sortables.forEach((s, t) => {
            s.get_items().forEach((elem, i) => {
                var id = elem.dataset.id;
                var item = app.$._session.playlist[id];
                var c = {};
                if (item.index != i) c.index = i;
                if (item.track_index != t) c.track_index = t;
                if (utils.is_empty(c)) return;
                playlist_changes[id] = c;
            });
        });
        app.playlist_update(playlist_changes)
    }

    clipboard_copy(cutting = false) {
        var items = this.get_selected_items();
        if (!items.length) return;
        items = items.map(i => i._copy(true));
        this.clipboard = { items, cutting };
        localStorage.setItem("playlist-clipboard", JSON.stringify(this.clipboard));
        this.update_next_frame();
    }

    async clipboard_paste() {
        if (!this.clipboard) return;
        if (this.clipboard.cutting) {
            var items = this.clipboard.items.map(i => app.$.sessions[i._session_id].playlist[i.id]).filter(i => i);
            this.clipboard = null;
            localStorage.removeItem("playlist-clipboard");
            app.playlist_move(items);
        } else {
            app.playlist_add(this.clipboard.items);
        }
        // this.update_next_frame();
    }

    async clipboard_clear() {
        this.clipboard = null;
        localStorage.removeItem("playlist-clipboard");
        this.update_next_frame();
    }

    /** @param {PlaylistItem$} item */
    rename(item) {
        app.blocking_updates.add(new Promise((resolve) => {
            var el = this.get_element(item);

            this.scroll_into_view(el);
            // var new_name = window.prompt("Rename:", item.props.label || "");

            var filename = el.querySelector(".filename");
            var old_name = filename.innerText;
            var orig_html = filename.innerHTML;
            var default_name = item._get_pretty_name({ label: false });

            filename.contentEditable = true;
            dom.set_inner_html(filename, item.props.label || default_name);
            filename.focus();
            window.getSelection().selectAllChildren(filename);
            var blur_listener, keydown_listener;
            filename.addEventListener("keydown", keydown_listener = (e) => {
                if (e.key === "Escape") {
                    filename.innerHTML = orig_html;
                    filename.blur();
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    filename.blur();
                }
            });
            filename.addEventListener("blur", blur_listener = () => {
                resolve();
                filename.contentEditable = false;
                filename.removeEventListener("blur", blur_listener);
                filename.removeEventListener("keydown", keydown_listener);
                var new_name = filename.innerText.trim();
                if (!new_name || new_name == default_name) new_name = null;
                dom.set_inner_html(filename, `<span>${new_name || default_name}</span>`);

                if (old_name != new_name) {
                    app.playlist_update({ [item.id]: { props: { label: new_name } } });
                }
                this.timeline_container_elem.focus({ preventScroll: true });
            });
        }));
    }

    zoom_into_selected_playlist_items() {
        var ud = this.current._userdata;
        var start, end;
        if (ud.clipping) [start, end] = [ud.clipping.start, ud.clipping.end];
        else {
            var items = this.get_selected_items();
            if (!items || !items.length) items = this.get_all_items();
            start = Math.min(...items.map(item => item._userdata.timeline_start));
            end = Math.max(...items.map(item => item._userdata.timeline_end));
        }
        this.set_timeline_view([start, end]);
    }

    scroll_to_playhead() {
        this.set_timeline_view(null, this.time || 0);
    }

    /** @param {PlaylistItem$[]} items */
    set_selection(items, focus = true) {
        if (!Array.isArray(items)) items = [items];
        this.sortables.forEach(s => s.deselect_all());
        var elems = new Set(items.map(item => this.get_element(item)).filter(e => e));
        elems.forEach((elem, i) => {
            ResponsiveSortable.closest(elem).click(elem, false, i != 0);
        });
        if (focus) this.focus();
    }

    /** @param {PlaylistItem$} item */
    get_element(item) {
        var id;
        if (item instanceof Element) id = item.dataset.id;
        else if (typeof item == "object") id = item.id;
        else if (typeof item == "string") id = item;
        return this.get_elements().find(e => e.dataset.id == id);
    }
    get_elements() {
        return this.sortables.map(s => s.get_items()).flat();
    }
    get_selection() {
        return this.sortables.map(s => s.get_selection()).flat();
    }
    get_first_selected() {
        return this.get_selection()[0];
    }

    get_all_items() {
        return this.get_elements().map(e => app.$._session.playlist[e.dataset.id]).filter(i => i);
    }
    get_selected_items() {
        return this.get_selection().map(e => app.$._session.playlist[e.dataset.id]).filter(i => i);
    }
    get_selection_indices() {
        return this.get_selection().map(e => dom.get_index(e));
    }
    get_selected_item() {
        return this.get_selected_items()[0];
    }

    /** @param {PlaylistItem$} item */
    async open(item, selection = [], focus = true) {
        if (!item._is_playlist) return;
        this.sortables.forEach(s => s.forget_last_active());
        this.#current_id = item.id;
        this.cursor_position = null;
        item._private.hash_on_open = item._calculate_contents_hash();
        this.update();
        this.set_selection(selection, focus);
    }

    #update_info() {
        var selected_items = this.get_selected_items();
        var len = this.get_elements().length;
        var info = {};
        info["Selection"] = `<i class="far fa-square-check"></i> [${selected_items.length}/${len}]`;
        if (selected_items.length) {
            var duration = utils.sum(selected_items.map(i => i._userdata.duration));
            info["Duration"] = `<i class="far fa-clock"></i> (${utils.seconds_to_timespan_str(duration, "h?:mm:ss")})`;
        }
        if (this.clipboard) {
            info["Clipboard"] = `${this.clipboard.cutting ? `<i class="fas fa-scissors"></i>` : `<i class="far fa-clipboard"></i>`} [${this.clipboard.items.length}]`;
        }
        dom.set_inner_html(this.playlist_info_text, Object.entries(info).map(([name, text]) => `<span title="${name}">${text}</span>`).join(""));
        dom.set_inner_html(this.toggle_selection_button, `${selected_items.length ? "Deselect" : "Select"} All`);
        dom.toggle_attribute(this.toggle_selection_button, "disabled", len == 0);
        this.toggle_selection_button.onclick = () => {
            if (selected_items.length) this.active_sortable.deselect_all();
            else this.active_sortable.select_all();
            this.timeline_container_elem.focus({ preventScroll: true });
        };
    };

    #update_position() {
        if (!this.base_min_height) {
            var c = window.getComputedStyle(this.elem);
            this.base_min_height = parseFloat(c.getPropertyValue("--min-height"));
        }
        var get_style = () => {
            if (!app.settings.get("playlist_sticky")) return;
            if (this.elem.parentElement.childElementCount > 1) return;
            var r = this.elem.parentElement.getBoundingClientRect();
            var min_height = 400;
            var max_height = r.bottom - r.top;
            var padding = parseFloat(getComputedStyle(app.main_elem).paddingTop);
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
                top: `${Math.round(fixed_top - r.top)}px`,
                // width: `${width}px`,
                height: `${Math.round(height)}px`,
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

            var changed_zoom = this.last_zoom != this.zoom;
            this.last_zoom = this.zoom;

            if (this.clipping) {
                let limits_html = [
                    `<div style="left:0; width:${Math.max(0, (this.clipping.start - this.view_start) / this.view_duration * 100).toFixed(3)}%"></div>`,
                    `<div style="right:0; width:${Math.max(0, (this.view_end - this.clipping.end) / this.view_duration * 100).toFixed(3)}%"></div>`,
                ].join("");
                dom.set_inner_html(this.limits_elem, limits_html);
            }

            this.limits_elem.style.display = this.clipping ? "" : "none";

            // var max_width = Math.max(...this.sortables.map(s=>s.el.offsetWidth));
            // set_style_property(this.elem, "--timeline-width", `${max_width}px`);
            dom.set_style_property(this.timeline_container_elem, "--timeline-width", `${this.duration * this.zoom}px`)

            this.ticks_bar.update(this.view_start, this.view_end);

            this.cursor_elem.style.left = `${((this.cursor_position || 0) - this.view_start) * this.zoom}px`;
            this.cursor_elem.style.display = (this.cursor_position == null) ? "none" : "";

            this.playhead_elem.style.display = (this.time == null || this.time < 0 || this.time > this.duration) ? "none" : "";
            this.playhead_elem.style.left = `${(this.clip_time - this.view_start) / this.view_duration * 100}%`;

            this.playlist_zoom_out_button.disabled = this.playlist_zoom <= PLAYLIST_ZOOM_MIN;
            this.playlist_zoom_in_button.disabled = this.playlist_zoom >= PLAYLIST_ZOOM_MAX;
            this.playlist_zoom_input.value = this.zoom.toFixed(2) + "x";
            this.playlist_goto_playhead_button.disabled = this.time == null;

            // this.debounced_os_update();
            if (changed_zoom) this.update_scroll();
            // this.tracks_elem.dispatchEvent(new Event("scroll"));
        }

        // this.scrollbar_width = Math.max(...get_scrollbar_width(this.tracks_elem));
        // dom.set_style_property(this.timeline_container_elem, "--scrollbar-width", `${this.scrollbar_width}px`);
    }

    get timeline_window_duration() {
        return this.tracks_elem.clientWidth / this.zoom;
    }
    get timeline_window_start() {
        return this.tracks_elem.scrollLeft / this.zoom;
    }
    get_timeline_scroll_percent = (ox = 0.5) => (this.timeline_window_start + this.timeline_window_duration * ox) / this.duration;
    set_timeline_scroll_percent = (v, ox = 0.5) => {
        this.tracks_elem.scrollLeft = this.duration * (v - (this.timeline_window_duration / this.duration * ox)) * this.zoom;
    }
    set_timeline_zoom(v) {
        this.zoom = utils.clamp(v, PLAYLIST_ZOOM_MIN, PLAYLIST_ZOOM_MAX);
        if (isNaN(this.zoom) || !isFinite(this.zoom)) this.zoom = 1.0;
        dom.set_style_property(this.timeline_container_elem, "--playlist-zoom", this.zoom);
    }
    reset_scroll() {
        this.tracks_elem.scrollLeft = this.tracks_elem.scrollTop = 0;
    }
    inc_timeline_zoom(v = 0, e) {
        this.set_timeline_view(Math.pow(PLAYLIST_ZOOM_BASE, utils.log(this.zoom, PLAYLIST_ZOOM_BASE) + v), null, e);
    }
    set_timeline_view(zoom, time, e = null) {
        var ox = 0.5;
        if (e instanceof MouseEvent) {
            var pt = { x: e.clientX, y: e.clientY };
            var rect = this.tracks_elem.getBoundingClientRect();
            ox = utils.clamp(get_rect_pt_percent(rect, pt).x);
        } else if (e instanceof Number) {
            ox = e;
        }
        if (Array.isArray(zoom)) {
            this.set_timeline_zoom(this.zoom * this.timeline_window_duration / (zoom[1] - zoom[0]));
            this.set_timeline_scroll_percent((zoom[0] + zoom[1]) / 2 / this.duration);
        } else {
            var scroll_x = (time == null) ? this.get_timeline_scroll_percent(ox) : (time / this.duration);
            if (zoom != null) this.set_timeline_zoom(zoom);
            this.set_timeline_scroll_percent(scroll_x, ox);
        }
        this.update();
    }
}

/** @param {HTMLElement} parent_elem @param {PlaylistItem$} item */
function build_playlist_breadcrumbs(parent_elem, item, show_modify = false, exclude_root = true) {
    var path = [item, ...item._parents].reverse().filter(p => p);
    var path_hash = JSON.stringify(path.map(i => [i._hash]));

    if (parent_elem._path_hash === path_hash) return;
    parent_elem._path_hash = path_hash;
    dom.remove_children(parent_elem);
    dom.add_class(parent_elem, "breadcrumbs");
    path.forEach((item, i) => {
        var elem = $(`<a></a>`)[0];
        var name = item._get_pretty_name() || "[Untitled]";
        if (item._is_root) {
            if (exclude_root) return;
            elem.style.overflow = "visible";
            dom.set_inner_html(elem, `<i class="fas fa-house"></i>`);
        } else {
            dom.set_inner_html(elem, name);
        }
        elem.href = "javascript:void(0)";
        parent_elem.append(elem);
        elem.onclick = () => item._reveal();
        elem.title = name;
        if (i != path.length - 1) {
            parent_elem.append($(`<span class="separator"></span>`)[0]);
        }
    });

    if (show_modify && item._is_modifiable) {
        var a = $(`<a class="modify" href="javascript:void(0);" title="Modify..."><i class="fas fa-wrench"></i></a>`)[0];
        parent_elem.append(a);
        a.onclick = () => {
            new PlaylistItemModifyMenu([app.$._session.playlist[item.id]]).show();
        }
    }
}

class PlaylistItemUI extends ui.UI {
    /** @type {ProgressBar} */
    progress;

    /** @param {Session$} session @param {string} id */
    constructor(session, id) {
        super(`<li class="item"><div class="clips"></div><div class="front"><span class="play-icons"></span><span class="icons"></span><span class="filename"></span><span class="extra"></span><span class="badges"></span><div class="duration"></div></div></li>`);

        var play_icons_elem = this.elem.querySelector(".play-icons");
        var icons_elem = this.elem.querySelector(".icons");
        var filename_elem = this.elem.querySelector(".filename");
        var duration_elem = this.elem.querySelector(".duration");
        var extra_elem = this.elem.querySelector(".extra");
        var badges_elem = this.elem.querySelector(".badges");
        var clips_elem = this.elem.querySelector(".clips");

        var last_hash;
        this.on("update", () => {
            var item = session.playlist[id];
            if (!item) {
                console.log("item not found", id);
                return;
            }
            // var index = this.index;
            var is_current = item._is_current;
            var is_currently_playing = item._is_currently_playing;
            var is_ancestor_of_current = item._is_ancestor_of_current;
            var is_cutting = !!(app.playlist.clipboard && app.playlist.clipboard.cutting && app.playlist.clipboard.items.find(i => i.id == item.id));
            var is_buffering = app.media.buffering;
            var is_processing = item._is_processing;
            let media_info = item._media_info || EMPTY_OBJECT;
            let media_info_hash = media_info ? [media_info.ts, media_info.processing] : 0;
            let is_rtmp_live = item._is_rtmp_live;
            var upload = item._upload;
            var download = item._download;
            let children = item._children;

            var _hash = JSON.stringify([item, /* index,  */is_current, is_currently_playing, is_ancestor_of_current, is_cutting, is_processing, is_buffering, is_rtmp_live, media_info_hash, upload, download, children.length]);

            if (last_hash === _hash) return;

            last_hash = _hash;
            item._clear_userdata();
            var userdata = item._userdata;

            // let num_descendents = item._descendents.length;
            // let root_merged_playlist = item._root_merged_playlist;
            var is_playlist = item._is_playlist;
            var problems = [];
            let name = userdata.name;
            let filename_parts = [`<span>${name}</span>`];
            let title_parts = [name];
            let main_icon;
            var icons = [];
            var play_icons = [];
            let background_color, outline_color;
            let badges = {};

            dom.toggle_class(this.elem, "cutting", is_cutting);

            let blocks = [];

            if (userdata.clipping) {
                if (userdata.clipping.loops < 128) {
                    let segments = get_clip_segments(userdata.clipping);
                    if (userdata.clipping.loops > 1) {
                        let t = 0, d = userdata.duration;
                        if (d) {
                            for (let s of segments) {
                                blocks.push({ x: t / d, width: s.duration / d })
                                t += s.duration
                            }
                        }
                    } else {
                        let d = userdata.media_duration;
                        if (d) {
                            for (let s of segments) {
                                blocks.push({ x: s.start / d, width: s.duration / d });
                            }
                        }
                    }
                }
                blocks = blocks.filter(b => b.width > 0.0001);
                if (blocks.length == 1 && blocks[0].width == 1) blocks = [];
            }
            let clips_html = blocks.map(b => `<div style="left:${b.x.toFixed(5) * 100}%;width:${b.width.toFixed(5) * 100}%;"></div>`).join("");
            dom.set_inner_html(clips_elem, clips_html);
            dom.toggle_class(clips_elem, "repeats", !!(userdata.clipping && userdata.clipping.loops > 1))

            if (is_processing) {
                play_icons.push(`<i class="fas fa-sync fa-spin"></i>`);
            } else if (is_ancestor_of_current) {
                play_icons.push(`<i class="fas fa-arrow-right"></i>`);
            } else if (is_currently_playing) {
                if (is_buffering) play_icons.push(`<i class="fas fa-circle-notch fa-spin"></i>`);
                else play_icons.push(`<i class="fas fa-play"></i>`);
            } else if (is_current) {
                play_icons.push(`<i class="fas fa-forward-step"></i>`);
            } else {
                play_icons.push(`<span class="numbering">${String(item.index + 1).padStart(2, "0")}</span>`);
            }

            if (!upload) { // check upload queue ids
                if (!item._is_special && media_info.exists === false) {
                    problems.push({ level: 3, text: "Media does not exist." });
                } else if (!item._is_special && !utils.is_empty(media_info) && !media_info.streams && media_info.protocol !== "livestreamer:" && !item._is_playlist && !userdata.is_processing) {
                    problems.push({ level: 1, text: "Possibly invalid media." });
                }
                /*  else if (root_merged_playlist && !item._is_mergable) {s
                    problems.push({level:2, text:"Merged items must be local files or empties."});
                } */
            }

            if (item.props.color && item.props.color !== "none") {
                background_color = item_colors[item.props.color];
                outline_color = Color(item_colors[item.props.color] || "#fff").mix(Color("#000"), 0.08).hex();
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

            if (item._is_special) {
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
                    title_parts.push(is_rtmp_live ? "[Connected]" : "[Disconnected]");
                    if (is_rtmp_live) {
                        main_icon = `<i class="fas fa-link" style="color:#00cc00;" title="Connected"></i>`;
                    } else {
                        main_icon = `<i class="fas fa-unlink" title="Disconnected"></i>`;
                    }
                    // main_icon = `<i class="fas fa-tower-broadcast"></i>`
                }
            }

            if (item.filename.match(/^(http|ftp|rtmp)s?:/)) {
                let icon = $(`<i class="fas fa-globe"></i>`)[0]; //  style="color:cornflowerblue"
                icon.title = item.filename;
                main_icon = icon.outerHTML;
                badges["web"] = new URL(item.filename).hostname.replace(/^www\./, "");
            }

            if (!download) {
                if (media_info.streams) {
                    var default_video = get_default_stream(media_info.streams, "video");
                    var default_audio = get_default_stream(media_info.streams, "audio");

                    let has_video = default_video && default_video.codec && !default_video.albumart;
                    let has_audio = default_audio && default_audio.codec;

                    if (has_video) {
                        var codec = default_video.codec.replace(/video$/, "").split(".")[0];
                        var size = get_video_size(default_video.width, default_video.height, default_video.interlaced);

                        if (!media_info.duration || media_info.duration <= IMAGE_DURATION) {
                            icons.push(`<i class="fas fa-image"></i>`);
                            badges["image"] = `${codec} ${default_video.width}x${default_video.height}`;
                        } else {
                            icons.push(`<i class="fas fa-film"></i>`);
                            let parts = [codec, size.text];
                            if (default_video.fps) parts[1] += "/" + (default_video.fps.toLocaleString({ maximumFractionDigits: 2 }));
                            badges["video"] = parts.join(" ");
                        }
                    }
                    if (has_audio) {
                        if (!has_video) icons.push(`<i class="fas fa-music"></i>`);
                        badges["audio"] = default_audio.codec.replace(/^pcm_.+$/, "pcm").split(".")[0];
                    }
                    /* if (root_merged_playlist && default_video && default_video.codec == "vc1") {
                        problems.push({level:2, text: "VC-1 video codec can lead to playback issues within a merged playlist."});
                    } */
                }
            }

            if (item.upload_id || download) {
                let t = download ? "download" : "upload";
                if (item.upload_id && !upload) {
                    problems.push({ level: 2, text: "Upload failed." });
                }
                this.progress = this.progress || new ProgressBar(t);
                this.progress.progress = upload || download;
                icons.push(`<i class="fas fa-${t}"></i>`);
                dom.set_children(extra_elem, [this.progress.elem]);
            } else {
                if (this.progress) {
                    this.progress.destroy();
                    this.progress = null;
                }
            }

            dom.set_inner_html(badges_elem, Object.entries(badges).map(([k, v]) => {
                var parts = v.split(" ");
                parts[0] = parts[0].toUpperCase();
                return `<i class="badge" data-badge-type="${k}">${parts.join(" ")}</i>`;
            }).join(""));

            if (userdata.is_modified) {
                icons.push(`<i class="fas fa-wrench"></i>`);
            }

            let d = userdata.duration;
            let duration_str = d ? utils.seconds_to_timespan_str(d, "h?:mm:ss") : "";

            dom.set_inner_html(duration_elem, duration_str);

            if (problems.length) {
                var problem_groups = utils.group_by(problems, p => p.level);
                var err_icon_html;
                if (problem_groups.has(3)) err_icon_html = `<i class="fas fa-times" style="color:red;"></i>`;
                else if (problem_groups.has(2)) err_icon_html = `<i class="fas fa-exclamation-triangle" style="color:orange;"></i>`;
                else if (problem_groups.has(1)) err_icon_html = `<i class="fas fa-question-circle"></i>`;
                if (err_icon_html) {
                    let icon = $(err_icon_html)[0];
                    icons.push(icon.outerHTML);
                }
            }

            dom.set_inner_html(play_icons_elem, play_icons.join(""));

            // if (!main_icon) main_icon = `<i class="fas fa-file"></i>`;
            dom.set_inner_html(icons_elem, [main_icon, ...icons].join(""));

            dom.set_inner_html(filename_elem, filename_parts.join(" "));

            dom.set_style_property(this.elem, "--duration", userdata.timeline_duration);
            dom.set_style_property(this.elem, "--start", userdata.timeline_start);
            dom.set_style_property(this.elem, "--end", userdata.timeline_end);
            dom.set_style_property(this.elem, "--background-color", background_color || "");
            dom.set_style_property(this.elem, "--outline-color", outline_color || "");
            dom.toggle_class(this.elem, "current", is_current);
            this.elem.title = [title_parts.join(" "), ...problems.map(p => " - " + p.text)].join("\n");
        });

    }
}

class ProgressBar extends ui.UI {
    /** @param {"upload"|"download"} t */
    constructor(t) {
        super(`<div class="progress-bar"><span class="percent"></span><span class="speed"></span></div>`);

        let percent_el = this.elem.querySelector(".percent");
        let speed_el = this.elem.querySelector(".speed");
        this.on("render", () => {
            var { bytes, total, speed, stage, stages } = this.progress ?? {};
            bytes = bytes ?? 0;
            total = total ?? 0;
            speed = speed ?? 0;
            let incomplete = !this.progress;
            let p = total ? (bytes / total) : 0;
            this.elem.classList.toggle("incomplete", incomplete);
            this.elem.title = incomplete ? "Incomplete" : `${utils.capitalize(t)}ing [${utils.format_bytes(bytes, true)} / ${utils.format_bytes(total, true)}]`;
            dom.set_style_property(this.elem, "--progress", `${p * 100}%`);
            let percent_text = [];
            if (stages) percent_text.push(`${stage + 1}/${stages}`);
            percent_text.push(`${(p * 100).toFixed(2)}%`);
            dom.set_inner_html(percent_el, incomplete ? "Incomplete" : percent_text.join(" | "));
            dom.set_inner_html(speed_el, incomplete ? "Incomplete" : `${utils.format_bytes(speed, true)}ps`);
        });
    }
}

//------------------------------------------------------


/** @template {ui.UISettings<Area>} [Settings=ui.UISettings<Area>] */
/** @template {ui.UIEvents} [Events=ui.UIEvents] */
/** @extends {ui.Column<Settings,Events>} */
export class Area extends ui.Column {
    constructor(elem, settings) {
        super(elem, settings);
        dom.add_class(this.elem, "area");
        dom.add_class(this.elem, `area-${app.areas.length + 1}`);
        app.areas.push(this);
    }
}

export class SessionPasswordInput extends ui.InputProperty {
    constructor() {
        var elem = $(`<input type="text">`, {
            "label": "Password",
            "default": "",
            "reset": false,
            "placeholder": "Enter password",
        })[0];
        super(elem);
        this.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") button.click();
        });

        let button = $(`<button title="Sign in"><i class="fas fa-key"></i></button>`)[0];
        button.addEventListener("click", () => {
            app.passwords.set(app.$._session.id, password.value);
            if (!app.$._session.access_control._self_has_access) {
                window.alert("Incorrect Password")
            }
        });

        this.buttons_el.append(button);
    }
}

export class ButtonGroup extends ui.UI {
    constructor(settings) {
        super(`<div class="button-group"></div>`, {
            hidden: () => this.children.length == 0,
            ...settings,
        });
    }
}

class Toast extends ui.UI {
    constructor(message) {
        var elem = $(`<div class="toast"><div class="message"></div><button class="close"><i class="fas fa-times"></i></button></div>`)[0];
        super(elem);
        this.elem.querySelector(".message").innerHTML = message;
        this.elem.querySelector(".close").addEventListener("click", () => this.hide());
        app.toast_container.append(this.elem);
    }
    show(duration = 0) {
        this.elem.classList.add("show");
        if (duration) {
            setTimeout(() => this.hide(), duration);
        }
    }
    hide() {
        // slide_out(this.elem, 100);
        this.elem.classList.remove("show");
        setTimeout(() => this.destroy(), 300);
    }
}

export class MainWebApp extends utils.EventEmitter {

    #updating = false;
    blocking_updates = new utils.PromiseSet();
    /** @type {Record<string,Promise<MediaInfo>>} */
    media_info_promises = {};
    /** @type {Record<string,MediaInfo>} */
    media_info = {};
    $ = new Remote$();
    /** @type {Set<Modal>} */
    showing_modals = new Set();

    get is_debug_mode() { return this.$.conf["debug"] || new URLSearchParams(window.location.search.slice(1)).has("debug"); }
    get is_headless() { return !!this.$.sysinfo.is_headless; }

    constructor() {
        super();

        app = this;

        console.log("init");

        /** @type {HTMLElement} */
        this.elem = document.querySelector("#livestreamer");
        ui.Tooltip.defaults.appendTo = document.body;
        ui.Modal.defaults.root = app.elem;

        var main_elem = $(
            `<div class="main">
            <div class="session-header">
                <div class="session-tabs-wrapper">
                    <div id="session-tabs" data-overlayscrollbars-initialize></div>
                    <button class="new-session session-tab" title="New Session"><i class="fas fa-plus"></i></button>
                </div>
                <div class="session-select-wrapper"></div>
                <div class="right"></div>
            </div>

            <div class="session-header-line"></div>
        
            <div id="session">
                <div class="session-controls-wrapper">
                    <div id="session-controls"></div>
                    <div id="session-load-save"></div>
                    <div id="users"></div>
                </div>
                <div id="session-inner">
                    <div id="session-ui"></div>
                </div>
            </div>
            
            <div id="no-sessions" style="display:none;">
                <div class="no-session">Open or create a new session.</div>
                <div class="owner"></div>
                <div class="no-access">You do not have access.</div>
            </div>
            
            <div id="session-password"></div>

            <div class="app-logs-section">
                <div class="session-header-line"></div>
            </div>
            <div class="session-header-line"></div>

            <div id="toast-container" class="toast-container"></div>
        </div>`)[0];
        this.elem.append(main_elem);

        Chart.register(zoomPlugin);
        // Chart.register(annotationPlugin);

        Sortable.mount(new MultiDrag(), CancelSortPlugin, /* RememberScrollPositionsPlugin */); // , MyAutoScrollPlugin

        window.onbeforeunload = (e) => {
            if (ALL_XHRS.size) return `Uploads are in progress, leaving will abort the uploads.`;
            // return "";
        };

        if (IS_ELECTRON) {
            window.prompt = async (message, default_value) => {
                return new ui.PromptModal(message, default_value).show();
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
            /* "media_seek_time_interpolation": {
                __group__: "media_player",
                __input__: "<select>",
                __title__: "Seek Bar Time Interpolation",
                __default__: true,
                __options__: YES_OR_NO,
            }, */
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
                __options__: [["tabs", "Tabs"], ["select", "Dropdown"]],
            },
            /* "open_file_manager_in_new_window": {
                __group__: "misc",
                __input__: "<select>",
                __title__: "Open File Manager in New Window",
                __default__: false,
                __options__: YES_OR_NO,
            }, */
        }
        var settings_defaults = Object.fromEntries(Object.entries(this.settings_prop_defs).map(([k, v]) => [k, v.__default__]));

        this.settings = new dom.LocalStorageBucket("livestreamer-1.0", {
            ...settings_defaults,
            "layout": null,
            "session_order": null,
            "last_session_id": null,
            "playlist_item_info_simple": true,
        });
        this.passwords = new dom.LocalStorageBucket("livestreamer-passwords");

        /** @type {Set<ui.UI>} */
        this.roots = new Set();
        this.root = new Root(this.elem);
        this.roots.add(this.root);
        this.media = new Media();

        // this.conf = await fetch("conf").then(r=>r.json()); // crazy...;
        /** @type {Area[]} */
        this.areas = [];

        this.font_cache = {};
        this.num_requests = 0;
        this.upload_queue = new UploadQueue();
        this.clipboard = null;
        /** @type {Record<PropertyKey,typeof TargetConfigMenu>} */
        this.target_config_menus = {
            "local": LocalMediaServerTargetConfigMenu,
            "file": FileTargetConfigMenu,
            "gui": GUITargetConfigMenu,
        };
        this.advanced_functions = [];

        this.main_elem = this.elem.querySelector(".main");
        this.session_elem = this.elem.querySelector("#session");
        this.session_controls_wrapper_elem = this.elem.querySelector(".session-controls-wrapper");
        this.session_controls_elem = this.elem.querySelector("#session-controls");
        this.load_session_save_elem = this.elem.querySelector("#session-load-save");

        this.toast_container = this.elem.querySelector(".toast-container");
        new ui.UI(this.load_session_save_elem, {
            "hidden": () => this.$._session.type === constants.SessionTypes.EXTERNAL
        })

        var right_elem = this.elem.querySelector(".session-header>.right");
        var right_bg = new ButtonGroup();
        // var admin_button = new ui.Button(`<button class="mini icon" title="Admin" id="show-admin"><i class="fas fa-users-cog"></i></button>`, {
        //     hidden: ()=>!this.$._client.user.is_admin,
        //     click: ()=>{
        //         new AdminMenu().show();
        //     }
        // });
        // right_bg.append(admin_button);
        var config_button = new ui.Button(`<button class="icon" title="Client Configuration" id="show-config"><i class="fas fa-user-cog"></i></button>`, {
            click: () => {
                new UserConfigurationSettings().show();
            }
        });

        var help_button = new ui.Button(`<a class="button icon" title="Help" id="show-help" href="./help.html" target="_blank"><i class="far fa-question-circle"></i></a>`, {
            click: (e) => {
                e.preventDefault();
                this.toggle_help();
            }
        });
        right_bg.append(config_button, help_button);
        right_elem.append(right_bg);

        var session_controls_bg = new ButtonGroup();
        var minimize_session_button = new ui.Button(`<button id="minimize-session" class="icon" title="Minimize Session"><i class="fas fa-window-minimize"></i></button>`, {
            click: () => {
                window.location.hash = "";
            }
        });
        var sign_out_session_button = new ui.Button(`<button id="sign-out-session" class="icon" title="Sign out"><i class="fas fa-sign-out-alt"></i></button>`, {
            hidden: () => !(this.$._session.access_control._self_has_access && this.$._session.access_control._self_requires_password),
            click: () => {
                this.passwords.unset(this.$._session.id);
            }
        });
        var config_session_button = new ui.Button(`<button id="config-session" class="icon" title="Configure Session"><i class="fas fa-cog"></i></button>`, {
            disabled: () => !this.$._session._has_access || !this.$._session.access_control._self_has_ownership,
            click: () => {
                new SessionConfigurationMenu().show();
            }
        });
        var destroy_session_button = new ui.Button(`<button id="destroy-session" class="icon" title="Delete Session"><i class="fas fa-trash"></i></button>`, {
            disabled: () => !this.$._session.access_control._self_has_ownership,
            click: () => {
                if (confirm(`Are you sure you want to delete Session '${this.$._session.name}'?`)) {
                    var session_id = this.$._client.session_id;
                    window.location.hash = "";
                    app.update();
                    this.request("destroy_session", [session_id, true]);
                }
            }
        });
        session_controls_bg.append(minimize_session_button, sign_out_session_button, config_session_button, destroy_session_button);
        this.session_controls_elem.append(session_controls_bg);

        var load_session_button = new ui.Button(`<button id="load-session" class="" title="Load">Load</button>`, {
            disabled: () => !this.$._session._has_access || !this.$._session.access_control._self_has_ownership,
            click: () => {
                this.load_session();
            }
        });

        var save_session_button = new ui.Button(`<button id="save-session" class="" title="Save">Save</button>`, {
            disabled: () => !this.$._session._has_access || !this.$._session.access_control._self_has_ownership,
            click: () => {
                this.save_session();
            }
        });
        var history_session_button = new ui.Button(`<button id="history-session" class="" title="History">History</button>`, {
            disabled: () => !this.$._session._has_access || !this.$._session.access_control._self_has_ownership,
            click: () => {
                new HistoryMenu().show();
            }
        });

        var bg = new ButtonGroup();
        bg.append(load_session_button, save_session_button, history_session_button);
        this.load_session_save_elem.append(bg);

        this.session_inner_elem = this.elem.querySelector("#session-inner");
        this.session_ui_elem = this.elem.querySelector("#session-ui");
        this.no_sessions_elem = this.elem.querySelector("#no-sessions");
        this.new_session_button = this.elem.querySelector(".new-session");
        var session_tabs_outer = this.elem.querySelector("#session-tabs");
        this.session_tabs_elem = OverlayScrollbars(session_tabs_outer, {
            overflow: {
                x: "scroll",
                y: "hidden",
            },
        }).elements().viewport;
        this.users_elem = this.elem.querySelector("#users");

        var session_select_wrapper = this.elem.querySelector(".session-select-wrapper");
        var session_select = new ui.InputProperty(`<select id="session-select"></select>`, {
            "options": () => {
                return [["", "-", { style: { "display": "none" } }], ...[...this.session_tabs_elem.children].map(e => e.option_data)];
            },
            "data": () => this.$._client.session_id || "",
            "width": 240,
        });
        session_select.on("change", (e) => {
            if (e.trigger) {
                this.try_subscribe_to(session_select.value);
            }
        });
        session_select.buttons_el.append(new ui.Button(`<button class="icon" title="New Session"><i class="fas fa-plus"></i></button>`, {
            click: () => this.new_session()
        }));
        session_select_wrapper.append(session_select);

        var session_ui = new ui.Column();
        var row1 = new ui.Row();
        row1.append(new Area());
        var row2 = new ui.Row();
        row2.append(new Area(), new Area());
        session_ui.append(row1, row2);
        this.session_ui_elem.append(session_ui);

        /** @type {Record<PropertyKey,Panel>} */
        this.panels = {};

        this.stream_settings = new SessionStreamSettings();
        this.areas[0].append(this.stream_settings);

        this.playlist = new PlaylistPanel();
        this.areas[1].append(this.playlist);

        this.media_player = new MediaPlayerPanel();
        this.media_settings = new MediaSettingsPanel();
        this.metrics = new StreamMetricsPanel();
        this.session_logger = new LogPanel("session-log", "Session Log", () => this.$._session.logs);

        this.areas[2].append(this.media_player, this.media_settings, this.metrics, this.session_logger);
        this.default_layout = this.get_layout();

        this.log_section = this.elem.querySelector(".app-logs-section");
        this.logger = new LogPanel("app-log", "Application Log", () => this.$.logs);
        this.log_section.append(this.logger);

        var session_password_elem = this.elem.querySelector("#session-password");
        this.session_password = new SessionPasswordInput();
        session_password_elem.append(this.session_password);

        for (let area of this.areas) {
            new Sortable(area.elem, {
                group: "layout",
                fallbackTolerance: 3, // So that we can select items on mobile
                animation: 150,
                handle: ".drawer>.header",
                filter: (e) => {
                    if (e.target.closest(".not-draggable")) {
                        return true;
                    }
                    if (e.target.closest(".drawer>.header")) {
                        if (dom.has_touch_screen() || e.target.closest("button,input,select")) return true;
                    }
                    return false;
                },
                onStart: () => {
                    document.body.classList.add("dragging-ui");
                },
                onEnd: () => {
                    document.body.classList.remove("dragging-ui");
                    this.save_layout();
                    this.update();
                },
                preventOnFilter: false,
            });
        }

        this.session_sortable = new ResponsiveSortable(this.session_tabs_elem, {
            fallbackTolerance: 3, // So that we can select items on mobile
            animation: 150,
            // filter: ".unmovable",
            handle: ".handle",
            onEnd: (evt) => {
                if (this.$.conf["session_order_client"]) {
                    this.settings.set("session_order", [...this.session_tabs_elem.children].map(e => e.dataset.id));
                } else {
                    this.request("rearrange_sessions", [evt.oldIndex, evt.newIndex]);
                }
            },
        });

        this.footer_buttons = new ui.Row().elem;
        this.main_elem.append(this.footer_buttons);
        dom.set_style_property(this.footer_buttons, "justify-content", "end");

        {
            let group = new ui.UI({
                "class": "button-group",
                "gap": 0,
                "hidden": () => !(app.$.processes["file-manager"] || IS_ELECTRON)
            });

            if (!IS_ELECTRON) {
                group.append(
                    new ui.Button(`<button><i class="fas fa-screwdriver-wrench"></i></button>`, {
                        "click": () => new FileManagerVolumesMenu().show(),
                        "title": "Manage Volumes"
                    }),
                    /* new ui.Button(`<button><i class="fas fa-folder-tree"></i></button>`, {
                        "click": ()=>new FileSystemInfoMenu().show(),
                        "title": "File Tree"
                    }) */
                )
                group.append(
                    new ui.Link(`<a class="button">File Manager</a>`, {
                        "href": () => this.get_file_manager_url(),
                        "click": (e) => {
                            e.preventDefault();
                            this.open_file_manager({ new_window: true, standalone: true, hidden_id: "file-manager-standalone" });
                        }
                    })
                );
            }
            this.footer_buttons.append(group);
        }

        /* this.footer_buttons.append(
            new ui.Button(`<button>Font Manager</button>`, {
                "click": ()=>app.fonts_menu.show()
            })
        ) */
        this.footer_buttons.append(
            new ui.Button(`<button>Configure Targets</button>`, {
                "click": () => new TargetsMenu().show()
            }),
            new ui.Button(`<button>Live Manager</button>`, {
                "click": () => new LiveManagerMenu().show()
            }),
            new ui.Button(`<button>System Manager</button>`, {
                "click": () => new SystemManagerMenu().show()
            }),
            /* new ui.Button(`<button>Advanced Functions</button>`, {
                "click": ()=>this.advanced_functions_menu.show()
            }), */
            new ui.Button(`<button>Uploads & Downloads</button>`, {
                "click": () => new UploadsDownloadsMenu().show()
            }),
            new ui.Button(`<button>Controls</button>`, {
                "click": () => new KeyboardShortcutsMenu().show()
            }),
            new ui.Button(`<button>Change Log</button>`, {
                "click": () => new ChangeLogMenu().show(),
                /** @this {UI} */
                "update": function () {
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
                            this.elem.getAnimations().forEach(a => a.cancel());
                        }
                    }
                    this.__last_diff = diff;
                }
            }),
            new ui.Button(`<button>Setup External Session</button>`, {
                "click": () => new ExternalSessionConfigurationMenu().show()
            }),
        );

        this.settings.on("change", (e) => {
            var k = e.name;
            var v = e.new_value;
            if (k.includes(":")) {
                if (k.startsWith("drawer:")) {
                    var panel = this.panels[k.slice(7)];
                    if (panel) panel.toggle(!v);
                }
            } else {
                for (var w of [window, ...Object.values(windows)]) {
                    var body;
                    try { body = w.document.body; } catch (e) { continue; }
                    var type = typeof v;
                    var inputs = ["input", "select", "textarea"];
                    for (var c of inputs.map(i => [...w.document.querySelectorAll(`${i}[data-setting__${k}]`)]).flat()) {
                        c.value = v;
                    }
                    if (type === "boolean") {
                        dom.toggle_attribute(body, `data-setting__${k}`, v);
                        for (var c of [...w.document.querySelectorAll(`button[data-setting__${k}]`)]) {
                            if (v) delete c.dataset.toggled;
                            else c.dataset.toggled = 1;
                        }
                    } else if (type != "object" && type != "function") {
                        dom.set_attribute(body, `data-setting__${k}`, v);
                    }
                }
                this.update_next_frame();
            }
        });

        this.passwords.on("change", (e) => {
            this.update_next_frame();
        });

        this.setup_events(this.elem);

        window.addEventListener("keydown", this.on_keydown = (e) => {
            if (ui.Modal.showing.size) return;
            if (!isNaN(e.key) && e.ctrlKey) {
                var sessions = this.sessions_ordered;
                var i = +e.key - 1;
                this.try_subscribe_to(sessions[i] ? sessions[i].id : null);
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

        this.new_session_button.onclick = () => this.new_session();

        {
            let menu = new dom.DropdownMenu({
                trigger: "contextmenu",
                target: this.session_tabs_elem,
                parent: this.elem,
                position: "trigger",

                items: (e) => {
                    var elem = this.session_sortable.get_item(e.target);
                    var curr = this.$.sessions[elem.dataset.id];
                    return [
                        {
                            label: () => `ID: ${curr.id}`,
                            click: () => window.navigator.clipboard.writeText(curr.id),
                        }
                    ]
                }
            });
        }

        window.addEventListener("hashchange", () => {
            this.try_subscribe_to(window.location.hash.slice(1));
        });

        window.addEventListener("beforeunload", () => {
            for (var w of Object.values(windows)) w.close();
        });

        var fd = new FileDrop(this.playlist.elem);

        fd.on("drop", /** @param {FileSystemEntry[]} entries */ async (entries) => {
            if (!entries.length) return;
            var items = [];
            /** @param {PlaylistItem$} parent */
            var traverse = async (entry, parent) => {
                if (!entry) return;
                if (entry.isFile) {
                    /** @type {FileSystemFileEntry} */
                    let file_entry = entry;
                    let file = await new Promise(resolve => file_entry.file(resolve));
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
                        filename: "livestreamer://playlist",
                        props: {
                            label: dir_entry.name
                        }
                    }, {
                        parent
                    });
                    await new Promise((resolve) => {
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
        });

        var url = new URL(window.location.href);
        var key = url.searchParams.get("livestreamer_auth");
        var ws_url = new URL(url.origin.replace(/^http(s)?:\/\//, "ws$1://") + url.pathname);
        if (key) ws_url.searchParams.set("livestreamer_auth", key);

        this.ws = new dom.ReconnectingWebSocket();
        var opens = 0;
        this.ws.on("open", () => {
            opens++;
            this.$ = new Remote$();
            var session_id = window.location.hash.slice(1) || this.settings.get("last_session_id");
            var hash = `#${session_id}`;
            if (window.location.hash != hash) window.history.replaceState(null, "", hash);
            if (session_id) this.request("subscribe_session", [session_id]);
        });
        this.ws.on("data", (data) => {
            utils.remote.apply$(this.$, data);
            this.update_next_frame();
        });
        this.ws.on("close", () => {
            for (var m of ui.Modal.showing) m.hide();
            this.update_next_frame();
        });

        var connection_loader = new ui.Loader({
            "hidden": () => app.ws.is_open,
            update() {
                var text = {
                    [WebSocket.CONNECTING]: "Connecting...",
                    [WebSocket.OPEN]: "Connected",
                    [WebSocket.CLOSING]: "Disconnecting...",
                    [WebSocket.CLOSED]: "Disconnected",
                }[app.ws.ready_state];
                this.settings["loader.message"] = text;
            }
        });
        this.elem.append(connection_loader);

        this.tick_interval = setInterval(() => this.tick(), 1000 / 10);
        this.tick();

        this.update_layout();

        this.passwords.load();
        this.settings.load();

        this.ws.connect(ws_url.toString());
    }

    setup_events(elem) {
        elem.addEventListener("click", (e) => {
            /** @type {HTMLElement} */
            var elem = e.target;
            var data_setting_prefix = "data-setting__";
            var data_setting_key;
            var get_data_setting_attribute = (e) => {
                for (var attr of e.attributes) {
                    if (attr.nodeName.startsWith(data_setting_prefix)) {
                        data_setting_key = attr.nodeName.slice(data_setting_prefix.length);
                        return true;
                    }
                }
            }
            dom.closest(elem, (e) => e.matches("button") && get_data_setting_attribute(e));
            if (data_setting_key) {
                this.settings.toggle(data_setting_key);
            }
            // if (elem.matches("a")) {
            //     var url = dom.get_anchor_url(e.target);
            //     var file_manager_url = dom.get_url(null, "file-manager");
            //     if (url.host === file_manager_url.host && url.pathname === "/index.html") {
            //         console.log(utils.try_catch_file_uri_to_path(url).toString());
            //         this.open_file_manager({start: utils.try_catch_file_uri_to_path(url).toString()})
            //         console.log(e.target);
            //         e.preventDefault();
            //     }
            //     /* if (url.host === window.location.host && url.pathname === "/index.html" && url.hash) {
            //         this.try_attach_to(url.hash.slice(1));
            //         e.preventDefault();
            //     } */
            // }
        });
    }

    async update() {
        if (!this.$) return;
        if (this.#updating) return;
        this.#updating = true;
        await this.blocking_updates.ready;
        this.#update();
        this.#updating = false;
    }

    update_next_frame = dom.debounce_next_frame(this.update.bind(this));

    async #update() {

        this.elem.style.display = "";

        var is_null_session = this.$._session._is_null;
        var access_control = this.$._session.access_control;
        var has_access = is_null_session || access_control._self_has_access
        var requires_password = access_control._self_requires_password;

        dom.toggle_class(this.session_elem, "is-rtmp-connected", !!this.$._session._get_connected_nms_session_with_appname("internal", "private"));
        dom.set_dataset_value(this.session_elem, "session-type", this.$._session.type);
        dom.toggle_display(this.session_elem, !is_null_session);
        dom.toggle_display(this.session_inner_elem, has_access);
        dom.toggle_display(this.session_controls_wrapper_elem, !is_null_session);
        dom.toggle_display(this.no_sessions_elem, is_null_session || !has_access);
        dom.toggle_display(this.no_sessions_elem.querySelector(".no-session"), has_access);
        dom.toggle_display(this.no_sessions_elem.querySelector(".no-access"), !has_access);
        dom.toggle_display(this.no_sessions_elem.querySelector(".owner"), !has_access);
        dom.set_inner_html(this.no_sessions_elem.querySelector(".owner"), `This session is owned by ${access_control._owners.map(u => `[${u.username}]`).join(" | ")}`);

        this.session_password.settings["hidden"] = (has_access || !requires_password);

        dom.toggle_display(this.log_section, this.$._client.user.is_admin);

        this.#rebuild_sessions();
        this.#rebuild_clients();

        for (var ul of Object.values(this.$.uploads)) {
            if (!ul || ul.status === UploadStatus.CANCELLED) {
                this.upload_queue.cancel(ul.id);
            }
        }

        if (this.$.disk.is_low && !disk_warn_shown) {
            disk_warn_shown = true;
            new Toast(`<span>Disk space is low: ${(this.$.disk.free / this.$.disk.total * 100).toFixed(1)}% remaining, ${utils.format_bytes(this.$.disk.free, true)} free.</span>`).show();
        }

        document.body.dataset.playlist_id = this.playlist.id;
        for (var area of this.areas) {
            area.elem.dataset.children = [...area.children].map(c => c.id).join(",");
        }

        this.media.update();
        for (var root of this.roots) root.update();
    }

    load_font(id) {
        if (!this.font_cache[id]) {
            this.font_cache[id] = app.request("get_font", [id]);
        }
        return this.font_cache[id];
    }

    get_layout() {
        return this.areas.map(area => [...area.elem.children].map(c => c.dataset.id))
    }
    save_layout() {
        this.settings.set("layout", this.get_layout())
    }
    update_layout() {
        (this.settings.get("layout") || this.default_layout).forEach((blocks, i) => {
            this.areas[i].append(...blocks.map(id => this.panels[id]).filter(b => b));
        });
        this.update_next_frame();
    }

    /** @param {PlaylistItem$[]} items */
    playlist_rescan(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;

        this.request("update_media_info_from_ids", [items.map(item => item.id), true]);
    }

    /** @param {PlaylistItem$[]} items */
    playlist_split(items, splits, local_times = false) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        splits = utils.sort(splits);
        if (!splits.length) return [];

        var add_items = [];
        var remove_items = [];
        items = items.filter(i => i._is_splittable);
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
                if (!(utils.almost_equal(segment_start, start) && utils.almost_equal(segment_end, end)) && segment_start >= start && segment_end <= end && d > 0 && !utils.almost_equal(d, 0)) {
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
                insert_pos: item.index + 1,
                track_index: item.track_index
            });
        }
        if (remove_items.length) this.playlist_remove(remove_items);
        // await Promise.all(promises);
    }

    /** @param {PlaylistItem$[]} items */
    playlist_group(items) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;

        items.sort((a, b) => a.index - b.index);
        var index = items[0].index;
        var name = items[0]._get_pretty_name()
        var track_index = items[0].track_index
        var props = {};
        // if (items.length == 1)
        props.label = name;
        this.playlist_register_history("Playlist Grouped");
        var new_item = this.playlist_add({
            filename: "livestreamer://playlist",
            props,
            register_history: false
        }, {
            insert_pos: index,
            track_index: track_index,
        })[0];
        var changes = Object.fromEntries(items.map((item, i) => [item.id, { parent_id: new_item.id, index: i, track_index: 0 }]));
        this.playlist_update(changes, { register_history: false });

        // delete this.$.session.playlist[fake_id];
        // this.$.push([`sessions/${this.$.session.id}/playlist/${new_item.id}`, null]);
    }

    /** @param {PlaylistItem$[]} items */
    async playlist_breakdown(items) {
        if (!Array.isArray(items)) items = [items];
        items = items.filter(item => item._is_playlist);
        if (!items.length) return;

        var changes = {}
        for (var item of items) {
            var children = item._children;
            for (var c of children) {
                changes[c.id] = { parent_id: item.parent_id, track_index: item.track_index };
            }
            var parent_items = item._parent._get_track(item.track_index);
            var i = parent_items.indexOf(item) + 1;
            parent_items.splice(i, 1, ...children);
            parent_items.forEach((p, i) => {
                if (!changes[p.id]) changes[p.id] = {};
                changes[p.id].index = i;
            });
        }
        this.playlist_register_history("Playlist Broken Down");
        this.playlist_update(changes, { register_history: false });
        this.playlist_remove(items, { register_history: false });
    }

    /** @typedef {{insert_pos:number, track_index:number, parent:PlaylistItem$, register_history:boolean}} PlaylistInsertOptions */
    /** @param {PlaylistItem$[]} items @param {PlaylistInsertOptions} opts */
    async playlist_move(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let { track_index, insert_pos, parent } = this.get_playlist_insert_options(opts);
        var old_session_id = items[0]._session.id;
        var new_session_id = parent._session.id;

        var all = items.map(i => [{ id: i.id, parent: parent.id }, ...i._descendents.map(d => ({ id: d.id, parent: d.parent_id }))]).flat();
        var is_circular = utils.is_circular(all);
        if (is_circular) {
            alert("Circular parent-child loop. Aborting operation.");
            return;
        }

        var affected = new Set(items);
        var parent_items = parent._get_track(track_index);
        parent_items = parent_items.map(item => affected.has(item) ? null : item);
        if (old_session_id == new_session_id) {
            parent_items.splice(insert_pos, 0, ...items);
            parent_items = parent_items.filter(i => i);
            var data = Object.fromEntries(parent_items.map((item, i) => [item.id, { index: i, track_index, parent_id: parent.id }]));
            this.playlist_update(data);
            this.playlist.set_selection(items);
        } else {
            this.playlist_remove(items);
            this.playlist_add(items, { insert_pos, track_index })
        }
    }

    playlist_register_history(message) {
        this.request("playlist_register_history", [message]);
    }

    /** @param {any[]} items @param {PlaylistInsertOptions} opts */
    playlist_add(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (!items.length) return;
        let { track_index, insert_pos, parent, register_history } = this.get_playlist_insert_options(opts);
        var files = [];

        /** @type {PlaylistItem$[]} */
        var new_items = [];
        var add_item = (data, index, parent_id, track_index) => {
            let id = dom.uuid4();
            let filename, props, children;
            let upload_id;
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
                        upload_id = dom.uuid4();
                        file.id = upload_id;
                        files.push(file);
                    }
                }
                if (data instanceof PlaylistItem$) children = data._children;
                else if (data.children) children = data.children;
            } else {
                throw new Error("Invalid playlist item data");
            }
            var item = new PlaylistItem$({ filename, id, index, track_index, parent_id, props, upload_id });
            new_items.push(item);
            if (children) {
                children.forEach((c, i) => add_item(c, i, item.id, c.track_index || 0));
            }
            return item;
        }

        items.forEach((c, i) => {
            add_item(c, insert_pos + i, parent.id, track_index);
        });

        parent._get_track(track_index).slice(insert_pos).forEach((item, i) => {
            item.index = insert_pos + items.length + i;
        });
        for (var item of new_items) {
            this.$._session.playlist[item.id] = item;
        }
        for (var file of files) {
            this.$.uploads[file.id] = {}; // indicate that there is an upload so the progress bar doesnt flash red.
        }

        this.request("playlist_add", [new_items, { insert_pos, parent_id: parent.id, track_index, register_history }])
            .then(() => {
                for (var file of files) {
                    this.upload_queue.add(file, {
                        first_and_last_pieces_first: !!file.name.match(/\.mp4$/i),
                        media: true,
                        session: this.$._session.id,
                    });
                }
            });

        this.update().then(() => {
            this.playlist.set_selection(new_items);
        })

        return new_items;
    }

    /** @param {PlaylistItem$[]} items */
    playlist_remove(items, opts) {
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;
        let { register_history } = opts ?? {};

        for (var item of items) {
            var ul = item._upload;
            if (ul) app.upload_queue.cancel(ul.id);
        }
        let new_selection = [];
        let selection = this.playlist.get_selected_items();
        if (selection.length) {
            let next = selection[0]._get_nearest_not_in_selection(selection);
            if (next) new_selection.push(next);
        }
        for (var [session_id, group] of utils.group_by(items, i => i._session.id)) {
            var all_deleted_items = new Set(group.flatMap(i => [i, ...i._descendents]).reverse()); // important to reverse, 
            for (var item of all_deleted_items) {
                delete this.$.sessions[session_id].playlist[item.id];
            }
            this.update().then(() => {
                this.playlist.set_selection(new_selection);
            })
            this.request("playlist_remove", [group.map(i => i.id), session_id, { register_history }]);
        }
    }

    /** @param {object} changes */
    playlist_update(changes, opts) {
        let { register_history, replace_props } = opts ?? {};
        // changes = utils.tree_from_pathed_entries(changes);
        // var playlist = this.$.sessions[session_id].playlist;
        // if (cull) cull_equal_props(changes, playlist);
        if (utils.is_empty(changes)) return;
        for (var id in changes) {
            var item = app.$._session.playlist[id];
            if (!item) continue;
            var change = { ...changes[id] };
            var { props } = change;
            delete change.props;
            utils.merge(item, change, { delete_nulls: true });
            utils.merge(item.props, props, { delete_nulls: true });
            // utils.deep_merge(item, props, {deep:!replace_props, delete_null:true});
        }
        // this.update();
        this.request("playlist_update", [changes, { register_history, replace_props }]);
    }

    playlist_undo() {
        var h = this.$._session.playlist_history;
        if (h.position <= h.start) return;
        this.request("playlist_undo");
    }

    playlist_redo() {
        var h = this.$._session.playlist_history;
        if (h.position >= h.end) return;
        this.request("playlist_redo");
    }

    /** @param {PlaylistItem$[]} items */
    playlist_download(items) {
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;
        this.request("download_and_replace", [items.map(item => item.id)], {
            show_spinner: false
        });
    }

    /** @param {PlaylistItem$[]} items */
    playlist_cancel_download(items) {
        if (!Array.isArray(items)) items = [items];
        if (items.length == 0) return;
        this.request("cancel_download", [items.map(item => item.id)], {
            show_spinner: false
        });
    }

    /** @param {PlaylistItem$[]} items */
    playlist_cancel_upload(items) {
        if (!Array.isArray(items)) items = [items];
        items.forEach(i => app.upload_queue.cancel(i.id));
        if (items.length == 0) return;
        // this also cancels it for other users:
        this.request("cancel_upload", [items.map(item => item.upload_id)], {
            show_spinner: false
        });
    }

    /** @param {PlaylistItem$} item */
    playlist_play(item, start = 0) {
        item = item ?? this.$._session.playlist[utils.remote.Null$];
        var options = { pause: false };
        var root_merged = item._root_merged_playlist;
        if (root_merged) {
            var t = utils.sum([item, ...item._iterate_parents(root_merged)].map(p => p._userdata.start));
            item = root_merged;
            start += t;
        }
        options.start = start

        // this.media_player.seek.seek(options.start);
        // this.$._session._stream.mpv.time = start; // necessary?

        // this.$._session.playlist_id = item.id;
        // this.$._session.time_pos = start;
        // this.update();

        return this.request("playlist_play", [item.id || null, options]);
    }

    /** @param {number} t */
    seek(t, relative = false) {
        if (relative) t += this.$._session.time_pos;
        if (t < 0) t = 0;
        this.$._session.time_pos = t;
        this.update();
        return this.request("seek", [t])
    }

    seek_chapter(i, relative = false) {
        var chapters = this.$._session._current_playlist_item._userdata.chapters;
        if (relative) {
            var t = this.$._session.time_pos;
            var c = this.$._session._get_current_chapter_at_time(t);
            if (c) {
                if ((c.start - t) < -5 && i < 0) i++;
                i += c.index;
            }
        }
        i = utils.clamp(i, 0, chapters.length - 1);
        c = chapters[i];
        if (c) {
            return this.seek(c.start);
        }
    }

    /** @param {PlaylistInsertOptions} opts */
    get_playlist_insert_options(opts) {
        let { parent, track_index, insert_pos } = opts ?? {};
        parent = parent ?? this.playlist.current;
        track_index = track_index ?? this.playlist.active_track_index;
        let num_items = parent._get_track(track_index).length;
        if (insert_pos === undefined) {
            let last_active = this.playlist.sortables[track_index].get_last_active();
            insert_pos = (last_active) ? dom.get_index(last_active) + 1 : num_items;
        }
        insert_pos = utils.clamp(insert_pos, 0, num_items);
        track_index = utils.clamp(track_index, 0, 1);
        return { ...opts, parent, track_index, insert_pos };
    }

    // ---------------

    get_handover_sessions_options(include_none = true) {
        var sessions = this.sessions_ordered.filter(s => s.type === constants.SessionTypes.INTERNAL && !s._is_running);
        var options = sessions.map(s => s.name).map((n, i) => [sessions[i].id, n])
        if (include_none) options.unshift(["", "-"]);
        return options;
    }
    /** @param {string} method @param {any[]} args @param {typeof default_request_opts} opts */
    request(method, args, opts) {
        opts = {
            ...this.default_request_opts,
            ...opts
        };
        if (args !== undefined && !Array.isArray(args)) args = [args];

        return new Promise(async (resolve) => {
            var request = { method, arguments: args };
            if (this.is_debug_mode) {
                console.debug(`request`, JSON.stringify(request));
            }
            var ws_promise = this.ws.request(request);
            if (opts.show_spinner) {
                if (!this.request_spinner) {
                    this.request_spinner = new ui.UI(`<div id="request-loading"><i class="fas fa-sync fa-spin"></i></div>`, {
                        "hidden": () => this.$._pending_requests.size == 0,
                    });
                    this.elem.append(this.request_spinner);
                }
                this.$._pending_requests.add(ws_promise);
            }
            if (opts.show_loader) {
                this.$._pending_loader_requests.add(ws_promise);
                if (!this.request_loader) {
                    this.request_loader = new ui.Loader({
                        "hidden": () => this.$._pending_loader_requests.size == 0,
                    });
                    this.elem.append(this.request_loader);
                }
            }
            var update = () => {
                if (this.request_spinner) this.request_spinner.update();
                if (this.request_loader) this.request_loader.update();
            }

            update();

            ws_promise
                .then(d => resolve(d))
                .catch((e) => {
                    if (e instanceof utils.TimeoutError) return;
                    if (this.is_debug_mode) {
                        console.warn("Server error:\n" + e.toString());
                        window.alert("Server error:\n" + e.toString());
                    }
                })
                .finally(() => {
                    this.$._pending_requests.delete(ws_promise);
                    this.$._pending_loader_requests.delete(ws_promise);
                    update();
                });
        })
    }

    async try_subscribe_to(session_id) {
        if (session_id && !this.$.sessions[session_id]) return;
        if (!this.$.client_id) return;
        session_id = session_id || "";
        var new_hash = `#${session_id}`;
        this.settings.set("last_session_id", session_id);
        if (window.location.hash !== new_hash) {
            window.history.replaceState({}, "", new_hash);
        }
        if (this.$._client.session_id != session_id) {
            /* if (session_id) {
                this.$._client.session_id = session_id;
                this.update();
            } */
            this.request("subscribe_session", [session_id], { show_loader: true });
            this.session_password.reset();
        }
        return true;
    }

    tick() {
        dom.toggle_class(this.elem, "is-touch", dom.has_touch_screen());
    }

    #rebuild_clients() {
        var session_id = this.$._client.session_id;
        var clients = Object.values(this.$.clients).filter(c => c.session_id == session_id);
        /** @type {Record<PropertyKey,Client$[]>} */
        var clients_stacked = {};
        for (var c of clients) {
            if (clients_stacked[c.user.username] === undefined) clients_stacked[c.user.username] = [];
            clients_stacked[c.user.username].push(c);
        }
        var owners = this.$._session.access_control._owners.map(u => u.username);
        var items = [
            ...owners.map(o => ({ username: o, type: "owner" })),
            ...utils.sort(Object.values(clients_stacked), a => a[0].user.username).map(c => ({ username: c[0].user.username, type: "client", number: c.length }))
        ];
        for (var i of items) i.id = utils.md5(JSON.stringify(i));

        dom.rebuild(this.users_elem, items, {
            add: (item, elem, i) => {
                elem = $(`<span class="user"></span>`)[0];
                var is_self = this.$._client.user.username == item.username;
                var text = is_self ? `Me` : item.username;
                dom.toggle_class(elem, "is-self", is_self);
                if (item.type === "owner") {
                    elem.append($(`<i class="fas fa-user-tie"></i>`)[0]);
                    dom.add_class(elem, "is-owner");
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
            return utils.sort(Object.values(this.$.sessions), (s) => {
                var i = order.indexOf(s.id);
                if (i == -1) return Number.MAX_SAFE_INTEGER;
                return i;
            }, (s) => s.index);
        } else {
            return utils.sort(Object.values(this.$.sessions), (s) => s.index);
        }
    }

    async #rebuild_sessions() {
        var items = this.sessions_ordered;
        var session_id = this.$._client.session_id;
        dom.rebuild(this.session_tabs_elem, items, {
            add: (item, elem, i) => {
                if (!elem) elem = $(`<a class="session-tab"><div class="handle"><i class="fas fa-grip-lines"></i></div><span class="name"></span><span class="icons"></span></a>`)[0];
                var access_control = item.access_control;
                var has_access = access_control._has_access(this.$._client.user.username, this.passwords.get(item.id));
                var requires_password = access_control._self_requires_password;
                var is_active = item.id == session_id;
                var is_owner = access_control._self_has_ownership;
                var state = item._stream.state;
                var hash = JSON.stringify([item.id, item.name, item.schedule_start_time, state, is_owner, is_active, has_access, requires_password]);
                elem.onclick = (e) => {
                    e.preventDefault();
                    this.try_subscribe_to(item.id);
                }
                if (elem._hash == hash) return;
                elem._hash = hash;

                var handle = elem.querySelector(".handle");
                dom.set_attribute(elem, "href", `#${item.id}`);
                elem.querySelector(".name").textContent = item.name;
                elem.title = item.name;
                // toggle_class(elem, "unmovable", !item.movable);
                var icons = elem.querySelector(".icons");
                var icons_html = "";
                var option_data = { text: item.name, value: item.id };
                if (is_owner) {
                    // icons_html += `<i class="fas fa-user-tie"></i>`;
                    // option_data.text += ` [Owner]`;
                } else if (requires_password) {
                    icons_html += `<i class="fas fa-key"></i>`;
                    option_data.text += ` [Password]`;
                } else if (!requires_password && !has_access) {
                    icons_html += `<i class="fas fa-lock"></i>`;
                    option_data.text += ` [Locked]`;
                }
                elem.option_data = option_data;
                dom.toggle_class(elem, "locked", !has_access);
                var schedule_start_time = item.schedule_start_time ? +new Date(item.schedule_start_time) : 0;
                if (["starting", "stopping"].includes(state)) {
                    icons_html += `<i class="fas fa-sync fa-spin"></i>`;
                } else if (state === "started") {
                    icons_html += `<i class="fas fa-circle blinking"></i>`;
                } else if (schedule_start_time > Date.now()) {
                    icons_html += `<i class="far fa-clock"></i>`;
                }
                dom.set_inner_html(icons, icons_html);
                dom.toggle_class(elem, "active", is_active);
                dom.toggle_class(elem, "owned", is_owner);
                dom.toggle_class(elem, "live", state !== "stopped");
                return elem;
            },
        });
    }

    get_user(id) {
        for (var client of Object.values(this.$.clients)) {
            if (client.user.user_id == id) {
                return { "id": client.user.user_id, "username": client.user.username };
            }
        }
        return null;
    }

    get user_time_format() { return this.settings.get("time_display_ms") ? "h:mm:ss.SSS" : "h:mm:ss"; }

    async load_session() {
        var files = await this.open_file_dialog({ filter: [".json"] });
        var text = await read_file(files[0]);
        var data;
        try { data = JSON.parse(text); } catch {
            window.alert("Invalid livestreamer session file.");
            return;
        }
        if (data) {
            this.request("load_session", [data]);
        }
    }

    async save_session() {
        var data = await this.request("get_user_save_data");
        console.log(data);
        var name = `${utils.sanitize_filename(this.$._session.name)}-${utils.date_to_string()}`
        await save_local_file(`${name}.json`, JSON.stringify(data, null, "  "));
    }

    async toggle_help() {
        if (!this.help_container) {
            var a = $(await fetch("./help.html").then(d => d.text()));
            this.help_container = $(`<div class="help"></div>`)[0];
            var iframe = $(`<iframe frameBorder="0">`)[0];
            iframe.src = "./help.html";
            var close_button = $(`<button class="close"><i class="fas fa-times"></i></button>`)[0];
            this.help_container.append(close_button, iframe);
            this.elem.append(this.help_container);
            var close_button = this.help_container.querySelector("button.close");
            close_button.onclick = () => this.toggle_help();
        }
        dom.toggle_class(this.elem, "show-side-panel");
    }
    chapter_to_string(c, show_time = false) {
        var item = this.$._session.playlist[c.id];
        var title = c.title || (item ? item._get_pretty_name() : null);
        var parts = [`${String(c.index + 1).padStart(2, "0")}.`];
        if (title) parts.push(title);
        if (show_time) parts.push(`[${utils.seconds_to_timespan_str(c.start)}]`);
        return parts.join(" ");
    }

    /** @param {string|URL} uri */
    uri_to_elfinder_hash(uri) {
        if (!utils.is_uri(uri)) uri = utils.urlify(uri).toString();
        var volume = Object.values(this.$.volumes).find(v => uri.startsWith(v.uri));
        if (volume) {
            var relpath = uri.slice(volume.uri.length);
            relpath = decodeURIComponent(relpath);
            if (!relpath.startsWith("/")) relpath = "/" + relpath;
            return volume.elf_id + btoa(unescape(encodeURIComponent(relpath))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '.').replace(/\.+$/, '');
        }
    }

    alert_for_reload_of_current_item() {
        window.alert(`The item is currently playing and may require reloading to apply changes.`);
    }

    prompt_for_reload_of_current_item() {
        if (window.confirm(`The item is currently playing and some changes may require reloading to apply changes.\nDo you want to reload?`)) {
            app.request("playlist_reload_current", [true]);
        }
    }

    restart_targets(ids) {
        app.request("restart_targets", [ids]);
    }

    async new_session() {
        var name = await window.prompt("New session name", "");
        if (name === null) return;
        var id = await this.request("new_session", [name]);
        window.location.hash = id;
    }

    async get_media_info(filename) {
        if (filename in this.$._session.media_info) return this.$._session.media_info[filename];
        if (!(filename in this.media_info_promises)) {
            this.media_info_promises[filename] = app.request("get_media_info", [filename]).then((mi) => {
                this.media_info[filename] = mi;
                return mi;
            })
        }
        return this.media_info_promises[filename];
    }

    async open_file_dialog(options) {
        if (IS_ELECTRON) {
            var paths = await this.open_file_manager(options);
            return paths.map(p => ({ path: p, name: utils.basename(p) }));
        } else {
            var dialog_opts = {};
            if (options.filter) dialog_opts.accept = options.filter.join(", ");
            if (options.multiple) dialog_opts.multiple = !!options.multiple;
            return await dom.open_file_dialog(dialog_opts);
        }
    }

    get_file_manager_url(opts) {
        if (!this.$.conf.file_manager_url) return;
        var url = new URL(this.$.conf.file_manager_url);
        if (!opts) opts = {};
        var elfinder_options = {};
        if (opts.id != null) elfinder_options.id = opts.id;
        if (opts.multiple != null || opts.files != null || opts.folders != null) {
            if (!elfinder_options.commandsOptions) elfinder_options.commandsOptions = {};
            if (!elfinder_options.commandsOptions.getfile) elfinder_options.commandsOptions.getfile = {};
            if (opts.multiple != null) {
                elfinder_options.commandsOptions.getfile.multiple = !!opts.multiple;
            }
            if (opts.folders != null) {
                elfinder_options.commandsOptions.getfile.folders = !!opts.folders;
            }
        }
        if (opts.folders) {
            elfinder_options.onlyMimes = ["directory"];
        }
        if (opts.start) {
            var hash = app.uri_to_elfinder_hash(opts.start);
            if (hash) {
                url.hash = "#elf_" + hash;
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

    /** @typedef {{id:any, hidden_id:any, folders:boolean, files:boolean, multiple:boolean, filter:string[], start:string}} FileManagerOptions */

    /** @param {FileManagerOptions} options */
    async open_file_manager(options) {
        // console.log(options);
        options = {
            // "new_window" : app.settings.get("open_file_manager_in_new_window"),
            ...default_file_manager_options,
            ...options
        };

        if (!options.standalone && options.id === undefined) options.id = dom.uuidb64();
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
                electron_options.filters.push({ name: "All Files", extensions: ["*"] });
                var custom_ext = [];
                let mime_filters = [];
                for (var f of options.filter) {
                    mime_filters.push({ name: utils.capitalize(f), extensions: utils.mime_ext_map[f] || ["*"] });
                }
                if (mime_filters.length > 1) {
                    let names = [];
                    let extensions = [];
                    for (var f of mime_filters) {
                        names.push(f.name);
                        extensions.push(...f.extensions);
                    }
                    electron_options.filters.push({ name: names.join("/"), extensions: [...new Set(extensions)] })
                }
                electron_options.filters.push(...mime_filters);
                if (custom_ext.length) {
                    custom_ext = [...new Set(custom_ext)];
                    electron_options.filters.push({ name: "Custom File Type", extensions: custom_ext });
                }
            }
            var results = await electron.showOpenDialog(electron_options);
            if (results.cancelled) return null;
            return results.filePaths;
        } else if (app.$.processes["file-manager"]) {
            /** @type {Window} */
            var win;
            /** @type {FileManagerMenu} */
            var menu;
            var win_id = options.hidden_id || options.id;
            var use_window = options.new_window;
            var messenger = new dom.WindowCommunicator();
            return new Promise((resolve, reject) => {
                messenger.on("exit", ({ id }) => {
                    if (id != options.id) return;
                    resolve(null);
                });
                messenger.on("files", ({ files, id }) => {
                    if (id != options.id) return;
                    var paths = files.map(f => utils.pathify(f.uri) || f.uri);
                    resolve(paths);
                });

                var url = this.get_file_manager_url(options);

                if (use_window) {
                    win = windows[win_id];
                    if (!win || win.closed) {
                        win = window.open(url, `_blank`);
                        if (win_id) windows[win_id] = win;
                    }
                    win.focus();
                    win.addEventListener("beforeunload", (e) => {
                        e.preventDefault();
                        delete windows[win_id];
                        resolve();
                    });
                } else {
                    menu = new FileManagerMenu(url);
                    menu.show();
                    win = menu.iframe.contentWindow;
                    menu.once("hide", () => {
                        resolve();
                    });
                }
            }).finally(() => {
                messenger.destroy();
                if (use_window) win.close();
                else menu.hide();
            })
        } else {
            console.error("File Manager not present")
        }
    }

    start_stream(test = false) {
        app.request("start_stream", [{ "test": test }])
    }

    destroy() {
        for (var root of this.roots) root.destroy();
        this.removeAllListeners();
        // ui.destroy();
        // window.removeEventListener("keydown", this.on_keydown);
        // window.removeEventListener("hashchange", this.on_hashchange);
        // window.removeEventListener("beforeunload", this.beforeunload);
        // this.playlist.destroy();
    }
};

class Root extends ui.UI {
    constructor(elem) {
        super(elem);
        this.elem.id = "livestreamer";
        app.roots.add(this);
    }
    destroy() {
        app.roots.delete(this);
        super.destroy();
    }
}

let get_property_opts = function (prop, cb) {
    var filtered = {}, m;
    for (var k in prop) {
        if (m = k.match(/^__(default|min|max|step|options|info|label)__$/)) filtered[m[1]] = prop[k];
    }
    if (!filtered.options && typeof prop?.default === "boolean") filtered.options = YES_OR_NO;
    if (cb) filtered = cb(filtered);
    return filtered;
}

export default MainWebApp;