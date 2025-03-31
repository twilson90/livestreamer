import { Filter } from "../Filter.js";
export default new Filter({
	name: "normalize",
	descriptive_name: "Normalize",
	type: "video",
	description: `Normalize RGB video (aka histogram stretching, contrast stretching). For each channel of each frame, the filter computes the input range and maps it linearly to the user-specified output range. The output range defaults to the full dynamic range from pure black to pure white.`,
	props: {
		blackpt: {
			__name__: "Black Point",
			__description__: "Set the black point color that defines the minimum output value.",
			__default__: "#000000",
			__type__: "color"
		},
		whitept: {
			__name__: "White Point",
			__description__: "Set the white point color that defines the maximum output value.", 
			__default__: "#ffffff",
			__type__: "color"
		},
		smoothing: {
			__name__: "Smoothing",
			__description__: "Number of previous frames to use for temporal smoothing. Higher values reduce flickering but may cause over/under-exposure.",
			__default__: 0,
			__min__: 0,
			__max__: 100
		},
		independence: {
			__name__: "Independence",
			__description__: "Ratio of independent vs linked channel normalization. 0.0 is fully linked (preserves hue), 1.0 is fully independent (can shift colors).",
			__default__: 1.0,
			__min__: 0,
			__max__: 1
		},
		strength: {
			__name__: "Strength",
			__description__: "Overall strength of the normalization effect.",
			__default__: 1.0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]normalize=blackpt=${$.blackpt}:whitept=${$.whitept}:smoothing=${$.smoothing}:independence=${$.independence}:strength=${$.strength}[${v1}]`);
		ctx.vid = v1;
	}
});
