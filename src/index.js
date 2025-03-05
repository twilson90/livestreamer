import livestreamer from "./core/exports.js";
import "./electron/index.js";
livestreamer({
    modules: [
        "media-server",
        "file-manager",
        "main"
    ]
});