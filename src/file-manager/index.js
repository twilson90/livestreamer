import express from "express";
import path from "node:path";
import compression from "compression";
import WebServer from "../core/WebServer.js";
import ElFinderEx from "./ElFinderEx.js";
import globals from "./globals.js";
import Core from "../core/index.js";
import * as utils from "../core/utils.js";

const dirname = import.meta.dirname;

export class FileManagerApp extends Core {
    constructor() {
        super("file-manager");
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
        
        await this.elFinder.init();

        exp.use("/", await this.serve({
            root: path.resolve(dirname, `public_html`)
        }));
    }
    async destroy(){
        await this.web.destroy();
    }
}

export default new FileManagerApp();