import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import readline from "node:readline";
import {globals, utils, DataNodeID, DataNodeID$} from "./exports.js";
/** @import {InternalSession} from "./exports.js" */

const log_interval = 5 * 1000;

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
    get filename() { return this.$.filename; };
    get dest_dir() { return this.session.files_dir || globals.app.files_dir; }
    #promise = null;
    #cancel = null;
    #last_log = 0;
    
    /** @param {string} id */
    /** @param {InternalSession} session */
    constructor(id, session) {
        super(id, new Download$());
        this.session = session;

        globals.app.downloads[this.id] = this;
        globals.app.$.downloads[this.id] = this.$;
        this.$.filename = session.$.playlist[id].filename;
    }

    start() {
        if (!this.#promise) {
            this.#promise = new Promise(async (resolve,reject)=>{
                this.$.bytes = 0;
                this.$.total = 0;
                this.$.speed = 0;
                var mi = await this.session.update_media_info(this.filename, {force:true});
                if (!mi) return;
                
                var name = mi.filename;
                var dest_path = path.join(this.dest_dir, name);
                this.$.dest_path = dest_path;
                var exists = await fs.stat(dest_path).catch(utils.noop);
                var fail;
                var tmp_download_path;
                if (exists) {
                    globals.app.logger.info(`'${this.filename}' already exists.`);
                } else {
                    globals.app.logger.info(`Starting download '${this.filename}'...`);
                    if (mi.ytdl) {
                    this.$.stage = 0;
                    this.$.stages = 1;
                    tmp_download_path = path.join(os.tmpdir(), name)
                        var proc = utils.execa(globals.app.conf["core.ytdl_path"], [
                            this.filename,
                            "--no-warnings",
                            "--no-call-home",
                            "--no-check-certificate",
                            // "--prefer-free-formats", // this uses MKV on ubuntu...
                            // "--extractor-args", `youtube:skip=hls,dash,translated_subs`,
                            `--format`, globals.app.conf["core.ytdl_format"],
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
                                // globals.app.logger.error(`[download] ${line}`)
                            }
                        });
                        proc.on("error", (e)=>{
                            globals.app.logger.error(e);
                            globals.app.logger.warn(`Download [${this.filename}] interrupted.`);
                            fail = true;
                        });

                        await new Promise(resolve=>proc.on("exit", resolve));
                    } else {
                        const response = await fetch(this.filename);
                        const reader = response.body.getReader();
                        const writer = fs.createWriteStream(tmp_download_path);
                        this.$.total = parseInt(response.headers.get('content-length'));
                        let receivedBytes = 0;

                        while (true) {
                            const {done, value} = await reader.read();
                            if (done) break;

                            receivedBytes += value.length;
                            writer.write(value);
                            this.$.bytes = receivedBytes;
                            this.$.total = Math.max(this.$.total, receivedBytes);
                            this.$.speed = receivedBytes / ((Date.now() - this.#last_log) / 1000);

                            const now = Date.now();
                            if ((now - this.#last_log) > log_interval) {
                                this.#last_log = now;
                                const percent = (receivedBytes / this.$.total * 100).toFixed(2);
                                this.emit("info", `Downloading '${this.filename}', ${receivedBytes}/${this.$.total}, ${percent}%, ${utils.format_bytes(this.$.speed)}ps...`);
                            }
                        }
                        writer.end();
                    }

                    if (!fail && tmp_download_path) {
                        await fs.rename(tmp_download_path, dest_path);
                        globals.app.logger.info(`Download finished [${this.filename}]`);
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

    ondestroy() {
        this.cancel();
        delete globals.app.downloads[this.id];
        delete globals.app.$.downloads[this.id];
        if (this.stdout_listener) this.stdout_listener.close();
        if (this.stderr_listener) this.stderr_listener.close();
        this.stdout_listener = null;
        this.stderr_listener = null;
        this.#promise = null;
        this.#cancel = null;
        return super.ondestroy();
    }
}

export default Download;