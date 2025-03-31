/** @param {Element} elem */
export async function on_stylesheet_load(elem) {
    var href = elem.href;
    if (href.startsWith("//")) href = location.protocol + href;
    else if (href.startsWith("/")) href = location.origin + href;
    if (elem.nodeName === "LINK" && elem.sheet) return true;
    var check_interval, resolve, i = 0;
    function check() {
        if (elem.sheet || ++i >= 100) return resolve(elem.sheet);
        for (var ss of elem.ownerDocument.styleSheets) {
            if (ss.href === href) return resolve(ss);
        }
    }
    return new Promise((_resolve) => {
        resolve = () => _resolve(elem.sheet);
        elem.addEventListener("load", resolve);
        check_interval = setInterval(check, 100);
        // setTimeout(check, 1);
    }).then((ss) => {
        clearInterval(check_interval);
        elem.removeEventListener("load", resolve);
        return ss;
    });
}
