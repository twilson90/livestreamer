/** @template T, K @param {Iterable<T>} values @param {function(T):K} cb @returns {Map<K,T[]>} */
export function group_by(values, cb) {
	/** @type {Map<T,K[]>} */
	var groups = new Map();
	for (var value of values) {
		var key = cb(value);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(value);
	}
	return groups;
}

export default group_by;