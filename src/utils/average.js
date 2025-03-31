/** @param {Iterable<number>} iterable */
export function average(...iterable) {
	var total = 0, n = 0;
	for (var num of iterable) {
		total += num;
		n++;
	}
	return (total / n) || 0;
}

export default average;