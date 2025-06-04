import { StreamRangeServer } from "../../core/exports.js";
import { globals } from "../exports.js";
import fs from "fs-extra";
import path from "node:path";
/** @type {import('@googleapis/drive')} */
let Drive;

// Main function to get authenticated client
async function authenticate() {
    const client_secret = globals.app.conf["main.google_drive.client_secret"];
    const client_id = globals.app.conf["main.google_drive.client_id"];
    const refresh_token = globals.app.conf["main.google_drive.offline_refresh_token"];
    var token_path = path.join(globals.app.tmp_dir, "google_drive_token.json");
    const client = new Drive.auth.OAuth2(client_id, client_secret);
    let old_tokens = fs.existsSync(token_path) ? JSON.parse(fs.readFileSync(token_path)) : null;
    client.setCredentials({...old_tokens, refresh_token});
    client.on('tokens', (tokens)=>{
        fs.writeFileSync(token_path, JSON.stringify(tokens));
    });
    return client;
}

/** @param {string} url @param {http.IncomingMessage} req @param {http.ServerResponse} res */
export default async function (url, req, res) {
    var m;
    if (m = url.match(/^https?:\/\/drive\.google\.com\/(?:file\/d\/|drive\/(?:u\/\d+\/)?folders\/)([a-zA-Z0-9_-]+)/)) {
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