import fs from "fs-extra";
import path from "node:path";
import child_process from "node:child_process";
import stream from "node:stream";
import events from "node:events";
import os from "node:os";
import * as tar from "tar";
import * as uuid from "uuid";
import is_image from "is-image";
import { execa } from "execa";
import pidtree from "pidtree";
import { Agent, setGlobalDispatcher } from 'undici'
import { glob, Glob } from "glob";
import {noop} from "../utils/noop.js";
import {pathify} from "../utils/pathify.js";
import { fileURLToPath } from "url";
import { StopWatchBase } from "../utils/StopWatch.js";
export * from "../utils/exports.js";

const speed_window = 16;

/** @import { Path } from "glob"; */

//command: string, args: ReadonlyArray<string>, options: SpawnOptions
// /** @param {string} command @param {readonly string[]} args @param {child_process.SpawnOptions} options */
// export function spawn(command, args, options) {
//     options = {windowsHide:true, ...options };
//     try {
//         return child_process.spawn(command, args, options);
//     } catch (e) {
//         console.error(e);
//     }
// }

export function is_windows() { return !!process.platform.match(/^win/i); }

/** @template T @param {any} o @param {T} type @returns {T} */
export function cast(o, type) { return o; }

export function strip_ext(name) {
    const extension = path.extname(name);
    if (!extension) {
        return name;
    }
    return name.slice(0, -extension.length);
}

export async function read_last_lines(input_file_path, max_lines, encoding, buffer_size) {
    buffer_size = buffer_size || 16 * 1024;
    const nl = "\n".charCodeAt(0);
    var [stat, file] = await Promise.all([
        fs.stat(input_file_path),
        fs.open(input_file_path, "r")
    ]);
    let lines = [];
    var chunk = Buffer.alloc(buffer_size);
    let leftover = [];
    var add_line = (buffer)=>{
        lines.push(encoding ? buffer.toString(encoding) : buffer);
    }
    let pos = stat.size;
    while (pos) {
        pos -= buffer_size
        if (pos < 0) {
            buffer_size += pos;
            pos = 0;
        }
        await fs.read(file, chunk, 0, buffer_size, pos);
        let i = buffer_size;
        let last_nl_index = buffer_size;
        while (i--) {
            if (chunk[i] === nl) {
                let temp = chunk.subarray(i+1, last_nl_index);
                if (leftover.length) {
                    temp = Buffer.from([...temp, ...leftover]);
                    leftover = [];
                }
                add_line(temp);
                last_nl_index = i;
                if (lines.length >= max_lines) break;
            }
        }
        if (lines.length >= max_lines) break;
        leftover = Buffer.from([...chunk.subarray(0, last_nl_index), ...leftover]);
        if (pos == 0) {
            add_line(leftover);
        }
    }
    lines.reverse();
    await fs.close(file);
    return lines;
}

export {is_image};

export async function is_dir_empty(p) {
    try {
        const directory = await fs.opendir(p);
        const entry = await directory.read();
        await directory.close();
        return entry === null;
    } catch (error) {
        return false;
    }
}

export async function can_write_file(filepath, size) {
    try {
        const stats = fs.statfs(path.parse(filepath).root);
        const free = stats.bsize * stats.bfree;
        return free >= size;
    } catch (error) {
        console.error('Error checking disk space:', error);
        return false;
    }
}

export async function unique_filename(filepath) {
    let n = 0;
    let ext = path.extname(filepath);
    let filename = path.basename(filepath, ext);
    let dir = path.dirname(filepath);
    while (true) {
        let stat = await fs.stat(filepath).catch(noop);
        if (!stat) return filepath;
        let suffix = (n == 0) ? ` - Copy` : ` - Copy (${n+1})`;
        filepath = path.join(dir, filename + suffix + ext);
        n++;
    }
}

export async function readdir_stats(dir){
    var files = await fs.promises.readdir(dir);
    return Promise.all(files.map(filename=>fs.promises.lstat(path.join(dir, filename)).then(stat=>({filename,stat}))));
}

export async function get_most_recent_file_in_dir(dir){
    var files = await fs.promises.readdir(dir);
    return (await order_files_by_mtime(files, dir)).pop();
}

