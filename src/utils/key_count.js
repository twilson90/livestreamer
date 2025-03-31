/** @param {object} ob */
export function key_count(ob) {
	var i = 0;
	for (var k in ob) i++;
	return i;
}

export default key_count;