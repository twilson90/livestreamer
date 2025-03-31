import { is_iterable } from "./is_iterable.js";
export function first(o) {
	if (is_iterable(o)) {
		for (var k of o) return k;
	} else {
		for (var k in o) return o[k];
	}
}

export default first;