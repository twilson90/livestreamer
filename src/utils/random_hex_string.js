import { random_string } from "./random_string.js";
/** @param {number} length */
export function random_hex_string(length) {
	return random_string(length, "0123456789abcdef");
}

export default random_hex_string;