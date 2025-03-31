/** @param {number} num @param {number} f */
export function ceil_to_factor(num, f = 1.0) {
	return Math.ceil(num / f) * f;
}

export default ceil_to_factor;