export async function order_files_by_mtime(files, dir){
    var stat_map = {};
    await Promise.all(files.map((filename)=>(async()=>{
        var fullpath = dir ? path.join(dir, filename) : filename;
        stat_map[filename] = await fs.promises.lstat(fullpath);
    })()));
    return files
        .map(filename=>({filename, stat:stat_map[filename]}))
        .filter(f=>f.stat.isFile())
        .sort((a,b)=>a.stat.mtime-b.stat.mtime)
        .map(f=>f.filename);
}

export function uuidb64() {
    return Buffer.from(uuid.v4().replace(/-/g, '')).toString("base64url");
}

export function uuid4() {
    return uuid.v4();
}

export async function order_files_by_mtime_descending(files, dir){
    return (await order_files_by_mtime(files, dir)).reverse();
}

export function split_spaces_exclude_quotes(string) {
    let match, matches = [];
    const groupsRegex = /[^\s"']+|(?:"|'){2,}|"(?!")([^"]*)"|'(?!')([^']*)'|"|'/g;
    while ((match = groupsRegex.exec(string))) {
        if (match[2]) {
            matches.push(match[2]);
        } else if (match[1]) {
            matches.push(match[1]);
        } else {
            matches.push(match[0]);
        }
    }
    return matches;
}

export function has_root_privileges(){
    return !!(process.getuid && process.getuid() === 0);
}

export async function  compress_logs_directory(dir){
    var now = Date.now();
    // core.logger.info(`Compressing '${dir}'...`);
    var dayago = now - (24 * 60 * 60 * 1000);
    var promises = [];
    var files = await fs.readdir(dir);
    files = files.filter(filename=>filename.match(/\.log$/));
    files = await order_files_by_mtime_descending(files, dir);
    for (let filename of files) {
        let fullpath = path.join(dir, filename);
        let stats = await fs.lstat(fullpath);
        let tar_path = `${fullpath}.tgz`;
        if (+stats.mtime < dayago) {
            var t = Date.now();
            promises.push(
                (async()=>{
                    await tar.create({gzip:true, file:tar_path, cwd:dir, portable:true}, [filename]).catch(noop);
                    // core.logger.info(`Compressed '${fullpath}' in ${Date.now()-t}ms.`);
                    await fs.utimes(tar_path, stats.atime, stats.mtime);
                    await fs.unlink(fullpath);
                })()
            );
        }
    }
    await Promise.all(promises);
    // core.logger.info(`Compression of '${dir}' took ${Date.now()-now}ms.`)
}
  
export const array_avg = function (arr) {
    if (arr && arr.length >= 1) {
        const sumArr = arr.reduce((a, b) => a + b, 0)
        return sumArr / arr.length;
    }
}

export function cpu_average() {
    var totalIdle = 0, totalTick = 0;
    var cpus = os.cpus();
    for (var i = 0, len = cpus.length; i < len; i++) {
        var cpu = cpus[i];
        for (var type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    }
    return {idle: totalIdle / cpus.length, total: totalTick / cpus.length};
}
  
// load average for the past 1000 milliseconds calculated every 100
/** @returns {number} */
export function get_cpu_load_avg(avgTime = 1000, delay = 100) {
    return new Promise((resolve, reject) => {
        const n = ~~(avgTime / delay);
        if (n <= 1) {
            reject('Error: interval to small');
        }
        let i = 0;
        let samples = [];
        const avg1 = cpu_average();
        let interval = setInterval(() => {
            if (i >= n) {
                clearInterval(interval);
                resolve(array_avg(samples));
            }
            const avg2 = cpu_average();
            const totalDiff = avg2.total - avg1.total;
            const idleDiff = avg2.idle - avg1.idle;
            samples[i] = (1 - idleDiff / totalDiff);
            i++;
        }, delay);
    });
}

export { promisify } from "node:util";
export { pidtree, execa }

export function build_hierarchy_from_indented_string(str) {
    const lines = str.split('\n');
    const root = {};
    const stack = [{ level: -1, node: root }];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue; // Skip empty lines

        const leadingSpaces = line.match(/^ */)[0].length;
        const key = trimmedLine;
        const currentLevel = leadingSpaces;

        // Pop stack until we find a parent level
        while (stack.length > 0 && stack[stack.length - 1].level >= currentLevel) {
            stack.pop();
        }

        // Get parent node and add new key
        const parent = stack[stack.length - 1].node;
        parent[key] = {};

        // Push new node onto the stack
        stack.push({ level: currentLevel, node: parent[key] });
    }

    return root;
}

