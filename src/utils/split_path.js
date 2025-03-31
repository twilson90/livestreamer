import * as consts from "./constants.js";

/** @param {string} path */
export function split_path(path) {
	return path.split(consts.path_separator_regex).filter(p => p);
}

export default split_path;