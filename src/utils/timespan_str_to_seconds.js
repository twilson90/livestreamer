import { timespan_str_to_ms } from "./timespan_str_to_ms.js";


export function timespan_str_to_seconds(str, format = "hh:mm:ss") {
	return timespan_str_to_ms(str, format) / 1000;
}

export default timespan_str_to_seconds;