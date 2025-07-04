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
            volumes: [
                {
                    "name": "Files",
                    "driver": "LocalFileSystem",
                    "root": this.files_dir,
                },
                ...this.conf["file-manager.volumes"]
            ],
        });
        await this.elFinder.ready;

        this.ipc.respond("volumes", ()=>Object.fromEntries(Object.entries(this.elFinder.volumes).map(([k,v])=>[k,v.config])));

        exp.use("/", await this.serve({
            root: path.resolve(dirname, `public_html`)
        }));
    }
    async destroy(){
        await this.web.destroy();
        return super.destroy();
    }
}

export default FileManagerApp;