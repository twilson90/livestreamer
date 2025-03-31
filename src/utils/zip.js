/** @template T @param {Iterable<T,T>[]} iterables */

export function* zip(...iterables) {
	const iterators = iterables.map(iterable => iterable[Symbol.iterator]());
	while (true) {
		const nextValues = iterators.map(iterator => iterator.next());
		if (nextValues.some(next => next.done)) break;
		const tuple = nextValues.map(next => next.value);
		yield tuple;
	}
}
export default zip;