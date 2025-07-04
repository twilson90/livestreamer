/** @param {Element} element */
export function get_index(element) {
    if (element.parentNode) {
        for (var i = 0; i < element.parentNode.children.length; i++) {
            if (element.parentNode.children[i] === element) return i;
        }
    }
    return -1;
}