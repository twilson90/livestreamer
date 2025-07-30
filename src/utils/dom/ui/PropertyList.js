import { $ } from "../render_html.js";
import { set_inner_html } from "../set_inner_html.js";
import { DropdownMenu } from "../DropdownMenu.js";
import { UI, Button, List } from "./ui.js";
import { PropertyGroup } from "./PropertyGroup.js";
import { InputProperty } from "./InputProperty.js";
import { array_move_element } from "../../array_move_element.js";
import { json_copy } from "../../json_copy.js";
import { uuid4 } from "../uuid4.js";
import { rebuild } from "../rebuild.js";

/** @import {InputPropertyEvents,InputPropertySettings,UISetting,SetValueOptions} from "./exports.js" */


/**
 * @template ItemType
 * @template ValueType
 * @template {PropertyList} [ThisType=PropertyList]
 * @typedef {InputPropertySettings<ItemType,ValueType,ThisType> & {
*   'item_size': UISetting<ThisType,string>,
*   'ui': (this:ThisType, ui:PropertyListItem)=>void,
*   'new': (this:ThisType)=>ValueType,
* }} PropertyListSettings
*/

/** @typedef {InputPropertyEvents & {"list.move":[string],"list.delete":[string],"list.add":[string]}} PropertyListEvents */

/**
 * @template ItemType
 * @template ValueType
 * @template {PropertyListSettings<ItemType,ValueType,PropertyList>} [Settings=PropertyListSettings<ItemType,ValueType,PropertyList>]
 * @template {PropertyListEvents} [Events=PropertyListEvents]
 * @extends {InputProperty<ItemType, ValueType, Settings, Events>} */
export class PropertyList extends InputProperty {
    // get values() { return super.values.map(v=>v||[]); }
    get is_disabled() {
        return super.is_disabled;
    }

    get item_count() { return Object.keys(this.value).length; }

