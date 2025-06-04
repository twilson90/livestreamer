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
    var orig_elems = new Map([...container.querySelectorAll(opts.selector)].map(e=>[e.dataset.id, e]));
    var leftovers = new Set(orig_elems.values());
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var id = opts.id_callback ? opts.id_callback.apply(item, [item]) : item.id;
        var orig_elem = orig_elems.get(id);
        var elem = opts.add(item, orig_elem, i) || orig_elem;
        elem.dataset.id = id;
        if (opts.auto_insert) {
            if (elem.parentElement != container || get_index(elem) != i) {
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