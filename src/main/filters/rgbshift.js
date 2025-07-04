import { Filter } from "../Filter.js";
export const rgbshift = new Filter({
	name: "rgbshift",
	descriptive_name: "RGB Shift",
	type: "video",
	description: `Shift RGB pixels horizontally and/or vertically.`,
	props: {
		rh: {
			__name__: "Red Horizontal",
			__description__: "Set amount to shift red horizontally.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		rv: {
			__name__: "Red Vertical", 
			__description__: "Set amount to shift red vertically.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		gh: {
			__name__: "Green Horizontal",
			__description__: "Set amount to shift green horizontally.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		gv: {
			__name__: "Green Vertical",
			__description__: "Set amount to shift green vertically.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		bh: {
			__name__: "Blue Horizontal",
			__description__: "Set amount to shift blue horizontally.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		bv: {
			__name__: "Blue Vertical",
			__description__: "Set amount to shift blue vertically.",
			__default__: 0,
			__min__: -100,
			__max__: 100
		},
		edge: {
			__name__: "Edge Mode",
			__description__: "Set edge mode.",
			__default__: "smear",
			__options__: ["smear", "default", "warp"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]rgbshift=rh=${$.rh}:rv=${$.rv}:gh=${$.gh}:gv=${$.gv}:bh=${$.bh}:bv=${$.bv}:edge=${$.edge}[${v1}]`);
		ctx.vid = v1;
	}
});

export default rgbshift;