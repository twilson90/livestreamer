import { path_separator_regex } from "./path_separator_regex.js";

/** @param {string} path */
export function split_path(path) {
	return path.split(path_separator_regex).filter(p => p);
}

export default split_path;