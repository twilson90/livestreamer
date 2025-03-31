import { remove_style_property } from "./remove_style_property.js";
import { set_style_property } from "./set_style_property.js";

/** @param {HTMLElement} elem @param {Object} props */
export function update_style_properties(elem, props) {
    for (var k in props) {
        if (props[k]) set_style_property(elem, k, props[k]);
        else remove_style_property(elem, k);
    }
}

export default update_style_properties;