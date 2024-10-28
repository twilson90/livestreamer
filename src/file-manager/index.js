import express from "express";
import path from "node:path";
import compression from "compression";
import core from "../core/index.js";
import WebServer from "../core/WebServer.js";
import ElFinderEx from "./ElFinderEx.js";
import globals from "./globals.js";

const dirname = import.meta.dirname;

export class FileManagerApp {

    async init() {
        const exp = express();

        this.web = new WebServer(exp, {
            auth: true
        });

        core.ipc.respond("volumes", ()=>Object.fromEntries(Object.entries(this.elFinder.volumes).map(([k,v])=>[k,v.config])));
        
        exp.use("/", compression({threshold:0}), express.static(path.resolve(dirname, `public_html`)));
        
        this.elFinder = new ElFinderEx(exp, {
            volumes: [
                core.files_dir,
                ...core.conf["file-manager.volumes"]
            ],
        });
        await this.elFinder.init();
    }
    async destroy(){
        await this.web.destroy();
    }
}

export const app = globals.app = new FileManagerApp();
core.init("file-manager", app);
export default app;