import path from "node:path";
import fs from "fs-extra";
import * as utils from "../core/utils.js";
import globals from "./globals.js";

export class Plugin {
    constructor(id, dir, options) {
        this.id = id;
        this.dir = path.resolve(dir);
        if (globals.app.$.plugins[this.id]) delete globals.app.$.plugins[this.id];
        var json = JSON.parse(fs.readFileSync(path.join(this.dir, "plugin.json"), "utf-8"));
        globals.app.plugins[this.id] = this;
        globals.app.$.plugins[this.id] = {
            id: this.id,
            front_js: fs.readFileSync(path.join(this.dir, json.front), "utf-8"),
            front_url: `plugins/${this.id}/`+json.front,
            core: json.core,
            options
        };
        if (json.core) utils.import(file_url(json.core));
    }

    destroy() {
        delete globals.app.plugins[this.id];
        delete globals.app.$.plugins[this.id];
        // this.watcher.close();
    }
}

export default Plugin;