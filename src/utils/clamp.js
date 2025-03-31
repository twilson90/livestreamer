/** @param {number} a @param {number} min @param {number} max */
export function clamp(a, min = 0, max = 1) {
	return Math.min(max, Math.max(min, a));
}

export default clamp;