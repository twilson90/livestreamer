import mime from "mime";
import { StreamRangeServer } from "../../core/StreamRangeServer.js";
import {File} from "megajs";

/** @param {string} url @param {http.IncomingMessage} req @param {http.ServerResponse} res */
export default async function(url, req, res) {
    var m;
    if (m = url.match(/^https?:\/\/mega\.nz\/(?:file|folder)\/([a-zA-Z0-9_-]+#[a-zA-Z0-9_-]+)/i)) {
        var file = await File.fromURL(url);
        await file.loadAttributes();
        if (file.children.length) {
            file = file.children.find(c=>c.downloadId[0] == file.downloadId && c.downloadId[1] == file.loadedFile);
        }
        if (!file) {
            return;
        }
        var size = file.size;
        var type = mime.getType(file.name);
        new StreamRangeServer(({start,end})=>file.download({start, end}), {size, type}).handleRequest(req, res);
        return {
            size: file.size,
            name: file.name,
            filename: file.name,
            mtime: file.createdAt,
        };
    }
}