/** @param {number} num @param {string} format */
export function ms_to_timespan_str(num, format = "hh:mm:ss") {
	var negative = num < 0;
	num = Math.abs(+num) || 0;
	var format_parts = format.split(/([^a-z])/i).filter(m => m);
	var parts = [];
	for (var i = 0; i < format_parts.length; i++) {
		var p = format_parts[i];
		var divider = null;
		if (p.startsWith("d")) divider = 24 * 60 * 60 * 1000;
		else if (p.startsWith("h")) divider = 60 * 60 * 1000;
		else if (p.startsWith("m")) divider = 60 * 1000;
		else if (p.startsWith("s")) divider = 1000;
		else if (p.startsWith("S")) divider = 1;
		else if (parts.length == 0) continue;
		if (p == "?") {
			if (parts[parts.length - 1] == 0) parts.pop();
			continue;
		}
		if (divider) {
			var v = Math.floor(num / divider);
			p = v.toString().padStart(p.length, "0");
			num -= v * divider;
		}
		parts.push(p);
	}
	return (negative ? "-" : "") + parts.join("");
}

export default ms_to_timespan_str;