/** @param {string} str */
export function is_valid_rtmp_url(str) {
	return /^rtmps?\:\/\//i.test(str);
}

export default is_valid_rtmp_url;