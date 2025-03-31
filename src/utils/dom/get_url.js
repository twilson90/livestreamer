/** @param {string} uri @param {string} sub @param {boolean} ws */
export function get_url(uri, sub, ws = false) {
    let url = new URL(uri || window.location.origin);
    var parts = url.host.split(".");
    if (!uri) parts.shift();
    parts.unshift(sub);
    url.host = parts.filter(a => a).join(".");
    if (ws) url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return url;
}

export default get_url;