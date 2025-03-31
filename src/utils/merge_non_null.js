/** @param {...any} obs */
export function merge_non_null(...obs) {
	var ob = obs.shift();
	for (var o of obs) {
		for (var k in o) {
			if (o[k] != null) ob[k] = o[k];
		}
	}
	return ob;
}

export default merge_non_null;