import { create_select_options } from './create_select_options.js';
import { remove_children } from "./remove_children.js";
/** @import {OptionSettings, OptionGroupSettings} from './fix_options.js' */

/** @param {HTMLSelectElement} select @param {(OptionSettings|OptionGroupSettings)[]} options */
export function set_select_options(select, options) {
    // if (!Array.isArray(settings)) Object.entries(settings);
    var hash = JSON.stringify(options);
    if (hash === select._options_hash) return;
    select._options_hash = hash;
    remove_children(select);
    select.append(...create_select_options(options));
}

export default set_select_options;