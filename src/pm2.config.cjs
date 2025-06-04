const path = require("path");
module.exports = {
    apps: [
        {
            namespace: "livestreamer",
            name: "livestreamer.core",
            script: path.resolve(__dirname, "index.js"),
            windowsHide: true,
            wait_ready: true,
            // cron_restart: "0 5 * * 1",
        },
    ],
};