import { UI } from "./ui.js";

/** @import {UISetting, UISettings, UIEvents} from './exports.js' */

/**
 * @template {Loader} [ThisType=Loader]
 * @typedef {UISettings<ThisType> & {
*  "loader.background": UISetting<ThisType, string>,
*  "loader.color": UISetting<ThisType, string>,
* }} LoaderSettings
*/

/** 
* @template {LoaderSettings} [Settings=UISettings<Loader>]
* @template {UIEvents} [Events=UIEvents]
* @extends {UI<Settings,Events>}
*/
export class Loader extends UI {
   /** @param {Settings} settings */
   constructor(settings) {
       settings = {
           "loader.background": "",
           "loader.color": "",
           "loader.message": "Loading...",
           ...settings,
       }
       super(`<div class="loader"></div>`, settings);
       this.icon_el = $(`<div class="loading-icon"><i></i><i></i><i></i></div>`)[0];
       this.message_el = $(`<div class="msg"></div>`)[0];
       this.elem.style.zIndex = 999999999;
       this.elem.append(this.icon_el, this.message_el);
       var update = ()=>{
           this.message_el.innerHTML = this.get_setting("loader.message");
           this.elem.style.backgroundColor = this.get_setting("loader.background");
           this.elem.style.color = this.get_setting("loader.color");
       };
       this.on("render",()=>{
           update();
       })
       update();
   }
}