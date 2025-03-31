import { deep_merge } from "./deep_merge.js";
import { pathed_key_to_lookup } from "./pathed_key_to_lookup.js";
export function tree_from_pathed_entries(entries) {
	var root = {};
	if (!Array.isArray(entries)) entries = [entries];
	for (var c of entries) {
		if (Array.isArray(c)) {
			deep_merge(root, pathed_key_to_lookup(c[0], c[1]));
		} else if (typeof c === "object") {
			for (var k in c) {
				deep_merge(root, pathed_key_to_lookup(k, c[k]));
			}
		}
	}
	return root;
}

export default tree_from_pathed_entries;