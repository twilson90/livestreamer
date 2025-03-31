import { clamp } from "./clamp.js";
export function invlerp(x, y, a) {
	return clamp((a - x) / (y - x));
}

export default invlerp;