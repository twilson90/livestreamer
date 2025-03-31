/** @param {Iterable<any>} iterable @return {boolean} */
export function all_equal(iterable) {
	var first = undefined;
	for (var o of iterable) {
		if (first === undefined) first = o;
		else if (first !== o) return false;
	}
	return true;
}

export default all_equal;