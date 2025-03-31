import { TimeoutError } from "./TimeoutError.js";
/** @param {Promise<any>} promise @param {number} ms */
export function promise_timeout(promise, ms = 10000) {
	if (typeof promise === "function") promise = new Promise(promise);
	if (!ms || ms <= 0) return promise;
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(new TimeoutError(`Timed out in ${ms}ms.`));
		}, ms);
		promise
			.then(resolve)
			.catch(reject);
	});

}

export default promise_timeout;