/** @param {Element} elem @param {string} new_value @param {Object} opts */
export function set_value(elem, new_value, opts) {
    if (typeof elem.value === "undefined") throw new Error();

    opts = {
        trigger: "change",
        ...opts
    };
    var changed = false;
    // var curr_val = get_value(elem);
    // if (curr_val === val) return;
    if (elem.type === "checkbox") {
        new_value = !!new_value;
        if (elem.checked !== new_value) {
            changed = true;
            elem.checked = !!new_value;
        }
    } else {
        if (elem.nodeName === "SELECT") {
            var json = JSON.stringify(new_value);
            var option = [...elem.options].find(e => e.dataset.value == json);
            if (option) new_value = option.value;
            else new_value = "";
        }
        if (new_value === null || new_value === undefined) {
            new_value = "";
        } else {
            new_value = String(new_value);
        }
        var old_value = elem.value;
        if (old_value !== new_value) {
            var pos = elem.selectionStart;
            var at_end = pos == elem.value.length;
            changed = true;
            elem.value = new_value;
            if (at_end) pos = elem.size;
            if (pos !== undefined && elem.selectionEnd != null) elem.selectionEnd = pos;
        }
    }
    if (opts.trigger === "change" && changed || opts.trigger == true) {
        elem.dispatchEvent(new Event("change"));
    }
    return changed;
}

export default set_value;