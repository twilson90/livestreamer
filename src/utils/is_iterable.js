/** @param {any} obj */
export function is_iterable(obj) {
	return obj != null && typeof obj[Symbol.iterator] === 'function';
}

export default is_iterable;