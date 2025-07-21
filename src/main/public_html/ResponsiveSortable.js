import Sortable from 'sortablejs';
import * as utils from '../../utils/exports.js';
import * as dom from '../../utils/dom/exports.js';

// -----------------------------
// Sortable bullshit.
// -----------------------------

/** @typedef {{sortable: Sortable}} SortablePlugin */

/** @extends {SortablePlugin} */
export class CancelSortPlugin {
    constructor(){
        this.defaults = {
            cancelSort: true,
            revertOnSpill: true
        };
    }
    drop({ cancel, dispatchSortableEvent, originalEvent, dragEl, cloneEl }) {
        // In case the 'ESC' key was hit,
        // the origEvent is of type 'dragEnd'.
        if (originalEvent && originalEvent.type === 'dragend') {
            // Call revert on spill, to revert the drag
            // using the existing algorithm.
            this.sortable.revertOnSpill.onSpill(...arguments);
            // Undo changes on the drag element.
            if (dragEl) {
                // Remove ghost & chosen class.
                dragEl.classList.remove(this.options.ghostClass);
                dragEl.classList.remove(this.options.chosenClass);
                dragEl.removeAttribute('draggable');
            }
            // In case of a copy, the cloneEl
            // has to be removed again.
            if (cloneEl) {
                cloneEl.remove();
            }
            // Dispatch 'end' event.
            dispatchSortableEvent('end');
        }
    }
    static pluginName = "cancelSort";
}

/** @extends {SortablePlugin} */
export class MyAutoScrollPlugin {
    #handleAutoScroll;

