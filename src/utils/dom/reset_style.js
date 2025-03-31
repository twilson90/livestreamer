/** @param {Element} el */
export function reset_style(el) {
    var props = [];
    for (var i = 0; i < el.style.length; i++) props[i] = el.style[i];
    for (var k of props) {
        el.style[k] = "";
    }
}

export default reset_style;