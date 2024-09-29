module.exports = {
  apps: [
    {
      script: "./index.js",
      name: "livestreamer.root",
      cron_restart: "0 5 * * 1",
      args: []
    },
  ],
};