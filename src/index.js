
import { createRequire } from 'node:module';
import { start } from "./core/exports.js";
import { glob } from "glob";

if (process.versions.electron) {
    console.log("Running in Electron environment");
    const require = createRequire(import.meta.url);
    var index = glob.sync("./electron/index.*", {cwd: import.meta.dirname, absolute: true })[0];
    require(index);
}

start({
    modules: [
        "media-server",
        "file-manager",
        "main"
    ]
});