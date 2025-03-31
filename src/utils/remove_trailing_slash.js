/** @param {string} filename */
export function remove_trailing_slash(filename) {
	return String(filename).replace(/[\/\\]+$/, "");
}

export default remove_trailing_slash;