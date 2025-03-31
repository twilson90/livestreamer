/** @param {Element} target @param {Element} elem */
export function insert_after(target, elem) {
    var parent = target.parentNode;
    if (parent.lastChild === target) {
        parent.appendChild(elem);
    } else {
        parent.insertBefore(elem, target.nextSibling);
    }
}

export default insert_after;