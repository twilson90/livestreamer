/** @param {string|string[]} key @param {any} value @param {object} target */
export function pathed_key_to_lookup(key, value) {
	let target = {};
	let path = typeof key === "string" ? key.split("/") : [...key];
	if (path.length == 0) return value;
	let prop = path.pop();
	let curr = target;
	for (var p of path) {
		if (typeof curr[p] !== "object" || curr[p] === null) curr[p] = {};
		curr = curr[p];
	}
	curr[prop] = value;
	return target;
}

export default pathed_key_to_lookup;