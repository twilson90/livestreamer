import { Filter } from "../Filter.js";
export const colorcorrect = new Filter({
	name: "colorcorrect",
	descriptive_name: "Color Correct",
	type: "video", 
	description: `Adjust color white balance selectively for blacks and whites. This filter operates in YUV colorspace.`,
	props: {
		rl: {
			__name__: "Red Shadows",
			__description__: "Set the red shadow spot.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bl: {
			__name__: "Blue Shadows", 
			__description__: "Set the blue shadow spot.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		rh: {
			__name__: "Red Highlights",
			__description__: "Set the red highlight spot.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bh: {
			__name__: "Blue Highlights",
			__description__: "Set the blue highlight spot.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		saturation: {
			__name__: "Saturation",
			__description__: "Set the amount of saturation.",
			__default__: 1,
			__min__: -3,
			__max__: 3
		},
		analyze: {
			__name__: "Analysis Mode",
			__description__: "If set to anything other than manual it will analyze every frame and use derived parameters for filtering output frame.",
			__default__: "manual",
			__options__: ["manual", "average", "minmax", "median"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorcorrect=rl=${$.rl}:bl=${$.bl}:rh=${$.rh}:bh=${$.bh}:saturation=${$.saturation}:analyze=${$.analyze}[${v1}]`);
		ctx.vid = v1;
	}
});
export default colorcorrect;