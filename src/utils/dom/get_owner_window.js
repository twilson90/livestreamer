/** @returns {Window} */
export function get_owner_window(node) {
    var doc = node.ownerDocument;
    return (doc.defaultView) ? doc.defaultView : doc.parentWindow;
}

export default get_owner_window;