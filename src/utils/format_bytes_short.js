/** @param {number} value @param {string} unit */
export function format_bytes_short(value, unit = "k") {
	unit = unit.toLowerCase();
	if (unit.startsWith("b")) return String(Math.floor(value * 8)) + "b";
	if (unit.startsWith("k")) return String(Math.floor(value / 1000 * 8)) + "kb";
	if (unit.startsWith("m")) return String(Math.floor(value / 1000 / 1000 * 8)) + "mb";
	if (unit.startsWith("g")) return String(Math.floor(value / 1000 / 1000 / 1000 * 8)) + "gb";
}

export default format_bytes_short;