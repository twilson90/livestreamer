/** @template T @param {T} a @param {number} num */
export function repeat(a, num) {
	return new Array(num).fill().map(() => a);
}

export default repeat;