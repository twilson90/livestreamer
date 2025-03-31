import { on_stylesheet_load } from "./exports.js";

export function clone_document_head(from, to, opts) {
    opts = Object.assign({
        style: true,
        script: false,
        other: true,
        remove_media_rules: true,
    }, opts);
    var promises = [];
    if (from instanceof Document) from = from.head;
    for (let c of from.children) {
        var is_stylesheet = (c.nodeName === "LINK" && c.rel === "stylesheet");
        if (c.nodeName === "SCRIPT") {
            if (!opts.script) continue;
        } else if (is_stylesheet || c.nodeName === "STYLE") {
            if (!opts.style) continue;
        } else {
            if (!opts.other) continue;
        }

        let clone = c.cloneNode(true);
        to.append(clone);

        if (is_stylesheet && opts.remove_media_rules) {
            var promise = on_stylesheet_load(clone);
            promise.then((ss) => {
                // order.push([new Date()-t, clone, ss]);
                var rules = [];
                try { rules = ss.cssRules; } catch { }
                if (!rules) return;
                for (var j = rules.length - 1; j >= 0; j--) {
                    if (rules[j].cssText.indexOf('@media') === 0) {
                        ss.deleteRule(j);
                    }
                }
            });
            promises.push(promise);
        }
    }
    return Promise.all(promises);
}

export default clone_document_head;