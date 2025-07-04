import { StreamRangeServer } from "../../core/exports.js";
import { globals } from "../exports.js";
import fs from "fs-extra";
import path from "node:path";
import {utils} from "../../core/exports.js";

/** @param {string} url @param {http.IncomingMessage} req @param {http.ServerResponse} res */
export default async function (url, req, res) {
    var m;
    // https://1drv.ms/v/c/af15b118f3719717/EeU3K9JzSSxIqclcpBCqeTUBEcDmN-qrT0r3WuocJ5F6hw?e=jeDoyS
    if (m = url.match(/^https?:\/\/1drv\.ms\//)) {
        var response = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
        });
        var url = new URL(response.headers.get("Location"));
        var [driveId, fileId] = url.searchParams.get("resid").split("!");
        const downloadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`;
        if (!fileId) return;

        var fileId = m[1];
        if (!Drive) Drive = await import('@googleapis/drive');
        const auth = await authenticate();
        const drive = Drive.drive({ version: 'v3', auth });
        const metadataResponse = await drive.files.get({
            fileId,
            fields: 'id,name,size,mimeType,createdTime,modifiedTime'
        });
        const metadata = metadataResponse.data;
        var get_stream = async ({start, end}) => {
            const response = await drive.files.get(
                {
                    fileId,
                    alt: 'media',
                },
                {
                    responseType: 'stream', 
                    headers: {
                        "Range": `bytes=${start??0}-${end??""}`
                    }
                }
            );
            return response.data;
        };
        new StreamRangeServer(get_stream, {type: metadata.mimeType, size: +metadata.size}).handleRequest(req, res);
        return {
            size: metadata.size,
            name: metadata.name,
            filename: metadata.name,
            mtime: +new Date(metadata.modifiedTime),
        };
    }
}