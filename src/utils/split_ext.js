/** @param {string} filename */
export function split_ext(filename) {
	filename = String(filename);
	var i = filename.lastIndexOf(".");
	if (i == -1) return [filename, ""];
	return [filename.substr(0, i), filename.slice(i)];
}

export default split_ext;