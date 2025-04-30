import { deep_equals } from "./deep_equals.js";
import { Diff } from "./Diff.js";
import { is_empty } from "./is_empty.js";

/** @typedef {(Diff|Record<string,Diff>)} DiffMapNode */
/** @typedef {Record<string,DiffMapNode>} DiffMap */

/** @param {any} o1 @param {any} o2 @returns {DiffMap} */
function _deep_diff(o1, o2, is_update=false) {
	if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
		var diff = {};
		for (var k in o1) {
			var d = _deep_diff(o1[k], o2[k], k in o2);
			if (d) diff[k] = d;
		}
		for (var k in o2) {
			if (k in o1) continue;
			var d = _deep_diff(undefined, o2[k], false);
			if (d) diff[k] = d;
		}
		if (!is_empty(diff)) return diff;
	} else {
		if (!deep_equals(o1, o2)) return new Diff(o1, o2, is_update);
	}
}

/** @param {any} o1 @param {any} o2 @returns {DiffMap} */
export function deep_diff(o1, o2) {
	return _deep_diff(o1, o2) || {};
}

export default deep_diff;