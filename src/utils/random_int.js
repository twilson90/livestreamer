/** @param {number} min @param {number} max */
export function random_int(min, max) {
	min = ~~min;
	max = ~~max;
	return Math.floor(Math.random() * (max - min + 1) + min);
}

export default random_int;