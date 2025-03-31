import { remove_trailing_slash } from "./remove_trailing_slash.js";
export function join_paths(...paths) {
	var last = paths.pop();
	return [...paths.map(f => remove_trailing_slash(f)), last].join("/");
}

export default join_paths;