/** @param {any} obj */
export function is_plain_object(obj) {
	return typeof obj === 'object' && obj !== null && obj.constructor === Object && Object.prototype.toString.call(obj) === '[object Object]';
}

export default is_plain_object;