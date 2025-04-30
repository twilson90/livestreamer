/** @template T @param {T} obj @param {Function(any,any):any} replacer @returns {T} */
export function json_copy(obj, replacer) {
	if (typeof (obj) !== 'object' || obj === null) return obj;
	return JSON.parse(replacer ? JSON.stringify(obj, replacer) : JSON.stringify(obj));
}

export default json_copy;