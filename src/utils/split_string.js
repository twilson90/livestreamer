/** @param {string} str @param {number} partLength */
export function split_string(str, partLength) {
	var list = [];
	if (str !== "" && partLength > 0) {
		for (var i = 0; i < str.length; i += partLength) {
			list.push(str.substr(i, Math.min(partLength, str.length)));
		}
	}
	return list;
}

export default split_string;