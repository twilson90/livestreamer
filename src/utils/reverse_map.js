/** @template T,K @param {Record<T,K>|Map<T,K>} obj @return {Map<K,T>} */
export function reverse_map(obj) {
	return new Map(((obj instanceof Map) ? [...obj.entries()] : Object.entries(obj)).map(([k, v]) => [v, k]));
}

export default reverse_map;