    /** @param {Sortable} sortable */
    constructor(sortable){
        this.defaults = {
            myAutoScroll: true,
        };
        this.#handleAutoScroll = (e)=>{
            console.log("auto scroll");
        };
    }

    dragStarted({ originalEvent }) {
        console.log("drag started");
        Sortable.utils.on(document, 'dragover', this.#handleAutoScroll);
    }

    dragOverCompleted({ originalEvent }) {
        console.log("drag over completed");
    }

    drop() {
        console.log("drop");
        Sortable.utils.off(document, 'dragover', this.#handleAutoScroll);
    }

    static pluginName = "myAutoScroll";
    static initializeByDefault = true;
}

/** @extends {SortablePlugin} */
export class RememberScrollPositionsPlugin {
    // fucks up auto scroll (dragging to scroll)
    /** @param {Sortable} sortable */
    constructor(sortable) {
        sortable.el.addEventListener("start", (e)=>{
            /** @type {Map<HTMLElement, number>} */
            var scroll_map = new Map();
            var lock_scroll = (e)=>{
                var s = scroll_map.get(e.target);
                if (s) e.target.scrollTop = s;
            }
            var els = sortable.el.querySelectorAll("*");
            // var els = new Set([...e.items, e.item]);
            // els = new Set([...els].flatMap(el=>[...el.querySelectorAll("*")]));
            for (var c of els) {
                scroll_map.set(c, c.scrollTop);
                c.addEventListener("scroll", lock_scroll);
            }
            var onchange = ()=>{
                for (var [el,s] of scroll_map) {
                    el.scrollTop = s;
                }
            }
            var onend = ()=>{
                for (var [el, s] of scroll_map) {
                    el.removeEventListener("scroll", lock_scroll);
                    el.scrollTop = s;
                }
                scroll_map.clear();
                sortable.el.removeEventListener("change", onchange);
                sortable.el.removeEventListener("end", onend);
            };
            sortable.el.addEventListener("change", onchange);
            sortable.el.addEventListener("end", onend);
        });
    }
    static pluginName = "rememberScrollPositions";
}

export class ResponsiveSortable extends Sortable {
    /** @type {ResponsiveSortable[]} */
    static instances = [];
    /** @type {Record<PropertyKey, ResponsiveSortable>} */
    static active = {};
    static VERTICAL = "vertical";
    static HORIZONTAL = "horizontal";
    
    /** @returns {ResponsiveSortable} */
    static closest(e) {
        if (!e) return null;
        if (e instanceof Sortable) return e;
        var el = dom.closest(e, c=>Sortable.get(c));
        return el ? Sortable.get(el) : null;
    }
    
    /** @param {HTMLElement} el @param {Sortable.Options} options */
    constructor(el, options) {
        options = {
            lastSelectedClass: "sortable-last-selected",
            lastActiveClass: "sortable-last-active",
            ...options,
        }
        
        super(el, options);

        this.orientation = ResponsiveSortable.VERTICAL
        
        // $(this.el).disableSelection();
        this.el.classList.add("sortable");

        ResponsiveSortable.instances.push(this);

        this.option("multiDragKey", "Control");
        this.el.addEventListener("pointerdown", this._on_pointer_down = (e)=>{
            if (this.options.multiDrag) this.option("multiDragKey", e.pointerType === "touch" ? "" : "Control");
        });

        // !! fixes multidrag on touch devices !!
        if (this.options.multiDrag && !this.options.handle) {
            var moved;
            var old_triggerDragStart = this._triggerDragStart;
            var on_touch_move = (e)=>moved=true;
            var has_touch;
            this._triggerDragStart = (evt, touch)=>{
                var item = this.get_item(evt.target);
                moved = false;
                has_touch = !!touch;
                if (touch && !this.is_selected(item)) {
                    Sortable.utils.on(this.el.getRootNode(), 'touchmove', on_touch_move);
                    return;
                }
                old_triggerDragStart.apply(this, [evt, touch]);
            }
            var old_onDrop = this._onDrop;
            this._onDrop = (evt)=>{
                Sortable.utils.off(this.el.getRootNode(), 'touchmove', on_touch_move);
                old_onDrop.apply(this, moved ? [] : [evt]);
            }
        }
        // --------------------------------------
        
        window.addEventListener("keydown", this._on_key_down = (e)=>{
            if (!dom.has_focus(this.el, true)) return;
            if (!this.options.multiDrag) return;
            if (!this.is_active_sortable_in_group()) return;
            var items = this.get_items();
            var last = this.get_last_active(true);
            var last_index = items.indexOf(last);
            var is_last_selected = this.is_selected(last);
            var next_index;
            var is_vertical = this.orientation === ResponsiveSortable.VERTICAL;
            if (e.key === "Home") {
                next_index = 0;
            } else if (e.key === "End") {
                next_index = items.length - 1;
            } else if (e.key === "PageUp") {
                next_index = last_index - 10;
            } else if (e.key === "PageDown") {
                next_index = last_index + 10;
            } else if ((e.key === "ArrowUp" && is_vertical) || (e.key === "ArrowLeft" && !is_vertical)) {
                if (last_index == -1) next_index = 0;
                else if (!is_last_selected) next_index = last_index;
                else next_index = last_index - 1;
            } else if ((e.key === "ArrowDown" && is_vertical) || (e.key === "ArrowRight" && !is_vertical)) {
                if (last_index == -1) next_index = items.length - 1;
                else if (!is_last_selected) next_index = last_index;
                else next_index = last_index + 1;
            } else if (e.ctrlKey && e.key === "a") {
                this.select_all();
            } else if (e.ctrlKey && e.key === "d") {
                this.deselect_all();
            } else {
                return;
            }
            if (next_index !== undefined) {
                next_index = utils.clamp(next_index, 0, items.length-1);
                this.click(items[next_index], e.shiftKey, false);
            }
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.el.addEventListener("contextmenu", this._on_contextmenu = (e) => {
            e.preventDefault();
            if (this.get_item(e.target) && !this.is_selected(e.target)) {
                this.simulate_click(e.target, {
                    screenX: e.screenX,
                    screenY: e.screenY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    metaKey: e.metaKey,
                    button: 0,
                });
            }
        });
        this.el.addEventListener("click", this._on_click = (e)=>{
            this.set_active_sortable_in_group();
        });
        this._dragging_resolve = ()=>{};
        this.el.addEventListener("start", this._on_start = ()=>{
            this.dragging = true;
            this.dragging_promise = new Promise((resolve)=>this._dragging_resolve = resolve);
        })
        this.el.addEventListener("end", this._on_end = ()=> {
            this.dragging = false;
            this._dragging_resolve();
        });

        this.el.addEventListener("unchoose", this._on_unchoose = (e)=>{
            if (!this.options.multiDrag) return;
            if (!e.item.parentElement) return;
            var items = e.items.length ? e.items : [e.item];
            var selected_items = items.filter(i=>ResponsiveSortable.closest(i).is_selected(i));
            for (var s of this.get_sortables_in_group()) {
                if (s !== this) s.deselect_all();
            }
            /** @type {ResponsiveSortable} */
            var dest = Sortable.get(e.to);
            dest.set_active_sortable_in_group();
            if (dest != this) {
                dest.set_selection(selected_items);
            }
            dest.set_last_active(e.item);
            e.item.scrollIntoView({block:"nearest", inline:"nearest"});
        });
        /* sortable.el.addEventListener("choose", (evt)=>{
        }); */
    }
    _dispatchEvent(name, props) {
        var ev = new Event(name);
        Object.assign(ev, {
            name: name,
            sortable: this,
            rootEl: this.el,
        }, props);
        this.el.dispatchEvent(ev);
    }
    simulate_click(target, e) {
        var old_drag_key;
        if (this.multiDrag) {
            old_drag_key = this.multiDrag.multiDragKeyDown;
            if (e.ctrlKey) this.multiDrag.multiDragKeyDown = true;
        }
        // this.options.delay = 10;
        this.el.focus();
        [this.options.supportPointer ? "pointerdown" : "mousedown", "mouseup"].forEach((type,i)=>{
            var evt = new MouseEvent(type, {
                bubbles:true,
                cancelable:true,
                view: target.ownerDocument.defaultView,
                detail: 0,
                screenX: e.screenX || 0,
                screenY: e.screenY || 0,
                clientX: e.clientX || 0,
                clientY: e.clientY || 0,
                ctrlKey: e.ctrlKey || false,
                altKey: e.altKey || false,
                shiftKey: e.shiftKey || false,
                metaKey: e.metaKey || false,
                button: e.button || 0,
                relatedTarget: null
            });
            var prop = {get:()=>target, set:(v)=>{}};
            Object.defineProperty(evt, "target", prop);
            Object.defineProperty(evt, "currentTarget", prop);
            if (i == 0) this._onTapStart(evt);
            else this._onDrop(evt);
        });
        if (this.multiDrag) {
            if (e.ctrlKey) this.multiDrag.multiDragKeyDown = old_drag_key;
        }
    }
    get_sortables_in_group() {
        return ResponsiveSortable.instances.filter(s=>s.options.group.name === this.options.group.name);
    }
    set_active_sortable_in_group() {
        var old = ResponsiveSortable.active[this.options.group.name];
        if (old === this) return;
        ResponsiveSortable.active[this.options.group.name] = this;
        if (old) old.deselect_all();
        for (var s of [old, this]) {
            if (!s) continue;
            s.el.classList.toggle("active", s===this);
            s._dispatchEvent("active-change", {active:s===this});
        }
    }
    get_active_sortable_in_group() {
        return ResponsiveSortable.active[this.options.group.name];
    }
    get_group_index() {
        return this.get_sortables_in_group().indexOf(this);
    }
    is_active_sortable_in_group() {
        return this.get_active_sortable_in_group() === this;
    }
    get_last_active(use_fallback=false) {
        var last_active = this.get_item(this.last_active);
        if (last_active || !use_fallback) return last_active;
        var items = this.get_items();
        return items[utils.clamp(this.last_active_index || 0, 0, items.length-1)];
    }
    set_last_active(e) {
        e = this.get_item(e);
        this.get_items().forEach(i=>i.classList.toggle(this.options.lastActiveClass, i === e));
        this.last_active = e;
        this.last_active_index = this.get_item_index(e);
    }
    forget_last_active() {
        this.last_active = null;
        this.last_active_index = null;
    }
    get_items(filter=null) {
        var items = Array.from(this.el.children).filter(e=>Sortable.utils.closest(e, this.options.draggable, this.el, false));
        if (filter) {
            filter = new Set(filter);
            items = items.filter(item=>filter.has(item));
        }
        return items;
    }
    get_selection() {
        return this.get_items().filter(e=>this.is_selected(e));
    }
    deselect_all() {
        this.get_items().forEach(item=>this.deselect(item));
        this.set_last_active(null);
    }
    select_all() {
        this.get_items().forEach(item=>this.select(item));
    }
    select(item) {
        item = this.get_item(item);
        if (!item || this.is_selected(item)) return;
        Sortable.utils.select(item);
        this._dispatchEvent("select", {targetEl:item});
    }
    deselect(item) {
        item = this.get_item(item);
        if (!item || !this.is_selected(item)) return;
        Sortable.utils.deselect(item);
        this._dispatchEvent("deselect", {targetEl:item});
    }
    set_selection(items) {
        var selection = new Set(items.map(i=>this.get_item(i)));
        this.get_items().forEach((item,i)=>{
            if (selection.has(item)) this.select(item);
            else this.deselect(item);
        });
    }
    click(item, shiftKey, ctrlKey) {
        item = this.get_item(item);
        if (!item) return;
        var rect = item.getBoundingClientRect();
        this.simulate_click(item, {
            clientX: rect.x + rect.width/2,
            clientY: rect.y + rect.height/2,
            ctrlKey: !!ctrlKey,
            shiftKey: !!shiftKey,
            button: 0,
        });
    }
    is_selected(e) {
        e = this.get_item(e);
        return e ? e.classList.contains(this.options.selectedClass) : false;
    }
    /** @returns {HTMLElement} */
    get_item(e) {
        e = Sortable.utils.closest(e, this.options.draggable, this.el, false);
        return (e && e.parentElement === this.el) ? e : undefined;
    }
    get_item_index(e) {
        return this.get_items().indexOf(this.get_item(e));
    }
    destroy() {
        delete ResponsiveSortable.active[this.options.group.name];
        utils.array_remove(ResponsiveSortable.instances, this);
        window.removeEventListener("keydown", this._on_key_down);
        this.el.removeEventListener("click", this._on_click);
        this.el.removeEventListener("start", this._on_start);
        this.el.removeEventListener("end", this._on_end);
        this.el.removeEventListener("unchoose", this._on_unchoose);
        this.el.removeEventListener("contextmenu", this._on_contextmenu);
        this.el.removeEventListener("pointerdown", this._on_pointer_down);
        this._dragging_resolve();
        super.destroy();
    }
}