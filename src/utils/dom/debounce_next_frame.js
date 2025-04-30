/** @template T @param {function():T} func @returns {(function():Promise<T>) & {cancel:function():void}} */
export function debounce_next_frame(func) {
    var timeout_id, args, context, promise, resolve;
    var later = () => {
        promise = null;
        resolve(func.apply(context, args));
    };
    var debounced = function (...p) {
        context = this;
        args = p;
        return promise = promise || new Promise(r => {
            resolve = r;
            timeout_id = requestAnimationFrame(later);
        });
    };
    debounced.cancel = () => {
        promise = null;
        cancelAnimationFrame(timeout_id);
    };
    return debounced;
}

export default debounce_next_frame;