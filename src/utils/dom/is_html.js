const _temp_div = document.createElement("div");
/** @param {string} str */
export function is_html(str) {
    _temp_div.innerHTML = str;
    for (var c = _temp_div.childNodes, i = c.length; i--;) {
        if (c[i].nodeType == 1) return true;
    }
    return false;
}

export default is_html;