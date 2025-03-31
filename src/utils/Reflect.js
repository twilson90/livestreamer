function fix_path(path) {
	if (typeof path === "string") return path.split("/");
	if (!Array.isArray(path)) return [path];
	return path;
}

export function has(fn_this, fn_path) {
	fn_path = fix_path(fn_path);
	var parent_ref = get(fn_this, fn_path.slice(0,-1));
	var prop = fn_path.slice(-1)[0];
	return Reflect.has(parent_ref, prop);
}

export function get(fn_this, fn_path) {
	fn_path = fix_path(fn_path);
	var fn_ref = fn_this;
	try {
		for (var fn_part of fn_path) {
			fn_this = fn_ref;
			fn_ref = Reflect.get(fn_ref, fn_part, fn_this);
		}
		return fn_ref;
	} catch {
		throw new RefException(`${fn_this} -> ${fn_path}`);
	}
}

export function set(fn_this, fn_path, fn_value) {
	fn_path = fix_path(fn_path);
	var fn_ref = get(fn_this, fn_path.slice(0,-1));
	var prop = fn_path.slice(-1)[0];
	return Reflect.set(fn_ref, prop, fn_value, fn_this);
}

export function deleteProperty(fn_this, fn_path) {
	fn_path = fix_path(fn_path);
	var fn_ref = get(fn_this, fn_path.slice(0,-1))
	var prop = fn_path.slice(-1)[0];
	Reflect.deleteProperty(fn_ref, prop);
}

export function call(fn_this, fn_path, fn_args) {
	fn_path = fix_path(fn_path);
	if (!Array.isArray(fn_args)) fn_args = [fn_args];
	var fn_this = get(fn_this, fn_path.slice(0,-1));
	var fn_ref = get(fn_this, fn_path.slice(-1));
	return Reflect.apply(fn_ref, fn_this, fn_args);
}

export class RefException extends Error {
	constructor(str) {
		super(`Invalid reference : ${str}`)
	}
}