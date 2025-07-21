import * as utils from "../../../utils/exports.js";
import * as dom from "../../../utils/dom/exports.js";
import {$} from '../../../jquery-global.js';
import Hls from "hls.js";
import videojs from "video.js/core.es.js";

import "video.js/dist/video-js.css";
import "../../../utils/dom/dom.scss";
import './style.scss';

class Crop {
    x0 = 0;
    x1 = 1;
    y0 = 0;
    y1 = 1;
    name = "";
    get w() { return this.x1 - this.x0; }
    get h() { return this.y1 - this.y0; }
    get area() { return this.w * this.h; }
    get valid() { return this.w > 0.5 && this.h > 0.5; }
    constructor(o, name) {
        this.name = name;
        if (Array.isArray(o)) {
            let [w,h] = o;
            this.x0 = (1-w)/2;
            this.x1 = 1-(1-w)/2;
            this.y0 = (1-h)/2;
            this.y1 = 1-(1-h)/2;
        } else if (typeof o === "object" && o !== null) {
            var {x0,x1,y0,y1} = o;
            this.x0 = x0;
            this.x1 = x1;
            this.y0 = y0;
            this.y1 = y1;
        }
    }
    /** @param {Crop} b */
    difference(b) {
        var a = this;
        return Math.abs(b.x0-a.x0) + Math.abs(b.y0-a.y0) + Math.abs(b.x1-a.x1) + Math.abs(b.y1-a.y1);
    }
}

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

var crops = [
    new Crop([1, 1], "Original"),                  // 16:9
    new Crop([1/(4/3), 1], "4:3"),             // 16:9 -> 4:3
    new Crop([1, (16/9)/(21/9)], "21:9"),      // 21:9 -> 16:9
    new Crop([1/(4/3), 1/(4/3)], "4:3 -> 16:9"), // 16:9 -> 4:3 -> 16:9
]

var crop_modes = [
    {
        "label": "Automatic",
        "icon": `AUTO`,
        "value": "auto"
    },
    {
        "label": "16:9 (Widescreen)",
        "icon": `16:9`,
        "value": 16/9,
        "crop": crops[0]
    },
    {
        "label": "4:3 (Standard)",
        "icon": `4:3`,
        "value": 4/3,
        "crop": crops[1]
    },
    {
        "label": "21:9 (Cinematic)",
        "icon": `21:9`,
        "value": 21/9,
        "crop": crops[2]
    },
];

var DEBUG = false;
var REGION_BUFFER = 10;
var MIN_REGIONS_FIRST_CROP = 0;
const CROP_DETECT_INTERVAL = 1000;
const VIDEO_UI_UPDATE_INTERVAL = 100;
const IS_EMBED = window.parent !== window.self;

var settings = new dom.LocalStorageBucket("player", {
    time_display_mode: 0,
    volume: 1,
    crop_mode: crop_modes.findIndex(m=>m.value == "auto"),
});
settings.load();

/** @type {MediaServerVideoPlayerWebApp} */
let app;
export class MediaServerVideoPlayerWebApp {
    /** @type {VideoPlayer} */
    player;

    constructor() {
        app = this;
        this.init();
    }

    async init() {

        if (IS_EMBED) document.body.classList.add("embedded");
        
        conf = await (await fetch("/conf")).json();

        var params = new URLSearchParams(location.search);
        var autoplay = params.get("autoplay") == "1"
        this.src = new URL(`/media/live/${params.get("id")}/master.m3u8`, window.location.origin+window.location.pathname).toString();

        this.play_button = new PlayButton();
        document.body.append(this.play_button.el);

        var menu = new dom.DropdownMenu({
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
        });
        
        setInterval(()=>{
            app.update()
        }, VIDEO_UI_UPDATE_INTERVAL);

        this.init_player(autoplay);
    }

    init_player(autoplay) {
        if (this.player) {
            this.player.play();
        } else {
            this.player = new VideoPlayer(this.src);
            this.player.init(autoplay);
        }
    }
    update = dom.debounce_next_frame(()=>this.#update());
    #update() {
        if (this.player) this.player.update();
        this.play_button.update();
    }
}

