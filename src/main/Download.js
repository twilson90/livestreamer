import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import readline from "node:readline";
import {globals} from "./exports.js";
import {utils, DataNodeID, DataNodeID$} from "../core/exports.js";
/** @import {InternalSession} from "./exports.js" */

const progress_interval = 1 * 1000;
const progress_log_interval = 5 * 1000;

export class Download$ extends DataNodeID$ {
    filename = "";
    dest_path = "";
    stage = 0;
    stages = 0;
    bytes = 0;
    total = 0;
    speed = 0;
}

/** @extends {DataNodeID<Download$>} */
export class Download extends DataNodeID {
    get dest_dir() { return this.session.files_dir || globals.app.files_dir; }
    #promise = null;
    #last_progress = 0;
    #last_progress_log = 0;
    
    /** @param {string} id @param {InternalSession} session @param {string} filename */
    constructor(id, session) {
        super(id, new Download$());
        this.session = session;
        this.item = session.$.playlist[id];
        this.filename = this.$.filename = this.item.filename;
        this.controller = new AbortController();

        globals.app.downloads[this.id] = this;
        globals.app.$.downloads[this.id] = this.$;
    }

    start() {
        return this.#promise = this.#promise || (async ()=>{
            var mi = await this.session.update_media_info(this.filename);
            if (!mi) return;
            
            var name = utils.sanitize_filename_advanced(path.basename(mi.filename || mi.name || this.filename));
            var dest_path = path.join(this.dest_dir, name);
            this.$.dest_path = dest_path;
            var exists = await fs.stat(dest_path).catch(utils.noop);
            var tmp_download_path = path.join(globals.app.tmp_dir, utils.md5(this.filename) + (path.extname(mi.filename) || ".mp4"));
            if (exists) {
                this.emit("info", `'${this.filename}' already exists.`);
            } else {
                this.emit("info", `Starting download '${this.filename}'...`);
                if (mi.ytdl) {
                    this.$.stage = 0;
                    this.$.stages = 1;
                    var proc = utils.execa(globals.app.conf["core.ytdl_path"], [
                        this.filename,
                        "--no-warnings",
                        "--no-call-home",
                        "--no-check-certificate",
                        // "--prefer-free-formats", // this uses MKV on ubuntu...
                        // "--extractor-args", `youtube:skip=hls,dash,translated_subs`,
                        `--format`, globals.app.conf["core.ytdl_format"],
                        "--no-playlist",
                        "--playlist-start", "1",
                        "--playlist-end", "1",
                        `--no-mtime`,
                        "--output", tmp_download_path
                    ], {buffer:false});
                    var stdout_listener = readline.createInterface(proc.stdout);
                    this.controller.signal.onabort = ()=>{
                        proc.kill('SIGINT');
                        if (stdout_listener) stdout_listener.close();
                    }
                    var first = false;
                    stdout_listener.on("line", line=>{
                        console.log(line.trim());
                        var m;
                        if (line.match(/^\[download\] Destination\:/i)) {
                            if (first) this.$.stage++;
                            if (this.$.stage >= this.$.stages) this.$.stages = this.$.stage+1;
                            first = true;
                        } else if (m = line.match(/^\[download\]\s+(\S+)\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/i)) {
                            var percent = parseFloat(m[1]) / 100;
                            this.total = Math.floor(utils.string_to_bytes(m[2]));
                            this.bytes = Math.floor(percent * this.$.total);
                            this.speed = Math.floor(utils.string_to_bytes(m[3]));
                            this.#update_progress();
                        } else if (line.match(/^ERROR\:/i)) {
                            throw new Error(line);
                        }
                    });
                    await proc;
                } else {
                    let filename = mi.virtual_filename || this.filename;
                    await utils.download_url_to_file(filename, tmp_download_path, {
                        onProgress: (info)=>{
                            this.bytes = info.downloaded;
                            this.total = info.total;
                            this.speed = info.speed;
                            this.#update_progress();
                        },
                        signal: this.controller.signal
                    })
                }
                await fs.rename(tmp_download_path, dest_path);
                this.emit("info", `Download finished [${this.filename}]`);
            }
            return dest_path;
        })()
    }

    #update_progress() {
        var now = Date.now();
        if ((now - this.#last_progress) > progress_interval) {
            this.#last_progress = now;
            this.$.bytes = this.bytes;
            this.$.total = this.total;
            this.$.speed = this.speed;
            this.emit("progress", this.$);
        }
        if ((now - this.#last_progress_log) > progress_log_interval) {
            this.#last_progress_log = now;
            this.emit("info", `Downloading '${this.filename}', ${this.bytes}/${this.total}, ${(this.bytes/this.total*100).toFixed(2)}%, ${utils.format_bytes(this.speed)}ps...`)
        }
    }

    ondestroy() {
        this.controller.abort();
        delete globals.app.downloads[this.id];
        delete globals.app.$.downloads[this.id];
        this.#promise = null;
        return super.ondestroy();
    }
}

export default Download;