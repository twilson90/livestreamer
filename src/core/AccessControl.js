/** @typedef {{password:string, access:"allow"|"deny"|"password"}} AccessControlEntry */
export class AccessControl {
    #$;
    /** @type {Record<string, AccessControlEntry>} */
    get $() { return this.#$; }
    constructor(ac) {
        if (!ac) ac = {};
        if (!ac["*"]) ac["*"] = {"access":"allow"};
        this.#$ = new Proxy(ac, {
            get: (target, prop) => {
                return target[prop];
            },
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
    }
}

export default AccessControl;