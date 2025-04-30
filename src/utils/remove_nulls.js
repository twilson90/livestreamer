/** @param {object} obj */
export function remove_nulls(obj, recursive=false) {
	if (Array.isArray(obj)) {
		var i = obj.length;
		while (i--) {
			if (obj[i] == null) obj.splice(i, 1);
			else if (recursive && typeof obj[i] === "object") remove_nulls(obj[i], true);
		}
	} else {
		for (var k of Object.keys(obj)) {
			if (obj[k] == null) delete obj[k];
			else if (recursive && typeof obj[k] === "object") remove_nulls(obj[k], true);
		}
	}
	return obj;
}

export default remove_nulls;