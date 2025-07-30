import http from 'node:http';
import stream from 'node:stream';
import fs from 'node:fs';
/** @import {Readable} from 'node:stream'; */
  
export class StreamRangeServer {
    /** @param {(({start: number, end: number}) => Readable)|Readable} readable @param {{size: number, type: string}} opts */
    constructor(readable, opts={}) {
        this.readable = readable;
        this.size = opts.size;
        this.type = opts.type || 'application/octet-stream';
    }

    createServer() {
        return http.createServer((req, res) => {
            if (req.method !== 'GET') {
                res.writeHead(405, { 'Allow': 'GET' });
                return res.end();
            }
            this.handleRequest(req, res);
        });
    }

    /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
    async handleRequest(req, res) {
        // Handle range requests if size is known
        let headers = {
            'Accept-Ranges': 'bytes',
            'Content-Type': this.type,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'origin, range',
            'Connection': 'close',
        }
        /** @type {Readable} */
        var readable;
        var start = 0, end;

        if (req.headers.range) {
            const parts = req.headers.range.replace(/bytes=/, '').split('-');
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : this.size - 1;
            if (isNaN(start) || isNaN(end) || start > end || end >= this.size) {
                res.writeHead(416, {
                    'Content-Range': `bytes */${this.size ?? "*"}`
                });
                return res.end();
            }
            res.writeHead(206, {
                'Content-Length': end - start + 1,
                'Content-Range': `bytes ${start}-${end}/${this.size ?? "*"}`
            });
        } else {
            if (this.size != null) headers['Content-Length'] = this.size;
            res.writeHead(200, headers);
            end = this.size;
        }
        if (req.method === "HEAD") {
            return res.end();
        }
        readable = await this.get_readable(start, end);

        stream.pipeline(readable, res, (err)=>{
            if (err === "Premature close") return;
            if (err) console.warn(err);
        });

        /* var handle_end = ()=>{
            res.end();
        }
        req.on('close', handle_end);
        req.on('end', handle_end);
        req.on('error', handle_end); */
    }

    async get_readable(start, end) {
        if (typeof this.readable === 'function') return this.readable({start, end});
        return this.readable;
    }
}

let i = 0;