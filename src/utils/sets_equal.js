/** @template T @param {Iterable<T>} sets */
export function sets_equal(...sets) {
	var seta = sets[0];
	if (!(seta instanceof Set)) seta = new Set(seta);
	for (var setb of sets.slice(1)) {
		if (!(setb instanceof Set)) setb = new Set(setb);
		if (seta.size !== setb.size) return false;
		for (var a of seta) {
			if (!setb.has(a)) return false;
		}
	}
	return true;
}

export default sets_equal;