/** @template T @param {T} target @param {Record<string, any>} defaults @returns {T} */
export function proxy_defaults(target, defaults={}) {
    var json_defaults = Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k, JSON.stringify(v)]));
    return new Proxy(target, {
        set(target, prop, value) {
            if (JSON.stringify(value) === json_defaults[prop] || value === null || value === undefined) delete target[prop];
            else target[prop] = value;
            return true;
        }
    });
}
export default proxy_defaults;