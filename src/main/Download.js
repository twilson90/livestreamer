import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import readline from "node:readline";
import core from "../core/index.js";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import globals from "./globals.js";

const log_interval = 5 * 1000;

export class Download extends DataNode {
    get filename() { return this.$.filename; };
    get promise() { return this.#promise; };
    #promise = null;
    #cancel = null;
    #last_log = 0;
    
    constructor(id, filename, dest_dir) {
        super(id);
        globals.app.downloads[this.id] = this;
        globals.app.$.downloads[this.id] = this.$;

        this.dest_dir = dest_dir || core.files_dir;
        this.$.filename = filename;
    }

    start() {
        if (!this.#promise) {
            this.#promise = new Promise(async (resolve,reject)=>{
                this.$.bytes = 0;
                this.$.total = 0;
                this.$.speed = 0;
                var mi = await globals.app.probe_media(this.filename);

                if (mi.probe_method != "youtube-dl") return;
                
                var name = mi.filename
                var dest_path = path.join(this.dest_dir, name);
                this.$.dest_path = dest_path;
                var exists = await fs.stat(dest_path).catch(()=>{});
                var fail;
                var tmp_download_path;
                if (exists) {
                    core.logger.info(`'${this.filename}' already exists.`);
                } else {
                    core.logger.info(`Starting download '${this.filename}'...`);
                    this.$.stage = 0;
                    this.$.stages = 1;
                    tmp_download_path = path.join(os.tmpdir(), name)
                    var proc = utils.execa(core.conf["main.youtube_dl"], [
                        this.filename,
                        "--no-warnings",
                        "--no-call-home",
                        "--no-check-certificate",
                        // "--prefer-free-formats", // this uses MKV on ubuntu...
                        // "--extractor-args", `youtube:skip=hls,dash,translated_subs`,
                        `--format`, core.conf["main.youtube_dl_format"],
                        `--no-mtime`,
                        "--output", tmp_download_path
                    ], {buffer:false});
                    this.#cancel = ()=>utils.tree_kill(proc.pid, 'SIGINT');
                    this.stdout_listener = readline.createInterface(proc.stdout);
                    var first = false;
                    this.stdout_listener.on("line", line=>{
                        var m;
                        // console.log(line);
                        if (line.match(/^\[download\] Destination\:/i)) {
                            if (first) this.$.stage++;
                            if (this.$.stage >= this.$.stages) this.$.stages = this.$.stage+1;
                            first = true;
                        } else if (m = line.match(/^\[download\]\s+(\S+)\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/i)) {
                            var percent = parseFloat(m[1]) / 100;
                            this.$.total = Math.floor(utils.string_to_bytes(m[2]));
                            this.$.bytes = Math.floor(percent * this.$.total);
                            this.$.speed = Math.floor(utils.string_to_bytes(m[3]));
                            var now = Date.now();

                            if ((now - this.#last_log) > log_interval) {
                                this.#last_log = now;
                                this.emit("info", `Downloading '${this.filename}', ${this.$.bytes}/${this.$.total}, ${(percent*100).toFixed(2)}%, ${utils.format_bytes(this.$.speed)}ps...`)
                            }
                        } else if (line.match(/^ERROR\:/i)) {
                            this.emit("error", line);
                            // core.logger.error(`[download] ${line}`)
                        }
                    });
                    proc.on("error", (e)=>{
                        core.logger.error(e);
                        core.logger.warn(`Download [${this.filename}] interrupted.`);
                        fail = true;
                    });

                    await new Promise(resolve=>proc.on("exit", resolve));

                    if (!fail && tmp_download_path) {
                        await fs.rename(tmp_download_path, dest_path);
                        core.logger.info(`Download finished [${this.filename}]`);
                    }
                }

                if (fail) reject();
                else resolve(dest_path);
                    
                this.#cancel = null;
                this.destroy();
            });
        }
        return this.#promise;
    }

    cancel() {
        if (this.#cancel) this.#cancel();
    }

    destroy() {
        this.cancel();
        super.destroy();
        delete globals.app.downloads[this.id];
        delete globals.app.$.downloads[this.id];
        if (this.stdout_listener) this.stdout_listener.close();
        if (this.stderr_listener) this.stderr_listener.close();
        this.stdout_listener = null;
        this.stderr_listener = null;
        this.#promise = null;
        this.#cancel = null;
        this.emit("destroy");
    }
}

export default Download;