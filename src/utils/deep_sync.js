import { json_copy } from "./json_copy.js";

/** 
 * Syncs two objects to become identical, preserving only key order differences.
 * @param {object} dst - The destination object to sync into
 * @param {object} src - The source object to sync from
 * @returns {object} The synced destination object
 */
export function deep_sync(dst, src) {
	var old_keys = Object.keys(dst);
	for (var k in src) {
		if (src[k] === dst[k]) continue;
		if (src[k] !== null && dst[k] !== null && typeof src[k] === 'object' && typeof dst[k] === 'object' && Array.isArray(src[k]) == Array.isArray(dst[k])) {
			deep_sync(dst[k], src[k]);
		} else {
			dst[k] = json_copy(src[k]);
		}
	}
	if (Array.isArray(src)) dst.length = src.length;
	for (var k of old_keys) {
		if (!(k in src)) delete dst[k];
	}
	return dst;
}

export default deep_sync;