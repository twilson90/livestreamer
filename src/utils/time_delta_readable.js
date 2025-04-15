
export function time_delta_readable(delta) {
	var time_formats = [
		[1, '1 second ago', '1 second from now'],
		[60, 'second', 1],
		[60 * 2, '1 minute ago', '1 minute from now'],
		[60 * 60, 'minute', 60],
		[60 * 60 * 2, '1 hour ago', '1 hour from now'],
		[60 * 60 * 24, 'hour', 60 * 60],
		[60 * 60 * 24 * 2, 'Yesterday', 'Tomorrow'],
		[60 * 60 * 24 * 7, 'day', 60 * 60 * 24],
		[60 * 60 * 24 * 7 * 2, 'Last week', 'Next week'],
		[60 * 60 * 24 * 7 * 4, 'week', 60 * 60 * 24 * 7],
		[60 * 60 * 24 * 7 * 4 * 2, 'Last month', 'Next month'],
		[60 * 60 * 24 * 7 * 4 * 12, 'month', 60 * 60 * 24 * 30],
		[60 * 60 * 24 * 7 * 4 * 12 * 2, 'Last year', 'Next year'],
		[Number.POSITIVE_INFINITY, 'year', 60 * 60 * 24 * 365]

	];
	var seconds = Math.floor(delta / 1000);
	if (seconds == 0) return 'Just now';
	var [token, i] = (seconds < 0) ? ["ago", 1] : ['from now', 2];
	seconds = Math.abs(seconds);
	for (var format of time_formats) {
		if (seconds < format[0]) break;
	}
	if (typeof format[2] === 'string') return format[i];
	var t = Math.floor(seconds / format[2]);
	return `${t} ${format[1]+(t==1?"":"s")} ${token}`;
}

export default time_delta_readable;