    /** @param {Settings} settings */
    constructor(settings) {
        var wrapper = new UI({ class: `property-list-wrapper` });
        super(wrapper.elem, {
            "setup": false,
            "item_size": "auto",
            "empty": "No items",
            "new": ()=>({}),
            "default": ()=>[],
            "vertical": true,
            "copy_id": ()=>this.id,
            "can_add": true,
            "can_move": true,
            "can_delete": true,
            "clipboard": ()=>!this.get_setting("readonly"),
            ...settings
        });

        this.modifiers.push((value)=>{
            if (!value) return {};
            if (Array.isArray(value)) value = Object.fromEntries(value.map((v,i)=>({id:v.id, index:i,v})));
            var i = 0;
            var items = Object.values(value).filter(v=>v).sort((a,b)=>a.index - b.index);
            var new_value = {};
            for (var item of items) {
                if (!item.id) item.id = uuid4();
                item.index = i++;
                new_value[item.id] = item;
            }
            return value;
        });

        var add_button = new Button(`<button style="flex:1"><i class="fas fa-plus"></i></button>`, {
            "title": "Add",
            "click": async() => {
                var value = this.value;
                var new_value = await this.get_setting("new");
                if (!new_value) return;
                var id = uuid4();
                value[id] = {id, ...new_value};
                this.set_value(value, { trigger: true });
                this.emit("list.add", new_value);
                this.once("render", ()=>{
                    list.elem.scrollLeft = 999999999;
                    list.elem.scrollTop = 999999999;
                });
            },
            "hidden": ()=>!this.get_setting("can_add") || this.get_setting("readonly"),
        });

        var copy_key = `clipboard:${this.copy_id}`;
        var copy = ()=>{
            localStorage.setItem(copy_key, JSON.stringify(this.value));
        };

        var paste = (append)=>{
            var value;
            try {
                value = JSON.parse(localStorage.getItem(copy_key));
                value = value.map(v=>({id: uuid4(), ...v}));
            } catch (e) {
                return;
            }
            if (append) value = {...this.value, ...value};
            this.set_value(value, {trigger: true});
        };

        var more_button = new Button(`<button class="icon button"><i class="fas fa-ellipsis-v"></i></button>`, {
            title: "More",
            hidden: ()=>!this.get_setting("clipboard"),
        });
        more_button.elem.style.flex = "none";
        var more_dropdown = new DropdownMenu({
            target: more_button.elem,
            parent: this.elem,
            trigger: "click",
            "items": [
                {
                    icon: `<i class="fas fa-copy"></i>`,
                    label: `Copy`,
                    click: ()=>copy()
                },
                {
                    icon: `<i class="fas fa-clipboard"></i>`,
                    label: `Paste (Replace)`,
                    disabled: ()=>!localStorage.getItem(copy_key),
                    click: ()=>paste(false)
                },
                {
                    icon: `<i class="fas fa-clipboard"></i>`,
                    label: `Paste (Append)`,
                    disabled: ()=>!localStorage.getItem(copy_key),
                    click: ()=>paste(true)
                }
            ]
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
        this.buttons_el.append(more_button.elem);

        this.on("update", () => {
            /** @type {ValueType[]} */
            let value = Object.values(this.value).sort((a,b)=>a.index - b.index);

            rebuild(list.elem, value, {
                add: (item, elem, index)=>{
                    if (!item.id) item.id = uuid4();
                    if (!elem) elem = new PropertyListItem(this, item.id).elem;
                    return elem;
                },
            });

            var vertical = !!this.get_setting("vertical");
            wrapper.elem.classList.toggle("vertical", vertical);

            var num_filters = value.length;
            var is_indeterminate = this.is_indeterminate;
            if (is_indeterminate) num_filters = 0;
            empty_el.style.display = num_filters ? "none" : "";
            list.elem.style.display = num_filters ? "" : "none";
            set_inner_html(empty_el, is_indeterminate?"Multiple values":this.get_setting("empty"));
            set_inner_html(count_el, `(${is_indeterminate?"-":value.length})`);
        });
    }
    
}

export class PropertyListItem extends UI {
    get value() { return this.list.value[this.item_id]; }
    set value(value) { this.set_value(value); }
    /** @param {SetValueOptions} opts */
    set_value(value, opts) {
        var value_list = this.list.value;
        value_list[this.item_id] = {...this.value, ...value, id: this.item_id};
        this.list.set_value(value_list, opts);
    }

    get list_index() { return this.list.value.findIndex(v=>v.id == this.item_id); }

    /** @param {PropertyList} list @param {string} item_id */
    constructor(list, item_id) {
        super({
            class: "property-list-item",
        });
        this.list = list;
        this.item_id = item_id;

        let buttons = new UI({ class: "property-list-item-buttons" });
        var up_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "up" : "left"}"></i>`,
            "click": () => {
                var index = this.index;
                this.set_value({...this.value, index: index - 1.5}, { trigger: true }); // weird way of doing it but works. relies on modifier to generate new indices, kinda fucked.
                this.list.emit("list.move", this.item_id);
            },
            "hidden": () => list.item_count < 2 || !this.list.get_setting("can_move", this) || this.list.get_setting("readonly"),
            "disabled": () => this.index == 0,
            "title": `Move Back`,
        });
        var down_button = new Button(`<button></button>`, {
            "content": () => `<i class="fas fa-arrow-${list.get_setting("vertical") ? "down" : "right"}"></i>`,
            "click": () => {
                var index = this.index;
                this.set_value({...this.value, index: index + 1.5}, { trigger: true }); // ditto
                this.list.emit("list.move", this.item_id);
            },
            "hidden": () => list.item_count < 2 || !this.list.get_setting("can_move", this) || this.list.get_setting("readonly"),
            "disabled": () => this.index == list.item_count - 1,
            "title": `Move Forward`,
        });
        var delete_button = new Button(`<button><i class="fas fa-trash"></i></button>`, {
            "click": () => {
                var value = list.value;
                delete value[this.item_id];
                list.set_value(value, { trigger: true });
                this.list.emit("list.delete", this.item_id);
            },
            "hidden": ()=>!this.list.get_setting("can_delete", this) || this.list.get_setting("readonly"),
            // "disabled": () => (list.item_count <= 1), // !list.get_setting("allow_empty")
            "title": "Delete",
        });
        buttons.append(up_button, down_button, delete_button);
        this.buttons = buttons;

        this.props = new UI({
            "class": "property-list-item-content",
        });

        this.append(this.props, this.buttons);

        this.once("update", ()=>{
            list.get_setting("ui", this);
        });
    }
}

export default PropertyList;