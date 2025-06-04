import { pathToFileURL } from "./pathToFileURL.js";

/** @param {string|URL} str Note: this function is not 100% reliable, it may return a URL object even if the string is not a valid URL, or it may return a string that is not a valid URL (e.g. ftp will have a url encoded path which is not valid). */
export function urlify(str) {
	if (str instanceof URL) return str;
	if (/^[a-zA-Z]+:\/\//.test(str)) return new URL(str);
	try { return pathToFileURL(str); } catch { }
}

export default urlify;