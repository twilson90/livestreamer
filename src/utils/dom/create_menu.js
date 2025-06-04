import { noop } from "../noop.js";
import { $ } from "./render_html.js";
import { add_class } from "./add_class.js";
import { toggle_display } from "./toggle_display.js";

/** @returns {HTMLElement} */
export function create_menu(items, opts = {}) {
    opts = {
        click: noop,
        params: [],
        ...opts
    };
    var list = $(`<div class="list-menu"></div>`)[0];

    var process_item = (item, list) => {
        let elem;
        var is_separator = (typeof item === "string" && item.slice(0, 3) === "---");
        if (is_separator) {
            elem = $(`<div class="separator"></div>`)[0];
        } else if (Array.isArray(item)) {
            elem = $(`<div class="list-menu"></div>`)[0];
            item.forEach(i => process_item(i, elem));
        } else {
            var get = (p) => {
                if (typeof item[p] === "function") {
                    var params = typeof opts.params === "function" ? opts.params() : opts.params;
                    return item[p].apply(item, [params, elem]);
                }
                return item[p];
            };
            var icon = get("icon");
            var label = get("label");
            var disabled = get("disabled");
            var shortcut = get("shortcut");
            var visible = get("visible");
            var href = get("href");
            var description = get("description_or_label");
            var t = (href) ? "a" : "div";
            elem = $(`<${t} class="item"></${t}>`)[0];
            elem.style.justifyContent = get("align") || "flex-start";

            elem.title = [...new Set([label, description])].filter(s => s).join(" | ");
            if (href) {
                elem.href = href;
                elem.target = "_blank";
            }

            if (icon) elem.append(...$(`<span class="icon">${icon}</span>`));
            if (label) elem.append(...$(`<span class="label">${label}</span>`));
            if (shortcut) {
                shortcut = shortcut.replace("ArrowUp", "↑").replace("ArrowDown", "↓").replace("ArrowLeft", "←").replace("ArrowRight", "→");
                elem.append(...$(`<span class="shortcut"><span>${shortcut}</span></span>`));
            }
            if (disabled) {
                elem.disabled = true;
                add_class(elem, "disabled");
            } else {
                elem.addEventListener("click", (e) => {
                    get("click");
                    opts.click();
                });
            }
            if (visible === false) toggle_display(elem, false);
            get("render");
        }
        list.appendChild(elem);
    };
    items.forEach(i => process_item(i, list));
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("mouseup", (e) => e.preventDefault());
    return list;
}

export default create_menu;