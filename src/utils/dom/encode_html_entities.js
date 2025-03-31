/** @param {string} str */
export function encode_html_entities(str) {
    return String(str).replace(/[\u00A0-\u9999<>\&]/gim, (i) => {
        return `&#${i.charCodeAt(0)};`;
    });
}

export default encode_html_entities;