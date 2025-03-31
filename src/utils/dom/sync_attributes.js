import { remove_attribute } from "./remove_attribute.js";
import { set_attribute } from "./set_attribute.js";

/**
 * ignores text elements and whitespace
 * @param {Element} dst
 * @param {Element} src
 * */
export function sync_attributes(dst, src) {
    for (var attr of src.attributes) {
        if (src.getAttribute(attr.name) !== dst.getAttribute(attr.name)) set_attribute(dst, attr.name, attr.value);
    }
    for (var attr of dst.attributes) {
        if (!src.hasAttribute(attr.name)) remove_attribute(dst, attr.name);
    }
}

export default sync_attributes;