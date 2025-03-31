import { array_starts_with } from "./array_starts_with.js";

/** @param {any|any[]} obj @param {(function(PropertyKey,any):boolean)|string[][]} filter_callback @returns {T} */
export function deep_filter(obj, filter_callback) {
	if (Array.isArray(filter_callback)) {
		var paths = filter_callback;
		filter_callback = (k, v, path) => paths.some(p => array_starts_with(path, p));
	}
	/** @param {any} obj @param {string[]} path */
	var walk = (obj, path) => {
		if (typeof obj !== "object" || obj === null) return obj;
		let new_obj = Array.isArray(obj) ? [] : {};
		for (var k of Object.keys(obj)) {
			var new_path = [...path, k];
			if (filter_callback.apply(obj, [k, obj[k], new_path])) {
				new_obj[k] = walk(obj[k], new_path);
			}
		}
		return new_obj;
	};
	return walk(obj, []);
}

export default deep_filter;