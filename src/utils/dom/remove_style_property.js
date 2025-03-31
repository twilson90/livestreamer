/** @param {HTMLElement} elem @param {string} prop @param {string} value */
export function remove_style_property(elem, prop, value) {
    if (elem.style.getPropertyValue(prop) !== "") {
        elem.style.removeProperty(prop);
    }
}

export default remove_style_property;