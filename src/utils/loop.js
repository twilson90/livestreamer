/** @param {number} num @param {number} min @param {number} max */
export function loop(num, min, max) {
	var len = max - min;
	num = min + (len != 0 ? (num - min) % len : 0);
	if (num < min) num += len;
	return num;
}

export default loop;