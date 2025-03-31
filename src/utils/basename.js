import { remove_trailing_slash } from "./remove_trailing_slash.js";
import * as consts from "./constants.js";

/** @param {*} filename */
export function basename(filename) {
	filename = String(filename);
	return remove_trailing_slash(filename).split(consts.path_separator_regex).pop();
}

export default basename;