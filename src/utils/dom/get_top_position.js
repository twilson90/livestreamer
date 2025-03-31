/** @param {Element} el */
export function get_top_position(el) {
    const { top } = el.getBoundingClientRect();
    const { marginTop } = window.getComputedStyle(el);
    return top - parseInt(marginTop, 10);
}

export default get_top_position;