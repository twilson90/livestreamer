/** @param {Element} elem @param {string} clazz @param {boolean} value */
export function toggle_class(elem, clazz, value) {
    if (elem.classList.contains(clazz) != value) {
        elem.classList.toggle(clazz, value);
    }
}

export default toggle_class;