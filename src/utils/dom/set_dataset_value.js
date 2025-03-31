import { convert_to_camel_case } from "./convert_to_camel_case.js";
/** @param {HTMLElement} elem */
export function set_dataset_value(elem, key, value) {
    return elem.dataset[convert_to_camel_case(key)] = value;
}

export default set_dataset_value;