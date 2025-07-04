const TIME_DIVIDERS = {
	d: 24 * 60 * 60 * 1000,
	h: 60 * 60 * 1000,
	m: 60 * 1000,
	s: 1000,
};

/** @param {number} num @param {number} show_ms @param {("d"|"h"|"m"|"s")[]} exclude */
export function ms_to_shorthand_str(num, show_ms = 0, exclude = []) {
	var negative = num < 0;
	num = Math.abs(+num) || 0;
	var parts = [];
	for (var k in TIME_DIVIDERS) {
		if (exclude && exclude.includes(k)) continue;
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