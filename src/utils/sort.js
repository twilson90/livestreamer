/** @template T @param {T[]} arr @param {...(function(T):number)} cbs */
export function sort(arr, ...cbs) {
	if (!cbs.length) cbs = [v => v];
	return arr.sort((a, b) => {
		for (var cb of cbs) {
			var av = cb(a), bv = cb(b);
			if (!Array.isArray(av)) av = [av, "ASCENDING"];
			if (!Array.isArray(bv)) bv = [bv, "ASCENDING"];
			var m = 1;
			if (av[1] === "ASCENDING") m = 1;
			else if (av[1] === "DESCENDING") m = -1;
			else throw new Error();
			if (av[0] < bv[0]) return -1 * m;
			if (av[0] > bv[0]) return 1 * m;
		}
		return 0;
	});
}

export default sort;