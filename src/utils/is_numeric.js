/** @param {any} n */
export function is_numeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

export default is_numeric;