/** @template T @param {Object.<string,T|PromiseLike<T>>} obj @returns {Object.<string,Promise<Awaited<T>[]>>}; */
export async function promise_all_object(obj) {
	var new_obj = {};
	await Promise.all(Object.entries(obj).map(([k, p]) => Promise.resolve(p).then(data => new_obj[k] = data)));
	return new_obj;
}
