/** @param {Element} e @param {number} v */
export function scroll_y_percent(e, v) {
    if (v === undefined) {
        var y = e.scrollTop / (e.scrollHeight - e.clientHeight);
        return isNaN(y) ? 1 : y;
    } else {
        e.scrollTop = (e.scrollHeight - e.clientHeight) * v;
    }
}

export default scroll_y_percent;