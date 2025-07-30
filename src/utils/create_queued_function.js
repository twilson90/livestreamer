/** @template T @param {T} fn @returns {T} */
export function create_queued_function(fn) {
	let queue = Promise.resolve();
	return (...args) => {
		queue = queue.then(() => fn(...args));
		return queue;
	};
}
export default create_queued_function;