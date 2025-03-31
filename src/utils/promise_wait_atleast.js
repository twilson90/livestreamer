import { timeout } from "./timeout.js";
/** @param {Promise<any>} promise @param {number} ms */
export function promise_wait_atleast(promise, ms = 10000) {
	return Promise.all([promise, timeout(ms)]).then((d) => {
		return d[0];
	});
}

export default promise_wait_atleast;