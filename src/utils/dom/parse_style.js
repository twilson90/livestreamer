import { set_attribute } from "./set_attribute.js";

const _div2 = document.createElement("div");
export function parse_style(s) {
    set_attribute(_div2, "style", s);
    var d = {};
    for (var i = 0; i < _div2.style.length; i++) {
        var k = _div2.style[i];
        d[k] = _div2.style.getPropertyValue(k);
    }
    return d;
}

export default parse_style;