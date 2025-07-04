import { Filter } from "../Filter.js";
export const curves = new Filter({
	name: "curves",
	descriptive_name: "Curves", 
	type: "video",
	description: `Apply color adjustments using curves.`,
	
	props: {
		preset: {
			__name__: "Preset",
			__description__: "Select one of the available color presets.",
			__default__: "none",
			__options__: [
				["none", "None"],
				["color_negative", "Color Negative"],
				["cross_process", "Cross Process"], 
				["darker", "Darker"],
				["increase_contrast", "Increase Contrast"],
				["lighter", "Lighter"],
				["linear_contrast", "Linear Contrast"],
				["medium_contrast", "Medium Contrast"],
				["negative", "Negative"],
				["strong_contrast", "Strong Contrast"],
				["vintage", "Vintage"]
			]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]curves=preset=${$.preset}[${v1}]`);
		ctx.vid = v1;
	}
});
export default curves;