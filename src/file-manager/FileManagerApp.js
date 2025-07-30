import express from "express";
import path from "node:path";
import compression from "compression";
import {ElFinderEx, globals} from "./exports.js";
import {CoreFork, WebServer} from "../core/exports.js";

const dirname = import.meta.dirname;

/** @extends {CoreFork<FileManagerApp$>} */
export class FileManagerApp extends CoreFork {
    constructor() {
        super("file-manager", {});
        globals.app = this;
    }

    async init() {

        const exp = express();

        this.web = new WebServer(exp, {
            auth: true,
            allow_unauthorised: false,
        });
        
        exp.use(compression({threshold:0}));
        
        this.elFinder = new ElFinderEx(exp, {
            volumes: {
                "files": {
                    "name": "Files",
                    "driver": "LocalFileSystem",
                    "root": this.files_dir,
                },
                ...this.conf["file-manager.volumes"]
            },
        });
        await this.elFinder.ready;

        this.ipc.respond("volumes", ()=>this.elFinder.volume_configs);
        this.ipc.respond("add_volume", (...args)=>this.elFinder.add_volume(...args));
        this.ipc.respond("edit_volume", (...args)=>this.elFinder.edit_volume(...args));
        this.ipc.respond("delete_volume", (...args)=>this.elFinder.delete_volume(...args));
        this.ipc.emit("file-manager.volumes", this.elFinder.volume_configs);

        exp.use("/", await this.serve({
            root: path.resolve(dirname, `public_html`)
        }));
    }
    async _destroy(){
        await this.web.destroy();
        return super._destroy();
    }
}

export default FileManagerApp;