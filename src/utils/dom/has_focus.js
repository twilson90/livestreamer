import { walk } from './walk.js';
import { closest } from './closest.js';

/** @param {HTMLElement} el */
export function has_focus(el, ancestors = false, descendents = false) {
    /** @type {Document|ShadowRoot} */
    var root = el.getRootNode();
    var active_el = root.activeElement;
    if (active_el === el) return true;
    if (root.body !== active_el) {
        if (ancestors && closest(el, (e) => e === active_el)) return true;
        if (descendents && walk(el, (e) => e === active_el)) return true;
    }
    return false;
}

export default has_focus;