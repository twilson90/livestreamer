/** @template T1 @param {function():T1} cb @param {any} [default_value] @returns {T1} */
export function try_catch(cb, default_value = undefined) {
	try {
		return cb();
	} catch (e) {
		return default_value;
	}
}

export default try_catch;