/** @param {HTMLElement} elem */
export function convert_to_camel_case(key) {
    return key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export default convert_to_camel_case;