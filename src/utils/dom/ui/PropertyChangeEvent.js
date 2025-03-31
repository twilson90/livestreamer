/** @typedef {(HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement)&{_validation_tooltip:Tooltip}} Input */

export class PropertyChangeEvent {
    /** @param {Property} prop */
    constructor(prop, trigger = false) {
        this.property = prop;
        this.datas = [...prop.items];
        this.name = prop.name;
        this._value = prop._value;
        this._values = prop._values;
        this.value = prop.value;
        this.values = prop.values;
        this.container = prop.container;
        this.trigger = trigger;
    }
}

export default PropertyChangeEvent;