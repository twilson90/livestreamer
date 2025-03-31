/** @param {string|string[]} key @param {any} value @param {object} target */
export function pathed_key_to_lookup(key, value, target = {}) {
	let path = typeof key === "string" ? key.split("/") : [...key];
	let curr = target;
	for (var i = 0; i < path.length - 1; i++) {
		var p = path[i];
		if (typeof curr[p] !== "object" || curr[p] === null) curr[p] = {};
		curr = curr[p];
	}
	curr[path[path.length - 1]] = value;
	return target;
}

export default pathed_key_to_lookup;