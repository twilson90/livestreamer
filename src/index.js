import core from "./core/index.js";

if (process.versions.electron) {
    import("./electron/index.js").then(({ ElectronApp })=>{
        core.init("electron", new ElectronApp(), {
            modules: [
                "media-server",
                "main"
            ]
        });
    })
} else {
    core.init(null, null, {
        modules: [
            "media-server",
            "file-manager",
            "main"
        ]
    });
}