/** @returns {AsyncIterable<Path>} */
export async function *find_symlinks(dir, broken=false) {
    /** @type {AsyncGenerator<Path>} */
    var g = new Glob("**", {cwd:dir, absolute:true, nodir:true, stat:true, withFileTypes:true});
    for await (var f of g) {
        if (!f.isSymbolicLink()) continue;
        if (broken !== undefined) {
            const targetPath = await f.readlink();
            const resolvedTargetPath = path.resolve(path.dirname(f.fullpath()), targetPath);
            const targetBroken = await fs.access(resolvedTargetPath).then(()=>true).catch(()=>false);
            if (broken !== targetBroken) continue;
        }
        yield f;
    }
}

export function ffmpeg_escape_file_path(str) {
    // if (is_windows()) str = str.replace(/\\/g, "/");
    return ffmpeg_escape(str);
}

export function ffmpeg_escape(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/,/g, '\\,'); // not sure about the comma
}

export function ffmpeg_escape_av_file_path(str) {
    // if (is_windows()) str = str.replace(/\\/g, "/");
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'\\''").replace(/:/g, '\\:').replace(/,/g, '\\,'); // not sure about the comma
}

/* export function ffmpeg_escape_av_file_path(str) {
    if (is_windows()) str = str.replace(/\\/g, "/");
    return str.replace(/\\/g, "\\\\\\\\").replace(/'/g, `\\\\'`).replace(/:/g, "\\:")
} */

// export function ffmpeg_escape(str) {
//     return str.replace(/\\/g, "\\\\\\\\").replace(/'/g, `'\\\\''`).replace(/:/g, "\\:")
// }

export async function append_line_truncate(filePath, line, maxLines=512) {
    var data = await fs.readFile(filePath, 'utf8').catch(noop);
    let lines = data ? data.split('\n') : [];
    lines.push(line);
    if (lines.length > maxLines) {
        lines = lines.slice(lines.length - maxLines);
    }
    const updatedContent = lines.join('\n');
    await fs.writeFile(filePath, updatedContent, 'utf8');
}

/** @template T */
export class AsyncIteratorLoop {
    /** @type {Function():Iterator<T>} */
    #generator;
    /** @type {Iterator<T>} */
    #iterator;
    /** @type {Iterator<any>} */
    #looped_iterator;
    constructor(generator, fn) {
        this.#generator = generator;
        this.#iterator = this.#generator();
        this.#looped_iterator = this.#start_loop();
    }

    next() {
        return this.#looped_iterator.next();
    }
    
    async *#start_loop() {
        while (true) {
            var r = this.#iterator.next();
            if (r.done === true) {
                yield;
                this.#iterator = this.#generator();
            } else {
                yield r.value;
            }
        }
    }
}

export function* iterate_keys(obj) {
    for (var k in obj) yield k;
}

/** @template T @param {(() => Iterable<T>) | Iterable<T>} generator */
export function* infinite_iterator(generator) {
    while (true) {
        let hasItems = false;
        var iterable = typeof generator === "function" ? generator() : generator;
        for (const item of iterable) {
            hasItems = true;
            yield item;
        }
        if (!hasItems) {
            yield undefined;
        }
    }
}

export function url_exists(url) {
    if (typeof url !== "string") url = url.toString();
    if (url.match(/^file:/)) return fs.exists(pathify(url));
    return fetch(url, { method: 'head' }).then((res)=>!String(res.status).match(/^4\d\d$/)).catch(()=>false);
}

/** @param {string} url @param {RequestInit} options */
// export function fetch_without_ssl(url, options) {
//     return fetch(url, {
//         ...options,
//         dispatcher: httpsAgent
//     });
// }

/** @param {Response} response */
export async function* stream_response(response) {
    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
                if (done) break;
            yield value;
        }
    } finally {
        reader.releaseLock();
    }
}

export function get_node_modules_dir(module) {
    var f = fileURLToPath(module ? import.meta.resolve(module) : import.meta.url);
    while(path.basename(f) != "node_modules" || path.basename(f) == f) f = path.dirname(f);
    return f;
}

export class StopWatchHR extends StopWatchBase {
	__get_now() { return performance.now(); }
}

