import { $ } from "../render_html.js";
import { set_inner_html } from "../set_inner_html.js";
import { UI, Button } from "./ui.js";
import { Property, PropertyContainer } from "./Property.js";
import { array_move_element } from "../../array_move_element.js";
import * as reflect from "../../reflect.js";

/** @import {PropertySettings,UISetting, PropertyList} from "./exports.js" */

/**
 * @typedef {PropertySettings & {
 *   'item_size': UISetting<string>,
 *   'allow_empty': UISetting<boolean>,
 *   'ui': (ui:PropertyListItem)=>void,
 *   'new': ()=>any,
 * }} PropertyListSettings
 */

/** @extends {Property<PropertyListSettings>} */
export class PropertyList extends Property {
    get values() { return super.values.map(v => v || []); }
    get value() { return super.value || []; }
    /** @type {PropertyListItem[]} */
    get list_items() { return this._list.children; }

    /** @param {PropertyListSettings} settings */
    constructor(settings) {
        var wrapper = new UI({ class: `property-list-wrapper` });
        super(wrapper.elem, {
            "setup": false,
            "item_size": "auto",
            "allow_empty": true,
            "empty": "No items",
            "new": () => ({}),
            ...settings
        });
        var list = new UI({ class: `property-list` });
        var add_button = new Button(`<button><i class="fas fa-plus"></i></button>`, {
            title: "Add Item",
            "click": () => {
                this.set_value([...this.value, this.get_setting("new")], { trigger: true });
                this.once("render", () => {
                    list.elem.scrollLeft = 999999999;
                    list.elem.scrollTop = 999999999;
                });
            }
        });
        var count_el = $(`<span class="property-list-count"></span>`)[0];
        this.header_el.append(count_el);
        var empty_el = $(`<div class="empty"></div>`)[0];
        wrapper.append(empty_el);

        var item_size = this.get_setting("item_size");
        if (!isNaN(item_size)) item_size = String(item_size) + "px";
        this.elem.style.setProperty("--ui-property-list-item-size", item_size);
        wrapper.append(list);
        this.buttons_el.prepend(add_button.elem);

        this.on("update", () => {
            var items = [...list.children];
            for (var i = 0; i < this.value.length; i++) {
                if (!items[i]) {
                    let item = new PropertyListItem(this);
                    items[i] = item;
                    list.append(item);
                }
                items[i].update();
            }
            for (; i < items.length; i++) {
                items[i].destroy();
            }
            var vertical = !!this.get_setting("vertical");
            wrapper.elem.classList.toggle("vertical", vertical);

            empty_el.style.display = this.value.length ? "none" : "";
            list.elem.style.display = this.value.length ? "" : "none";
            set_inner_html(empty_el, this.get_setting("empty"));
            set_inner_html(count_el, `(${this.value.length})`);
        });
        this._list = list;
    }
}

export class PropertyListItem extends UI {
    get value() { return this.list.value[this.index]; }

    /** @param {PropertyList} list */
    constructor(list) {
        super(null, { class: "property-list-item" });
        this.list = list;

        let buttons = new UI({ class: "property-list-item-buttons" });
        var up_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "up" : "left"}"></i>`,
            "click": () => {
                list.set_value(array_move_element(list.value, this.index, this.index - 1), { trigger: true });
            },
            "hidden": () => list.value.length < 2,
            "disabled": () => this.index == 0,
            "title": `Move Back`,
        });
        var down_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "down" : "right"}"></i>`,
            "click": () => {
                list.set_value(array_move_element(list.value, this.index, this.index + 1), { trigger: true });
            },
            "hidden": () => list.value.length < 2,
            "disabled": () => this.index == list.value.length - 1,
            "title": `Move Forward`,
        });
        var delete_button = new Button(`<button><i class="fas fa-trash"></i></button>`, {
            "click": () => {
                var val = list.value;
                val.splice(this.index, 1);
                list.set_value(val, { trigger: true });
            },
            "disabled": () => (!list.get_setting("allow_empty") && list.value.length <= 1),
            "title": "Delete",
        });
        buttons.append(up_button, down_button, delete_button);
        this.buttons = buttons;

        this.content = new UI({ class: "property-list-item-content" });
        this.append(this.content, this.buttons);

        list.get_setting("ui", this);

        var property_container = this.content.children.find(c => c instanceof PropertyContainer);
        if (property_container) {
            property_container.settings.data = (_, path) => {
                var d = list.value[this.index];
                try {
                    return reflect.get(d, path);
                } catch (e) {
                    console.error(e);
                }
            };
            property_container.on("change", (e) => {
                if (e.trigger) {
                    var value = list.value;
                    value[this.index][e.name] = e._value;
                    list.set_value(value, { trigger: true });
                }
            });
        }
    }

    set_value(value) {
        var list_value = this.list.value;
        list_value[this.index] = value;
        this.list.set_value(list_value, { trigger: true });
    }
}

export default PropertyList;