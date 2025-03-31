import { clamp } from "./clamp.js";
export function array_move_element(arr, from_index, to_index) {
	from_index = clamp(from_index, 0, arr.length - 1);
	to_index = clamp(to_index, 0, arr.length - 1);
	arr.splice(to_index, 0, ...arr.splice(from_index, 1));
	return arr;
}

export default array_move_element;