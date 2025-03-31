/** @import {FilterContext} from "./exports.js" */
import {nearest_base10} from "../utils/nearest_base10.js";

/**
 * @typedef {{
 * 	__default__: any,
 * 	__min__: number,
 * 	__max__: number,
 * 	__step__: number,
 * 	__options__: any[],
 * 	__description__: string,
 * 	__type__: string
 * }} FilterProperty
 **/

/**
 * @typedef {{
 *  name: string,
 *  active: boolean,
 *  props: Record<string,any>,
 * }} FilterInput
 **/

export class Filter {
	name = "";
	descriptive_name = "";
	description = "";
	type = "";
	/** @type {Record<PropertyKey,FilterProperty>} */
	props = {};
	presets = {};
	/** @param {Filter} d */
	constructor(d) {
        Object.assign(this, d);
		this.descriptive_name = this.descriptive_name || this.name;
		this.description = this.description || "";
		for (var k in this.props) {
			var p = this.props[k];
			p.__type__ = p.__type__ || typeof p.__default__;
			p.__description__ = (p.__description__ || "").split(/\r?\n/).map(a=>a.trim()).join("\n");
			if (p.__min__ !== undefined && p.__max__ !== undefined && p.__step__ === undefined) {
				p.__step__ = nearest_base10((p.__max__ - p.__min__) / 100);
			}
		}
		var defaults = Object.fromEntries(Object.entries(this.props).map(([k,v])=>[k,v.__default__]));
		this.presets = {
			default: defaults,
			...Object.fromEntries(Object.entries(this.presets).map(([k,v])=>[k,{...defaults,...v}])),
		};
	}
	
	/** @param {FilterContext} ctx */
	apply(ctx, d) {};

	static format(name, props) {
		return `${name}=${Object.entries(props).map(([k,v])=>`${k}=${v}`).join(":")}`;
	}
}