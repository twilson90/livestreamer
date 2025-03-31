/** @param {Date} date */
export function split_datetime(date, apply_timezone = false) {
	date = new Date(date);
	if (isNaN(date)) return ["", ""];
	if (apply_timezone) date = new Date(+date - (+date.getTimezoneOffset() * 60 * 1000));
	var parts = date.toISOString().slice(0, -1).split("T");
	if (parts[0][0] == "+") parts[0] = parts[0].slice(1);
	return parts;
}

export default split_datetime;