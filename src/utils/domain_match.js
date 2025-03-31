import { escape_regex } from "./escape_regex.js";

/** @param {string} uri @param {string} domain @description includes subdomains */

export function domain_match(uri, domain) {
	try { uri = new URL(uri).hostname || uri; } catch { }
	return !!uri.match(`^(?:[^:]+:\\/\\/)?(?:.+?\.)?(${escape_regex(domain)})(?:\/|$)`);
}

export default domain_match;