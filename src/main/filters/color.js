import { Filter } from "../Filter.js";
export default new Filter({
	name: "color",
	descriptive_name: "Color",
	type: "video",
	description: "Generates a solid color, replacing the input video.",
	props: {
		color: {
			__name__: "Color",
			__default__: "#000000",
			__description__: "Set the color of the generated video.",
			__type__: "color",
		},
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]color=c=${$.color}:s=${ctx.width}x${ctx.height}:r=${ctx.fps}[${v1}]`);
		ctx.vid = v1;
	}
});