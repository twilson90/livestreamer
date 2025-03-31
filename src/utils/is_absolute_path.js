/** @param {string} s */
export function is_absolute_path(s) {
	return /^(?:[a-zA-Z]\:[\\/]|\/)/.test(String(s));
}

export default is_absolute_path;