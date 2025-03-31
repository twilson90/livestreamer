/** @param {Element} e @param {number} v */
export function scroll_pos_from_bottom(e, v) {
    if (v === undefined) {
        return e.scrollHeight - e.clientHeight - e.scrollTop;
    } else {
        e.scrollTop = e.scrollHeight - e.clientHeight - v;
    }
}

export default scroll_pos_from_bottom;