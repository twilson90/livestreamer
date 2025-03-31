/** @param {number} t @param {boolean} days @param {boolean} hours @param {boolean} minutes @param {boolean} seconds */
export function ms_to_human_readable_str(t, days = true, hours = true, minutes = true, seconds = true) {
	var o = {};
	if (days) o["Day"] = 1000 * 60 * 60 * 24;
	if (hours) o["Hour"] = 1000 * 60 * 60;
	if (minutes) o["Minute"] = 1000 * 60;
	if (seconds) o["Second"] = 1000;
	var parts = [];
	for (var k in o) {
		var v = Math.floor(t / o[k]);
		if (v) parts.push(`${v.toLocaleString()} ${k}${v > 1 ? "s" : ""}`);
		t -= v * o[k];
	}
	return parts.join(" ") || "0 Seconds";
}

export default ms_to_human_readable_str;