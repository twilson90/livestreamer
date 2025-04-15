/** @template T @param {Iterable<T>} array @param {number} num @param {(e:T)=>number} cb */
export function closest(array, num, cb) {
	var min_score = Number.MAX_VALUE;
	/** @type {T} */
	var curr;
	for (var e of array) {
		var score = Math.abs(cb(e) - num);
		if (score < min_score) {
			min_score = score;
			curr = e;
		}
	}
	return curr;
}

export default closest;