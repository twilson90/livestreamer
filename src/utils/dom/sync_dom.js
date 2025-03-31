import { set_inner_html } from "./set_inner_html.js";
import { sync_attributes } from "./sync_attributes.js";

// ignores text elements and whitespace
/** @param {Element} dst @param {Element} src @param {{attrs:boolean}} opts */
export function sync_dom(dst, src, opts) {
    opts = Object.assign({
        attrs: true
    }, opts);
    if (!(src && dst && src.nodeName === dst.nodeName)) throw new Error("src and dst must match nodeName to sync");
    if (opts.attrs) {
        sync_attributes(dst, src);
    }
    if (src.children.length == 0 && dst.children.length == 0) {
        set_inner_html(dst, src.innerHTML);
        return;
    }
    var get_id = (el) => opts.get_id ? opts.get_id(el) : el.getAttribute("data-id") || el.id;
    var dst_children = [...dst.children];
    var i;
    for (i = 0; i < src.children.length; i++) {
        var src_c = src.children[i];
        var src_id = get_id(src_c);
        if (src_id) {
            var dst_c_index = dst_children.findIndex(c => get_id(c) === src_id);
            if (dst_c_index != -1 && dst_c_index != i) {
                dst_children.splice(i, 0, dst_children.splice(dst_c_index, 1));
            }
        }
        var dst_c = dst_children[i];
        var same = src_c && dst_c && src_c.nodeName === dst_c.nodeName;
        if (!same) {
            if (dst_c) {
                dst_c.remove();
                dst_c = null;
            }
            if (src_c) dst_c = src_c.cloneNode(true);
        }
        if (dst_c) {
            if (!dst.children[i]) dst.append(dst_c);
            else if (dst.children[i] !== dst_c) dst.children[i].before(dst_c);
        }
        if (same) {
            sync_dom(dst_c, src_c);
        }
    }
    var leftovers = [...dst.children].slice(i);
    for (var dst_c of leftovers) {
        dst_c.remove();
    }
}

export default sync_dom;