/** @param {number} length @param {string} [chars] @return {string} */
export function random_string(length, chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
	var result = new Array(length), num_chars = chars.length;
	for (var i = length; i > 0; --i) result[i] = chars[Math.floor(Math.random() * num_chars)];
	return result.join("");
}

export default random_string;