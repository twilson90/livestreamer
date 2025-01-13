const path = require("path");

module.exports = {
  apps: [
    {
      name: "livestreamer.root",
      script: path.resolve(__dirname, "index.js"),
      cron_restart: "0 5 * * 1",
      args: []
    },
  ],
};