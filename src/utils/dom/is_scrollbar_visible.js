/** @param {Element} elem */
export function is_scrollbar_visible(elem) {
    var doc = elem.ownerDocument;
    var win = doc.defaultView || doc.parentWindow;
    var scroll_lookup = { auto: true, scroll: true, visible: false, hidden: false };
    var styles = win.getComputedStyle(elem, null);
    var overflow_x = scroll_lookup[styles.overflowX.toLowerCase()] || false;
    var overflow_y = scroll_lookup[styles.overflowY.toLowerCase()] || false;
    return overflow_x || overflow_y;
}

export default is_scrollbar_visible;