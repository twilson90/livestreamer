/** @template T @param {Iterable<T>} arr */
export function* iterate_unique(arr) {
	var seen = new Set();
	for (var a of arr) {
		if (seen.has(a)) continue;
		seen.add(a);
		yield a;
	}
}

export default iterate_unique;