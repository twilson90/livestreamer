/** @param {object} ob */
export function first_key(ob) {
	for (var k in ob) return k;
}

export default first_key;