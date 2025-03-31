/** @param {number} v */
export function nearest_base10(v) {
	const exponent = Math.floor(Math.log10(v));
	const lower = Math.pow(10, exponent);
	const higher = Math.pow(10, exponent + 1);
	return (v - lower < higher - v) ? lower : higher;
}

export default nearest_base10;