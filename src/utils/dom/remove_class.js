/** @param {Element} elem @param {string} clazz */
export function remove_class(elem, clazz) {
    if (elem.classList.contains(clazz)) elem.classList.remove(clazz);
}

export default remove_class;