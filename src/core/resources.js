import path from "node:path";
import fs from "node:fs";
import {glob} from "glob";

export const dirs = [];

const exists = {};
let resources_dir = find_resources_dir(import.meta.dirname);

if (resources_dir) {
	add_dir(resources_dir);
}
if (process.versions.electron && import.meta.env?.BUILD && process.resourcesPath) {
	add_dir(process.resourcesPath, true);
}

export function find_resources_dir(dir) {
	const cwd = path.resolve(process.cwd());
	var last = dir;
	while (true) {
		let dirs = glob.sync("resources/", {cwd: dir, absolute: true});
		if (dirs.length) return dirs[0];
		last = dir;
		if (dir === cwd) return;
		dir = path.dirname(dir);
		if (last === dir) return;
	}
}

export function add_dir(dir, force=false) {
    if (dirs.includes(dir)) return;
	if (fs.existsSync(dir) || force) {
		dirs.unshift(dir);
	}
}

export function get_path(relative_path) {
	for (const dir of dirs) {
		const full_path = path.resolve(dir, relative_path);
		exists[full_path] = exists[full_path] ?? fs.existsSync(full_path);
		if (exists[full_path]) {
			return full_path;
		}
	}
}