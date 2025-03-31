import { invlerp } from "./invlerp.js";
import { lerp } from "./lerp.js";
/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} a */
export function range(x1, y1, x2, y2, a) {
	return lerp(x2, y2, invlerp(x1, y1, a));
}

export default range;