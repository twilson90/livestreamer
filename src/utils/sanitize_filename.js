/** @param {string} name */
export function sanitize_filename(name) {
	return String(name).toLowerCase().replace(/^\W+/, "").replace(/\W+$/, "").replace(/\W+/g, "-").trim().slice(0, 128);
}

export default sanitize_filename;