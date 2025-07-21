export function hr_timestamp() {
    if (typeof performance !== "undefined") {
        return performance.now();
    }
    return Date.now();
}
export default {hr_timestamp};