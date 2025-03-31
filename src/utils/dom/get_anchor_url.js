import { try_catch } from '../try_catch.js';
/** @param {Element} el */
export function get_anchor_url(el) {
    if (!el.matches("a")) return;
    /** @type {HTMLAnchorElement} */
    var anchor = el;
    return try_catch(() => new URL(anchor.href));
}

export default get_anchor_url;