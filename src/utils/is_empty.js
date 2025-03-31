/** @param {any} obj */
export function is_empty(obj) {
	if (obj && typeof obj === "object") {
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) return false;
		}
	}
	return true;
}

export default is_empty;