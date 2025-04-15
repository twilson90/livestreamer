import { remove_trailing_slash } from "./remove_trailing_slash.js";
import { path_separator_regex } from "./path_separator_regex.js";

/** @param {*} filename */
export function basename(filename) {
	filename = String(filename);
	return remove_trailing_slash(filename).split(path_separator_regex).pop();
}

export default basename;