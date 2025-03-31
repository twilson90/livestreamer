/** @param {number} num */
export function count_decimals(num = 1.0) {
	const p = num.toString();
	var decimals = 0;
	if (p.includes('e')) {
		const [coefficient, exponent] = p.split('e');
		const coefficientDecimalPlaces = coefficient.split('.')[1].length || 0;
		decimals = coefficientDecimalPlaces - parseInt(exponent);
	} else if (p.indexOf('.') !== -1) {
		decimals = p.split('.')[1].length;
	} else {
		decimals = 0;
	}
	return decimals;
}

export default count_decimals;