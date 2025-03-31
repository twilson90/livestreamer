import { key_count } from "./key_count.js";

/** @template T @param {Record<PropertyKey,T>} ob @param {number} max_size  @returns {T[]} */

export function trim_object(ob, max_size) {
	var result = [];
	var num_keys = key_count(ob);
	for (var k in ob) {
		if (num_keys <= max_size) break;
		result.push(ob[k]);
		delete ob[k];
		num_keys--;
	}
	return result;
}

export default trim_object;