import { clamp } from "./clamp.js";

var k = 1024;
var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function format_bytes(bytes, space=false) {
    if (!bytes || !isFinite(bytes)) bytes = 0;
	var i = clamp(Math.floor(Math.log(bytes) / Math.log(k)), 0, sizes.length - 1);
	var decimals = i>=2 ? 2 : 0;
	var parts = [(bytes / Math.pow(k, i)).toFixed(decimals), sizes[i]];
	return parts.join(space?" ":"");
}

export default format_bytes;