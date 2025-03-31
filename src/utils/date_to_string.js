/** @param {Date|number} date @param {object} options */
export function date_to_string(date, options) {
	if (date === undefined) date = Date.now();
	options = Object.assign({
		date: true,
		time: true,
		delimiter: "-",
	}, options);
	date = new Date(date);
	var parts = date.toISOString().slice(0, -1).split("T");
	if (!options.time) parts.splice(1, 1);
	if (!options.date) parts.splice(0, 1);
	var str = parts.join("-").replace(/[^\d]+/g, options.delimiter);
	return str;
}

export default date_to_string;