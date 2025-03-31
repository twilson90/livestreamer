/** @param {HTMLElement} elem @param {string} prop @param {string} value */
export function set_style_property(elem, prop, value) {
    if (elem.style.getPropertyValue(prop) != value) {
        elem.style.setProperty(prop, value);
    }
}

export default set_style_property;