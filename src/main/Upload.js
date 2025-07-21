import fs from "fs-extra";
import path from "node:path";
import {globals} from "./exports.js";
import {utils, DataNodeID, DataNodeID$} from "../core/exports.js";

const log_interval = 1 * 1000;

export class Upload$ extends DataNodeID$ {
    bytes = 0;
    total = 0;
    speed = 0;
    dest_path = "";
    status = 0;
    chunks = 0;
    bytes = 0;
}

/** @extends {DataNodeID<Upload$>} */
export class Upload extends DataNodeID {
    #last_log = 0;
    segment_tree = new utils.RangeTree();
    /** @type {Set<import("fs").WriteStream>} */
    streams = new Set();
    #speeds = [];
    #last_ts;
    #last_bytes;
    #speed_pointer=0;
    #speed_check_interval_id;
    /** @type {Set<import("http").IncomingMessage>} */
    requests = new Set();

    get finished() { return this.$.bytes >= this.$.total; }
    get bytes() { return this.$.bytes; }
    // get segments() { return this.$.segments; }
    get unique_dest_path() { return this.$.dest_path; }
    get status() { return this.$.status; }
    get filesize() { return this.$.total; }
    get chunks() { return this.$.chunks; }
    get first_and_last_chunks_uploaded() { return this.segment_tree.includes(0) && this.segment_tree.includes(this.filesize-1); }
    get first_chunk_uploaded() { return this.segment_tree.includes(0); }

    static Status = {
        STARTED:1,
        FINISHED:2,
        CANCELLED:3,
        ERROR:4,
    }

    constructor(id, dest_path, filesize, mtime=0) {
        super(id, new Upload$());

        this.$.bytes = 0;
        this.$.total = filesize;
        this.$.speed = 0;
        this.$.dest_path = dest_path;
        this.$.status = Upload.Status.STARTED;
        this.$.chunks = 0;
        
        this.mtime = mtime;

        var dir = path.dirname(dest_path);
        // var hash = utils.md5(JSON.stringify([filesize, mtime]));
        // var chunks_dir = path.join(dir, `.chunks`);
        // this.chunk_file_path = path.join(chunks_dir, `${this.id}.json`);
        // this.chunk_file_path = path.join(dir, `.chunks_${hash}`);

        globals.app.uploads[id] = this;
        globals.app.$.uploads[id] = this.$;
        globals.app.logger.info(`Starting upload '${this.unique_dest_path}'...`);

        this.ready = (async ()=>{
            await fs.mkdir(dir, {recursive:true});
            // await fs.mkdir(chunks_dir, {recursive:true});
            this.$.dest_path = await utils.unique_filename(dest_path);
            if (dest_path !== this.unique_dest_path) {
                globals.app.logger.info(`Upload (${dir}) '${path.basename(dest_path)}' -> '${path.basename(this.unique_dest_path)}'...`);
            }

            // this should force the file to be written sequentially even if chunks arrive out of order by reserving the space on disk first.
            // await utils.reserve_disk_space(this.unique_dest_path, filesize);

            await fs.truncate(this.unique_dest_path, filesize);

            this.#last_log = Date.now();
            
            this.$.status = Upload.Status.STARTED;

            this.#speed_check_interval_id = setInterval(()=>{
                var ts = Date.now();
                let speed = Math.round((this.bytes - this.#last_bytes)/((ts - this.#last_ts)/1000)) || 0;
                this.#speeds[(this.#speed_pointer++)%8] = speed;
                this.$.speed = utils.average(...this.#speeds);
                this.#last_ts = ts;
                this.#last_bytes = this.bytes;
            }, 1000);
        })();
    }

    /** @param {import("http").IncomingMessage} req @param {import("stream").Readable} stream */
    add_chunk(req, stream, start) {

        this.requests.add(req);
        
        req.on('close', () => {
            this.requests.delete(req);
            if (!req.complete) {
                this.cancel_timeout_id = setTimeout(()=>{
                    globals.app.logger.info(`Upload chunk cancelled by request closure: ${this.unique_dest_path}`);
                    this.cancel();
                }, 5000);
            }
        });

        clearTimeout(this.cancel_timeout_id);

        var writestream = fs.createWriteStream(this.unique_dest_path, {start, flags: "r+"}); // stat?"r+":"w"
        var p = start;
        this.streams.add(writestream);
        stream.on("data", (chunk)=>{
            var ts = Date.now();
            let start = p;
            let end = p + chunk.length;
            this.segment_tree.add(start, end);
            this.$.bytes = this.segment_tree.total;
            // this.$.bytes += chunk.length;
            var percent = this.bytes / this.$.total;
            if ((ts - this.#last_log) > log_interval) {
                this.#last_log = ts;
                globals.app.logger.info(`Uploading ['${this.unique_dest_path}', ${this.bytes}/${this.$.total}, ${(percent*100).toFixed(2)}%`);
            }
            p += chunk.length;
        });
        /* stream.on("error", err => {
        }); */
        return new Promise((resolve,reject)=>{
            stream
                .pipe(writestream)
                .on("error", (err)=>{
                    this.$.status = Upload.Status.ERROR;
                    this.streams.delete(writestream);
                    writestream.end();
                    this.emit("error", err);
                    reject(err);
                })
                .on("finish", ()=>{
                    resolve();
                    this.$.chunks++;
                    this.emit("chunk");
                    this.streams.delete(writestream);
                    
                    if (this.finished && this.$.status !== Upload.Status.FINISHED) {
                        this.$.status = Upload.Status.FINISHED;
                        globals.app.logger.info(`Upload finished '${this.unique_dest_path}'`);
                        writestream.on("close", ()=>{
                            // this.sync_mtime();
                            this.emit("complete");
                        });
                    }
                    if (this.status === Upload.Status.FINISHED) {
                        this.destroy();
                    }
                })
        })
    }

    /* async sync_mtime() {
        if (!this.mtime) return;
        var stat = await fs.stat(this.unique_dest_path);
        await fs.utimes(this.unique_dest_path, stat.atime, new Date(this.mtime));
    } */

    /* get first_last_parts_uploaded() {
        var mb = 1024*1024, filesize = this.filesize;
        if (filesize <= mb*2) return true;
        return this.segment_tree.includes(0,mb) && this.segment_tree.includes(filesize - mb, filesize);
    } */
    async cancel() {
        if (this.$.status === Upload.Status.CANCELLED) return;
        this.$.status = Upload.Status.CANCELLED;
        for (var s of this.streams) {
            s.close();
        }
        for (var req of [...this.requests]) {
            req.destroy();
        }
        globals.app.logger.info(`Upload cancelled by user: ${this.unique_dest_path}`);
        this.destroy();
    }

    async ondestroy() {
        delete globals.app.uploads[this.id];
        delete globals.app.$.uploads[this.id];
        clearInterval(this.#speed_check_interval_id);
        return super.ondestroy();
    }
}

export default Upload;