/** @param {string} date @param {string} time */
export function join_datetime(date, time, apply_timezone = false) {
	var time_parts = time.split(":");
	while (time_parts.length < 3) time_parts.push("00");
	for (var i = 0; i < 2; i++) {
		if (!time_parts[i].match(/^\d{2}$/)) {
			time_parts[i] = (+time_parts[i]).toFixed(0);
		}
	}
	if (!time_parts[2].match(/^\d{2}\.\d{3}$/)) {
		time_parts[2] = parseFloat(time_parts[2]).toFixed(3).padStart(6, "0");
	}
	time = time_parts.join(":");
	var date = +new Date(`${date} ${time}Z`);
	if (apply_timezone) date += +new Date(date).getTimezoneOffset() * 60 * 1000;
	return new Date(date);
}

export default join_datetime;