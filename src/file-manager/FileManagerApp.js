import express from "express";
import path from "node:path";
import compression from "compression";
import {WebServer, ElFinderEx, globals, Core, Core$} from "./exports.js";

const dirname = import.meta.dirname;

export class FileManagerApp$ extends Core$ {}

/** @extends {Core<FileManagerApp$>} */
export class FileManagerApp extends Core {
    constructor() {
        super("file-manager", new FileManagerApp$());
        globals.app = this;
    }

    async init() {
        const exp = express();

        this.web = new WebServer(exp, {
            auth: true
        });

        this.ipc.respond("volumes", ()=>Object.fromEntries(Object.entries(this.elFinder.volumes).map(([k,v])=>[k,v.config])));
        
        exp.use(compression({threshold:0}));
        
        this.elFinder = new ElFinderEx(exp, {
            volumes: [
                this.files_dir,
                ...this.conf["file-manager.volumes"]
            ],
        });
        this.elFinder.ready;

        exp.use("/", await this.serve({
            root: path.resolve(dirname, `public_html`)
        }));
    }
    async destroy(){
        await this.web.destroy();
    }
}

export default FileManagerApp;