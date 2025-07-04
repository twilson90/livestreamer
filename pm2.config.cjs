const path = require("path");
const appspace = process.env.LIVESTREAMER_APPSPACE ?? path.basename(__dirname);

module.exports = {
	apps: [
		{
			name: `${appspace}.root`,
			namespace: appspace,
			script: path.resolve(__dirname, "index.js"),
			args: [],
			cron: process.env.LIVESTREAMER_CRON,
			env: {
				"LIVESTREAMER_APPSPACE": appspace,
			}
		},
	],
};