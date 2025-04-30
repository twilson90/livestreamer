/** @returns {string[]} */
export function get_property_keys(obj) {
	const proto = Object.getPrototypeOf(obj);
	const inherited = (proto) ? get_property_keys(proto) : [];
	var seen = new Set(inherited);
	return [...inherited, ...Object.getOwnPropertyNames(obj).filter(k => !seen.has(k))];
}

export default get_property_keys;