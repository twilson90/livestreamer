/** @param {HTMLIFrameElement} el */
export function iframe_ready(el) {
    return new Promise(resolve => {
        var check = () => {
            var doc = el.contentDocument || el.contentWindow.document;
            if (doc.readyState == 'complete') resolve();
            else setTimeout(check, 100);
        };
        check();
    });
}

export default iframe_ready;