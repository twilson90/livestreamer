/** @param {any} s */
export function is_uri(s) {
	return /^[a-z]{2,}\:\/\//.test(String(s));
}

export default is_uri;