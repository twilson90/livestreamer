import { get_index } from "./get_index.js";
import { insert_at } from "./insert_at.js";
/** @param {Element} elem */
export function restart_animation(elem) {
    var parent = elem.parentElement;
    var i = get_index(elem);
    if (parent) {
        elem.remove();
        insert_at(parent, elem, i);
    }
}

export default restart_animation;