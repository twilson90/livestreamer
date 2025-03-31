/** @param {number} num @param {number} f */
export function floor_to_factor(num, f = 1.0) {
	return Math.floor(num / f) * f;
}

export default floor_to_factor;