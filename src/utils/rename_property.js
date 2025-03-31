/** @param {object} object @param {string} from @param {string} to */
export function rename_property(object, from, to) {
	if (from in object) {
		var val = object[from];
		delete object[from];
		object[to] = val;
	}
}

export default rename_property;