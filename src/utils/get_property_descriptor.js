/** @param {object} obj @param {string} property */
export function get_property_descriptor(obj, property) {
	while (obj) {
		var d = Object.getOwnPropertyDescriptor(obj, property);
		if (d) return d;
		obj = Object.getPrototypeOf(obj);
	}
	return null;
}

export default get_property_descriptor;