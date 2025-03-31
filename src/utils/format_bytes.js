import { clamp } from "./clamp.js";
export function format_bytes(bytes, decimals = 2, min = 1) {
	decimals = Math.max(decimals, 0);
	var k = 1024;
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
	var i = clamp(Math.floor(Math.log(bytes) / Math.log(k)), min, sizes.length - 1);
	if (!isFinite(i)) i = 0;
	return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

export default format_bytes;