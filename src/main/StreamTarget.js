import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import {codec_to_ext, globals} from "./exports.js";
import {utils, StopStartStateMachine, StopStartStateMachine$, FFMPEGWrapper, Logger, MPVWrapper, constants} from "../core/exports.js";
/** @import { Target, SessionStream } from './exports.js' */
/** @import { Live$ } from '../media-server/exports.js' */

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
    url = "";
    /** @type {Live$} */
    live = null;
    key = utils.uuidb64();
    title = "";
}

/** @extends {StopStartStateMachine<StreamTarget$>} */
export class StreamTarget extends StopStartStateMachine {
    /** @type {FFMPEGWrapper} */
    #ffmpeg;
    /** @type {MPVWrapper} */
    #mpv;
    /** @type {child_process.ChildProcess} */
    #ffplay;
    #restart_timeout;

    get ffmpeg() { return this.#ffmpeg; }

    /** @param {SessionStream} stream @param {Target} target */
    constructor(stream, target) {
        super(globals.app.generate_uid("stream-target"), new StreamTarget$());

        this.stream = stream;
        this.target = target;

        this.logger = new Logger(`stream-target-${target.id}`);
        this.stream.logger.add(this.logger);

        stream.stream_targets[target.id] = this;
        stream.$.stream_targets[target.id] = this.$;

        var update_live = ()=>{
            if (!this.$.live) return;
            globals.app.ipc.request("media-server", "update_live", [
                this.$.live.id,
                { title: this.$.title }
            ]);
        }
        var debounced_update_live = utils.debounce(update_live, 100);
        this.observer.on("change", (c)=>{
            if (c.subtree) return;
            if (c.path[0] === "title") {
                debounced_update_live();
            }
        });

        this.ready = this.#init();
    }

    async #init() {
        let stream_id = this.stream.id;
        let target_id = this.target.id;
        let rtmp_host = this.target.rtmp_host;
        let rtmp_key = this.target.rtmp_key;
        let opts = this.stream.get_target_opts(this.target.id);
        let origin = this.stream.$.publish_stream_path;
        let title = this.stream.$.title;
        let output_format = "";
        let output = "";
        let input = globals.app.get_socket_path(`stream-${this.stream.id}`);
        if (!utils.is_windows()) input = `unix://${input}`;
        let input_format = "mpegts";

        let key_base = this.target.name
            .toLowerCase() // Convert to lowercase
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .replace(/[^\w\-\.]+/g, ''); // Remove non-word characters except dashes
        
        if (!this.stream.keys[key_base]) this.stream.keys[key_base] = 0;
        this.stream.keys[key_base]++;
        let key = `${key_base}-${this.stream.keys[key_base]+1}`;
        
        if (this.target.id === "local") {
            this.$.live = await globals.app.ipc.request("media-server", "create_live", this.$);
        } else if (this.target.id === "file") {
            let format = opts.format;
            let filename = this.stream.session.evaluate_and_sanitize_filename(path.resolve(globals.app.files_dir, opts.filename));
            let ext = path.extname(filename);
            if (!ext) {
                ext = codec_to_ext(format);
                filename += ext;
            }
            // filename = filename.split(path.sep).join("/");
            output_format =  format;
            output =  filename;
        } else if (this.target.id === "gui") {
            input = this.stream.$.rtmp_url;
            input_format = "flv";
        }

        if (rtmp_host) {
            output = rtmp_key ? rtmp_host.replace(/\/+$/, "") + "/" + rtmp_key.replace(/^\/+/, "") : rtmp_host;
        }
        if (utils.is_uri(output)) {
            let _url = new URL(output);
            if (_url.protocol.match(/^(rtmp|http)s?:$/)) {
                if (!output_format) output_format = "flv";
            }
            output = _url.toString();
        }

        Object.assign(this.$, {
            stream_id,
            target_id,
            rtmp_host,
            rtmp_key,
            opts,
            origin,
            title,
            output,
            output_format,
            input,
            input_format,
            width: this.stream.width,
            height: this.stream.height,
            fps: this.stream.$.fps,
            key,
        });
    }

