import { time_delta_readable } from "./time_delta_readable.js";


export function time_diff_readable(from, to) {
	if (from && !to) [from, to] = [new Date(), from];
	if (!from) from = new Date();
	if (!to) to = new Date();
	return time_delta_readable(to - from);
}

export default time_diff_readable;