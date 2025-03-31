/** @param {string} _url */
export function fix_url(_url) {
	_url = String(_url).trim();
	let url;
	try {
		url = new URL(url);
		if (!url.hostname) url = new URL("https://" + _url);
	} catch {
		try {
			url = new URL("https://" + _url);
		} catch {
			return;
		}
	}
	return url.toString();
}

export default fix_url;