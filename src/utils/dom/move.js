import { insert_at } from "./insert_at.js";

/** @param {Element} elem @param {number} delta */
export function move(elem, delta = 1) {
    if (delta == 0) return;
    var children = [...elem.parentElement.children];
    var index = children.indexOf(elem);
    if (delta > 0) index += 1;
    insert_at(elem.parentElement, elem, index + delta);
}

export default move;