import { get_index } from "./get_index.js";
import { insert_at } from "./insert_at.js";

/** @template T @param {HTMLElement} container @param {{selector:string, auto_insert:boolean, remove:function(Element):void, add:function(T,Element,Number):Element }} opts @param {T[]} items */
export function rebuild(container, items, opts) {
    if (!opts) opts = {};
    opts = Object.assign({
        selector: ":scope>*",
        auto_insert: true,
        remove: (elem) => elem.remove(),
        add: (elem) => { },
        id_callback: null
    }, opts);
    var orig_elems = Array.from(container.querySelectorAll(opts.selector));
    var leftovers = new Set(orig_elems);
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var id = opts.id_callback ? opts.id_callback.apply(item, [item]) : item.id;
        var elem = orig_elems.find(e => e.dataset.id == id);
        elem = opts.add(item, elem, i) || elem;
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