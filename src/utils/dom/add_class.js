/** @param {Element} elem */
export function add_class(elem, clazz) {
    if (!elem.classList.contains(clazz)) elem.classList.add(clazz);
}

export default add_class;