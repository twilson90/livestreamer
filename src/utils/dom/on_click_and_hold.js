/** @param {Element} elem @param {Function} callback */
export function on_click_and_hold(elem, callback) {
    var delay = 0;
    var next_time = 0;
    var is_down = false;
    elem.addEventListener("mousedown", function (e) {
        next_time = 0;
        delay = 250;
        handleMouseDown(e);
    });
    document.addEventListener("mouseup", function (e) {
        handleMouseUp(e);
    });
    function handleMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        is_down = true;
        requestAnimationFrame(watcher);
    }
    function handleMouseUp(e) {
        e.preventDefault();
        e.stopPropagation();
        is_down = false;
    }
    function watcher(time) {
        if (!is_down) return;
        if (time > next_time) {
            next_time = time + delay;
            delay = Math.max(50, delay - 50);
            callback.apply(elem);
        }
        requestAnimationFrame(watcher);
    }
}

export default on_click_and_hold;