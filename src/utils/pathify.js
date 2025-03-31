import { fileURLToPath } from "./fileURLToPath.js";
import { urlify } from "./urlify.js";

/** @param {string|URL} str */
export function pathify(str) {
	try { return fileURLToPath(urlify(str)); } catch { }
}

export default pathify;