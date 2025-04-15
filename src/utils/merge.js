/** @param {any} o1 @param {any} o2 @param {{delete_nulls:boolean, skip_nulls:boolean}} opts */
export function merge(o1,o2, opts) {
	var {delete_nulls, skip_nulls} = opts ?? {};
	for (var k in o2) {
		if (o2[k] == null && skip_nulls) continue;
		if (o2[k] == null && delete_nulls) delete o1[k];
		else o1[k] = o2[k];
	}
	return o1;
}

export default merge;