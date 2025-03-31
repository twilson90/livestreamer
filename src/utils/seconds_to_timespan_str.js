import { ms_to_timespan_str } from "./ms_to_timespan_str.js";
/** @param {number} num @param {string} format */
export function seconds_to_timespan_str(num, format = "hh:mm:ss") {
	return ms_to_timespan_str(num * 1000, format);
}

export default seconds_to_timespan_str;