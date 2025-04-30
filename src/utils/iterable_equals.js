/** @param {Iterable<any>} it1 @param {Iterable<any>} it2 @returns {boolean} */
export function iterable_equals(it1, it2) {
	while (true) {
		var a = it1.next();
		var b = it2.next();
		if (a.done !== b.done) return false;
		if (a.done) break;
		if (a.value !== b.value) return false;
	}
	return true;
}

export default iterable_equals;