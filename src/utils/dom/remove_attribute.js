/** @param {Element} elem @param {string} attr */
export function remove_attribute(elem, attr) {
    if (elem.hasAttribute(attr)) elem.removeAttribute(attr);
}

export default remove_attribute;