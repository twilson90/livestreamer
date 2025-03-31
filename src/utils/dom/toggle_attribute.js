/** @param {Element} elem @param {string} attr @param {string} value */
export function toggle_attribute(elem, attr, value) {
    if (elem.hasAttribute(attr) != value) {
        elem.toggleAttribute(attr, value);
    }
}

export default toggle_attribute;