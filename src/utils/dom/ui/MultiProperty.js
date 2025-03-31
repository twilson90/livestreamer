
import { Property } from "./Property.js";
/** @import {PropertySettings} from "./Property.js" */

/** @typedef {PropertySettings & {}} MultiPropertySettings */
/** @extends {Property<MultiPropertySettings>} */
export class MultiProperty extends Property {
    /** @param {Settings} settings */
    constructor(settings) {
        var wrapper = $(`<div class="property-multiple"></div>`)[0];
        super(wrapper, settings);
        /** @type {Property[]} */
        var props = this.get_setting("props");
        if (!Array.isArray(props)) props = [props];
        for (var prop of props) {
            wrapper.append(prop);
        }
        this.on("change", /** @param {PropertyChangeEvent} e */(e) => {
            if (e.property === this) {
                props.forEach((prop, i) => {
                    prop.set_value(e.value[prop.name], { trigger: false });
                });
            } else if (props.includes(e.property)) {
                if (e.trigger) {
                    var value = this.value;
                    value[e.name] = e.value;
                    this.set_value(value, { trigger: true });
                }
                return false;
            }
        });
    }
}

export default MultiProperty;