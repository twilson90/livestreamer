import { remove_trailing_slash } from "./remove_trailing_slash.js";
import { basename } from "./basename.js";



export function dirname(filename) {
	filename = String(filename);
	filename = remove_trailing_slash(filename);
	return filename.substring(0, filename.length - basename(filename).length - 1);
}

export default dirname;