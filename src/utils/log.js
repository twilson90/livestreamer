/** @param {number} n @param {number} base */
export function log(n, base) {
	return Math.log(n) / (base ? Math.log(base) : 1);
}

export default log;