/** @typedef {{downloaded: number, total: number, percent: number, speed: number}} Progress */
var default_download_opts = {
    /** @type {number} set to 0 to disable chunking */
    chunk_size: 1024 * 1024 * 8,
    /** @type {number} */
    progress_interval: 1024 * 64,
    /** @type {AbortController} */
    controller: null,
    start: 0,
    end: 0,
    /** @type {Agent} */
    agent: undefined,
}
/** @extends {events.EventEmitter<{data:[Buffer], progress:[Progress]}>} */
export class Downloader extends events.EventEmitter {
    /** @type {string} */
    #url;
    /** @type {typeof default_download_opts} */
    #opts;
    /** @type {AbortController} */
    #controller;
    #started;
    /** @param {string} url @param {typeof default_download_opts} opts */
    constructor(url, opts) {
        super();
        this.#url = url;
        this.#opts = {
            ...default_download_opts,
            ...opts
        }
        this.#controller = opts.controller ?? new AbortController();
    }

    async download() {
        return this.#started = this.#started ?? (async()=>{
            let downloaded_bytes = 0;
            let progress_bytes = 0;
            let last_progress_update = 0;
            var start_ts = Date.now();
            var {chunk_size, progress_interval, start, end, agent} = this.#opts;

            chunk_size = Math.max(chunk_size, 0);
            progress_interval = Math.max(progress_interval, 0);
            start = Math.max(start, 0);
            end = Math.max(end, 0);
        
            downloaded_bytes = start ?? 0;
            let accept_ranges;
            let file_size = 0;
        
            if (chunk_size || start || end) {
                const head_res = await fetch(this.#url, { method: 'HEAD', signal: this.#controller.signal, agent });
                if (!head_res.ok) throw new Error(`HEAD request failed: ${head_res.status}`);
                
                file_size = parseInt(head_res.headers.get('content-length'));
                accept_ranges = head_res.headers.get('accept-ranges') === 'bytes';
                
                if (!accept_ranges) {
                    console.warn('Server does not support byte ranges - cannot resume downloads');
                    downloaded_bytes = 0;
                    chunk_size = 0;
                    start = 0;
                    end = null;
                }
            }
            var done = false;
            
            while (!done) {
                let headers = {};
                if (accept_ranges && file_size) {
                    let next_end_bytes = [file_size - 1];
                    if (end) next_end_bytes.push(end - 1);
                    if (chunk_size) next_end_bytes.push(downloaded_bytes + chunk_size - 1);
                    let end_byte = Math.min(...next_end_bytes);
                    headers['Range'] = `bytes=${downloaded_bytes}-${end_byte}`;
                }
                const res = await fetch(this.#url, {
                    headers,
                    agent,
                    signal: this.#controller.signal
                });
                if (res.status !== 206 && res.status !== 200) {
                    throw new Error(`Unexpected status: ${res.status}`);
                }

                // Process the stream in chunks
                for await (const chunk of stream_response(res)) {
                    const now = Date.now();
                    downloaded_bytes += chunk.length;
                    progress_bytes += chunk.length;
                    let speed = progress_bytes / ((now - start_ts) / 1000);

                    this.emit('data', chunk);
                    
                    if ((downloaded_bytes - last_progress_update >= progress_interval) || (downloaded_bytes === file_size)) {
                        let p = {
                            downloaded: downloaded_bytes,
                            total: file_size,
                            percent: downloaded_bytes / file_size,
                            speed
                        };
                        this.emit('progress', p);
                        last_progress_update = downloaded_bytes;
                    }
                }
                done = downloaded_bytes >= file_size;
            }
            this.emit("end");
        })();
    }

    start() {
        return this.download();
    }

    abort() {
        this.#controller.abort();
    }
    
    stream() {
        var out = new stream.PassThrough();
        this.on('data', (chunk)=>out.write(chunk));
        this.on("end", ()=>new Promise(resolve=>out.end(resolve)));
        this.start();
        return out;
    }
    
    /** @param {string} file */
    async file(file, resume=false) {
        if (resume) {
            const exists = await fs.exists(file).catch(noop);
            const stat = exists ? await fs.stat(file).catch(noop) : null;
            if (stat) this.#opts.start = stat.size;
            else resume = false;
        }
        var out = fs.createWriteStream(file, {flags: resume ? 'r+' : 'w'});
        this.stream().pipe(out);
        return this.start();
    }
}

// prevents bad SSL being rejected.
// weird place to put this.
const httpsAgent = new Agent({
    connect: { rejectUnauthorized: false }
});
setGlobalDispatcher(httpsAgent);