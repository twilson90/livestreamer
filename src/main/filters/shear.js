import { Filter } from "../Filter.js";
export default new Filter({
	name: "shear",
	descriptive_name: "Shear",
	type: "video",
	description: `Apply shear transform to input video.`,
	props: {
		shx: {
			__name__: "X Shear",
			__description__: "Shear factor in X-direction.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		shy: {
			__name__: "Y Shear", 
			__description__: "Shear factor in Y-direction.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		fillcolor: {
			__name__: "Fill Color",
			__description__: "Set the color used to fill the output area not covered by the transformed video. If set to 'none', no background is printed.",
			__default__: "black",
			__type__: "color"
		},
		interp: {
			__name__: "Interpolation",
			__description__: "Set interpolation type.",
			__default__: "bilinear",
			__options__: ["bilinear", "nearest"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]shear=shx=${$.shx}:shy=${$.shy}:fillcolor=${$.fillcolor}:interp=${$.interp}[${v1}]`);
		ctx.vid = v1;
	}
});