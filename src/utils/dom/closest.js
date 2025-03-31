/** @param {HTMLElement} elem @param {function(Element):any} delegate */
export function closest(elem, delegate) {
    var p = elem;
    while (p) {
        var r = delegate.apply(p, [p]);
        if (r) return p;
        p = p.parentElement;
    }
}

export default closest;