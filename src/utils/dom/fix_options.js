/**
 * @template T
 * @typedef {{
 *   value:T,
 *   text:string,
 *   style:object,
 *   hidden:boolean,
 *   disabled:boolean
 * }} OptionSettings
 */

/**
 * @typedef {{
 *   group:string
 *   options:OptionSettings[]
 * }} OptionGroupSettings
 */

/** @template T @returns {OptionSettings<T>[]} */
export function fix_options(options) {
    return options.map((o)=>{
        if (Array.isArray(o)) {
            var i = 0, new_o = {};
            for (var i = 0; i < o.length; i++) {
                if (typeof o[i] === "object" && o[i] !== null) Object.assign(new_o, o[i]);
                else if (new_o.value === undefined) [new_o.value, new_o.text] = [o[i], o[i]];
                else new_o.text = String(o[i]);
            }
            return new_o;
        } else if (typeof o === "object" && o !== null) {
            if (o.name && !o.text) {
                o.text = o.name;
                delete o.name;
            }
            return {...o};
        } else return { value: o, text: String(o) };
    });
}
export default fix_options;