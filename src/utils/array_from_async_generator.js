/** @template T @param {AsyncGenerator<T>} gen @return {Promise<T[]>} */
export async function array_from_async_generator(gen) {
	const out = [];
	for await (const x of gen) out.push(x);
	return out;
}
