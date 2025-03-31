/**
 * Flattens a tree-like object structure into a list of paths and values
 * @param {object} o The object to flatten
 * @param {boolean} only_values Whether to only include leaf values in the output
 * @param {function} filter Optional filter function to control traversal
 * @returns {Array<[string[], any]>} Array of [path, value] pairs
 */
export function deep_entries(o, only_values = true, filter = null) {
	if (o == null) throw new Error("Cannot convert undefined or null to object");
	var entries = [];
	var next = (o, path) => {
		if (typeof o === "object" && o !== null) {
			if (!only_values && path.length) entries.push([path, o]);
			for (var k in o) {
				var new_path = [...path, k];
				if (filter && !filter.apply(o, [k, o[k], new_path])) {
					entries.push([new_path, o[k]]);
					continue;
				}
				next(o[k], new_path);
			}
		} else {
			entries.push([path, o]);
		}
	};
	next(o, []);
	return entries;
}

export default deep_entries;