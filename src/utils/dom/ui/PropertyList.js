import { $ } from "../render_html.js";
import { set_inner_html } from "../set_inner_html.js";
import { UI, Button, List } from "./ui.js";
import { PropertyGroup } from "./PropertyGroup.js";
import { InputProperty } from "./InputProperty.js";
import { array_move_element } from "../../array_move_element.js";

/** @import {PropertyEvents,InputPropertySettings,UISetting,SetValueOptions} from "./exports.js" */


/**
 * @template ItemType
 * @template ValueType
 * @template {PropertyList} [ThisType=PropertyList]
 * @typedef {InputPropertySettings<ItemType,ValueType,ThisType> & {
*   'item_size': UISetting<ThisType,string>,
*   'allow_empty': UISetting<ThisType,boolean>,
*   'ui': (this:ThisType,ui:PropertyListItem)=>void,
*   'new': (this:ThisType)=>ValueType,
* }} PropertyListSettings
*/

/**
 * @template ItemType
 * @template ValueType
 * @template {PropertyListSettings<ItemType,ValueType,PropertyList>} [Settings=PropertyListSettings<ItemType,ValueType,PropertyList>]
 * @template {PropertyEvents} [Events=PropertyEvents]
 * @extends {InputProperty<ItemType, ValueType[], Settings, Events>} */
export class PropertyList extends InputProperty {
    get values() { return super.values.map(v=>v||[]); }
    get is_disabled() {
        return super.is_disabled || this.is_indeterminate;
    }

    /** @param {Settings} settings */
    constructor(settings) {
        var wrapper = new UI({ class: `property-list-wrapper` });
        super(wrapper.elem, {
            "setup": false,
            "item_size": "auto",
            "allow_empty": true,
            "empty": "No items",
            "new": ()=>({}),
            "default": ()=>[],
            "vertical": true,
            ...settings
        });

        var add_button = new Button(`<button><i class="fas fa-plus"></i></button>`, {
            title: "Add Item",
            "click": async() => {
                var value = this.value;
                var new_value = await this.get_setting("new");
                if (!new_value) return;
                value.push(new_value);
                this.set_value(value, { trigger: true });
                this.once("render", ()=>{
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

        /** @type {List<PropertyListItem>} */
        var list = this.list = new List({ class: "property-list" });
        wrapper.append(list);
        this.buttons_el.prepend(add_button.elem);

        this.on("update", () => {
            let list_items = list.list_items;
            /** @type {ValueType[]} */
            let value = this.value || [];
            for (var i = 0; i < value.length; i++) {
                let index = i;
                if (!list_items[index]) {
                    list_items[index] = new PropertyListItem(this, index);
                    list.append(list_items[index]);
                }
            }
            for (; i < list_items.length; i++) {
                list_items[i].destroy();
            }
            var vertical = !!this.get_setting("vertical");
            wrapper.elem.classList.toggle("vertical", vertical);

            var num_filters = value.length;
            var is_indeterminate = this.is_indeterminate;
            if (is_indeterminate) num_filters = 0;
            empty_el.style.display = num_filters ? "none" : "";
            list.elem.style.display = num_filters ? "" : "none";
            set_inner_html(empty_el, is_indeterminate?"Multiple Items":this.get_setting("empty"));
            set_inner_html(count_el, `(${is_indeterminate?"-":value.length})`);
        });
    }
    
}

export class PropertyListItem extends UI {
    get value() { return this.list.value[this.index]; }
    set value(v) { this.set_value(v); }
    /** @param {SetValueOptions} opts */
    set_value(v, opts) {
        var value = [...this.list.value];
        value[this.index] = v;
        this.list.set_value(value, opts);
    }

    /** @param {PropertyList} list @param {number} index */
    constructor(list, index) {
        super({
            class: "property-list-item",
        });
        this.list = list;

        let buttons = new UI({ class: "property-list-item-buttons" });
        var up_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "up" : "left"}"></i>`,
            "click": () => {
                var value = list.value;
                array_move_element(value, index, index - 1);
                list.set_value(value, { trigger: true });
            },
            "hidden": () => list.value.length < 2,
            "disabled": () => index == 0,
            "title": `Move Back`,
        });
        var down_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "down" : "right"}"></i>`,
            "click": () => {
                var value = list.value;
                array_move_element(value, index, index + 1);
                list.set_value(value, { trigger: true });
            },
            "hidden": () => list.value.length < 2,
            "disabled": () => index == list.value.length - 1,
            "title": `Move Forward`,
        });
        var delete_button = new Button(`<button><i class="fas fa-trash"></i></button>`, {
            "click": () => {
                var value = list.value;
                value.splice(index, 1);
                list.set_value(value, { trigger: true });
            },
            "disabled": () => (!list.get_setting("allow_empty") && list.value.length <= 1),
            "title": "Delete",
        });
        buttons.append(up_button, down_button, delete_button);
        this.buttons = buttons;

        this.props = new PropertyGroup({
            "class": "property-list-item-content",
            "name": index,
            "show_not_default": false,
            "show_changed": false,
        });
        this.props.on("change", (e)=>{
            if (e.trigger) this.set_value(this.props.value);
        });
        var on_change;
        list.on("post_update", on_change = (e)=>{
            this.props.set_value(this.list.value[index]);
        });

        this.append(this.props, this.buttons);

        list.get_setting("ui", this);

        this.on("destroy", ()=>{
            list.off("change", on_change);
        });
    }
}

export default PropertyList;