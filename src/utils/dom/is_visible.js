/** @param {Element} elem */
export function is_visible(elem) {
    if (!elem.isConnected) return false;
    if (elem.offsetHeight === 0 && elem.offsetWidth === 0) return false;
    return true;
    /* if (!elem.ownerDocument) return false;
    while(elem) {
        if (getComputedStyle(elem).display === "none") return false;
        elem = elem.parentElement;
    }
    return true; */
}

export default is_visible;