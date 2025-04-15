function fix_path(path) {
	if (typeof path === "string") return path.split("/");
	if (!Array.isArray(path)) return [path];
	return [...path];
}

export function has(fn_ref, fn_path) {
	fn_path = fix_path(fn_path);
	var prop = fn_path.pop();
	var parent_ref = get(fn_ref, fn_path);
	return Reflect.has(parent_ref, prop);
}

export function get(fn_ref, fn_path) {
	fn_path = fix_path(fn_path);
	try {
		for (var fn_part of fn_path) {
			fn_ref = Reflect.get(fn_ref, fn_part, fn_ref);
		}
		return fn_ref;
	} catch {
		throw new RefException(`${fn_ref} -> ${fn_path}`);
	}
}

export function set(fn_ref, fn_path, fn_value, fn_this) {
	fn_path = fix_path(fn_path);
	var prop = fn_path.pop();
	fn_ref = get(fn_ref, fn_path);
	return Reflect.set(fn_ref, prop, fn_value, fn_this || fn_ref);
}

export function deleteProperty(fn_ref, fn_path) {
	fn_path = fix_path(fn_path);
	var prop = fn_path.pop();
	fn_ref = get(fn_ref, fn_path);
	Reflect.deleteProperty(fn_ref, prop);
}

export function call(fn_ref, fn_path, fn_args) {
	fn_path = fix_path(fn_path);
	var prop = fn_path.pop();
	var fn_this = get(fn_ref, fn_path);
	var fn = get(fn_this, prop);
	return Reflect.apply(fn, fn_this, fn_args||[]);
}

export class RefException extends Error {
	constructor(str) {
		super(`Invalid reference : ${str}`)
	}
}