import { Filter } from "../Filter.js";
export default new Filter({
	name: "colorcontrast", 
	descriptive_name: "Color Contrast",
	type: "video",
	description: `Adjust color contrast between RGB components.`,
	props: {
		rc: {
			__name__: "Red-Cyan",
			__description__: "Set the red-cyan contrast.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		gm: {
			__name__: "Green-Magenta",
			__description__: "Set the green-magenta contrast.",
			__default__: 0, 
			__min__: -1,
			__max__: 1
		},
		by: {
			__name__: "Blue-Yellow",
			__description__: "Set the blue-yellow contrast.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		rcw: {
			__name__: "Red-Cyan Weight",
			__description__: "Set the weight of the red-cyan contrast.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		gmw: {
			__name__: "Green-Magenta Weight",
			__description__: "Set the weight of the green-magenta contrast.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		byw: {
			__name__: "Blue-Yellow Weight",
			__description__: "Set the weight of the blue-yellow contrast.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		pl: {
			__name__: "Preserve Lightness",
			__description__: "Set the amount of preserving lightness.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorcontrast=rc=${$.rc}:gm=${$.gm}:by=${$.by}:rcw=${$.rcw}:gmw=${$.gmw}:byw=${$.byw}:pl=${$.pl}[${v1}]`);
		ctx.vid = v1;
	}
});