/** @param {string|URL} fileURL */
export function fileURLToPath(fileURL) {
	const url = (typeof fileURL === 'string') ? new URL(fileURL) : fileURL;
	if (url.protocol !== 'file:') throw new TypeError('URL must use the file: protocol');
	let pathname = decodeURIComponent(url.pathname);
	if (pathname.startsWith('/') && /^\/[A-Za-z]:\//.test(pathname)) {
		pathname = pathname.slice(1);
	}
	return pathname;
}

export default fileURLToPath;