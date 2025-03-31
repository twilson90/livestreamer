/** @param {string} str */
export function decode_html_entities(str) {
    return String(str).replace(/&#\d+;/gm, (s) => {
        return String.fromCharCode(s.match(/\d+/)[0]);
    });
}

export default decode_html_entities;