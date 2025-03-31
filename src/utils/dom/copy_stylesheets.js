import { $ } from "./render_html.js";

export async function copy_stylesheets(from, to, remove_media_queries = false) {
    if (from.ownerDocument === to.ownerDocument) {
        console.log(`copy_stylesheets: both ownerDocuments identical.`);
        return;
    }
    var style_nodes = new Set();
    function add_style(elem) {
        if (typeof elem === "string") elem = $(elem)[0];
        style_nodes.add(elem);
        to.append(elem);
    }
    var remote_stylesheets = 0;
    // var promises = [];
    for (let e of from.querySelectorAll("*")) {
        if (e instanceof HTMLStyleElement || (e instanceof HTMLLinkElement && e.rel === "stylesheet")) {
            // var cloneable = true;
            // try { var test_access = (e.sheet && e.sheet.cssRules) } catch { cloneable = false; }
            // if (cloneable) {
            //     add_style(e.cloneNode(true));
            // } else {
            //     var p = fetch(e.href).then((css)=>{
            //         add_style(`<style type=${e.type} media=${e.media}>${css}</style>`);
            //     });
            //     promises.push(p);
            // }
            if (e.href) {
                var href = e.href;
                if (href.startsWith("//")) href = "https:" + href;
                else if (href.startsWith("/")) href = location.origin + href;
                try {
                    var url = new URL(href);
                    if (url.host !== location.host) remote_stylesheets++;
                } catch { }
            }
            add_style(e.cloneNode(true));
        }
    }
    var num_stylesheets = style_nodes.size - remote_stylesheets;
    // await Promise.all(promises);
    return new Promise((resolve) => {
        var check_interval = setInterval(() => {
            for (var ss of to.ownerDocument.styleSheets) {
                if (!style_nodes.has(ss.ownerNode)) continue;
                style_nodes.delete(ss.ownerNode);
                try {
                    if (!ss.cssRules) continue;
                } catch {
                    continue;
                }
                if (remove_media_queries) {
                    for (var j = ss.cssRules.length - 1; j >= 0; j--) {
                        if (ss.cssRules[j].cssText.indexOf('@media') === 0) {
                            ss.deleteRule(j);
                        }
                    }
                }
            }
            if (style_nodes.size === 0 || to.ownerDocument.styleSheets.length >= num_stylesheets) {
                clearInterval(check_interval);
                resolve();
            }
        }, 1000 / 20);
    });
}
