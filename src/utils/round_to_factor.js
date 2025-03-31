/** @param {number} num @param {number} f */
export function round_to_factor(num, f = 1.0) {
	return Math.round(num / f) * f;
}

export default round_to_factor;