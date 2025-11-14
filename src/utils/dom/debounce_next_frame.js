/** @template T @param {function():T} func @returns {(function():Promise<T>) & {cancel:function():void}} */
export function debounce_next_frame(func) {
    var request_id, timeout_id, args, context, promise, resolve;
    var later = () => {
        promise = null;
        resolve(func.apply(context, args));
    };
    var debounced = function (...p) {
        context = this;
        args = p;
        return promise = promise || new Promise(r => {
            resolve = r;
            // if (document.hasFocus()) {
            request_id = requestAnimationFrame(later);
            // } else {
            //     timeout_id = setTimeout(later, 1000/60);
            // }
        });
    };
    debounced.cancel = () => {
        promise = null;
        if (request_id) cancelAnimationFrame(request_id);
        // if (timeout_id) clearTimeout(timeout_id);
    };
    return debounced;
}

export default debounce_next_frame;