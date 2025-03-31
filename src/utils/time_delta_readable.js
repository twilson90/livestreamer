
export function time_delta_readable(delta) {
	var time_formats = [
		[1, '1 second ago', '1 second from now'],
		[60, 'seconds', 1],
		[60 * 2, '1 minute ago', '1 minute from now'],
		[60 * 60, 'minutes', 60],
		[60 * 60 * 2, '1 hour ago', '1 hour from now'],
		[60 * 60 * 24, 'hours', 60 * 60],
		[60 * 60 * 24 * 2, 'Yesterday', 'Tomorrow'],
		[60 * 60 * 24 * 7, 'days', 60 * 60 * 24],
		[60 * 60 * 24 * 7 * 2, 'Last week', 'Next week'],
		[60 * 60 * 24 * 7 * 4, 'weeks', 60 * 60 * 24 * 7],
		[60 * 60 * 24 * 7 * 4 * 2, 'Last month', 'Next month'],
		[60 * 60 * 24 * 7 * 4 * 12, 'months', 60 * 60 * 24 * 30],
		[60 * 60 * 24 * 7 * 4 * 12 * 2, 'Last year', 'Next year'],
		[60 * 60 * 24 * 7 * 4 * 12 * 100, 'years', 60 * 60 * 24 * 365],
		[60 * 60 * 24 * 7 * 4 * 12 * 100 * 2, 'Last century', 'Next century'],
		[60 * 60 * 24 * 7 * 4 * 12 * 100 * 20, 'centuries', 60 * 60 * 24 * 365 * 100]
	];
	var seconds = Math.floor(delta / 1000);
	if (seconds == 0) return 'Just now';
	var [token, i] = (seconds < 0) ? ["ago", 1] : ['from now', 2];
	seconds = Math.abs(seconds);
	for (var format of time_formats) {
		if (seconds >= format[0]) continue;
		return (typeof format[2] === 'string') ? format[i] : `${Math.floor(seconds / format[2])} ${format[1]} ${token}`;
	}
	return time;
}

export default time_delta_readable;