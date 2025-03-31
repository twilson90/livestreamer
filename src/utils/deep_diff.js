import { deep_equals } from "./deep_equals.js";
import { Diff } from "./Diff.js";
/** @param {any} o1 @param {any} o2 */
export function deep_diff(o1, o2) {
	var _deep_diff = (o1, o2) => {
		if (typeof o1 === "object" && typeof o2 === "object" && o1 !== null && o2 !== null) {
			var diff = {}, diffs = 0;
			for (var k in o1) {
				var d = _deep_diff(o1[k], o2[k]);
				if (d) {
					diff[k] = d;
					diffs++;
				}
			}
			for (var k in o2) {
				if (k in o1) continue;
				var d = _deep_diff(undefined, o2[k]);
				if (d) {
					diff[k] = d;
					diffs++;
				}
			}
			if (diffs) {
				return diff;
			}
		} else {
			if (deep_equals(o1, o2)) return;
			return new Diff(o1, o2);
		}
	};
	return _deep_diff(o1, o2) || {};
}

export default deep_diff;