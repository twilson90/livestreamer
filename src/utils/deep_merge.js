/** @param {object} dst @param {object} src */
export function deep_merge(dst, src) {
	var is_array = Array.isArray(src);
	for (var k in src) {
		if (typeof src[k] === 'object' && src[k] !== null) {
			if (typeof dst[k] !== "object" || dst[k] === null) {
				dst[k] = Array.isArray(src[k]) ? [] : {};
			}
			deep_merge(dst[k], src[k]);
		} else {
			dst[k] = src[k];
		}
	}
	if (is_array) dst.length = src.length;
}

export default deep_merge;