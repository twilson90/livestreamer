// import { merge } from "./merge.js";

/** @template T @param {T} o1 @param {object} o2 @param {{delete_nulls:boolean, skip_nulls:boolean}} opts */
export function deep_merge(o1, o2, opts) {
	var {delete_nulls, skip_nulls} = opts ?? {};
	var is_array = Array.isArray(o2);
	for (var k in o2) {
		if (o2[k] == null && skip_nulls) continue;
		if (o2[k] == null && delete_nulls) delete o1[k];
		else if (typeof o1[k] === "object" && o1[k] !== null && typeof o2[k] === 'object' && o2[k] !== null) {
			let o1k_is_array = Array.isArray(o1[k]);
			let o2k_is_array = Array.isArray(o2[k]);
			if (o1k_is_array == o2k_is_array) {
				deep_merge(o1[k], o2[k], opts);
			} else {
				o1[k] = deep_merge(Array.isArray(o2[k]) ? [] : {}, o2[k], opts);
			}
		} else {
			o1[k] = o2[k];
		}
	}
	if (is_array) o1.length = o2.length;
	return o1;
}

export default deep_merge;