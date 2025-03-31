/** @param {number} min @param {number} max */
export function random(min, max) {
	return Math.random() * (max - min) + min;
}

export default random;