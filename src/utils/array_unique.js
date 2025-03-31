import { iterate_unique } from "./iterate_unique.js";
export function array_unique(arr) {
	return Array.from(iterate_unique(arr));
}

export default array_unique;