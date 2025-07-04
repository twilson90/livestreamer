import {random_int} from "./random_int.js";

/** @param {number} length @param {string} [chars] @returns {string} */
export function random_element(arr) {
	return arr[random_int(0, arr.length - 1)];
}

export default random_element;