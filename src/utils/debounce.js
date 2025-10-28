/** @template T @param {(...args: any[]) => T} func @returns {((...args: any[]) => Promise<T>) & {cancel: () => void}} Wrapped function that returns a promise */
export function debounce(func, t = 0) {
	var timeout_id, args, context, promise, resolve;
	var later = () => {
		resolve(func.apply(context, args));
		promise = null;
	};
	var debounced = function (...p) {
		context = this;
		args = p; // whatever the args are on last call will be used
		return promise = promise || new Promise(r => {
			resolve = r;
			timeout_id = setTimeout(later, t);
		});
	};
	debounced.cancel = () => {
		clearTimeout(timeout_id);
		promise = null;
	};
	return debounced;
}

export default debounce;