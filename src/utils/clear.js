/** @param {any} obj */
export function clear(obj) {
	if (Array.isArray(obj)) {
		obj.splice(0, obj.length);
	} else if (typeof obj === "object") {
		for (var k of Object.keys(obj)) {
			delete obj[k];
		}
	}
	return obj;
}

export default clear;