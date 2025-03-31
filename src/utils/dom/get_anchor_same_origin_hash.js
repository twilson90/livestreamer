import { get_anchor_url } from "./get_anchor_url.js";
/** @param {Element} el */
export function get_anchor_same_origin_hash(el) {
    var url = get_anchor_url(el);
    if (url && (url.origin + url.pathname) === (window.location.origin + window.location.pathname) && url.hash) return url.hash;
}

export default get_anchor_same_origin_hash;