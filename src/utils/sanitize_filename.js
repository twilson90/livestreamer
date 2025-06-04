/** @param {string} name */
export function sanitize_filename(name) {
	return String(name).toLowerCase().replace(/^\W+/, "").replace(/\W+$/, "").replace(/\W+/g, "-").trim().slice(0, 128);
}

export function sanitize_filename_advanced(filename, options = {}) {
	const {
		replacement = '_',
		maxLength = 255
	} = options;
  
	// 1. Remove control characters
	let sanitized = filename.replace(/[\x00-\x1f\x80-\x9f]/g, replacement);
	
	// 2. Replace illegal characters
	const illegalRe = /[/\\?%*:|"<>]/g;
	sanitized = sanitized.replace(illegalRe, replacement);
	
	// 3. Handle reserved filenames (Windows)
	const reservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
	if (reservedRe.test(sanitized)) {
	  	sanitized = '_' + sanitized;
	}
	
	// 4. Remove trailing periods and spaces (Windows)
	sanitized = sanitized.replace(/[ .]+$/, '');
	
	// 5. Truncate if needed
	if (sanitized.length > maxLength) {
		const extIndex = sanitized.lastIndexOf('.');
		const ext = extIndex > -1 ? sanitized.slice(extIndex) : '';
		const base = sanitized.slice(0, extIndex > -1 ? extIndex : sanitized.length);
		const truncateAt = maxLength - ext.length;
		sanitized = base.slice(0, truncateAt) + ext;
	}
	
	return sanitized || '_';
}

export default sanitize_filename;