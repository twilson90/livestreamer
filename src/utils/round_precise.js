/** @param {number} num @param {number} precision */
export function round_precise(num, precision = 0) {
	var m = Math.pow(10, precision);
	return Math.round(num * m) / m;
}

export default round_precise;