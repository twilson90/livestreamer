import { set_attribute } from "./set_attribute.js";

export function autosize(elem, min_rows = 3) {
    // var nearest_scrollable = closest(elem, (e)=>is_scrollbar_visible(e));
    // var scroll = [];
    // if (nearest_scrollable) {
    //     scroll = [nearest_scrollable.scrollLeft, nearest_scrollable.scrollTop];
    // }
    set_attribute(elem, "rows", min_rows);
    elem.style.resize = "none";
    var style = getComputedStyle(elem, null);
    var heightOffset;
    if (style.boxSizing === 'content-box') {
        heightOffset = -(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
    } else {
        heightOffset = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }
    // Fix when a textarea is not on document body and heightOffset is Not a Number
    if (isNaN(heightOffset)) {
        heightOffset = 0;
    }
    elem.style.overflow = "hidden";
    elem.style.height = "auto";
    var h = Math.max(18 * min_rows, elem.scrollHeight) + heightOffset;
    if (h) elem.style.height = `${h}px`;

    // if (nearest_scrollable) {
    //     nearest_scrollable.scrollTo(...scroll);
    // }
}

export default autosize;