class PlayButton {
    constructor() {
        /** @type {HTMLElement} */
        this.el = $(
            `<div class="play-button">
                <div class="play"><i class="fas fa-play"></i></div>
                <div class="pause"><i class="fas fa-pause"></i></div>
                <div class="ended"><div style="padding:10px">The stream has ended.</div><i class="fas fa-redo"></i></div>
            </div>`
        )[0];
        this.el.onclick = (e)=>app.init_player(true);
        document.body.append(this.el);
        this.el = this.el;
        this.update();
    }
    update() {
        var paused = false;
        var ended = false;
        var seeking = false;
        var videoWasPlaying = false;

        if (app.player) {
            var vjs = app.player.player;
            seeking  = vjs.scrubbing() || vjs.seeking();
            videoWasPlaying = vjs.controlBar.progressControl.seekBar.videoWasPlaying;
            ended = vjs.ended();
            paused = !ended && vjs.hasStarted() && vjs.paused() && (!seeking || !videoWasPlaying);
        }
        var initialized = app.player && app.player.initialized;
        this.el.querySelector(".play").style.display = !initialized ? "" :  "none";
        this.el.querySelector(".pause").style.display = paused ? "" : "none";
        this.el.querySelector(".ended").style.display = ended ? "" : "none";

        var showing = ended || paused || !initialized;
        // this.el.style.display = showing ? "" : "none";
        if (this._showing != showing) {
            this._showing = showing;
            if (showing) $(this.el).stop().fadeIn(200);
            else $(this.el).stop().fadeOut(200);
        }
    }
}

class VideoPlayer {
    /** @type {HTMLVideoElement} */
    video_el;
    /** @type {Hls}*/
    hls;
    /** @type {import("video.js/dist/types/player").default}*/
    player;
    initialized = false;
    #update_ratio_interval_id;

    constructor(src) {
        this.src = src;
        this.video_el = $(`<video class="video-js" preload="auto" width="1280" height="720"></video>`)[0];
        this.crop_detect = new CropDetect(this.video_el);
        this.crop_detect.ready.then(()=>{
            this.update_ratio();
        })

        document.body.append(this.video_el);

        this.video_el.addEventListener("error", (e)=>{
            console.log(e);
        });
        new ResizeObserver(()=>{
            this.update_ratio();
        }).observe(this.video_el);
    }

    update() {
        if (!this.player) return;

        var d = this.get_time_until_live_edge_area(true);
        var behindLiveEdge = this.liveTracker.behindLiveEdge();
        
        var rate = this.player.playbackRate();
        var new_rate;
        var at_live_edge = d <= 0 && !behindLiveEdge;
        // if (rate === -1) {
        //   new_rate = at_live_edge ? 1.0 : 1.5;
        // } else {
        new_rate = at_live_edge ? Math.min(1, rate) : rate;
        // }
        if (new_rate != rate) {
            this.player.playbackRate(new_rate);
        }

        // console.log("liveTracker.behindLiveEdge()", liveTracker.behindLiveEdge())
        var stl_text;
        if (this.liveTracker.behindLiveEdge()) {
            // this.is_mobile && 
            if (settings.get("time_display_mode") == 0) {
                stl_text = "["+this.get_live_time(0, this.player.currentTime())+"]"
            } else {
                stl_text = `[-${videojs.time.formatTime(this.get_time_until_live_edge_area())}]`
            }
        } else {
            stl_text = "LIVE";
        }
        if (this.seekToLive.last_text != stl_text) {
            this.seekToLive.last_text = stl_text
            this.seekToLive.textEl_.innerHTML = stl_text;
        }
        
        var is_live = this.liveTracker.isLive();
        if (is_live) this.timeDisplayToggle.show();
        else this.timeDisplayToggle.hide();
    }

