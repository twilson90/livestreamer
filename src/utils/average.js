/** @param {...number} values */
export function average(...values) {
	var total = 0, n = 0;
	for (var num of values) {
		total += num;
		n++;
	}
	return (total / n) || 0;
}

export default average;