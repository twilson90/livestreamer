/** @param {number} num @param {number} precision */
export function convert_bytes(num, precision = 2) {
	num = Math.abs(num);
	var divider = 1;
	for (x of ["bytes", "KB", "MB", "GB", "TB", "PB"]) {
		if ((num / divider) < 1024.0) break;
		divider *= 1024.0;
	}
	return `${(num / divider).toFixed(precision)} ${x}`;
}

export default convert_bytes;