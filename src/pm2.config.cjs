const path = require("path");
const appspace = process.env.LIVESTREAMER_APPSPACE || "livestreamer";

module.exports = {
	apps: [
		{
			name: `${appspace}.root`,
			namespace: appspace,
			// cwd: __dirname,
			script: path.resolve("index.js"),
			args: [],
			cron_restart: process.env.LIVESTREAMER_CRON,
			exec_mode: 'fork',
			env: {
				"LIVESTREAMER_APPSPACE": appspace,
			},
			kill_timeout: 5000,
			node_args: process.env.LIVESTREAMER_DEBUG ? ["--inspect=0.0.0.0:9229"] : [],
			windowsHide: true,
		},
	],
};