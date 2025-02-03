import fs from "fs-extra";
import path from "node:path";
import child_process from "node:child_process";
import url from "node:url";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import FFMPEGWrapper from "../core/FFMPEGWrapper.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import * as constants from "../core/constants.js";
/** @import { Target, Stream } from './types.d.ts' */

export class StreamTarget extends DataNode {
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @type {child_process.ChildProcessWithoutNullStreams} */
    #mpv;
    #reconnect_timeout;
    /** @param {Stream} stream @param {Target} target */
    constructor(stream, target) {
        super();

        this.logger = new Logger(`target-${target.id}`);
        this.logger.on("log", (log)=>this.stream.logger.log(log));

        this.stream = stream;
        this.target = target;

        stream.stream_targets[target.id] = this;
        stream.$.stream_targets[target.id] = this.$;
        
        var data = JSON.parse(JSON.stringify({
            opts: { ...stream.$.targets[target.id] },
            stream_id: stream.id,
            target_id: target.id,
        }));
        Object.assign(data, target.config(data, this));

        if (data.rtmp_host) {
            data.output_url = data.rtmp_key ? data.rtmp_host.replace(/\/+$/, "") + "/" + data.rtmp_key.replace(/^\/+/, "") : data.rtmp_host;
        }
        if (data.output_url) {
            let _url = new URL(data.output_url);
            if (_url.protocol.match(/^(rtmp|http)s?:$/)) {
                if (!data.output_format) {
                    data.output_format = "flv";
                }
                if (stream.$.internal_path) {
                    _url.searchParams.append("origin", stream.$.internal_path);
                }
                _url.searchParams.append("opts", JSON.stringify(data.opts));
            }
            data.output_url = _url.toString();
        }
        Object.assign(this.$, data);
    }

    update() {
        this.$.title = this.stream.$.title;
    }

    async start() {
        if (this.$.state === constants.State.STARTED) return;
        this.$.state = constants.State.STARTING;

        if (!this.stream.is_only_gui) {
            let input = this.stream.output_url;
            let {opts, output_url, output_format} = this.$;

            var try_restart_soon = async ()=>{
                if (this.$.state === constants.State.STOPPING || this.$.state === constants.State.STOPPED) return;
                this.logger.warn(`Ended unexpectedly, attempting restart soon...`);
                await this.stop("restart");
                this.#reconnect_timeout = setTimeout(()=>{
                    this.start();
                }, globals.app.conf["main.stream_restart_delay"] * 1000);
            }

            if (this.target.id === "gui") {
                var mpv_args = [
                    input,
                    "--video-latency-hacks=yes",
                    "--audio-buffer=0",
                    "--demuxer-lavf-o-add=fflags=+nobuffer",
                    "--vd-lavc-threads=1",
                    "--stream-buffer-size=4k",
                    "--interpolation=no",
                    "--no-correct-pts",
                    `--osc=${opts.osc?"yes":"no"}`
                ];
                this.#mpv = child_process.spawn(globals.app.conf["core.mpv_executable"], mpv_args);
                this.#mpv.on("close",()=>{
                    try_restart_soon();
                });
            } else {
                let is_file_output = utils.try(()=>new URL(output_url)).protocol === "file:";
                let output = output_url;
                if (is_file_output) {
                    output = url.fileURLToPath(output_url);
                    fs.mkdirSync(path.dirname(output), {recursive:true});
                }
                var ffmpeg_args = [];
                if (this.stream.is_realtime) ffmpeg_args.push("-re");
                ffmpeg_args.push(
                    // `-noautoscale`,
                    "-i", input,
                    "-c", "copy",
                    "-f", output_format,
                    output
                );
                let key = this.stream.id;
                if (this.$.output_url) {
                    let output_url = new URL(this.$.output_url);
                    if (output_url.protocol.match(/^(rtmp|http)s?:/)) {
                        key = (output_url.hostname === "127.0.0.1") ? "localhost" : output_url.hostname;
                    } else {
                        key = output_url.protocol.slice(0,-1);
                    }
                }
                if (!this.stream.keys[key]) this.stream.keys[key] = 0;
                key = `${key}:${this.stream.keys[key]++}`;
                // this.ffmpeg.on("line", console.log);
                this.#ffmpeg = new FFMPEGWrapper();
                this.#ffmpeg.on("info", (info)=>{
                    this.stream.register_metric(`${key}:speed`, this.stream.time_running, info.speed);
                    this.stream.register_metric(`${key}:bitrate`, this.stream.time_running, info.bitrate);
                });
                this.#ffmpeg.logger.on("log",(log)=>{
                    // if (this.target.id === "gui") return;
                    // log = {...log, level:Logger.TRACE};
                    this.logger.log(log);
                });
                this.#ffmpeg.on("end",(e)=>{
                    try_restart_soon();
                });
                this.#ffmpeg.start(ffmpeg_args);
            }
        }
        this.$.state = constants.State.STARTED;
        globals.app.ipc.emit("main.stream-target.started", this.id);
    }
    async stop(reason) {
        if (this.$.state === constants.State.STOPPED) return;
        this.$.state = constants.State.STOPPED;
        this.$.stop_reason = reason;
        if (this.#mpv) await utils.tree_kill(this.#mpv.pid);
        if (this.#ffmpeg) await this.#ffmpeg.stop();
        globals.app.ipc.emit("main.stream-target.stopped", {id:this.id, reason});
    }
    async restart() {
        await this.stop("restart");
        await this.start();
    }

    async destroy() {
        super.destroy();
        clearTimeout(this.#reconnect_timeout);
        delete this.stream.stream_targets[this.target.id];
        await this.stop("destroy");
    }
}

export default StreamTarget;