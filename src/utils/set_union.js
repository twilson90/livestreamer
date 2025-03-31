/** @template T @param {Iterable<T>} a @param {Iterable<T>} b */
export function set_union(a, b) {
	return new Set([...a, ...b]);
}

export default set_union;