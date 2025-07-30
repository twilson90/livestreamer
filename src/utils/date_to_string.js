/** @param {Date|number} date @param {object} options */
export function date_to_string(date, options) {
	if (date === undefined) date = Date.now();
	options = Object.assign({
		date: true,
		time: true,
		milliseconds: false,
		delimiter: "-",
	}, options);
	date = new Date(date);
	var parts = date.toISOString().slice(0, -1).split("T");
	var new_parts = [];
	if (options.date) new_parts.push(parts[0].replace(/[^\d]+/g, options.delimiter));
	if (options.time) {
		let time_parts = parts[1].split(".");
		let new_time_parts = [];
		new_time_parts.push(time_parts[0].replace(/[^\d]+/g, options.delimiter));
		if (options.milliseconds) new_time_parts.push(time_parts[1]);
		new_parts.push(new_time_parts.join("."));
	}
	var str = new_parts.join(options.delimiter);
	return str;
}

export default date_to_string;