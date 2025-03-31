/** @param {Element} elem */
export function select_text(elem) {
    elem.focus();
    var range = elem.ownerDocument.createRange();
    range.selectNodeContents(elem);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

export default select_text;