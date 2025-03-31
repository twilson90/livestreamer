import { ms_to_human_readable_str } from "./ms_to_human_readable_str.js";
/** @param {number} t @param {boolean} days @param {boolean} hours @param {boolean} minutes @param {boolean} seconds */
export function seconds_to_human_readable_str(t, days = true, hours = true, minutes = true, seconds = true) {
	return ms_to_human_readable_str(t * 1000);
}

export default seconds_to_human_readable_str;