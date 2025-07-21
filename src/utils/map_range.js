/** @param {number} value @param {number} in_min @param {number} in_max @param {number} out_min @param {number} out_max */
export function map_range(value, in_min, in_max, out_min, out_max) {
    return out_min + (out_max - out_min) * ((value - in_min) / (in_max - in_min));
}
export default map_range;