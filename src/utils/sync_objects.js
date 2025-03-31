
export function sync_objects(src, dst) {
	var dst_keys = new Set(Object.keys(dst));
	for (var k in src) {
		dst_keys.delete(k);
		if (dst[k] !== src[k]) dst[k] = src[k];
	}
	for (var k of dst_keys) {
		delete dst[k];
	}
}

export default sync_objects;