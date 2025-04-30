import { timeout } from "./timeout.js";

/** @param {function():Promise<any>} cb @param {number} attempts @param {number} delay @param {string} msg @returns {Promise<any>} */
export function retry_until(cb, attempts, delay, msg) {
	return new Promise(async (resolve, reject) => {
		while (attempts--) {
			let t = Date.now();
			try {
				return resolve(await cb());
			} catch (err) {
				console.warn(`${msg} failed, trying again [${attempts} attempts remaining]...`);
			}
			await timeout(delay - (Date.now() - t));
		}
		reject();
	});
}

export default retry_until;