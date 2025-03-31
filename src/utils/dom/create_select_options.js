import { $ } from './render_html.js';

/** @param {(OptionSettings|OptionGroupSettings)[]} options */
export function create_select_options(options) {
    return options.map(o => {
        /** @type {HTMLOptionElement} */
        if (o.group) {
            var e = $(`<optgroup label="${o.group}"></optgroup>`)[0];
            e.append(...create_select_options(o.options));
            return e;
        }
        var e = $(`<option></option>`)[0];
        e.innerHTML = o.text;
        if (o.disabled) e.disabled = true;
        if (o.selected) e.selected = true;
        if (o.hidden) e.hidden = true;
        if (o.class) o.class.forEach(c => e.classList.add(c));
        if (o.style) Object.assign(e.style, o.style);
        if (o.value !== undefined) {
            e.value = o.value;
            e.dataset.value = JSON.stringify(o.value);
        }
        return e;
    });
}

export default create_select_options;