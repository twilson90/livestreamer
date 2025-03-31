// will also handle decimal points (milliseconds)

export function timespan_str_to_ms(str, format = "hh:mm:ss") {
	var multiply = 1;
	if (str.startsWith("-")) {
		multiply = -1;
		str = str.slice(1);
	}
	var parts = String(str).split(/:/);
	var format_parts = format.split(/:/);
	if (format_parts.length > parts.length) format_parts = format_parts.slice(-parts.length); // so if str = "10:00" and format = "hh:mm:ss", the assumed format will be "mm:ss"
	else parts = parts.slice(-format_parts.length);
	var ms = 0;
	for (var i = 0; i < parts.length; i++) {
		var v = parseFloat(parts[i]);
		var f = format_parts[i][0];
		if (!Number.isFinite(v)) v = 0; // handles NaN & Infinity
		if (f == "d") ms += v * 24 * 60 * 60 * 1000;
		else if (f == "h") ms += v * 60 * 60 * 1000;
		else if (f == "m") ms += v * 60 * 1000;
		else if (f == "s") ms += v * 1000;
	}
	return ms * multiply;
}

export default timespan_str_to_ms;