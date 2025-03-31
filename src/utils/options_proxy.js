/** @template T @param {T} opts @return {T} */
export function options_proxy(opts) {
	return new Proxy(opts, {
		get(target, prop, receiver) {
			if (prop in target) {
				if (typeof target[prop] === "function") return target[prop]();
				return target[prop];
			}
		}
	});
}

export default options_proxy;