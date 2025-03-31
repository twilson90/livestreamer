/** @param {string} str */
export function escape_regex(str) {
	return String(str).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export default escape_regex;