/** @param {Iterable<any>} iterable @param {function(any,number,number):string} resolver @returns {any[]} */
export function* uniquify(iterable, resolver) {
	if (!resolver) resolver = (s, i, n) => n > 1 ? `${s} [${i + 1}]` : `${s}`;
	var map = new Map();
	for (var e of iterable) {
		map.set(map.has(e) ? map.get(e) + 1 : 1);
	}
	var i = 0;
	for (var e of iterable) {
		yield resolver(e, i++, map.get(e));
	}
}

export default uniquify;