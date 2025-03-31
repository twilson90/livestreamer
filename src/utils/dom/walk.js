/** @param {HTMLElement} elem @param {function(Element):any} delegate */
export function walk(elem, delegate) {
    var r, c;
    var _walk = (elem) => {
        r = delegate.apply(elem, [elem]);
        if (r) return r;
        for (c of elem.children) {
            r = _walk(c);
            if (r) return r;
        }
    };
    for (c of elem.children) {
        r = _walk(c);
        if (r) return r;
    }
}

export default walk;