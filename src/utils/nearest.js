/** @param {number} num @param {number[]} values */
export function nearest(num, ...values) {
	var min_diff = Number.MAX_VALUE;
	var curr = num;
	for (var val of values) {
		var m = Math.abs(num - val);
		if (m < min_diff) {
			min_diff = m;
			curr = val;
		}
	}
	return curr;
}

export default nearest;