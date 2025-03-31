import { noop } from "./noop.js";

/** @param {function(string[], any, any):boolean} */
export function cleanup_prop($, props, recursive, warn) {
	if (!warn) warn = noop;
	const cleanup_prop = ($, prop, path) => {
		if (!$) return;
		if (!prop) prop = {};
		if (!path) path = [];
		if (prop.__custom__) return;
		if (typeof prop !== "object") return;
		for (let k of Object.keys($)) {
			var value = $[k];
			let new_path = [...path, k];
			let p = new_path.join(".");
			if (!(k in prop) && !prop.__enumerable__ && !(prop.__default__ && k in prop.__default__)) {
				warn(`Unrecognized property '${p}', deleting...`);
				delete $[k];
			}
			let child_prop = prop.__enumerable__ ?? prop[k];
			/* if (delete_criteria(new_path, value, child_prop)) {
				warn(`Deleting property '${p}'...`);
				delete $[k];
			} */
			if (recursive && typeof value === "object" && value !== null && child_prop) {
				cleanup_prop(value, child_prop, new_path);
			}
		}
	};
	return cleanup_prop($, props, []);
}

export default cleanup_prop;