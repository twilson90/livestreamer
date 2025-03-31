import { array_equals } from "./array_equals.js";
import * as consts from "./constants.js";

/** @param {string} source @param {string} target */
export function relative_path(source, target) {
	var target_parts = String(target).split(consts.path_separator_regex);
	var source_parts = String(source).split(consts.path_separator_regex);
	if (array_equals(target_parts, source_parts)) {
		return ".";
	}
	var filename = target_parts.pop();
	var target_path = target_parts.join("/");
	var relative_parts = [];
	while (target_path.indexOf(source_parts.join("/")) === -1) {
		relative_parts.push("..");
		source_parts.pop();
	}
	relative_parts.push(...target_parts.slice(source_parts.length), filename);
	return relative_parts.join("/");
}

export default relative_path;