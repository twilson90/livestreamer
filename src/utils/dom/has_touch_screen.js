export function has_touch_screen() {
    if ("maxTouchPoints" in window.navigator) {
        return window.navigator.maxTouchPoints > 0;
    } else if ("msMaxTouchPoints" in window.navigator) {
        return window.navigator.msMaxTouchPoints > 0;
    } else {
        var mQ = window.matchMedia && window.matchMedia("(pointer:coarse)");
        if (mQ && mQ.media === "(pointer:coarse)") {
            return !!mQ.matches;
        } else if ('orientation' in window) {
            return true; // deprecated, but good fallback
        } else {
            // Only as a last resort, fall back to user agent sniffing
            var UA = window.navigator.userAgent;
            return /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) || /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
        }
    }
}

export default has_touch_screen;