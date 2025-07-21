import http from 'node:http';
import { PassThrough, Readable, pipeline } from 'node:stream';
import fs from 'node:fs';
  
export class StreamRangeServer {
    /** @param {(({start: number, end: number}) => Readable)|Readable} readable @param {{size: number, type: string}} opts */
    constructor(readable, opts={}) {
        this.stream = readable;
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
        var stream;
        var start = 0, end;

        if (this.size != null && req.headers.range) {
            const parts = req.headers.range.replace(/bytes=/, '').split('-');
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : this.size - 1;
            if (isNaN(start) || isNaN(end) || start > end || end >= this.size) {
                res.writeHead(416, {
                    'Content-Range': `bytes */${this.size}`
                });
                return res.end();
            }
            headers['Content-Length'] = end - start + 1;
            headers['Content-Range'] = `bytes ${start}-${end}/${this.size}`;
            res.writeHead(206, headers);
        } else {
            headers['Content-Length'] = this.size;
            res.writeHead(200, headers);
            end = this.size;
        }
        if (req.method === "HEAD") {
            return res.end();
        }
        stream = await this.get_stream(start, end);
        pipeline(stream, res, (err)=>{
            if (err === "Premature close") return;
            if (err) console.warn(err);
        });
        stream.on('end', ()=>{
            res.end();
        });
    }

    async get_stream(start, end) {
        if (typeof this.stream === 'function') return this.stream({start, end});
        return this.stream;
    }
}

let i = 0;