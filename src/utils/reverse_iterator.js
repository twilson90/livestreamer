/** @template T @param {T[]} array */
export function* reverse_iterator(array) {
	let index = array.length - 1;
	while (index >= 0) {
		yield array[index];
		index--;
	}
}
export default reverse_iterator;