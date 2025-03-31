/** @param {number} a @param {number} b @param {number} epsilon */
export function almost_equal(a, b, epsilon = Number.EPSILON) {
	return Math.abs(a - b) <= epsilon;
}

export default almost_equal;