import { Filter } from "../Filter.js";
export default new Filter({
	name: "huesaturation",
	descriptive_name: "Hue/Saturation",
	type: "video",
	description: `Apply hue-saturation-intensity adjustments to input video stream. This filter operates in RGB colorspace.`,
	props: {
		hue: {
			__name__: "Hue",
			__description__: "Set the hue shift in degrees to apply.",
			__default__: 0,
			__min__: -180,
			__max__: 180
		},
		saturation: {
			__name__: "Saturation",
			__description__: "Set the saturation shift.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		intensity: {
			__name__: "Intensity",
			__description__: "Set the intensity shift.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		colors: {
			__name__: "Colors",
			__description__: "Set which primary and complementary colors are going to be adjusted. This can select multiple colors at once.",
			__default__: "a",
			__options__: [
				["r", "Adjust reds"],
				["y", "Adjust yellows"], 
				["g", "Adjust greens"],
				["c", "Adjust cyans"],
				["b", "Adjust blues"],
				["m", "Adjust magentas"],
				["a", "Adjust all colors"]
			]
		},
		strength: {
			__name__: "Strength",
			__description__: "Set strength of filtering.",
			__default__: 1,
			__min__: 0,
			__max__: 100
		},
		rw: {
			__name__: "Red Weight",
			__description__: "Set weight for red RGB component. Used in saturation and lightness processing.",
			__default__: 0.333,
			__min__: 0,
			__max__: 1
		},
		gw: {
			__name__: "Green Weight",
			__description__: "Set weight for green RGB component. Used in saturation and lightness processing.",
			__default__: 0.334,
			__min__: 0,
			__max__: 1
		},
		bw: {
			__name__: "Blue Weight",
			__description__: "Set weight for blue RGB component. Used in saturation and lightness processing.",
			__default__: 0.333,
			__min__: 0,
			__max__: 1
		},
		lightness: {
			__name__: "Preserve Lightness",
			__description__: "Set preserving lightness. When enabled, lightness is kept at same value when adjusting hues.",
			__default__: false
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]huesaturation=hue=${$.hue}:saturation=${$.saturation}:intensity=${$.intensity}:colors=${$.colors}:strength=${$.strength}:rw=${$.rw}:gw=${$.gw}:bw=${$.bw}:lightness=${$.lightness}[${v1}]`);
		ctx.vid = v1;
	}
});
