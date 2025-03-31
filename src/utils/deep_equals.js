/** @param {any} o1 @param {any} o2 */
export function deep_equals(o1, o2) {
	var t1 = typeof o1;
	var t2 = typeof o2;
	if (t1 === "object" && t2 === "object" && o1 !== null && o2 !== null) {
		for (var k in o1) {
			if (!deep_equals(o1[k], o2[k])) return false;
		}
		for (var k in o2) {
			if (!(k in o1)) return false;
		}
		return true;
	} else {
		if (t1 == "number" && t2 == "number" && isNaN(o1) && isNaN(o2)) return true;
		if (o1 === o2) return true;
		return false;
	}
}

export default deep_equals;