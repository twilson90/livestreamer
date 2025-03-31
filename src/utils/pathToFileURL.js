/** @param {string} fileURL */
export function pathToFileURL(filePath) {
	const url = new URL('file://');
	url.pathname = filePath.replace(/\\/g, '/');
	return url;
}

export default pathToFileURL;