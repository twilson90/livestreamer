import { Filter } from "../Filter.js";
export default new Filter({
	name: "pixelize",
	descriptive_name: "Pixelize",
	type: "video", 
	description: `Apply pixelization to video stream.`,
	props: {
		width: {
			__name__: "Width",
			__description__: "Set block width that will be used for pixelization.",
			__default__: 16,
			__min__: 1,
			__max__: 1000
		},
		height: {
			__name__: "Height", 
			__description__: "Set block height that will be used for pixelization.",
			__default__: 16,
			__min__: 1,
			__max__: 1000
		},
		mode: {
			__name__: "Mode",
			__description__: "Set the mode of pixelization used.",
			__default__: "avg",
			__options__: [
				["avg", "Average"],
				["min", "Minimum"],
				["max", "Maximum"]
			]
		},
		planes: {
			__name__: "Planes",
			__description__: "Set what planes to filter.",
			__default__: "all",
			__options__: ["all", "y", "u", "v"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		$.width = Math.round(Math.min($.width, ctx.width/2));
		$.height = Math.round(Math.min($.height, ctx.height/2));
		ctx.stack.push(`[${ctx.vid}]pixelize=w=${$.width}:h=${$.height}:mode=${$.mode}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});