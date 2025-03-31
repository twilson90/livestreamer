/** @param {Element} elem */
export function get_value(elem) {
    if (elem.type === "checkbox") {
        return elem.checked;
    } else if (elem.nodeName === "SELECT") {
        var option = [...elem.options].find(e => e.value == elem.value);
        if (option && option.dataset.value !== undefined) return JSON.parse(option.dataset.value);
        else return elem.value;
    } else if (["number", "range"].includes(elem.type)) {
        return parseFloat(elem.value) || 0;
    } else {
        return elem.value;
    }
}

export default get_value;