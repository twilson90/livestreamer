/** @param {number} min @param {number} max */
export function random_int(min, max=undefined) {
	if (max === undefined) {
		if (min < 0) {
			max = 0;
		} else {
			max = min;
			min = 0;
		}
	}
	if (max === undefined) {
		max = Number.MAX_SAFE_INTEGER;
	}
	min = ~~min;
	max = ~~max;
	return Math.floor(Math.random() * (max - min + 1) + min);
}

export default random_int;