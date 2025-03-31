/** @param {Element} elem */
export function remove_children(elem) {
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

export default remove_children;