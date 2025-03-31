/** @template T @param {Set<T>} set @param {Iterable<T>} vals */
export function set_add(set, vals) {
	for (var v of vals) set.add(v);
}

export default set_add;