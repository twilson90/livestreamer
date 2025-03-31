/** @param {Element} elem @param {string} attr @param {string} value */
export function set_attribute(elem, attr, value) {
    if (elem.getAttribute(attr) != value) {
        elem.setAttribute(attr, value);
    }
}

export default set_attribute;