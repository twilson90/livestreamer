import { nearest } from "../nearest.js";

/* scroll_into_view(e) {
    var p = e.parentElement;
    if ((e.offsetTop + e.offsetHeight) < p.scrollTop) p.scrollTop = e.offsetTop;
    else if (e.offsetTop > (p.scrollTop + p.offsetHeight)) p.scrollTop = e.offsetTop + e.offsetHeight - p.offsetHeight;
}, */
/** @param {Element} el @param {{block_offset:number, inline_offset:number, block:ScrollLogicalPosition, inline:ScrollLogicalPosition, behavior:ScrollBehavior }} options */
export function scroll_to(container, el, options) {
    var { block_offset, inline_offset, block, inline, behavior } = options;
    var rect = el.getBoundingClientRect();
    if (!block && !inline) block = "start";
    if (block && rect.height == 0) return;
    if (inline && rect.width == 0) return;
    var scroll_opts = {
        block,
        inline,
        behavior
    };
    if (block) {
        let offset = rect.top - (block_offset || 0);
        if (block == "nearest" && nearest(0, rect.top, rect.bottom) == rect.bottom) block = "end";
        if (block == 'center') {
            let space = window.innerHeight - offset;
            if (rect.height < space) offset -= (space - rect.height) / 2;
        } else if (block == "end") {
            offset -= rect.height;
        }
        scroll_opts.top = offset;
    }
    if (inline) {
        let offset = rect.left - (inline_offset || 0);
        if (block == "nearest" && nearest(0, rect.left, rect.right) == rect.right) block = "end";
        if (block == 'center') {
            let space = window.innerWidth - offset;
            if (rect.width < space) offset -= (space - rect.width) / 2;
        } else if (block == "end") {
            offset -= rect.width;
        }
        scroll_opts.left = offset;
    }
    container.scrollBy(scroll_opts);
}

export default scroll_to;