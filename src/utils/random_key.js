import {random_element} from "./random_element.js";

/** @param {number} length @param {string} [chars] @returns {string} */
export function random_key(obj) {
	return random_element(Object.keys(obj))
}

export default random_key;