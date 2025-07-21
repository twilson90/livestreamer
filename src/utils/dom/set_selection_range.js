/** @param {Element} elem @param {number} start @param {number} end */
export function set_selection_range(elem, start, end) {
    const range = document.createRange();
    const selection = window.getSelection();
    
    // Set the range to select the desired portion
    range.setStart(elem.firstChild, start);
    range.setEnd(elem.firstChild, end);
    
    // Remove any existing selections and add the new range
    selection.removeAllRanges();
    selection.addRange(range);
}
export default set_selection_range;