    tick() {
        this.$.title = this.stream.$.title;
    }

    async _start() {
        clearTimeout(this.#restart_timeout);
        await this.ready;
        
        this.ffmpeg_speed = 0;
        this.ffmpeg_bitrate = 0;

        let output = this.$.output;
        let output_format = this.$.output_format;
        let input = this.$.input;
        let input_format = this.$.input_format;
        let ended = false;

        var handle_end = async (e)=>{
            if (ended) return;
            ended = true;
            if (this.stream.state === constants.State.STOPPED || this.stream.state === constants.State.STOPPING) {
                this.logger.info(`${this.toString()} ended after stream was stopped.`);
                this.destroy();
            } else {
                if (this.state === constants.State.STOPPING || this.state === constants.State.STOPPED) return;
                var delay = globals.app.conf["main.stream_restart_delay"]
                await this.stop("restart");
                this.logger.warn(`${this} ended unexpectedly, attempting restart in ${delay}s...`);
                this.#restart_timeout = setTimeout(()=>{
                    this.start();
                }, 1000 * delay);
            }
        };

        var handle_error = (e)=>{
            this.logger.error(new Error(`${this.toString()} error: ${e.message}`));
            handle_end();
        };

        if (this.target.id === "local") {
            if (this.$.live) {
                let handler = (id)=>{
                    if (id == this.$.live.id) {
                        handle_end();
                        globals.app.ipc.off(`media-server.live.stopped`, handler);
                    }
                }
                globals.app.ipc.on(`media-server.live.stopped`, handler);
                await globals.app.ipc.request("media-server", "start_live", [this.$.live.id, this.$]);
            }
        } else if (this.target.id === "gui") {
            var title = this.stream.name || "";
            this.#ffplay = child_process.spawn("ffplay", [
                `-autoexit`,
                "-fflags", "nobuffer",
                "-flags", "low_delay",
                "-framedrop",
                "-window_title", title,
                // "-avioflags", "direct",
                input
            ]);
            this.#ffplay.on("error", handle_error);
            this.#ffplay.on("close", handle_end);
            
            // var mpv_args = [
            //     input,
            //     "--no-config",
            //     `--force-window=immediate`
            //     `--title=${title}`
            // ];
            // this.#mpv = new MPVWrapper({ ipc: false });
            // this.#mpv.start(mpv_args)
            //     .catch(handle_error)
            //     .then(handle_end);
        } else {
            if (this.target.id === "file") {
                await fs.promises.mkdir(path.dirname(output), {recursive:true});
            }
            var ffmpeg_args = [];
            if (this.stream.is_realtime) {
                ffmpeg_args.push("-re");
            }
            ffmpeg_args.push(
                // `-noautoscale`,
                ...(input_format ? ["-f", input_format] : []),
                "-i", input,
                "-c", "copy",
                "-f", output_format,
                output
            );
            // this.ffmpeg.on("line", console.log);
            this.#ffmpeg = new FFMPEGWrapper();
            this.#ffmpeg.on("error", (e)=>this.logger.log(e));
            this.#ffmpeg.on("info", (info)=>{
                this.ffmpeg_speed = info.speed;
                this.ffmpeg_bitrate = info.bitrate;
            });
            this.#ffmpeg.start(ffmpeg_args)
                .catch(handle_error)
                .then(handle_end);
        }
        
        globals.app.ipc.emit("main.stream-target.started", this.$);
        
        return super._start();
    }

    async _stop() {
        clearTimeout(this.#restart_timeout);
        if (this.#ffplay) this.#ffplay.kill();
        if (this.$.live) await globals.app.ipc.request("media-server", "stop_live", this.$.live.id);
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