import { insert_at } from "./insert_at.js";

/** @param {Element} elem @param {number} i */
export function move(elem, i = 1) {
    if (i == 0) return;
    var children = [...elem.parentElement.children];
    var index = children.indexOf(elem);
    if (i > 0) index += 1;
    insert_at(elem.parentElement, elem, index + i);
}

export default move;