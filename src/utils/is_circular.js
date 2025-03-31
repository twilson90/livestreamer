import { detect_circular_structure } from "./detect_circular_structure.js";
/** @param {Iterable<{id,parent}>} nodes */
export function is_circular(nodes) {
	return detect_circular_structure(nodes).length > 0;
}

export default is_circular;