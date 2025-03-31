/** @param {number} x @param {number} y @param {number} a */
export function lerp(x, y, a) {
	return x * (1 - a) + y * a;
}

export default lerp;