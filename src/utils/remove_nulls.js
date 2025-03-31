/** @param {object} obj */
export function remove_nulls(obj) {
	if (Array.isArray(obj)) {
		var i = obj.length;
		while (i--) {
			if (obj[i] == null) obj.splice(i, 1);
		}
	} else {
		for (var k of Object.keys(obj)) {
			if (obj[k] == null) delete obj[k];
		}
	}
}

export default remove_nulls;