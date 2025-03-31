/** @param {string} str */
export function kebabcase(str) {
	return String(str).replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, '-')
		.toLowerCase();
}

export default kebabcase;