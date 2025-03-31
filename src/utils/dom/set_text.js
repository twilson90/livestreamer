/** @param {Element} elem @param {string} text */
export function set_text(elem, text) {
    text = String(text);
    if (elem.textContent != text) elem.textContent = text;
}

export default set_text;