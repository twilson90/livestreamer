import * as utils from "../../../utils/exports.js";
import * as dom from "../../../utils/dom/exports.js";
import { $ } from '../../../jquery-global.js';
import Hls from "hls.js";
import videojs from "video.js/core.es.js";
import ResizeObserver from 'resize-observer-polyfill';

import "video.js/dist/video-js.css";
import "../../../utils/dom/dom.scss";
import './style.scss';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const crop_mode_key = "crop_mode2";
const TOUCH_TIMEOUT = 5000;
const MOUSE_TIMEOUT = 3000;
const SEEK_STAGGER = 500;
const ENABLE_SEEK_STAGGER = true;

var url = new URL(window.location.href);

const DEBUG = window.location.search.includes("debug");
const DEBUG_HLS = window.location.search.includes("debug-hls");

var conf;
var time_display_modes = [
    {
        "label": "Live Time",
        "icon": `<i class="far fa-clock"></i>`
    },
    {
        "label": "Time Remaining",
        "icon": `<i class="far fa-hourglass"></i>`
    }
];

var crop_modes = [
    {
        "label": "Auto",
        "icon": `Auto`,
        "value": "auto"
    },
    {
        "label": "16:9",
        "icon": `16:9`,
        "value": `16:9`,
    },
    {
        "label": "4:3",
        "icon": `4:3`,
        "value": `4:3`,
    },
    {
        "label": "Cover",
        "icon": `<div class="cover-icon" style="transform:scale(0.8)"><i class="fas fa-arrows-up-down"></i><i class="fas fa-arrows-left-right"></i></div>`,
        "value": "cover",
    },
    {
        "label": "Detect",
        "icon": `<i style="transform:scale(0.8)" class="fas fa-robot"></i>`,
        "value": "detect",
    },
    {
        "label": "None",
        "icon": `None`,
        "value": "none"
    },
];

var REGION_BUFFER = 10;
var ASPECT_BUFFER = 10;
var MIN_REGIONS_FIRST_CROP = 0;
const CROP_DETECT_INTERVAL = 1000;
const VIDEO_UI_UPDATE_INTERVAL = 100;
const IS_EMBED = window.parent !== window.self;

var settings = new dom.LocalStorageBucket("player-v2", {
    time_display_mode: 0,
    volume: 1,
    [crop_mode_key]: 0,
});
settings.load();

function toggleVolumeBoost(mediaElem, state) {
    if (!mediaElem._audioCtx) {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(mediaElem);
        const compressor = ctx.createDynamicsCompressor();
        const gainNode = ctx.createGain();

        // Good defaults ("night mode" leveling)
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        gainNode.gain.value = 2;

        // Initially connected normally
        source.connect(ctx.destination);

        mediaElem._audioCtx = ctx;
        mediaElem._source = source;
        mediaElem._compressor = compressor;
        mediaElem._gainNode = gainNode;
        mediaElem._boosted = false;
    }
    const ctx = mediaElem._audioCtx;
    const source = mediaElem._source;
    const compressor = mediaElem._compressor;
    const gainNode = mediaElem._gainNode;

    if (state === undefined) {
        state = !mediaElem._boosted;
    } else {
        state = !!state;
    }
    if (state) {
        connectChain([source, compressor, gainNode, ctx.destination]);
    } else {
        connectChain([source, ctx.destination]);
    }
    mediaElem._boosted = state;

}
function connectChain(nodes) {
    nodes.forEach(n => { try { n.disconnect(); } catch {} });
    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].connect(nodes[i + 1]);
    }
}

/** @type {MediaServerVideoPlayerWebApp} */
let app;
export class MediaServerVideoPlayerWebApp {
    /** @type {Player} */
    player;
    active = false;
    is_touch = navigator.maxTouchPoints > 0;

    constructor() {
        app = this;
        this.init();
    }

    async init() {

        this.container_el = $(`<div class="video-container"></div>`)[0];

        this.last_touch_time = 0;
        var timeout;
        var set_active = () => {
            this.active = true;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.active = false;
            }, this.is_touch ? TOUCH_TIMEOUT : MOUSE_TIMEOUT);
        }
        window.addEventListener('keydown', (e) => {
            set_active();
            var preventDefault = true;
            if (e.key == " " || e.key == "p") {
                if (this.player.player.paused()) this.player.player.play();
                else this.player.player.pause();
            } else if (e.key == "m") {
                this.player.player.controlBar.getChild("VolumePanel").getChild("MuteToggle").handleClick(e)
            } else if (e.key == "ArrowLeft") {
                this.player.player.currentTime(this.player.player.currentTime() - 10);
            } else if (e.key == "ArrowRight") {
                this.player.player.currentTime(this.player.player.currentTime() + 10);
            } else if (e.key == ".") {
                this.player.stepForward();
            } else if (e.key == ",") {
                this.player.stepBackward();
            } else {
                preventDefault = false;
            }
            if (preventDefault) e.preventDefault();
        }, true);
        window.addEventListener('touchmove', () => {
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);
        window.addEventListener('touchend', (e) => {
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);
        window.addEventListener('touchstart', (e) => {
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);

        // window.addEventListener("mouseenter", (e)=>{
        //     set_active();
        // }, true)
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType !== "touch") this.is_touch = false;
            set_active();
        }, true);

        document.body.append(this.container_el);

        if (IS_EMBED) document.documentElement.classList.add("embedded");

        conf = await (await fetch("../conf")).json();

        var params = new URLSearchParams(location.search);
        var autoplay = params.has("autoplay") == "1";
        this.src = new URL(`../media/live/${params.get("id")}/master.m3u8`, window.location.origin + window.location.pathname).toString();

        /* var menu = new dom.DropdownMenu({
            items: [
                {
                    label: ()=>`Toggle Debug Mode`,
                    click: ()=>{
                        DEBUG = !DEBUG;
                        this.update();
                        if (this.player) this.player.update_ratio();
                    },
                }
            ],
            trigger: "contextmenu",
            target: document.body,
            position: "trigger"
        }); */

        setInterval(() => {
            this.update();
        }, VIDEO_UI_UPDATE_INTERVAL);

        this.init_player(autoplay);
    }

    init_player(autoplay = false) {
        this.player?.destroy();
        this.player = new Player(this.src, autoplay);
    }

    update = dom.debounce_next_frame(() => this.#update());

    #update() {
        this.player?.update();
    }
}

class PlayButton {
    was_just_seeking = false;

    constructor() {
        /** @type {HTMLElement} */
        this.el = $(
            `<div class="play-button">
                <div class="play"><i class="fas fa-play"></i></div>
                <div class="ended"><div style="padding:10px">The stream has ended.</div><i class="fas fa-redo"></i></div>
            </div>`
        )[0];

        // <div class="pause"><i class="fas fa-pause"></i></div>
        this.el.addEventListener("click", (e) => {
            let vjs = app.player.player;
            if (vjs.paused() || !vjs.hasStarted_) {
                app.player.play()
            } else if (!app.is_touch) {
                vjs.pause();
            }
            this.update();
        });
        this.el = this.el;

        this.update();
    }

