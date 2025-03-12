/** @typedef {{password:string, access:"allow"|"deny"|"password"}} AccessControlEntry */
export class AccessControl {
    ["*"] = {"access":"allow"};
    constructor(ac) {
        var proxy = new Proxy(this, {
            set: (target, prop, value) => {
                target[prop] = value;
                return true;
            },
            deleteProperty: (target, prop) => {
                if (prop === "*") return false;
                delete target[prop];
                return true;
            }
        });
        Object.assign(proxy, ac);
        return proxy;
    }
}

export default AccessControl;