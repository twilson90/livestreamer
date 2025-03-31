import { pathToFileURL } from "./pathToFileURL.js";

/** @param {string|URL} str */


export function urlify(str) {
	if (str instanceof URL) return str;
	if (/^[a-zA-Z]+:\/\//.test(str)) return new URL(str);
	try { return pathToFileURL(str); } catch { }
}

export default urlify;