/** @param {Element} elem @param {Element[]} new_children */
export function set_children(elem, new_children) {
    var children = [...elem.children];
    if (children.length && children.every((e, i) => e === new_children[i])) return;
    elem.replaceChildren(...new_children);
}

export default set_children;