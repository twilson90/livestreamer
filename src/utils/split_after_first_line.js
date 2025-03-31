/** @param {string} str */
export function split_after_first_line(str) {
	var m = str.match(/(.+?)[\n\r]+/);
	return m ? [m[1], str.slice(m[0].length)] : [str, undefined];
}

export default split_after_first_line;