    update() {
        var showing = false;
        var paused = false;
        var ended = false;
        // var not_initialized = false;

        let vjs = app.player.player;
        ended = vjs.ended();
        paused = !ended && vjs.paused()

        showing = !!(ended || paused);
        this.el.querySelector(".play").classList.toggle("hidden", !paused);
        this.el.querySelector(".ended").classList.toggle("hidden", !ended);
        this.el.classList.toggle("hidden", !showing);
    }
}

class Player extends utils.EventEmitter {
    /** @type {Hls}*/
    hls;
    /** @type {import("video.js/dist/types/player").default & {liveTracker:import("video.js/dist/types/live-tracker").default}}*/
    player;
    #update_ratio_interval_id;
    destroyed = false;
    crop_detect = new CropDetect();
    current_frag_aspect_ratio = 0;
    full = false;

    get crop_mode() {
        var i = settings.get(crop_mode_key);
        return crop_modes[i] || crop_modes[0];
    }

    constructor(src, autoplay) {
        super();
        this.src = src;
        this.autoplay = autoplay;
        console.log(`Player ${JSON.stringify({ src, autoplay })}`);
        this.ready = this.#init();
        this.ready.then(() => this.update(true));
    }

    async update() {
        await this.ready;
        if (this.destroyed) return;

        var seekToLive = this.player.controlBar.getChild("SeekToLive");
        seekToLive.updateLiveEdgeStatus();

        var rate = this.player.playbackRate();
        var new_rate = rate;
        var is_live = false;
        if (this.player.liveTracker?.isLive()) {
            is_live = true;
            const liveCurrentTime = this.player.liveTracker?.liveCurrentTime();
            const currentTime = this.player.currentTime();
            let isBehind = Math.abs(liveCurrentTime - currentTime) > (this.player.liveTracker.options_.liveTolerance - 2);
            if (!isBehind) {
                new_rate = Math.min(1, rate);
            }
        }
        if (new_rate != rate) {
            this.player.playbackRate(new_rate);
        }

        this.player.el_.classList.toggle("is-live", is_live);

        this.play_button.update();

        var menus = this.get_active_menus();
        if (app.active || menus.length || this.player.controlBar.el_.classList.contains("mouseover")) {
            if (!this.player.userActive_) {
                this.player.userActive(true);
            }
        } else {
            if (this.player.userActive_) {
                this.player.userActive(false);
            }
        }
        this.player.el_.classList.toggle("is-touch", app.is_touch);

        let c1 = this.current_frag_aspect_ratio;
        let c2 = 0;
        if (this.crop_mode.value == "auto") {
            //
        } else if (this.crop_mode.value == "cover") {
            c1 = this.current_frag_aspect_ratio;
            c2 = window.innerWidth / window.innerHeight;
            this.player.el_.classList.toggle("cover-horizontal", c1 < c2);
        } else if (this.crop_mode.value == "detect") {
            this.crop_detect.init(this.video_el);
            let ar = this.crop_detect.aspect_ratio?.value;
            if (ar) c1 = ar;
        } else if (this.crop_mode.value == "none") {
            c1 = 0;
        } else {
            c1 = this.crop_mode.value;
        }
        this.player.el_.classList.toggle("crop-enabled", this.crop_mode.value != "none");
        apply_crop(this.video_el, c1, c2);
        this.cropMenuButton.update_display();


        if (window.parent) {
            try {
                window.parent.postMessage({
                    type: "video-status",
                    data: {
                        origin: window.location.href,
                        ended: !!this.player?.ended()
                    }
                }, new URL(window.location.href).searchParams.get("origin") || window.location.origin)
            } catch (e) {
                // console.error(e);
            }
        }
    }
    get_active_menus() {
        return [...this.player.el_.querySelectorAll(".vjs-menu.vjs-lock-showing")];
    }

    get hls_level_details() {
        return this.hls?.levels?.[this.hls.currentLevel]?.details;
    }

    async #init() {
        let _this = this;
        var Component = videojs.getComponent("Component");
        var Button = videojs.getComponent("Button");
        var MenuButton = videojs.getComponent("MenuButton");
        var MenuItem = videojs.getComponent("MenuItem");
        var Menu = videojs.getComponent("Menu");
        var ProgressControl = videojs.getComponent("ProgressControl");
        var VolumeControl = videojs.getComponent("VolumeControl");
        var MouseTimeDisplay = videojs.getComponent("MouseTimeDisplay");
        var PlaybackRateMenuButton = videojs.getComponent("PlaybackRateMenuButton");
        var PlaybackRateMenuItem = videojs.getComponent("PlaybackRateMenuItem");
        var LoadProgressBar = videojs.getComponent("LoadProgressBar");

        {
            function textContent(el, text) {
                if (typeof el.textContent === 'undefined') {
                    el.innerText = text;
                } else {
                    el.textContent = text;
                }
                return el;
            }
            const percentify = (time, end) => utils.clamp(time / end * 100, 0, 100).toFixed(2) + '%';
            let update = LoadProgressBar.prototype.update;
            LoadProgressBar.prototype.update = function (...args) {
                this.requestNamedAnimationFrame('LoadProgressBar#update', () => {
                    let details = _this.hls_level_details
                    let liveTracker = this.player_.liveTracker;
                    let buffered = this.player_.buffered();
                    let duration = liveTracker && liveTracker.isLive() ? liveTracker.seekableEnd() : this.player_.duration();
                    let bufferedEnd = this.player_.bufferedEnd();
                    let diff = 0;
                    if (details?.live) {
                        duration = details.totalduration
                        if (bufferedEnd > duration) {
                            diff = bufferedEnd - duration;
                            bufferedEnd = duration;
                        }
                    }
                    const children = this.partEls_;
                    const percent = percentify(bufferedEnd, duration);
                    if (this.percent_ !== percent) {
                        this.el_.style.width = percent;
                        textContent(this.percentageEl_, percent);
                        this.percent_ = percent;
                    }

                    // add child elements to represent the individual buffered time ranges
                    for (let i = 0; i < buffered.length; i++) {
                        let part = children[i];
                        let start = buffered.start(i) - diff - (details?.targetduration ?? 0);
                        let end = buffered.end(i) - diff;
                        if (!part) {
                            part = this.el_.appendChild($(`<div></div>`)[0]);
                            children[i] = part;
                        }

                        //  only update if changed
                        if (part.dataset.start === start && part.dataset.end === end) {
                            continue;
                        }
                        part.dataset.start = start;
                        part.dataset.end = end;
                        part.style.left = percentify(start, bufferedEnd);
                        part.style.width = percentify(end - start, bufferedEnd);
                    }

                    // remove unused buffered range elements
                    for (let i = children.length; i > buffered.length; i--) {
                        this.el_.removeChild(children[i - 1]);
                    }
                    children.length = buffered.length;
                });
            }
        }

        var walk = (component, cb) => {
            cb(component);
            if (component.children_) {
                for (var c of component.children_) {
                    walk(c, cb);
                }
            }
        };

