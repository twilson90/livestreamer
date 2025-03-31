/** @template T @param {Iterable<T>} a @param {Set<T>|Iterable<T>} b */
export function set_intersection(a, b) {
	if (!(b instanceof Set)) b = new Set(b);
	return new Set([...a].filter(x => b.has(x)));
}

export default set_intersection;