    async update_ratio() {
        var crop_mode_index = settings.get("crop_mode");
        var crop_mode = crop_modes[crop_mode_index];
        let crop = crop_mode.crop || crops[0];
        if (crop_mode.value == "auto" || DEBUG) {
            await this.crop_detect.update();
        }
        if (crop_mode.value == "auto") {
            crop = this.crop_detect.nearest_crop;
        }
        apply_crop(this.video_el, crop);

        // for (var c of crops) {
        //     this.crop_detect.draw_rect(c, "grey", 1, [2, 2]);
        // }
        
        if (this.crop_detect.canvas) {
            if (DEBUG && !this.crop_detect.canvas.parentElement) {
                document.body.append(this.crop_detect.canvas);
            } else if (!DEBUG && this.crop_detect.canvas.parentElement) {
                this.crop_detect.canvas.remove();
            }
        }
        this.crop_detect.draw_rect(this.crop_detect.nearest_crop, "red", 1, [2,2]);
        this.crop_detect.draw_rect(this.crop_detect.region, "yellow", 1, [2,2]);
        this.crop_detect.draw_rect(crop, "green", 1);

        
    }
    
    get_preferred_level() {
        var level = localStorage.getItem("level");
        if (level == null) level = -1;
        return +level;
    }

    init(autoplay) {
        let _this = this;
        var Button = videojs.getComponent("Button");
        var MenuButton = videojs.getComponent("MenuButton");
        var MenuItem = videojs.getComponent("MenuItem");
        var ProgressControl = videojs.getComponent("ProgressControl");
        var VolumeControl = videojs.getComponent("VolumeControl");
        var MouseTimeDisplay = videojs.getComponent("MouseTimeDisplay");
        var PlaybackRateMenuButton = videojs.getComponent("PlaybackRateMenuButton");
        var PlaybackRateMenuItem = videojs.getComponent("PlaybackRateMenuItem");

        var ProgressControl_enable = ProgressControl.prototype.enable;
        ProgressControl.prototype.enable = function(...args) {
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
                app.player.destroy()
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
                var update_label = (level)=>{
                    var data = levels.find(l=>l.value == level);
                    this.q_label.innerHTML = data ? data.text : "-";
                }
                var levels = [];
                app.player.hls.on(Hls.Events.MANIFEST_PARSED, (event, data)=>{
                    levels = data.levels.map((l,i)=>{
                        return {value:i, text:l.height+"p", bitrate:l.bitrate}
                    }).filter(l=>l);
                    levels.push({value:-1, text:"AUTO", bitrate:0});
                    this.options_.levels = levels;
                    this.update();
                    update_label(levels[1].level);
                });
                app.player.hls.on(Hls.Events.LEVEL_SWITCHING, (event, data)=>{
                    update_label(data.level);
                });
                app.player.hls.on(Hls.Events.LEVEL_UPDATED, (event, data)=>{
                    update_label(data.level);
                });
                this.q_label = $(`<div>`)[0];
                this.menuButton_.el_.prepend(this.q_label);
                this.controlText("Quality");
                update_label(-1);
            }
            buildWrapperCSSClass() {
                return `vjs-level-select ${super.buildWrapperCSSClass()}`;
            }
            buildCSSClass() {
                return `vjs-level-select ${super.buildCSSClass()}`;
            }
            hide() {
                super.hide();
            }
            update() {
                super.update();
                this.update_selection();
            }
            update_selection(){
                for (var item of this.items) {
                    var level = app.player.get_preferred_level();
                    item.selected(item.level === level);
                }
            }
            createItems() {
                this.hideThreshold_ = 1;
                var levels = utils.sort([...this.options_.levels], l=>-l.bitrate);
                return levels.map((level)=>{
                    var item = new MenuItem(this.player_, { label: level.text, selectable: true });
                    item.level = level.value;
                    item.handleClick = ()=>{
                        app.player.hls.nextLevel = level.value;
                        localStorage.setItem("level", level.value);
                        this.update_selection();
                    };
                    return item;
                });
            }
        }
        videojs.registerComponent("hlsSelectMenuButton", HLSSelectMenuButton);
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
                this.icon.innerHTML = c.icon;
                this.controlText(`Time Display Mode: ${c.label}`);
            }
            buildCSSClass() {
                return `vjs-time-display-toggle vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("timeDisplayToggle", TimeDisplayToggle);
        
        class CropToggle extends Button {
            constructor(player, options) {
                super(player, options);
                app.player.crop_button = this;
                this.icon = document.createElement("div");
                this.icon.classList.add("icon");
                this.el_.prepend(this.icon);
                this.update();
            }
            handleClick(e) {
                var c = (settings.get("crop_mode")+1) % crop_modes.length;
                settings.set("crop_mode", c);
                this.update();
                _this.update_ratio();
            }
            update() {
                var c = settings.get("crop_mode") || 0;
                var d = crop_modes[c];
                if (d) {
                    this.icon.innerHTML = d.icon;
                    this.icon.dataset.ratio = d.icon;
                    var ctext = d.label;
                    if (d.value === "auto" && app.player.crop_detect.nearest_crop) {
                        if (app.player.crop_detect.nearest_crop.name) {
                            ctext += ` (${app.player.crop_detect.nearest_crop.name})`;
                        }
                    }
                    this.controlText(ctext);
                }
            }
            buildCSSClass() {
                return `vjs-crop-toggle vjs-control vjs-button ${super.buildCSSClass()}`;
            }
        }
        videojs.registerComponent("cropToggle", CropToggle);

        this.hls = new Hls({
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
            maxBufferSize: 2 * 1024 * 1024,
            maxBufferLength: 5, // minimum guaranteed buffer length
            maxMaxBufferLength: 15, // max seconds to buffer
            liveDurationInfinity: true,
            // liveSyncDurationCount: 3, // 3 by default, about 6 seconds.
            // progressive: true, // experimental
            lowLatencyMode: false,
            // maxLiveSyncPlaybackRate: 1.5,

            // -----
            // debug: true
        });
        
        this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data)=>{
            var level = this.get_preferred_level();
            if (level >= 0) this.hls.nextLevel = level;
        });

        this.player = videojs(this.video_el, {
            autoplay,
            // muted: true, 
            // volume:0,
            // fluid: true,
            playbackRates: [0.5, 1, 1.25, 1.5, 2], // , -1
            controls: true,
            responsive: true,
            liveui: true,
            enableSmoothSeeking: true,
            inactivityTimeout: 1000,
            
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
                    "cropToggle",
                    'playbackRateMenuButton',
                    'chaptersButton',
                    'descriptionsButton',
                    'subsCapsButton',
                    'audioTrackButton',
                    "hlsSelectMenuButton",
                    'pictureInPictureToggle',
                    'fullscreenToggle'
                ]
                /* volumePanel: {
                    inline: false,
                    vertical: true
                } */
            }
        });
        
        var c1 = $(`<div></div>`)[0];
        var c2 = $(`<div></div>`)[0];
        for (var c of [c1,c2]) {
            c.style.display = "flex";
            c.style.justifyContent = "center";
            c.style.alignItems = "center"; 
            c.style.width = "100%";
            c.style.height = "100%";
        }
        c2.append(c1);
        this.video_el.parentElement.insertBefore(c2, this.video_el);
        c1.append(this.video_el);
        c2.append(app.play_button.el);
        c2.style.background = "rgb(10,10,10)";
        c1.style.background = "black";

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

        this.hls.loadSource(this.src);
        this.hls.attachMedia(this.video_el);

        // this.hls.media.srcObject.setLiveSeekableRange(0, 600)
        // this.hls.on(Hls.Events.ERROR, (...e)=>{
        //   console.error(e);
        // })

        this.player.on('volumechange', ()=>{
            settings.set("volume", this.player.muted() ? 0 : this.player.volume())
        });
        this.player.volume(settings.get("volume"));

        /** @type {import("video.js/dist/types/control-bar/control-bar").default}*/
        this.controlBar = this.player.controlBar;
        /** @type {import("video.js/dist/types/control-bar/seek-to-live").default}*/
        this.seekToLive = this.controlBar.getChild("SeekToLive");
        /** @type {import("video.js/dist/types/control-bar/fullscreen-toggle").default}*/
        this.fullscreenToggle = this.controlBar.getChild("FullscreenToggle");
        /** @type {import("video.js/dist/types/control-bar/volume-panel").default}*/
        this.volumePanel = this.controlBar.getChild("VolumePanel");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-control").default}*/
        this.volumeControl = this.volumePanel.getChild("VolumeControl");
        /** @type {import("video.js/dist/types/control-bar/volume-control/volume-bar").default}*/
        this.volumeBar = this.volumeControl.getChild("VolumeBar");
        /** @type {TimeDisplayToggle} */
        this.timeDisplayToggle = this.controlBar.getChild("TimeDisplayToggle");
        /** @type {import("video.js/dist/types/control-bar/volume-control/mouse-volume-level-display").default}*/
        this.volumeBarMouseTimeDisplay = this.volumeBar.getChild('MouseVolumeLevelDisplay');
        /** @type {import("video.js/dist/types/control-bar/progress-control/progress-control").default}*/
        this.progressControl = this.controlBar.getChild('progressControl');
        /** @type {import("video.js/dist/types/control-bar/progress-control/seek-bar").default}*/
        this.seekBar = this.progressControl.getChild('seekBar');
        /** @type {import("video.js/dist/types/control-bar/progress-control/mouse-time-display").default}*/
        this.seekBarMouseTimeDisplay = this.seekBar.getChild('mouseTimeDisplay');
        /** @type {import("video.js/dist/types/control-bar/progress-control/play-progress-bar").default}*/
        this.seekBarPlayProgressBar = this.seekBar.getChild('playProgressBar');
        /** @type {import("video.js/dist/types/control-bar/playback-rate-menu/playback-rate-menu-button").default}*/
        this.controlplaybackRateMenuButton = this.controlBar.getChild('playbackRateMenuButton');
        /** @type {import("video.js/dist/types/live-tracker").default}*/
        this.liveTracker = this.player.liveTracker;

        this.controlplaybackRateMenuButton.menu.contentEl_.prepend(...$(`<li class="vjs-menu-title" tabindex="-1">Speed</li>`))

        this.is_mobile = !this.volumeBarMouseTimeDisplay;

        this.seektolive_wrapper_el = $(`<div>`)[0];
        this.seektolive_wrapper_el.classList.add("seek-to-live-wrapper");
        this.seekToLive.el_.after(this.seektolive_wrapper_el);
        this.seektolive_wrapper_el.append(this.seekToLive.el_);
        var seekToLive_handleClick = this.seekToLive.handleClick;
        this.seekToLive.handleClick = function(e) {
            seekToLive_handleClick.apply(this, [e]);
            this.player_.play();
        }
        
        if (conf.logo_url) {
            // let target = IS_EMBED ? `_parent` : `_blank`;
            let target = `_blank`;
            dom.load_image("/logo").then(img=>{
                this.logo_el = $(`<a target="${target}" class="logo" href="${conf.logo_url}"></a>`)[0];
                this.logo_el.append(img);
                this.player.el_.append(this.logo_el);
            })
        }

        if (this.volumeBarMouseTimeDisplay) {
            this.volumeBarMouseTimeDisplay.update = this.volumeBarMouseTimeDisplay.__proto__.update;
            var volumeControl_handleMouseDown = this.volumeControl.handleMouseDown;
            this.volumeControl.handleMouseDown = function(event) {
                volumeControl_handleMouseDown.apply(this, [event]);
                this.volumeBar.handleMouseDown(event);
                pauseEvent(event);
            };
            this.volumeControl.handleMouseMove = function(e) {
                this.volumeBar.handleMouseMove(e);
                // fucking ridiculous...
                const progress = this.volumeBar.getProgress();
                this.volumeBar.bar.el().style.width = (progress * 100).toFixed(2) + '%';
            }
            this.volumeControl.throttledHandleMouseMove = function(e) {
                console.log(e.clientX, e.clientY)
                this.volumeControl.handleMouseMove.apply(this, [e]);
            };
        } else {
            // mobile
            this.volumeControl.el_.style.display = "none";
        }

        if (this.seekBarMouseTimeDisplay) {
            const timeTooltip = this.seekBarMouseTimeDisplay.getChild('timeTooltip');
            this.seekBarMouseTimeDisplay.update = function(seekBarRect, seekBarPoint) {
                const time = seekBarPoint * this.player_.duration();
                timeTooltip.updateTime(seekBarRect, seekBarPoint, time);
                this.el_.style.left = seekBarRect.width * seekBarPoint;
            };
            timeTooltip.update = function (seekBarRect, seekBarPoint, content) {
                this.write(content);
                _this.seekBarMouseTimeDisplay.el_.style.left = `${seekBarRect.width * seekBarPoint}px`;
                var w = this.el_.offsetWidth;
                var x = seekBarRect.width * seekBarPoint;
                var left = utils.clamp(x, w/2, window.innerWidth-w/2);
                var cx = Math.round(left - x - w/2);
                this.el_.style.transform = `translateX(${cx}px)`;
            };
            timeTooltip.updateTime = function(seekBarRect, seekBarPoint, time) {
                const liveWindow = _this.liveTracker.liveWindow();
                var time = seekBarPoint * liveWindow
                let content = _this.get_live_time(settings.get("time_display_mode"), time);
                this.update(seekBarRect, seekBarPoint, content);
            };
        }

        /* this.player.ready(()=>{
            if (autoplay) {
                new Promise((resolve,reject)=>{
                    this.player.play().then(resolve);
                    setTimeout(()=>reject("Autoplay was disallowed."), 2000);
                }).catch((e)=>console.error(e))
            }
        }); */
        this.player.on("error", console.error);
        this.player.on("pause",()=>app.update());
        var was_seeking = false;
        this.player.on("seeking",()=>{
            was_seeking = true;
            app.update()
        });
        this.player.on("play",()=>{
            this.initialized = true;
            if (was_seeking) {
                was_seeking = false;
                this.crop_detect.clear_buffer();
                this.update_ratio();
            }
            app.update()
        });
        this.player.on("ended",(e)=>app.update());
        this.liveTracker.on("liveedgechange", ()=>app.update());

        this.#update_ratio_interval_id = setInterval(()=>{
            this.update_ratio();
        }, CROP_DETECT_INTERVAL);

        this.update();
        this.update_ratio();
    }

    get_time_until_live_edge_area(use_latency){
        const liveCurrentTime = utils.try_catch(()=>this.liveTracker.liveCurrentTime(), 0);
        const currentTime = this.player.currentTime();
        return Math.max(0, Math.abs(liveCurrentTime - currentTime) - (use_latency ? this.hls.targetLatency/2 : 0));
    };

    get_live_time(mode, time){
        const duration = this.player.duration();
        if (this.liveTracker && this.liveTracker.isLive()) {
            const liveWindow = this.liveTracker.liveWindow();
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
        var player = this.player;
        this.player = null;
        if (player) player.dispose();
        if (this.hls) this.hls.destroy();
        this.hls = null;
        this.crop_detect.destroy();
        clearInterval(this.#update_ratio_interval_id);
        app.player = null;
        document.body.append(app.play_button.el);
        app.update();
    }

    play() {
        this.player.play();
    }
}
class CropDetect {
    /** @type {HTMLVideoElement} */
    video_el;
    /** @type {HTMLCanvasElement} */
    canvas;
    /** @type {Crop[]} */
    buffer = [];
    region = new Crop();
    nearest_crop = new Crop();
    #ready;
    get ready() { return this.#ready; }
    get vw() { return this.video_el.videoWidth; }
    get vh() { return this.video_el.videoHeight; }

    constructor(video_el) {
        this.video_el = video_el;
        this.#ready = this.#init();
    }

    clear_buffer() {
        this.buffer = [];
    }

    async #init() {
        await new Promise(resolve=>{
            this.video_el.addEventListener("loadeddata", resolve)
            if (this.video_el.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
        });
    }
    
    async update() {
        await this.#ready;

        let {vw,vh} = this;
        if (vw == 0 || vh == 0) return;

        // let ar = utils.nearest(vw / vh, (4/3), (16/9));
        let ar = vw / vh;
        
        var dimensions = JSON.stringify([vw,vh]);
        if (this._last_dimensions != dimensions) {
            this._last_dimensions = dimensions;
            if (this.canvas) this.canvas.remove();
            /** @type {HTMLCanvasElement} */
            this.canvas = document.createElement('canvas');
            this.canvas.style.zIndex = 1000;
            this.canvas.height = 120;
            this.canvas.width = this.canvas.height * ar;
            this.ctx = this.canvas.getContext('2d', {willReadFrequently:true});
            Object.assign(this.canvas.style, {"position":"absolute", "top":"0","right":"0", "pointer-events":"none"});
        }
        
        let x0=0, y0=0, ow=this.canvas.width, oh=this.canvas.height;
        let x1=ow, y1=oh;
        let tx, ty;
        let threshold = 0x11;
        this.ctx.filter = "grayscale(100%) contrast(1.05)";
        this.ctx.drawImage(this.video_el, 0, 0, x1, y1);
        this.ctx.filter = "none";
        let data = this.ctx.getImageData(0,0, x1, y1).data;
        var row = (y)=>{
            for (tx=x0; tx<x1; tx++) if (data[(y*ow+tx)*4]>threshold) return true;
        };
        var col = (x)=>{
            for (ty=y0; ty<y1; ty++) if (data[(ty*ow+x)*4]>threshold) return true;
        };

        for (;y0<y1;y0++) if (row(y0+1)) break;
        for (;x0<x1;x0++) if (col(x0+1)) break;
        for (;y1>=0;y1--) if (row(y1-1)) break;
        for (;x1>=0;x1--) if (col(x1-1)) break;

        x0/=ow; x1/=ow; y0/=oh; y1/=oh;
        var r = new Crop({x0,y0,x1,y1});
        if (!r.valid) return;

        this.push_region(r);
        
        this.nearest_crop = [...crops].sort((a,b)=>{
            return a.difference(this.region) - b.difference(this.region);
        })[0];
        if (app.player.crop_button) app.player.crop_button.update();
    }
    /** @param {Region} r */
    push_region(r) {
        this.buffer.push(r);
        while (this.buffer.length > REGION_BUFFER) this.buffer.shift();
        if (this.buffer.length < MIN_REGIONS_FIRST_CROP) return;

        let x0=0,x1=0,y0=0,y1=0;
        for (var r of this.buffer) {
            x0+=r.x0; x1+=r.x1; y0+=r.y0; y1+=r.y1;
        }
        x0 /= this.buffer.length;
        x1 /= this.buffer.length;
        y0 /= this.buffer.length;
        y1 /= this.buffer.length;
        this.region = new Crop({x0,x1,y0,y1});
    }

    /** @param {Crop} r */
    draw_rect(r, color="red", thickness=1, dashed=false){
        if (!this.ctx) return;
        let {x0,y0,x1,y1} = r;
        let ow = this.canvas.width;
        let oh = this.canvas.height;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;
        this.ctx.setLineDash(Array.isArray(dashed) ? dashed : dashed ? [2, 2] : []);
        x0 = Math.floor(x0 * (ow-thickness) + thickness/2);
        y0 = Math.floor(y0 * (oh-thickness) + thickness/2);
        x1 = Math.ceil(x1 * (ow-thickness) + thickness/2);
        y1 = Math.ceil(y1 * (oh-thickness) + thickness/2);
        this.ctx.strokeRect(x0, y0, x1-x0, y1-y0);
    }

    async destroy() {
        await this.#ready;
        this.canvas.remove();
    }
}

/** @param {HTMLVideoElement} videoElement @param {Crop} crop */
function apply_crop(videoElement, crop) {
    var container = videoElement.parentElement;
    if (!container) return;

    const cropWidth = crop.x1 - crop.x0;
    const cropHeight = crop.y1 - crop.y0;
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    const cropAspect = (cropWidth * videoElement.videoWidth) / (cropHeight * videoElement.videoHeight);
    const windowAspect = window.innerWidth / window.innerHeight;

    container.style.position = 'relative';
    // container.style.overflow = 'hidden';
    videoElement.style.position = 'absolute';
    videoElement.style.objectFit = 'cover';

    videoElement.style.width = `${100/cropWidth}%`;
    videoElement.style.height = `${100/cropHeight}%`;
    videoElement.style.left = `50%`;
    videoElement.style.top = `50%`;
    videoElement.style.transform = 'translate(-50%, -50%)';
    // videoElement.style.transition = 'all 0.2s ease-in-out';
    // videoElement.style.transitionProperty = "width, height";
    
    if (windowAspect > cropAspect) {
        container.style.width = `${cropAspect * 100 / windowAspect}%`;
        container.style.height = `100%`;
    } else {
        container.style.width = `100%`;
        container.style.height = `${windowAspect * 100 / cropAspect}%`;
    }
    
}

export default MediaServerVideoPlayerWebApp;