import fs from "fs-extra";
import path from "node:path";
import child_process from "node:child_process";
import url from "node:url";
import tree_kill from "tree-kill-promise";
import {globals} from "./exports.js";
import {utils, StopStartStateMachine, StopStartStateMachine$, FFMPEGWrapper, Logger, MPVWrapper, constants} from "../core/exports.js";
/** @import { Target, SessionStream } from './exports.js' */

export class StreamTarget$ extends StopStartStateMachine$ {
    stream_id = "";
    target_id = "";
    /** @type {string | undefined} */
    output_url;
    /** @type {string | undefined} */
    rtmp_host;
    /** @type {string | undefined} */
    rtmp_key;
    /** @type {Record<PropertyKey,any>} */
    opts = {};
    speed = 0;
    bitrate = 0;
    url = "";
    key = utils.uuidb64();
}

/** @extends {StopStartStateMachine<StreamTarget$>} */
export class StreamTarget extends StopStartStateMachine {
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @type {MPVWrapper} */
    #mpv;
    /** @param {SessionStream} stream @param {Target} target */
    constructor(stream, target) {
        super(globals.app.generate_uid("stream-target"), new StreamTarget$());

        this.logger = new Logger(`stream-target-${target.id}`);
        this.logger.on("log", (log)=>{
            this.stream.logger.log(log)
        });

        this.stream = stream;
        this.target = target;

        stream.stream_targets[target.id] = this;
        stream.$.stream_targets[target.id] = this.$;
        
        var data = utils.json_copy({
            stream_id: stream.id,
            target_id: target.id,
            rtmp_host: target.rtmp_host,
            rtmp_key: target.rtmp_key,
            opts: stream.get_target_opts(target.id),
        });

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
                if (stream.$.title) {
                    _url.searchParams.append("title", stream.$.title);
                }
                _url.searchParams.append("opts", JSON.stringify(data.opts));
            }
            data.output_url = _url.toString();
        }
        Object.assign(this.$, data);

        let key = this.target.name
            .toLowerCase() // Convert to lowercase
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .replace(/[^\w\-\.]+/g, ''); // Remove non-word characters except dashes
        
        if (!this.stream.keys[key]) this.stream.keys[key] = 0;
        this.stream.keys[key]++;
        this.$.key = `${key}-${this.stream.keys[key]+1}`;
    }

    update() {
        this.$.title = this.stream.$.title;
    }

    async _start() {
        let input = this.stream.$.output_url;
        let {opts, output_url, output_format} = this.$;

        var handle_end = (type)=>{
            return ()=>{
                if (this.stream.state === constants.State.STOPPED || this.stream.state === constants.State.STOPPING) {
                    this.logger.info(`${type} ended after stream was stopped.`);
                    this.destroy();
                } else {
                    this._handle_end(type);
                }
            }
        }
        var handle_error = (type)=>{
            return (e)=>{
                this.logger.error(new Error(`Stream Target ${type} error: ${e.message}`));
            }
        }

        if (this.target.id === "gui") {
            var mpv_args = [
                input,
                "--no-config",
                "--video-latency-hacks=yes",
                "--audio-buffer=0",
                "--demuxer-lavf-o-add=fflags=+nobuffer",
                "--vd-lavc-threads=1",
                "--stream-buffer-size=4k",
                "--interpolation=no",
                "--no-correct-pts",
                `--osc=${opts.osc?"yes":"no"}`
            ];
            this.#mpv = new MPVWrapper({ ipc: false });
            this.#mpv.start(mpv_args)
                .catch(handle_error("mpv"))
                .then(handle_end("mpv"));
        } else {
            let is_file_output = utils.try_catch(()=>new URL(output_url).protocol === "file:");
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
            // this.ffmpeg.on("line", console.log);
            this.#ffmpeg = new FFMPEGWrapper();
            this.#ffmpeg.on("error", (e)=>this.logger.log(e));
            this.#ffmpeg.on("info", (info)=>{
                this.$.speed = info.speed;
                this.$.bitrate = info.bitrate;
            });
            /* this.#ffmpeg.logger.on("log",(log)=>{
                // if (this.target.id === "gui") return;
                // log = {...log, level:Logger.TRACE};
                this.logger.log(log);
            }); */
            this.#ffmpeg.start(ffmpeg_args)
                .catch(handle_error("ffmpeg"))
                .then(handle_end("ffmpeg"));
        }
        globals.app.ipc.emit("main.stream-target.started", this.$);
        
        return super._start();
    }

    async _stop() {
        if (this.#ffmpeg) await this.#ffmpeg.destroy();
        if (this.#mpv) await this.#mpv.destroy();
        globals.app.ipc.emit("main.stream-target.stopped", {id:this.id, reason:this.$.stop_reason});
        
        return super._stop();
    }

    async _destroy() {
        delete this.stream.stream_targets[this.target.id];
        return super._destroy();
    }
}

export default StreamTarget;