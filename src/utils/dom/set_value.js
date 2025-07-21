/** @param {HTMLElement} elem @param {string} new_value @param {{trigger:boolean|"change"}} opts */
export function set_value(elem, new_value, opts) {
    var value;
    if (elem.nodeName === "INPUT" || elem.nodeName === "TEXTAREA" || elem.nodeName === "SELECT") value = elem.value;
    else if (elem.contentEditable) value = elem.innerHTML;
    else throw new Error();

    opts = {
        trigger: false,
        ...opts
    };
    var changed = false;
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
        if (value !== new_value) {
            var pos = elem.selectionStart;
            var at_end = pos == value.length;
            changed = true;
            if (elem.nodeName == "INPUT" || elem.nodeName == "SELECT" || elem.nodeName == "TEXTAREA") {
                elem.value = new_value;
            } else if (elem.contentEditable) {
                elem.innerHTML = new_value;
            }
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