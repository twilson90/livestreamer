/** @param {object} o @param {function(string, any):any} cb */
export function deep_map(o, cb) {
	if (typeof o !== "object" || o === null) return;
	var new_o = {};
	for (var k in o) {
		if (typeof o[k] === "object" && o[k] !== null) {
			new_o[k] = deep_map(o[k], cb);
		} else {
			new_o[k] = cb.apply(o, [k, o[k]]);
		}
	}
	return new_o;
}

export default deep_map;