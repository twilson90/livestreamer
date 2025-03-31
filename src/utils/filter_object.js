/** @template T @param {T} obj @param {function(PropertyKey,T[PropertyKey]):boolean} filter_callback @param {boolean} [in_place] @returns {T} */
export function filter_object(obj, filter_callback, in_place = false) {
	if (!in_place) obj = { ...obj };
	for (var k of Object.keys(obj)) {
		if (!filter_callback(k, obj[k])) delete obj[k];
	}
	return obj;
}

export default filter_object;