/** @param {HTMLSelectElement} elem */
export function cycle_select(elem, trigger = false) {
    var value = elem.value;
    var options = Array.from(elem.options);
    var i = 0;
    for (; i < options.length; i++) {
        if (options[i].value == value) {
            i++;
            break;
        }
    }
    elem.value = options[i % options.length].value;
    if (trigger) elem.dispatchEvent(new Event("change"));
}

export default cycle_select;