        var close_menus = (except) => {
            walk(_this.player, (c) => {
                if (c instanceof MenuButton && c != except) c.unpressButton();
            });
        }
        let lockShowing = Component.prototype.lockShowing;
        Component.prototype.lockShowing = function (...args) {
            close_menus(this.menuButton_);
            return lockShowing.apply(this, args);
        }

        var ProgressControl_enable = ProgressControl.prototype.enable;
        ProgressControl.prototype.enable = function (...args) {
            this.handleMouseMove = ProgressControl.prototype.handleMouseMove;
            return ProgressControl_enable.apply(this, args);
        }

        // var VolumeControl_constructor = VolumeControl.prototype.constructor;
        // VolumeControl.prototype.constructor = function(...args) {
        //   var ret = VolumeControl_constructor.apply(this, args);
        //   this.throttledHandleMouseMove = this.handleMouseMove;
        //   return ret;
        // };

        // var MouseTimeDisplay_constructor = MouseTimeDisplay.prototype.constructor;

        // MouseTimeDisplay.prototype.constructor = function(...args) {
        //   var ret = MouseTimeDisplay_constructor.apply(this, args);
        //   this.el_.setAttribute('draggable', false)
        //   this.el_.ondragstart = ()=>false;
        //   return ret;
        // };

        function disable_drag(el) {
            el.setAttribute('draggable', false);
            el.ondragstart = (e) => {
                e.preventDefault();
                return false;
            }
        }
        function pauseEvent(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
            e.cancelBubble = true;
            e.returnValue = false;
            return false;
        }

