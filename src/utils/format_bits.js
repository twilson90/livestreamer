import { clamp } from "./clamp.js";

const k = 1000; // Note: For bits, we typically use 1000 (not 1024) per SI standard
const sizes = ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb'];

export function format_bits(bits, space=false) {
    // Handle zero and non-finite cases
    if (!bits || !isFinite(bits)) bits = 0;
    const i = clamp(Math.floor(Math.log(bits) / Math.log(k)), 0, sizes.length - 1);
	var decimals = i>=2 ? 2 : 0;
    var parts = [(bits / Math.pow(k, i)).toFixed(decimals), sizes[i]];
	return parts.join(space?" ":"")
}

export default format_bits;