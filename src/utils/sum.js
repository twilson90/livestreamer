/** @param {Iterable<number>} iterable */

export function sum(iterable) {
	var total = 0.0;
	for (var num of iterable) {
		total += num;
	}
	return total;
}

export default sum;