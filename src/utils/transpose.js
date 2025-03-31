/** @template T @param {T[][]} array */

export function transpose(array) {
	return array[0].map((_, c) => array.map(row => row[c]));
}

export default transpose;