import { json_copy } from "./json_copy.js";
export function get_defaults(def) {
	if (def.__default__ !== undefined) {
		return json_copy(def.__default__);
	}
	var defaults = {};
	for (var k in def) {
		if (k.startsWith("__")) continue;
		defaults[k] = get_defaults(def[k]);
	}
	if (Object.keys(defaults).length) return defaults;
}

export default get_defaults;