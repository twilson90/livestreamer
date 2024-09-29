import os from "node:os";
import path from "node:path";

export default {

	"core.debug": true,
	"file-manager.volumes": [
		{
			"name": "downloads",
			"driver": "LocalFileSystem",
			"root": path.join(os.homedir(), "Downloads"),
		},
	],
}