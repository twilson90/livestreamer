import { deep_merge } from "./deep_merge.js";
/** @param {object} o1 @param {object[]} objects */
export function deep_assign(o1, ...objects) {
	if (typeof o1 !== "object") throw new Error(`deep_assign requires Object as first argument`);
	for (var o2 of objects) {
		deep_merge(o1, o2);
	}
	return o1;
}

export default deep_assign;