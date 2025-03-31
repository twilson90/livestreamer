/** @template T @param {T} o @param {function(T):Iterable<T>} children_cb */
export function flatten_tree(o, children_cb) {
	/** @type {T[]} */
	var result = [];
	var next = (o) => {
		result.push(o);
		var children = children_cb.apply(o, [o]);
		if (!children || !(Symbol.iterator in children)) return;
		for (var c of children) {
			next(c);
		}
	};
	next(o);
	return result;
}

export default flatten_tree;