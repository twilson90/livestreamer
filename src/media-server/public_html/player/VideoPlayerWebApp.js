import * as utils from "../../../utils/exports.js";
import * as dom from "../../../utils/dom/exports.js";
import {$} from '../../../jquery-global.js';
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
        "icon": `<i style="transform:scale(0.8)" class="fas fa-arrows-up-down"></i>`, 
        "value": "cover",
    },
    /* {
        "label": "21:9",
        "icon": `21:9`,
        "value": 21/9,
    }, */
];

var DEBUG = false;
var REGION_BUFFER = 10;
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
        var set_active = ()=>{
            this.active = true;
            clearTimeout(timeout);
            timeout = setTimeout(()=>{
                this.active = false;
            }, this.is_touch ? TOUCH_TIMEOUT : MOUSE_TIMEOUT);
        }
        window.addEventListener('keydown', (e)=>{
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
        window.addEventListener('touchmove', ()=>{
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);
        window.addEventListener('touchend', (e)=>{
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);
        window.addEventListener('touchstart', (e)=>{
            this.last_touch_time = Date.now();
            this.is_touch = true;
            set_active();
        }, true);

        // window.addEventListener("mouseenter", (e)=>{
        //     set_active();
        // }, true)
        window.addEventListener('pointermove', (e)=>{
            if (e.pointerType !== "touch") this.is_touch = false;
            set_active();
        }, true);

        document.body.append(this.container_el);

        if (IS_EMBED) document.documentElement.classList.add("embedded");
        
        conf = await (await fetch("/conf")).json();

        var params = new URLSearchParams(location.search);
        var autoplay = params.get("autoplay") == "1";
        this.src = new URL(`/media/live/${params.get("id")}/master.m3u8`, window.location.origin+window.location.pathname).toString();

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
        
        setInterval(()=>{
            this.update();
        }, VIDEO_UI_UPDATE_INTERVAL);

        this.init_player(autoplay);
    }

    init_player(autoplay=false) {
        this.player?.destroy();
        this.player = new Player(this.src, autoplay);
    }
    
    update = dom.debounce_next_frame(()=>this.#update());
    
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
        this.el.addEventListener("click", (e)=>{
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
    // crop_detect = new CropDetect();
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
        console.log(`Player ${JSON.stringify({src,autoplay})}`);
        this.ready = this.#init();
        this.ready.then(()=>this.update(true));
    }

    async update() {
        await this.ready;
        if (this.destroyed) return;
        this.emit("update");
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

        var walk = (component, cb)=>{
            cb(component);
            if (component.children_) {
                for (var c of component.children_) {
                    walk(c, cb);
                }
            }
        };

        var get_active_menus = ()=>{
            return [...this.player.el_.querySelectorAll(".vjs-menu.vjs-lock-showing")];
        }
        var close_menus = (except)=>{
            walk(_this.player, (c)=>{
                if (c instanceof MenuButton && c != except) c.unpressButton();
            });
        }
        let lockShowing = Component.prototype.lockShowing;
        Component.prototype.lockShowing = function(...args) {
            close_menus(this.menuButton_);
            return lockShowing.apply(this, args);
        }

        var ProgressControl_enable = ProgressControl.prototype.enable;
        ProgressControl.prototype.enable = function(...args) {
            this.handleMouseMove = ProgressControl.prototype.handleMouseMove;
            return ProgressControl_enable.apply(this, args);
        }

        this.on("update", ()=>{
            var d = this.get_time_until_live_edge_area(true);
            var behindLiveEdge = this.player.liveTracker.behindLiveEdge();
            var is_live = this.player.liveTracker.isLive();
            var rate = this.player.playbackRate();
            var at_live_edge = d <= 0;
            var new_rate = at_live_edge ? Math.min(1, rate) : rate;
            if (new_rate != rate) {
                this.player.playbackRate(new_rate);
            }

            this.player.el_.classList.toggle("is-live", is_live);

            if (seekToLive) {
                var stl_text;
                if (behindLiveEdge) {
                    if (settings.get("time_display_mode") == 0) {
                        stl_text = "["+this.get_live_time(0, this.player.currentTime())+"]"
                    } else {
                        stl_text = `[-${videojs.time.formatTime(this.get_time_until_live_edge_area())}]`
                    }
                } else {
                    stl_text = "LIVE";
                }
                if (seekToLive.last_text != stl_text) {
                    seekToLive.last_text = stl_text
                    seekToLive.textEl_.innerHTML = stl_text;
                }
            }

            this.play_button.update();

            var menus = get_active_menus();
            if (app.active || menus.length || controlBar.el_.classList.contains("mouseover")) {
                if (!this.player.userActive_) {
                    this.player.userActive(true);
                }
            } else {
                if (this.player.userActive_) {
                    this.player.userActive(false);
                }
            }
            this.player.el_.classList.toggle("is-touch", app.is_touch);
        
            let c1 = this.crop_mode.value;
            let c2 = 0;
            if (c1 == "auto") {
                // crop = this.crop_detect.nearest_crop;
                c1 = this.current_frag_aspect_ratio;
            } else if (c1 == "cover") {
                c1 = this.current_frag_aspect_ratio;
                c2 = window.innerWidth / window.innerHeight;
            }

            apply_crop(this.video_el, c1, c2);
        })
        
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
            el.ondragstart = (e)=>{
                e.preventDefault();
                return false;
            }
        }
        function pauseEvent(e){
            if(e.stopPropagation) e.stopPropagation();
            if(e.preventDefault) e.preventDefault();
            e.cancelBubble=true;
            e.returnValue=false;
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
                    className: "", 
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
                var item = this.items.find(i=>i.level.value == level);
                var next_item = this.items.find(i=>i.level.value == next_level);
                var str = (next_level == level) ? `${item?.level.text || "-"}` : `${next_item?.level.text || "-"}*`;
                if (!this.label2) {
                    this.label2 = $(`<div class="label2">`)[0];
                    this.menuButton_.el_.prepend(this.label2);
                }
                var ctext = str;
                this.update_selection();
                var selected = this.items.find(item=>item.isSelected_);
                if (selected?.level.value == -1) {
                    ctext = `${ctext} (Auto)`;
                }
                this.controlText(ctext);
                this.label2.innerHTML = str;
            }
            createItems() {
                this.hideThreshold_ = 0;
                var levels = (_this.hls?.levels || []).map((l,i)=>{
                    return {value:i, text:l.height+"p", bitrate:l.bitrate}
                }).filter(l=>l)
                levels = utils.sort(levels, l=>-l.bitrate);
                levels.unshift({value:-1, text:"Auto", bitrate:0});
                // this.requestAnimationFrame(()=>this.update_selection());
                return levels.map((level)=>{
                    var item = new MenuItem(this.player_, { label: level.text, selectable: true });
                    item.level = level;
                    item.handleClick = ()=>{
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
                        ctext = `${c} (${ctext})`;
                    }
                    this.controlText(ctext);
                }
            }
            createItems() {
                this.hideThreshold_ = 1;
                return crop_modes.map((m,i)=>{
                    var item = new MenuItem(this.player_, { label: m.label, selectable: true });
                    item.handleClick = ()=>{
                        settings.set(crop_mode_key, i);
                        this.update_display();
                    };
                    return item;
                });
            }
            update_selection() {
                var m = settings.get(crop_mode_key);
                this.items.forEach((item, i)=> {
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
                settings.set("time_display_mode", (settings.get("time_display_mode")+1) % time_display_modes.length)
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
            handleClick(event) {
                _this.load_full_playlist();
            }
            update() {
                // this.controlText(`Time Display Mode: ${c.label}`);
            }
            buildCSSClass() {
                return `vjs-load-full-stream-button vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("loadFullPlaylistButton", LoadFullPlaylistButton);

        console.log("Setting up video.js...");
        
        /** @type {HTMLVideoElement} */
        var video_el = $(`<video class="video-js" preload="auto" width="1280" height="720"></video>`)[0];
        app.container_el.append(video_el);

        this.player = videojs(video_el, {
            // fluid: true,
            autoplay: this.autoplay && !isIOS,
            playsinline: isIOS,
            muted: this.autoplay && isIOS,
            // fluid: true,
            playbackRates: [0.5, 1, 1.25, 1.5, 2], // , -1
            controls: true,
            responsive: true,
            liveui: true,
            enableSmoothSeeking: true,
            inactivityTimeout: 0,
            // nativeControlsForTouch: true,
            
            /* html5: {
                hls: {
                    overrideNative: true
                }
            }, */
            
            // experimentalSvgIcons: true,
            liveTracker: {
                trackingThreshold: 0,
                liveTolerance: 10
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

        await new Promise(resolve=>this.player.ready(resolve));

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

        this.player.playbackRate = function(rate){
            if (rate === undefined) {
                if (auto_playback_rate) return -1;
                return player_playbackRate.apply(this);
            } else {
                auto_playback_rate = rate === -1;
                if (rate !== -1) return player_playbackRate.apply(this, [rate]);
            }
        }

        this.player.on('volumechange', ()=>{
            settings.set("volume", this.player.muted() ? 0 : this.player.volume())
        });
        this.player.volume(settings.get("volume"));

        /** @type {import("video.js/dist/types/control-bar/control-bar").default}*/
        var controlBar = this.player.controlBar;

        controlBar.el_.addEventListener("mouseover", ()=>controlBar.el_.classList.add("mouseover"))
        controlBar.el_.addEventListener("mouseout", ()=>controlBar.el_.classList.remove("mouseover"))

        /** @type {import("video.js/dist/types/control-bar/seek-to-live").default}*/
        var seekToLive = controlBar.getChild("SeekToLive");
        /** @type {import("video.js/dist/types/control-bar/fullscreen-toggle").default}*/
        var fullscreenToggle = controlBar.getChild("FullscreenToggle");
        /** @type {import("video.js/dist/types/control-bar/volume-panel").default}*/
        var volumePanel = controlBar.getChild("VolumePanel");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-control").default}*/
        var volumeControl = volumePanel.getChild("VolumeControl");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-bar").default}*/
        var volumeBar = volumeControl.getChild("VolumeBar");
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

        volumeBar.update();

        var tech = this.player.tech(true);
        
        if (ENABLE_SEEK_STAGGER && SEEK_STAGGER > 0) {
            let time;
            let setCurrentTime = tech.setCurrentTime;
            let setScrubbing = tech.setScrubbing;
            let currentTime = tech.currentTime;
            let debounced_setCurrentTime = utils.debounce(setCurrentTime, SEEK_STAGGER);
            tech.setScrubbing = function(...args) {
                if (!args[0] && this.isScrubbing_) {
                    setCurrentTime.apply(this, [time])
                }
                return setScrubbing.apply(this, args);
            }
            tech.currentTime = function(...args) {
                if (this.isScrubbing_) {
                    return time
                }
                return currentTime.apply(this, args);
            }
            tech.setCurrentTime = function(...args) {
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

        this.seektolive_wrapper_el = $(`<div>`)[0];
        this.seektolive_wrapper_el.classList.add("seek-to-live-wrapper");
        seekToLive.el_.after(this.seektolive_wrapper_el);
        this.seektolive_wrapper_el.append(seekToLive.el_);
        var seekToLive_handleClick = seekToLive.handleClick;
        seekToLive.handleClick = function(e) {
            _this.seekToLiveEdge();
            _this.player.play();
        }
        
        if (conf.logo_url) {
            // let target = IS_EMBED ? `_parent` : `_blank`;
            let target = `_blank`;
            dom.load_image("/logo").then(img=>{
                this.logo_el = $(`<a target="${target}" class="logo" href="${conf.logo_url}"></a>`)[0];
                this.logo_el.append(img);
                controlBar.el_.append(this.logo_el);
            })
        }

        if (volumeBarMouseTimeDisplay) {
            volumeBarMouseTimeDisplay.update = volumeBarMouseTimeDisplay.__proto__.update;
            var volumeControl_handleMouseDown = volumeControl.handleMouseDown;
            volumeControl.handleMouseDown = function(event) {
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
            seekBarMouseTimeDisplay.update = function(seekBarRect, seekBarPoint) {
                const time = seekBarPoint * this.player_.duration();
                timeTooltip.updateTime(seekBarRect, seekBarPoint, time);
                this.el_.style.left = seekBarRect.width * seekBarPoint;
            };
            timeTooltip.update = function (seekBarRect, seekBarPoint, content) {
                this.write(content);
                seekBarMouseTimeDisplay.el_.style.left = `${seekBarRect.width * seekBarPoint}px`;
                var w = this.el_.offsetWidth;
                var x = seekBarRect.width * seekBarPoint;
                var left = utils.clamp(x, w/2, window.innerWidth-w/2);
                var cx = Math.round(left - x - w/2);
                this.el_.style.transform = `translateX(${cx}px)`;
            };
            timeTooltip.updateTime = function(seekBarRect, seekBarPoint, time) {
                const liveWindow = _this.player.liveTracker.liveWindow();
                var time = seekBarPoint * liveWindow
                let content = _this.get_live_time(settings.get("time_display_mode"), time);
                this.update(seekBarRect, seekBarPoint, content);
            };
        }

        this.player.on("error", (e)=>{
            console.error(e);
        });
        this.player.on("pause",()=>{
            this.update()
        });
        var was_seeking = false;
        this.player.on("seeking",()=>{
            was_seeking = true;
            this.update()
        });
        this.player.on("play",()=>{
            if (was_seeking) {
                was_seeking = false;
                // this.crop_detect.clear_buffer();
            }
            this.update()
        });
        this.player.on("ended",(e)=>this.update());
        this.player.liveTracker.on("liveedgechange", ()=>this.update());

        // this.crop_detect.init(video_el);

        video_el.addEventListener("error", (e)=>{
            console.log(e);
        });

        this.resize_observer = new ResizeObserver(()=>{
            this.update();
            this.resize();
        });
        this.resize_observer.observe(controlBar.el_);
        
        this.player.el_.addEventListener('click', (e)=>{
            close_menus();
        });
        this.player.el_.addEventListener('touchend', (e)=>{
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
            return new Promise((resolve,reject)=>{
                this.play().then(resolve);
                setTimeout(()=>reject("Autoplay timed out."), 2000);
            }).catch((e)=>console.error(e))
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
                    // if (context.type == 'level') {
                    // }
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
                        shouldRetry: (retryConfig, retryCount, isTimeout, httpStatus,retry)=>{
                            if (httpStatus.code == 404) return true;
                            return retry;
                        }
                    },
                },
            },
            pLoader,
            startPosition: full ? 0 : undefined,
            maxBufferLength: 10, // minimum guaranteed buffer length
            maxMaxBufferLength: 20, // max seconds to buffer
            liveDurationInfinity: true, // I guess this gets overriden to false if the hls source is ongoing (no end)
            liveSyncDurationCount: 2, // # of segments to buffer before playing
            // progressive: true, // experimental
            // maxLiveSyncPlaybackRate: 1.5,

            // -----
            // debug: true
        });
        
        var hlsSelectMenuButton = this.player.controlBar.getChild("hlsSelectMenuButton");
        this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data)=>{
            this.set_preferred_level(this.get_preferred_level());
            hlsSelectMenuButton.update();
        });
        this.hls.on(Hls.Events.FRAG_CHANGED, (event, data)=>{
            if (!data.frag?.tagList) return;
            for (var tag of data.frag.tagList) {
                if (tag[0] === "EXT-X-ASPECT") {
                    this.current_frag_aspect_ratio = +tag[1];
                }
            }
            var cropMenuButton = this.player.controlBar.getChild('cropMenuButton');
            cropMenuButton.update_display();
            hlsSelectMenuButton.update_display();
        });
        this.hls.on(Hls.Events.LEVEL_SWITCHING, ()=>{
            hlsSelectMenuButton.update_display()
        });
        this.hls.on(Hls.Events.LEVEL_SWITCHED, ()=>{
            hlsSelectMenuButton.update_display()
        });

        this.hls.loadSource(this.src);
        this.hls.attachMedia(this.video_el);

        // this.hls.media.srcObject.setLiveSeekableRange(0, 600)
        var stall_timeout;
        this.hls.on(Hls.Events.ERROR, (e, data)=>{
            /* if (data.fatal && data.type == "mediaError") {
                this.hls.recoverMediaError();
            } */
            if (data.type == "mediaError") {
                if (data.details == "bufferStalledError") {
                    // clearTimeout(stall_timeout);
                    // let time = this.hls.media.currentTime;
                    // stall_timeout = setTimeout(()=>{
                    //     if (this.hls.media.currentTime == time) {
                    //         console.log(`Buffer stalled and not recovered. Attempting nudge at ${this.hls.media.currentTime}...`)
                    //         this.hls.media.currentTime += 0.01
                    //     }
                    // },1000)
                } else {
                    if (data.fatal) app.player.hls.recoverMediaError()
                }
            }
            console.error(data);
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

    get_preferred_level(){
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

    get_time_until_live_edge_area(use_latency){
        const liveCurrentTime = utils.try_catch(()=>this.player.liveTracker.liveCurrentTime(), 0);
        const currentTime = this.player.currentTime();
        return Math.max(0, Math.abs(liveCurrentTime - currentTime) - (use_latency ? this.hls?.targetLatency : 0));
    };

    get_live_time(mode, time){
        const duration = this.player.duration();
        if (this.player.liveTracker && this.player.liveTracker.isLive()) {
            const liveWindow = this.player.liveTracker.liveWindow();
            const secondsBehind = liveWindow - time;
            if (mode == 0) {
                return new Date(Date.now()-secondsBehind*1000).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit', second: "2-digit"}) // hour12: true
            } else if (mode == 1) {
                return (secondsBehind < 1 ? '' : '-') + videojs.time.formatTime(secondsBehind, liveWindow);
            }
        } else {
            return videojs.time.formatTime(time, duration);
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.player) this.player.dispose();
        if (this.hls) this.hls.destroy();
        this.resize_observer.disconnect();
        // if (this.crop_detect) this.crop_detect.destroy();
        clearInterval(this.#update_ratio_interval_id);
    }
}

// class CropDetect {
//     /** @type {HTMLVideoElement} */
//     #video_el;
//     /** @type {HTMLCanvasElement} */
//     canvas;
//     /** @type {Crop[]} */
//     buffer = [];
//     region = new Crop();
//     nearest_crop = new Crop();
//     #ready;
//     #crop_detect_interval;

//     get ready() { return this.#ready; }
//     get vw() { return this.#video_el.videoWidth; }
//     get vh() { return this.#video_el.videoHeight; }

//     constructor(video_el) {
//         this.#video_el = video_el;
//     }

//     clear_buffer() {
//         this.buffer = [];
//     }

//     init(video_el) {
//         this.#video_el = video_el;
//         this.#ready = this.#ready ?? new Promise(resolve=>{
//             this.#video_el.addEventListener("loadeddata", resolve)
//             if (this.#video_el.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
//         }).then(()=>{
//             this.#crop_detect_interval = setInterval(()=>{
//                 this.update();
//             }, CROP_DETECT_INTERVAL);
//         })
//         return this.#ready;
//     }
    
//     async update() {
        
//         await this.#ready;

//         if (this.destroyed) return;

//         let {vw,vh} = this;
//         if (vw == 0 || vh == 0) return;

//         // let ar = utils.nearest(vw / vh, (4/3), (16/9));
//         let ar = vw / vh;
        
//         var dimensions = JSON.stringify([vw,vh]);
//         if (this._last_dimensions != dimensions) {
//             this._last_dimensions = dimensions;
//             if (this.canvas) this.canvas.remove();
//             /** @type {HTMLCanvasElement} */
//             this.canvas = document.createElement('canvas');
//             this.canvas.style.zIndex = 1000;
//             this.canvas.height = 120;
//             this.canvas.width = this.canvas.height * ar;
//             this.ctx = this.canvas.getContext('2d', {willReadFrequently:true});
//             Object.assign(this.canvas.style, {"position":"absolute", "top":"0","right":"0", "pointer-events":"none"});
//         }
        
//         let x0=0, y0=0, ow=this.canvas.width, oh=this.canvas.height;
//         let x1=ow, y1=oh;
//         let tx, ty;
//         let threshold = 0x11;
//         this.ctx.filter = "grayscale(100%) contrast(1.05)";
//         this.ctx.drawImage(this.#video_el, 0, 0, x1, y1);
//         this.ctx.filter = "none";
//         let data = this.ctx.getImageData(0,0, x1, y1).data;
//         var row = (y)=>{
//             for (tx=x0; tx<x1; tx++) if (data[(y*ow+tx)*4]>threshold) return true;
//         };
//         var col = (x)=>{
//             for (ty=y0; ty<y1; ty++) if (data[(ty*ow+x)*4]>threshold) return true;
//         };

//         for (;y0<y1;y0++) if (row(y0+1)) break;
//         for (;x0<x1;x0++) if (col(x0+1)) break;
//         for (;y1>=0;y1--) if (row(y1-1)) break;
//         for (;x1>=0;x1--) if (col(x1-1)) break;

//         x0/=ow; x1/=ow; y0/=oh; y1/=oh;
//         var r = new Crop({x0,y0,x1,y1});
//         if (!r.valid) return;

//         this.push_region(r);
        
//         this.nearest_crop = [...crops].sort((a,b)=>{
//             return a.difference(this.region) - b.difference(this.region);
//         })[0];
//         if (app.player.crop_button) app.player.crop_button.update();
//     }
    
//     /** @param {Region} r */
//     push_region(r) {
//         this.buffer.push(r);
//         while (this.buffer.length > REGION_BUFFER) this.buffer.shift();
//         if (this.buffer.length < MIN_REGIONS_FIRST_CROP) return;

//         let x0=0,x1=0,y0=0,y1=0;
//         for (var r of this.buffer) {
//             x0+=r.x0; x1+=r.x1; y0+=r.y0; y1+=r.y1;
//         }
//         x0 /= this.buffer.length;
//         x1 /= this.buffer.length;
//         y0 /= this.buffer.length;
//         y1 /= this.buffer.length;
//         this.region = new Crop({x0,x1,y0,y1});
//     }

//     /** @param {Crop} r */
//     draw_rect(r, color="red", thickness=1, dashed=false){
//         if (!this.ctx) return;
//         let {x0,y0,x1,y1} = r;
//         let ow = this.canvas.width;
//         let oh = this.canvas.height;
//         this.ctx.strokeStyle = color;
//         this.ctx.lineWidth = thickness;
//         this.ctx.setLineDash(Array.isArray(dashed) ? dashed : dashed ? [2, 2] : []);
//         x0 = Math.floor(x0 * (ow-thickness) + thickness/2);
//         y0 = Math.floor(y0 * (oh-thickness) + thickness/2);
//         x1 = Math.ceil(x1 * (ow-thickness) + thickness/2);
//         y1 = Math.ceil(y1 * (oh-thickness) + thickness/2);
//         this.ctx.strokeRect(x0, y0, x1-x0, y1-y0);
//     }

//     async destroy() {
//         if (this.destroyed) return;
//         this.destroyed = true;
//         await this.#ready;
//         clearInterval(this.#crop_detect_interval);
//         if (this.canvas) this.canvas.remove();
//     }
// }

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

/** @param {HTMLVideoElement} video @param {number} ar */
function apply_crop(video, ar1, ar2) {
    if (!video) return;
    var c1 = video.parentElement;
    if (!c1) return;
    // c1 -> c2 -> video

    let vw = video.videoWidth || 0;
    let vh = video.videoHeight || 0;

    /* let cw, ch;
    if (typeof ar == "number") {
        let tmp = calculateRelativeSize(vw / vh, ar);
        cw = tmp.width;
        ch = tmp.height;
    } else {
        cw = vw;
        cw = vh;
    } */

    // let par = vw / vh;
    // let car = (cw * vw) / (ch * vh);
    // let war = window.innerWidth / window.innerHeight;

    var fix_ar = (ar)=>{
        if (typeof ar == "string") {
            let m;
            if (m = ar.match(/^([\d.]+):([\d.]+)$/)) {
                ar = +m[1] / +m[2];
            }
        }
        return ar;
    }
    var crop = (el, ar1, ar2, clip=true)=>{
        ar1 = fix_ar(ar1);
        ar2 = fix_ar(ar2);
        let w = 1;
        let h = 1;
        if (ar1 && ar2) {
            let tmp = calculateRelativeSize(ar1, ar2);
            w = tmp.width;
            h = tmp.height;
        }
        // el.style.transition = immediate ? "none" : "";
        el.style.width = `${100/w}%`;
        el.style.height = `${100/h}%`;

        if (ar1 && clip) {
            const rect = el.getBoundingClientRect();
            const container_w = rect.width;
            const container_h = rect.height;
            const container_ratio = container_w / container_h;
            let cw = 0, ch = 0;
            if (container_ratio > ar1) {
                const new_width = container_h * ar1;
                const crop_x = (container_w - new_width) / 2;
                cw = (crop_x / container_w) * 100;
            } else {
                const new_height = container_w / ar1;
                const crop_y = (container_h - new_height) / 2;
                ch = (crop_y / container_h) * 100;
            }
            const epsilon = 0.01;
            el.style.clipPath = (ch>epsilon || cw>epsilon) ? `inset(${ch}% ${cw}%)` : "";
        }
    }

    crop(video, vw/vh, ar1, false)
    crop(c1, ar1, ar2)
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


            var primeOnce = ()=>{
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


export default MediaServerVideoPlayerWebApp;