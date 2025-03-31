import { set_children } from './set_children.js';

/** @param {Element} elem @param {string | Element[]} html */
export function set_inner_html(elem, html) {
    if (Array.isArray(html)) {
        set_children(elem, html);
    } else if (html instanceof Element) {
        if (elem.children[0] !== html) elem.prepend(html);
        for (var i = 1; i < elem.children.length; i++) elem.children[i].remove();
    } else {
        if (elem.innerHTML !== html) {
            elem.innerHTML = html;
        }
        // if (elem[inner_html_prop] !== html) {
        //     elem[inner_html_prop] = elem.innerHTML = html;
        // }
        // _temp_div.innerHTML = html; // ugh. Needed for entities like & and whatnot
        // if (elem.innerHTML !== _temp_div.innerHTML) {
        //     elem.innerHTML = html;
        // }
    }
}

export default set_inner_html;