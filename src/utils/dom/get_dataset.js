import { convert_to_camel_case } from "./convert_to_camel_case";

/** @param {HTMLElement} elem */
export function get_dataset(elem, key) {
    if (key) {
        return elem.dataset[convert_to_camel_case(key)];
    }
    return Object.fromEntries(Array.from(elem.attributes).filter(attr => attr.nodeName.match(/^data-/)).map(attr => attr.nodeName.slice(5)).map(k => [k, get_dataset(elem, k)]));
}

export default get_dataset;