import {start} from "./exports.js";

// const dirname = import.meta.dirname;
// cwd: dirname,

start({
    modules: [
        "media-server",
        "file-manager",
        "main"
    ]
});