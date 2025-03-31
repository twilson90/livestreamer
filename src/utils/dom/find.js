/** @template T @param {Node} el @param {string} selector @param {new()=>T} type @returns {Iterable<T>} */
export function* find(el, selector, type) {
    if (!(el instanceof HTMLElement)) return;
    if (el.matches(selector)) yield el;
    else {
        for (var c of el.querySelectorAll(selector)) yield c;
    }
}
export default find;