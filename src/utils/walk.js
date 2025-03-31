

export function walk(o, delegate_filter) {
	var next = (o, delegate_filter, path) => {
		if (typeof o !== "object" || o === null) return;
		for (var k in o) {
			if (delegate_filter && delegate_filter.apply(o, [k, o[k], [...path, k]]) === false) continue;
			next(o[k], delegate_filter, [...path, k]);
		}
	};
	next(o, delegate_filter, []);
}

export default walk;