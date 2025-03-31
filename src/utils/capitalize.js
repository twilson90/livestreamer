/** @param {string} str */
export function capitalize(str) {
	return String(str).replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
}

export default capitalize;