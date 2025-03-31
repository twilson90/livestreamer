/** @param {Iterable<number>} iterable */
export function get_best(iterable, cb) {
	var best_item = undefined, best_value = undefined, i = 0;
	for (var item of iterable) {
		var curr_value = cb(item);
		if (i == 0 || curr_value > best_item) {
			best_item = item;
			best_value = curr_value;
		}
		i++;
	}
	return best_item;
}

export default get_best;