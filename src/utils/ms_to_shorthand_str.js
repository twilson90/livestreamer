/** @param {number} num @param {number} show_ms */
export function ms_to_shorthand_str(num, show_ms = 0) {
	var negative = num < 0;
	num = Math.abs(+num) || 0;
	var parts = [];
	for (var k in TIME_DIVIDERS) {
		var divider = TIME_DIVIDERS[k];
		var d = Math.floor(num / divider);
		num -= d * divider;
		if (k == "s" && show_ms) {
			d = (d + num / 1000).toFixed(+show_ms);
		}
		if (d) parts.push(`${d}${k}`);
	}
	return (negative ? "-" : "") + parts.join(" ");
}

export default ms_to_shorthand_str;