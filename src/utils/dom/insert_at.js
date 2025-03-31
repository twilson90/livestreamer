/** @param {Element} container @param {Element} element @param {number} index */
export function insert_at(container, element, index) {
    if (container.children[index] === element) return;
    index = Math.max(index, 0);
    if (index === 0) {
        container.prepend(element);
    } else {
        var after = container.children[index];
        if (after) container.insertBefore(element, after);
        else container.append(element);
    }
}

export default insert_at;