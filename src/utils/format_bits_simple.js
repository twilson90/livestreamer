/** @param {number} value @param {string} unit */
export function format_bits_simple(value, unit = "k", space=false) {
	unit = unit.toLowerCase();
	var parts;
	if (unit.startsWith("b")) parts = [ (Math.floor(value * 8)).toLocaleString(), "b"];
	if (unit.startsWith("k")) parts = [ (Math.floor(value / 1000 * 8)).toLocaleString(), "kb"];
	if (unit.startsWith("m")) parts = [ (Math.floor(value / 1000 / 1000 * 8)).toLocaleString(), "mb"];
	if (unit.startsWith("g")) parts = [ (Math.floor(value / 1000 / 1000 / 1000 * 8)).toLocaleString(), "gb"];
	return parts.join(space?" ":"");
}

export default format_bits_simple;