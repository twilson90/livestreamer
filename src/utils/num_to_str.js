/** @param {number} num @param {number} decimals */
export function num_to_str(num, decimals = 2) {
	return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default num_to_str;