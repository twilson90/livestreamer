import { get_index } from "./get_index.js";
import { insert_at } from "./insert_at.js";

/** @template T */
class default_opts {
    selector = ":scope>*";
    auto_insert = true;
    /** @param {Element} elem */
    remove = (elem) => elem.remove();
    /** @param {T} item @param {Element} elem @param {Number} index */
    add = (item, elem, index) => {
        return elem || document.createElement("div");
    };
    /** @param {T} item */
    id_callback = (item) => item.id;
}

/** @template T @param {HTMLElement} container @param {T[]} items @param {default_opts<T>} opts */
export function rebuild(container, items, opts) {
    opts = {
        ...new default_opts,
        ...opts
    }
    var curr_children = [...container.querySelectorAll(opts.selector)];
    var id_map = Object.fromEntries(curr_children.map(e=>[e.dataset.id, e]));
    var index_map = new Map(curr_children.map((e,i)=>[i, e]));
    var leftovers = new Set(Object.values(id_map));
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var id = opts.id_callback ? opts.id_callback.apply(item, [item]) : item.id;
        var orig_elem = id_map[id];
        var elem = opts.add(item, orig_elem, i) || orig_elem;
        elem.dataset.id = id;
        if (opts.auto_insert) {
            if (elem.parentElement != container || index_map.get(elem) != i) {
                insert_at(container, elem, i);
            }
        }
        leftovers.delete(elem);
    }
    for (var elem of leftovers) {
        if (opts.remove) opts.remove(elem);
        else elem.remove();
    }
}

export default rebuild;