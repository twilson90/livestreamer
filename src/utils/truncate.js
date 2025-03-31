export function truncate(str, len, suffix = "") {
	str = String(str);
	if (str.length > len) str = str.slice(0, len) + suffix;
	return str;
}

export default truncate;