        class StopButton extends Button {
            constructor(player, options) {
                super(player, options);
                this.stop_icon = $(`<i class="fas fa-stop" style="font-size: 140%;">`)[0];
                this.el_.prepend(this.stop_icon);
                this.controlText("Stop");
            }
            handleClick(event) {
                app.init_player(false);
            }
            buildCSSClass() {
                return `vjs-stop-control vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("stopButton", StopButton);
        class HLSSelectMenuButton extends MenuButton {
            constructor(player, options) {
                super(player, {
                    levels: [],
                    title: "Quality",
                    ...options,
                });
                this.controlText("Quality");
                this.update_display();
            }
            buildWrapperCSSClass() {
                return `vjs-level-select ${super.buildWrapperCSSClass()}`;
            }
            buildCSSClass() {
                return `vjs-level-select ${super.buildCSSClass()}`;
            }
            update() {
                super.update();
                this.update_display();
            }
            update_display() {
                var level = _this.hls?.currentLevel;
                var next_level = _this.hls?.nextLoadLevel;
                var item = this.items.find(i => i.level.value == level);
                var next_item = this.items.find(i => i.level.value == next_level);
                var str = (next_level == level) ? `${item?.level.text || "-"}` : `${next_item?.level.text || "-"}*`;
                if (!this.label2) {
                    this.label2 = $(`<div class="label2">`)[0];
                    this.menuButton_.el_.prepend(this.label2);
                }
                var ctext = str;
                this.update_selection();
                var selected = this.items.find(item => item.isSelected_);
                if (selected?.level.value == -1) {
                    ctext = `${ctext} (Auto)`;
                }
                this.controlText(ctext);
                this.label2.innerHTML = str;
            }
            createItems() {
                this.hideThreshold_ = 0;
                var levels = (_this.hls?.levels || []).map((l, i) => {
                    return { value: i, text: l.height + "p", bitrate: l.bitrate }
                }).filter(l => l)
                levels = utils.sort(levels, l => -l.bitrate);
                levels.unshift({ value: -1, text: "Auto", bitrate: 0 });
                // this.requestAnimationFrame(()=>this.update_selection());
                return levels.map((level) => {
                    var item = new MenuItem(this.player_, { label: level.text, selectable: true });
                    item.level = level;
                    item.handleClick = () => {
                        _this.set_preferred_level(level.value, true);
                        this.update_selection();
                    };
                    return item;
                });
            }

            update_selection() {
                var level = _this.get_preferred_level();
                var found = false;
                for (var item of this.items) {
                    item.selected(item.level.value == level);
                    if (item.level.value == level) found = true;
                }
            }
        }
        videojs.registerComponent("hlsSelectMenuButton", HLSSelectMenuButton);

        class CropMenuButton extends MenuButton {
            constructor(player, options) {
                super(player, {
                    title: "Crop",
                    className: "",
                    ...options,
                });
                this.controlText("Crop");
                this.update_display();
            }
            buildWrapperCSSClass() {
                return `vjs-crop-toggle ${super.buildWrapperCSSClass()}`;
            }
            buildCSSClass() {
                return `vjs-crop-toggle ${super.buildCSSClass()}`;
            }
            update() {
                super.update();
                this.update_display();
            }
            update_display() {
                this.update_selection();
                var c = settings.get(crop_mode_key) || 0;
                var d = crop_modes[c];
                if (d) {
                    if (!this.label2) {
                        this.label2 = $(`<div class="label2">`)[0];
                        this.menuButton_.el_.prepend(this.label2);
                    }
                    this.label2.innerHTML = d.icon;
                    this.label2.dataset.ratio = d.value;
                    var ctext = d.label;
                    if (d.value === "auto") {
                        let c = utils.nearest_aspect_ratio(_this.current_frag_aspect_ratio).name;
                        ctext = `${ctext} (${c})`;
                    }
                    if (d.value === "detect") {
                        let c = _this.crop_detect.aspect_ratio?.name;
                        ctext = `${ctext} (${c})`;
                    }
                    this.controlText(ctext);
                }
            }
            createItems() {
                this.hideThreshold_ = 1;
                return crop_modes.map((m, i) => {
                    var item = new MenuItem(this.player_, { label: m.label, selectable: true });
                    item.handleClick = () => {
                        settings.set(crop_mode_key, i);
                        this.update_display();
                    };
                    return item;
                });
            }
            update_selection() {
                var m = settings.get(crop_mode_key);
                this.items.forEach((item, i) => {
                    item.selected(i == m);
                });
            }
        }
        videojs.registerComponent("cropMenuButton", CropMenuButton);

        class TimeDisplayToggle extends Button {
            constructor(player, options) {
                super(player, options);
                this.icon = document.createElement("div");
                this.icon.classList.add("icon");
                this.el_.prepend(this.icon);
                this.update();
            }
            handleClick(event) {
                settings.set("time_display_mode", (settings.get("time_display_mode") + 1) % time_display_modes.length);
                remainingTimeDisplay.update();
                this.update();
            }
            update() {
                // console.log("time_display_mode", time_display_mode)
                var c = time_display_modes[settings.get("time_display_mode")];
                if (c) {
                    this.icon.innerHTML = c.icon;
                    this.controlText(`Time Display Mode: ${c.label}`);
                }
            }
            buildCSSClass() {
                return `vjs-time-display-toggle vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("timeDisplayToggle", TimeDisplayToggle);

        class LoadFullPlaylistButton extends Button {
            constructor(player, options) {
                super(player, options);
                this.icon = document.createElement("div");
                this.icon.classList.add("icon");
                this.icon.innerHTML = `<i class="fas fa-backward-step"></i>`;
                this.el_.prepend(this.icon);
                this.controlText("Load Full Playlist");
                this.update();
            }
            update() { }
            handleClick(event) {
                _this.load_full_playlist();
            }
            buildCSSClass() {
                return `vjs-load-full-stream-button vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("loadFullPlaylistButton", LoadFullPlaylistButton);

        var fix_time_ranges = (time_ranges) => {
            const hls = _this.hls;
            const details = hls?.levels?.[hls.currentLevel]?.details;
            if (details?.live) {
                let adjustedRanges = [];
                var [live_start, live_end] = [Math.max(0, details.driftEnd - details.totalduration), details.driftEnd];
                var live_window_length = live_end - live_start; // = details.totalduration
                for (let i = 0; i < time_ranges.length; i++) {
                    let start = time_ranges.start(i);
                    let end = time_ranges.end(i);
                    // start = Math.max(start, end - details.totalduration);
                    start = utils.map_range(start, live_start, live_end, 0, live_window_length);
                    end = utils.map_range(end, live_start, live_end, 0, live_window_length);
                    adjustedRanges.push({ start, end });
                }
                return createTimeRanges(adjustedRanges);
            } else {
                return time_ranges;
            }
        }
        const Html5 = videojs.getTech('Html5');
        class HlsHtml5 extends Html5 {
            // seekable() {
            //     return fix_time_ranges(super.seekable());
            // }
            // buffered() {
            //     return fix_time_ranges(super.buffered());
            // }
        }
        videojs.registerTech('HlsHtml5', HlsHtml5);

        console.log("Setting up video.js...");

        /** @type {HTMLVideoElement} */
        var video_el = $(`<video class="video-js" preload="auto" width="1280" height="720"></video>`)[0];
        app.container_el.append(video_el);
        video_el.addEventListener('click', e => {
            e.stopPropagation();
            return false;
        }, true);
        video_el.tabIndex = -1;

        this.player = videojs(video_el, {
            // fluid: true,
            autoplay: this.autoplay && !isIOS,
            playsinline: true,
            muted: this.autoplay && isIOS,
            // fluid: true,
            playbackRates: [0.5, 1, 1.25, 1.5, 2], // , -1
            controls: true,
            responsive: true,
            liveui: true,
            enableSmoothSeeking: true,
            inactivityTimeout: 0,
            // nativeControlsForTouch: true,
            techOrder: ['HlsHtml5'], // use your custom tech first

            /* html5: {
                vhs: {
                    overrideNative: true,
                }
            }, */
            // html5: {
            //     hls: {
            //         overrideNative: true
            //     }
            // },

            // experimentalSvgIcons: true,
            liveTracker: {
                trackingThreshold: 0,
                liveTolerance: 6
                // trackingThreshold: 0,
                // liveTolerance: 0.5
            },
            controlBar: {
                progressControl: {
                    keepTooltipsInside: true
                },
                skipButtons: {
                    forward: 30,
                    backward: 10,
                },
                volumePanel: {
                    inline: true
                },
                children: [
                    'loadFullPlaylistButton',
                    "stopButton",
                    'playToggle',
                    'skipBackward',
                    'skipForward',
                    'volumePanel',
                    'currentTimeDisplay',
                    'timeDivider',
                    'durationDisplay',
                    'progressControl',
                    'liveDisplay',
                    'seekToLive',
                    'remainingTimeDisplay',
                    'customControlSpacer',
                    "timeDisplayToggle",
                    "cropMenuButton",
                    'playbackRateMenuButton',
                    'chaptersButton',
                    'descriptionsButton',
                    'subsCapsButton',
                    'audioTrackButton',
                    "hlsSelectMenuButton",
                    // 'pictureInPictureToggle',
                    'fullscreenToggle'
                ],
                volumePanel: {
                    inline: false,
                    vertical: true
                }
            }
        });

        await new Promise(resolve => this.player.ready(resolve));

        var container_el = this.player.el();
        /** @type {HTMLVideoElement} */
        this.video_el = video_el = container_el.querySelector("video"); // may have changed... if iOS is to be believed.
        video_el.disablePictureInPicture = true;

        video_el.removeAttribute("tabindex");
        video_el.playsInline = true;
        this.stepper = new FrameStepper(video_el);

        console.log("video.js ready.");

        var c1 = $(`<div class="outer-crop"></div>`)[0];
        var c2 = $(`<div class="inner-crop"></div>`)[0];

        this.play_button = new PlayButton();
        c1.append(c2);
        c2.append(video_el);
        container_el.prepend(c1, this.play_button.el);

        // player.on("seeked",(e)=>this.update_play_button(e));
        // seekBarPlayProgressBar.__proto__.update.apply(seekBarPlayProgressBar);

        var player_playbackRate = this.player.playbackRate;
        var auto_playback_rate = true;

        this.player.playbackRate = function (rate) {
            if (rate === undefined) {
                if (auto_playback_rate) return -1;
                return player_playbackRate.apply(this);
            } else {
                auto_playback_rate = rate === -1;
                if (rate !== -1) return player_playbackRate.apply(this, [rate]);
            }
        }

        this.player.on('volumechange', () => {
            settings.set("volume", this.player.muted() ? 0 : this.player.volume())
        });
        this.player.volume(settings.get("volume"));

        /** @type {import("video.js/dist/types/control-bar/control-bar").default}*/
        var controlBar = this.player.controlBar;

        controlBar.el_.addEventListener("mouseover", () => controlBar.el_.classList.add("mouseover"))
        controlBar.el_.addEventListener("mouseout", () => controlBar.el_.classList.remove("mouseover"))

        /** @type {import("video.js/dist/types/control-bar/seek-to-live").default}*/
        var seekToLive = controlBar.getChild("SeekToLive");
        (() => {
            var last_text;
            var seektolive_wrapper_el = $(`<div class="seek-to-live-wrapper"></div>`)[0];
            seekToLive.el_.after(seektolive_wrapper_el);
            seektolive_wrapper_el.append(seekToLive.el_);
            seekToLive.handleClick = function (e) {
                _this.seekToLiveEdge();
                _this.player.play();
            }
            var old_updateLiveEdgeStatus = seekToLive.updateLiveEdgeStatus;
            seekToLive.updateLiveEdgeStatus = function () {
                old_updateLiveEdgeStatus.apply(this);
                var stl_text;
                var behindLiveEdge = _this.player.liveTracker.behindLiveEdge();
                if (behindLiveEdge) {
                    stl_text = `[${_this.get_time_string(-_this.get_time_until_live_edge_area(), true)}]`;
                } else {
                    stl_text = "LIVE";
                }
                if (last_text != stl_text) {
                    last_text = stl_text
                    this.textEl_.innerHTML = stl_text;
                }
            }
        })();
        /** @type {import("video.js/dist/types/control-bar/time-controls/remaining-time-display").default}*/
        var remainingTimeDisplay = controlBar.getChild("RemainingTimeDisplay");
        (() => {
            var first;
            remainingTimeDisplay.updateContent = function () {
                if (!first) this.el_.querySelector(`[aria-hidden="true"]`)?.remove();
                this.contentEl_.innerHTML = _this.get_time_string(_this.player.currentTime(), true);
                first = true;
            }
            remainingTimeDisplay.updateContent();
        })();
        /** @type {import("video.js/dist/types/control-bar/fullscreen-toggle").default}*/
        var fullscreenToggle = controlBar.getChild("FullscreenToggle");
        /** @type {import("video.js/dist/types/control-bar/volume-panel").default}*/
        var volumePanel = controlBar.getChild("VolumePanel");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-control").default}*/
        var volumeControl = volumePanel.getChild("VolumeControl");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-bar").default}*/
        var volumeBar = volumeControl.getChild("VolumeBar");
        (() => {
            var wrapper_el = $(`<div class="volume-bar-wrapper"></div>`)[0];
            var outer_el = $(`<div class="volume-bar-outer"></div>`)[0];
            var boost_button = $(`<button class="vjs-control vjs-button vjs-volume-boost"><i class="fas fa-volume-high"><i class="fas fa-plus"></i></button>`)[0];
            volumeBar.el_.after(wrapper_el);
            wrapper_el.append(boost_button);
            wrapper_el.append(outer_el);
            outer_el.append(volumeBar.el_);
            boost_button.title = "Volume Boost";
            var boost = false;
            wrapper_el.onmousemove = (e)=>{
                var r = boost_button.getBoundingClientRect();
                wrapper_el.classList.toggle("disable-tooltip", e.clientY < r.top + r.height);
            }
            boost_button.onmouseout = (e)=>{
                wrapper_el.classList.remove("disable-tooltip");
            }
            boost_button.onpointerdown = (e)=>{
                if (videojs.dom.isSingleLeftClick(e)) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    boost = !boost;
                    boost_button.classList.toggle("active", boost);
                    // amplifyMedia(_this.video_el, boost ? 3 : 1);
                    toggleVolumeBoost(_this.video_el, boost);
                }
            }
        })();
        // /** @type {import("video.js/dist/types/control-bar/volume-control/volume-level").default}*/
        // var volumeLevel = volumeBar.getChild("VolumeLevel");
        /** @type {TimeDisplayToggle} */
        var timeDisplayToggle = controlBar.getChild("TimeDisplayToggle");
        /** @type {LoadFullPlaylistButton} */
        var loadFullPlaylistButton = controlBar.getChild("LoadFullPlaylistButton");
        /** @type {import("video.js/dist/types/control-bar/volume-control/mouse-volume-level-display").default}*/
        var volumeBarMouseTimeDisplay = volumeBar.getChild('MouseVolumeLevelDisplay');
        /** @type {import("video.js/dist/types/control-bar/progress-control/progress-control").default}*/
        var progressControl = controlBar.getChild('progressControl');
        /** @type {import("video.js/dist/types/control-bar/progress-control/seek-bar").default}*/
        var seekBar = progressControl.getChild('seekBar');
        /** @type {import("video.js/dist/types/control-bar/progress-control/mouse-time-display").default}*/
        var seekBarMouseTimeDisplay = seekBar.getChild('mouseTimeDisplay');
        /** @type {import("video.js/dist/types/control-bar/progress-control/play-progress-bar").default}*/
        var seekBarPlayProgressBar = seekBar.getChild('playProgressBar');
        /** @type {import("video.js/dist/types/control-bar/playback-rate-menu/playback-rate-menu-button").default}*/
        var controlplaybackRateMenuButton = controlBar.getChild('playbackRateMenuButton');


        this.hlsSelectMenuButton = this.player.controlBar.getChild("hlsSelectMenuButton");
        this.cropMenuButton = this.player.controlBar.getChild('cropMenuButton');

        volumeBar.update();

        var tech = this.player.tech(true);

        if (ENABLE_SEEK_STAGGER && SEEK_STAGGER > 0) {
            let time;
            let setCurrentTime = tech.setCurrentTime;
            let setScrubbing = tech.setScrubbing;
            let currentTime = tech.currentTime;
            let debounced_setCurrentTime = utils.debounce(setCurrentTime, SEEK_STAGGER);
            tech.setScrubbing = function (...args) {
                if (!args[0] && this.isScrubbing_) {
                    setCurrentTime.apply(this, [time])
                }
                return setScrubbing.apply(this, args);
            }
            tech.currentTime = function (...args) {
                if (this.isScrubbing_) {
                    return time
                }
                return currentTime.apply(this, args);
            }
            tech.setCurrentTime = function (...args) {
                time = args[0];
                if (this.isScrubbing_) {
                    return debounced_setCurrentTime.apply(this, args);
                }
                return setCurrentTime.apply(this, args);
            };
        }

        // control_bar_wrapper.append(progressControl.el_);
        /* {
            var children = [...controlBar.el_.children];
            var os = dom.OverlayScrollbars(controlBar.el_, {});
            var scroll_inner = os.elements().viewport;
            for (var c of children) scroll_inner.append(c);
        } */
        controlplaybackRateMenuButton.menu.contentEl_.prepend(...$(`<li class="vjs-menu-title" tabindex="-1">Speed</li>`))

        if (conf.logo_url) {
            // let target = IS_EMBED ? `_parent` : `_blank`;
            let target = `_blank`;
            dom.load_image("../logo").then(img => {
                this.logo_el = $(`<a target="${target}" class="logo" href="${conf.logo_url}"></a>`)[0];
                this.logo_el.append(img);
                controlBar.el_.append(this.logo_el);
            })
        }

        if (volumeBarMouseTimeDisplay) {
            volumeBarMouseTimeDisplay.update = volumeBarMouseTimeDisplay.__proto__.update;
            var volumeControl_handleMouseDown = volumeControl.handleMouseDown;
            volumeControl.handleMouseDown = function (event) {
                volumeControl_handleMouseDown.apply(this, [event]);
                volumeBar.handleMouseDown(event);
                pauseEvent(event);
            };
            // volumeControl.handleMouseMove = function(e) {
            //     volumeBar.handleMouseMove(e);
            //     const progress = volumeBar.getProgress();
            //     volumeBar.bar.el().style.width = (progress * 100).toFixed(2) + '%';
            // }
        } else {
            // mobile
            // volumeControl.el_.style.display = "none";
        }

        if (seekBarMouseTimeDisplay) {
            const timeTooltip = seekBarMouseTimeDisplay.getChild('timeTooltip');
            seekBarMouseTimeDisplay.update = function (seekBarRect, seekBarPoint) {
                const time = seekBarPoint * this.player_.duration();
                timeTooltip.updateTime(seekBarRect, seekBarPoint, time);
                this.el_.style.left = seekBarRect.width * seekBarPoint;
            };
            timeTooltip.update = function (seekBarRect, seekBarPoint, content) {
                this.write(content);
                seekBarMouseTimeDisplay.el_.style.left = `${seekBarRect.width * seekBarPoint}px`;
                var w = this.el_.offsetWidth;
                var x = seekBarRect.width * seekBarPoint;
                var left = utils.clamp(x, w / 2, window.innerWidth - w / 2);
                var cx = Math.round(left - x - w / 2);
                this.el_.style.transform = `translateX(${cx}px)`;
            };
            timeTooltip.updateTime = function (seekBarRect, seekBarPoint, time) {
                const liveWindow = _this.player.liveTracker.liveWindow();
                if (_this.player.liveTracker?.isLive()) time = (1-seekBarPoint) * -liveWindow;
                let content = _this.get_time_string(time, true);
                this.update(seekBarRect, seekBarPoint, content);
            };
        }

        this.player.on("error", (e) => {
            console.error(e);
        });
        this.player.on("pause", () => {
            this.update()
        });
        var was_seeking = false;
        this.player.on("seeking", () => {
            was_seeking = true;
            this.update()
        });
        this.player.on("play", () => {
            if (was_seeking) {
                was_seeking = false;
                this.crop_detect.clear_buffer();
            }
            this.update()
        });
        this.player.on("ended", (e) => this.update());
        this.player.liveTracker.on("liveedgechange", () => this.update());

        video_el.addEventListener("error", (e) => {
            console.log(e);
        });

        this.resize_observer = new ResizeObserver(() => {
            this.update();
            this.resize();
        });
        this.resize_observer.observe(controlBar.el_);

        this.player.el_.addEventListener('click', (e) => {
            close_menus();
        });
        this.player.el_.addEventListener('touchend', (e) => {
            if (this.player.hasStarted_ && (Date.now() - this.active_ts) < 200) {
                e.preventDefault();
            }
        }, true);


        if (!window.__first_player_init) {
            window.__first_player_init = true;
            this.init_hls();
        }

        if (this.autoplay) {
            console.log("Attempting autoplay...")
            return new Promise((resolve, reject) => {
                this.play().then(resolve);
                setTimeout(() => reject("Autoplay timed out."), 2000);
            }).catch((e) => console.error(e))
        }
    }

    stepForward() {
        this.player.pause();
        this.stepper.stepForward();
    }

    stepBackward() {
        this.player.pause();
        this.stepper.stepBackward();
    }

    play() {
        this.init_hls();
        return this.player.play();
    }

    init_hls(full = false) {
        if (this.hls && full == this.full) return;

        this.full = full;

        class pLoader extends Hls.DefaultConfig.loader {
            constructor(config) {
                super(config);
                var load = this.load.bind(this);
                this.load = function (context, config, callbacks) {
                    if (full) {
                        let url = new URL(context.url);
                        url.searchParams.set("full", "1");
                        context.url = url.toString();
                    }
                    var onSuccess = callbacks.onSuccess;
                    callbacks.onSuccess = function (response, stats, context) {
                        onSuccess(response, stats, context);
                    };
                    load(context, config, callbacks);
                };
            }
        }

        if (this.hls) {
            this.hls.removeAllListeners();
            this.hls.detachMedia();
        }

        this.hls = new Hls({
            enableWorker: false,
            lowLatencyMode: true,
            // debug: !!import.meta.env.DEV,

            manifestLoadPolicy: {
                default: {
                    maxTimeToFirstByteMs: Infinity,
                    maxLoadTimeMs: 20000,
                    timeoutRetry: {
                        maxNumRetry: 5,
                        retryDelayMs: 0,
                        maxRetryDelayMs: 0,
                    },
                    errorRetry: {
                        maxNumRetry: 5,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 8000,
                        shouldRetry: (retryConfig, retryCount, isTimeout, httpStatus, retry) => {
                            if (httpStatus.code == 404) return true;
                            return retry;
                        }
                    },
                },
            },
            pLoader,
            startPosition: full ? 0 : undefined,
            maxBufferLength: 10, // minimum guaranteed buffer length
            backBufferLength: 60,
            maxMaxBufferLength: 60, // max seconds to buffer
            liveDurationInfinity: true, // I guess this gets overriden to false if the hls source is ongoing (no end)
            liveSyncDurationCount: 2, // # of segments to buffer before playing
            progressive: true, // experimental
            // maxLiveSyncPlaybackRate: 1.5,

            // -----
            debug: DEBUG_HLS
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            this.player.el_.classList.add("hls-loaded")
            this.set_preferred_level(this.get_preferred_level());
            this.hlsSelectMenuButton.update();
        });
        this.hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
            if (!data.frag?.tagList) return;
            for (var tag of data.frag.tagList) {
                if (tag[0] === "EXT-X-ASPECT") {
                    this.current_frag_aspect_ratio = +tag[1];
                }
            }
            this.cropMenuButton?.update_display();
            this.hlsSelectMenuButton.update_display();
        });
        this.hls_start_ts = Number.MAX_SAFE_INTEGER;
        this.hls_end_ts = Number.MIN_SAFE_INTEGER;
        this.hls.on(Hls.Events.FRAG_PARSED, (event, data) => {
            if (data.frag.programDateTime > this.hls_end_ts) {
                this.hls_end_ts = data.frag.programDateTime;
            }
            if (data.frag.programDateTime < this.hls_start_ts) {
                this.hls_start_ts = data.frag.programDateTime;
            }
            this.hls_offset = this.hls_end_ts - Date.now();
        });
        this.hls.on(Hls.Events.LEVEL_SWITCHING, () => {
            this.hlsSelectMenuButton.update_display()
        });
        this.hls.on(Hls.Events.LEVEL_SWITCHED, () => {
            this.hlsSelectMenuButton.update_display()
        });
        this.hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            if (data.details.live) {
                const windowDuration = data.details.totalduration; // DVR window length (sliding playlist)
                // force video.js to treat this as duration
                this.player.tech_.duration(windowDuration);
            }
        });

        this.hls.loadSource(this.src);
        this.hls.attachMedia(this.video_el);

        // this.hls.media.srcObject.setLiveSeekableRange(0, 600)
        var stall_timeout;
        this.hls.on(Hls.Events.ERROR, (e, error) => {
            /* if (data.fatal && data.type == "mediaError") {
                this.hls.recoverMediaError();
            } */
            if (error.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                setTimeout(() => {
                    console.log("Resetting HLS level errors.");
                    Object.values(this.hls.levels).forEach(l => l.loadError = 0);
                    Object.values(this.hls.levels).forEach(l => l.fragmentError = 0);
                }, 5000);
            }

            if (error.type == "mediaError") {
                if (error.details == "bufferStalledError") {
                    // clearTimeout(stall_timeout);
                    // let time = this.hls.media.currentTime;
                    // stall_timeout = setTimeout(()=>{
                    //     if (this.hls.media.currentTime == time) {
                    //         console.log(`Buffer stalled and not recovered. Attempting nudge at ${this.hls.media.currentTime}...`)
                    //         this.hls.media.currentTime += 0.01
                    //     }
                    // },1000)
                } else {
                    if (error.fatal) this.hls.recoverMediaError()
                }
            }
            console.error(error.error.message, error);
        });
    }

    async load_full_playlist() {
        this.init_hls(true);
        this.player.currentTime(0);
        this.player.play();
    }

    resize() {
        var menus = [...(this.player?.el_?.querySelectorAll(".vjs-menu-content") ?? [])];
        var border = 6; // 0.5em;
        var s = getComputedStyle(this.player.el_)["font-size"];
        if (s.match(/px$/)) border = parseFloat(s) / 2;
        for (var menu of menus) {
            menu.style.left = "";
            var rect = menu.getBoundingClientRect();
            var offset = 0;
            if (rect.x < border) offset = border - rect.x;
            if (rect.right > (window.innerWidth - border)) offset = window.innerWidth - border - rect.right;
            menu.style.left = `${offset}px`;
        }
    }

    set_preferred_level(level, save) {
        if (this.hls) {
            this.hls.nextLevel = this.hls.loadLevel = level;
        }
        if (save) localStorage.setItem("level", level);
    }

    get_preferred_level() {
        var level = +localStorage.getItem("level");
        if (isNaN(level)) level = -1;
        var num_levels = this.hls?.levels.length || 0;
        if (level > -1 && level < num_levels) return level;
        return -1;
    };

    seekToLiveEdge() {
        if (this.hls?.media) {
            const livePosition = this.hls.latencyController.liveSyncPosition;
            if (livePosition !== null) {
                this.hls.media.currentTime = livePosition;
            }
        }
    }

    get_time_until_live_edge_area(use_latency) {
        const liveCurrentTime = utils.try_catch(() => this.player.liveTracker.liveCurrentTime(), 0);
        const currentTime = this.player.currentTime();
        return Math.max(0, Math.abs(liveCurrentTime - currentTime) - (use_latency ? this.hls?.targetLatency : 0));
    };

    /**
     * @param {number} time - time in seconds from live edge
     * @returns {string} - time string
     */
    get_time_string(time, format = false) {
        let mode = settings.get("time_display_mode");
        let duration = this.player.duration();
        let str = "";
        if (this.player.liveTracker?.isLive()) {
            if (mode == 0) {
                let ts = time < 0 ? Date.now() + this.hls_offset + time * 1000 : Date.now() + this.hls_offset - duration;
                str = new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: "2-digit" });
            }
            if (mode == 1) {
                str = (format ? `-` : "") + videojs.time.formatTime(Math.abs(time), this.player.liveTracker.liveWindow());
            }
        } else {
            if (mode == 0) {
                let ts = this.hls_start_ts + (time * 1000);
                str = new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: "2-digit" });
            }
            if (mode == 1) {
                str = (format ? `-` : "") + videojs.time.formatTime(duration - time, duration);
            }
        }
        if (str === "Invalid Date") str = "-";
        return str;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.player) this.player.dispose();
        if (this.hls) this.hls.destroy();
        this.resize_observer.disconnect();
        if (this.crop_detect) this.crop_detect.destroy();
        clearInterval(this.#update_ratio_interval_id);
    }
}

class CropDetect {
    /** @type {HTMLVideoElement} */
    #video_el;
    /** @type {HTMLCanvasElement} */
    canvas;
    region_buffer = [];
    /** @type {utils.AspectRatio[]} */
    aspect_ratio_buffer = [];
    /** @type {utils.AspectRatio} */
    aspect_ratio = null;
    region;
    #ready;
    #crop_detect_interval;

    get ready() { return this.#ready; }
    get vw() { return this.#video_el.videoWidth; }
    get vh() { return this.#video_el.videoHeight; }

    constructor(video_el) {
        this.#video_el = video_el;
    }

    clear_buffer() {
        this.region_buffer = [];
    }

    init(video_el) {
        if (this.#video_el == video_el) return;
        this.#video_el = video_el;
        this.#ready = this.#ready ?? new Promise(resolve => {
            this.#video_el.addEventListener("loadeddata", resolve)
            if (this.#video_el.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
        }).then(() => {
            this.#crop_detect_interval = setInterval(() => {
                this.update();
            }, CROP_DETECT_INTERVAL);
        })
        return this.#ready;
    }

    async update() {

        await this.#ready;

        if (this.destroyed) return;

        let { vw, vh } = this;
        if (vw == 0 || vh == 0) return;

        // let ar = utils.nearest(vw / vh, (4/3), (16/9));
        let ar = vw / vh;

        var dimensions = JSON.stringify([vw, vh]);
        if (this._last_dimensions != dimensions) {
            this._last_dimensions = dimensions;
            if (this.canvas) this.canvas.remove();
            /** @type {HTMLCanvasElement} */
            this.canvas = document.createElement('canvas');
            this.canvas.style.zIndex = 1000;
            this.canvas.height = 120;
            this.canvas.width = this.canvas.height * ar;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            Object.assign(this.canvas.style, { "position": "absolute", "top": "0", "right": "0", "pointer-events": "none" });
        }

        let x0 = 0, y0 = 0, ow = this.canvas.width, oh = this.canvas.height;
        let x1 = ow, y1 = oh;
        let tx, ty;
        let threshold = 0x11;
        this.ctx.filter = "grayscale(100%) contrast(1.05)";
        this.ctx.drawImage(this.#video_el, 0, 0, x1, y1);
        this.ctx.filter = "none";
        let data = this.ctx.getImageData(0, 0, x1, y1).data;
        var row = (y) => {
            for (tx = x0; tx < x1; tx++) if (data[(y * ow + tx) * 4] > threshold) return true;
        };
        var col = (x) => {
            for (ty = y0; ty < y1; ty++) if (data[(ty * ow + x) * 4] > threshold) return true;
        };

        for (; y0 < y1; y0++) if (row(y0 + 1)) break;
        for (; x0 < x1; x0++) if (col(x0 + 1)) break;
        for (; y1 >= 0; y1--) if (row(y1 - 1)) break;
        for (; x1 >= 0; x1--) if (col(x1 - 1)) break;

        x0 /= ow; x1 /= ow; y0 /= oh; y1 /= oh;
        var r = { x0, y0, x1, y1 };

        this.push_region(r);

        // if (app.player.crop_button) app.player.crop_button.update();
    }

    push_region(r) {
        var { x0, x1, y0, y1 } = r;
        var w = Math.min(1, x1 - x0);
        var h = Math.min(1, y1 - y0);
        if (w < 0.75 && h < 0.75) return;
        let ar = (w * this.vw) / (h * this.vh);
        if (ar < 0.5 || ar > 4) return;
        var nearest_aspect_ratio = utils.nearest_aspect_ratio(ar);
        var rel = calculateRelativeSize(ar, nearest_aspect_ratio.value)
        if (rel.width < 0.8 || rel.height < 0.8) return;

        this.region_buffer.push(r);
        this.aspect_ratio_buffer.push(nearest_aspect_ratio);

        while (this.region_buffer.length > REGION_BUFFER) this.region_buffer.shift();
        if (this.region_buffer.length < MIN_REGIONS_FIRST_CROP) return;

        while (this.aspect_ratio_buffer.length > ASPECT_BUFFER) this.aspect_ratio_buffer.shift();
        if (this.aspect_ratio_buffer.length < MIN_REGIONS_FIRST_CROP) return;

        x0 = 0;
        x1 = 0;
        y0 = 0;
        y1 = 0;
        for (var r of this.region_buffer) {
            x0 += r.x0;
            x1 += r.x1;
            y0 += r.y0;
            y1 += r.y1;
        }
        x0 /= this.region_buffer.length;
        x1 /= this.region_buffer.length;
        y0 /= this.region_buffer.length;
        y1 /= this.region_buffer.length;

        this.region = { x0, x1, y0, y1 };

        this.aspect_ratio = most_common(this.aspect_ratio_buffer);
    }

    async destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        await this.#ready;
        clearInterval(this.#crop_detect_interval);
        if (this.canvas) this.canvas.remove();
    }
}

function calculateRelativeSize(outerAspectRatio, innerAspectRatio) {
    if (innerAspectRatio > outerAspectRatio) {
        return {
            width: 1,
            height: (outerAspectRatio / innerAspectRatio)
        };
    } else {
        return {
            width: (innerAspectRatio / outerAspectRatio),
            height: 1
        };
    }
}

/** @param {HTMLVideoElement} video */
function apply_crop(video, ar1, ar2) {
    if (!video) return;
    var c1 = video.parentElement;
    if (!c1) return;
    let vw = video.videoWidth || 0;
    let vh = video.videoHeight || 0;
    crop_ar(video, vw / vh, ar1, false);
    crop_ar(c1, ar1, ar2, true);
}

var fix_ar = (ar) => {
    if (typeof ar == "string") {
        let m;
        if (m = ar.match(/^([\d.]+):([\d.]+)$/)) {
            ar = +m[1] / +m[2];
        }
    }
    return ar;
}

var crop_ar = (el, ar1, ar2, clip = false) => {
    ar1 = fix_ar(ar1);
    ar2 = fix_ar(ar2);
    let w = 1;
    let h = 1;
    if (ar1 && ar2) {
        let tmp = calculateRelativeSize(ar1, ar2);
        w = tmp.width;
        h = tmp.height;
    }

    let cw = 0, ch = 0;
    if (ar1 && clip) {
        const container_w = window.innerWidth / w;
        const container_h = window.innerHeight / h;
        const container_ratio = container_w / container_h;
        if (container_ratio > ar1) {
            const new_width = container_h * ar1;
            const crop_x = (container_w - new_width) / 2;
            cw = (crop_x / container_w) * 100;
        } else {
            const new_height = container_w / ar1;
            const crop_y = (container_h - new_height) / 2;
            ch = (crop_y / container_h) * 100;
        }
    }

    const epsilon = 0.01;
    // el.style.transition = immediate ? "none" : "";
    el.style.width = `${100 / w}%`;
    el.style.height = `${100 / h}%`;
    // if (!DEBUG) {
    //     el.style.clipPath = (ch > epsilon || cw > epsilon) ? `inset(${ch}% ${cw}%)` : "";
    // }
}

class FrameStepper {
    /** @param {HTMLVideoElement} video */
    constructor(video, opts = {}) {
        this.video = video;
        this.eps = opts.eps ?? 1e-4;               // tolerance for float comparisons (~0.1 ms)
        this.defaultFPS = opts.defaultFPS ?? 30;   // fallback before we have data
        this.deltaWindow = opts.deltaWindow ?? 15; // rolling window size
        this.deltas = [];                           // recent frame deltas (seconds)
        this.lastMediaTime = null;
        this.lastPresentedFrames = 0;

        if (this.video.requestVideoFrameCallback) {
            this.enabled = true;
            // Start a persistent rVFC loop to keep state fresh
            const track = (now, md) => {
                if (this.lastMediaTime != null) {
                    const d = md.mediaTime - this.lastMediaTime;
                    if (d > this.eps) this.#pushDelta(d);
                }
                this.lastMediaTime = md.mediaTime;
                this.lastPresentedFrames = md.presentedFrames;
                this.video.requestVideoFrameCallback(track);
            };
            this.video.requestVideoFrameCallback(track);


            var primeOnce = () => {
                this.video.requestVideoFrameCallback((_, md) => {
                    this.lastMediaTime = md.mediaTime;
                    this.lastPresentedFrames = md.presentedFrames;
                });
            }
            // Prime state soon after metadata is ready (covers paused-at-load)
            if (video.readyState >= 1) {
                primeOnce();
            } else {
                video.addEventListener('loadeddata', () => primeOnce(), { once: true });
            }
        } else {
            this.enabled = false;
        }
    }

    #pushDelta(d) {
        this.deltas.push(d);
        if (this.deltas.length > this.deltaWindow) this.deltas.shift();
    }

    #medianDelta() {
        if (!this.deltas.length) return 1 / this.defaultFPS;
        const a = [...this.deltas].sort((x, y) => x - y);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    }

    #seekTo(time) {
        return new Promise(resolve => {
            const onFrame = (now, md) => resolve(md);
            this.video.requestVideoFrameCallback(onFrame);
            this.video.currentTime = Math.max(0, Math.min(time, isFinite(this.video.duration) ? this.video.duration : time));
        });
    }

    async stepForward() {
        if (!this.enabled) return;
        if (this.stepping) return;
        this.stepping = true;
        const start = this.lastMediaTime ?? this.video.currentTime;
        const delta = this.#medianDelta();
        let target = start + delta;

        // Seek and ensure we actually advanced at least ~one frame.
        let md = await this.#seekTo(target);
        let tries = 0;
        while ((md.mediaTime <= start + this.eps || md.presentedFrames <= this.lastPresentedFrames) && tries < 6) {
            // Nudge further if we landed on the same frame (typical with GOP/keyframe constraints)
            target += delta / 4;
            md = await this.#seekTo(target);
            tries++;
        }
        this.stepping = false;
        return md.mediaTime;
    }

    async stepBackward() {
        if (!this.enabled) return;
        if (this.stepping) return;
        this.stepping = true;
        const start = this.lastMediaTime ?? this.video.currentTime;
        const delta = this.#medianDelta();
        let target = Math.max(0, start - delta);

        let md = await this.#seekTo(target);
        let tries = 0;
        while ((md.mediaTime >= start - this.eps || md.presentedFrames >= this.lastPresentedFrames) && tries < 6) {
            // Nudge closer if we didn’t actually move to an earlier frame
            target = Math.max(0, target - delta / 4);
            md = await this.#seekTo(target);
            tries++;
        }
        this.stepping = false;
        return md.mediaTime;
    }
}

function crop_difference(a, b) {
    return Math.abs(b.x0 - a.x0) + Math.abs(b.y0 - a.y0) + Math.abs(b.x1 - a.x1) + Math.abs(b.y1 - a.y1);
}
function createTimeRanges(ranges) {
    return {
        length: ranges.length,
        start: (index) => ranges[index].start,
        end: (index) => ranges[index].end
    };


}
function most_common(arr) {
    const counts = new Map();
    for (const val of arr) {
        counts.set(val, (counts.get(val) || 0) + 1);
    }
    let maxCount = 0;
    let mostCommonVal = null;
    for (const [val, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonVal = val;
        }
    }
    return mostCommonVal;
}



export default MediaServerVideoPlayerWebApp;