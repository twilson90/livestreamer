import { Filter } from "../Filter.js";
export const colorize = new Filter({
	name: "colorize",
	descriptive_name: "Colorize",
	type: "video",
	description: `Overlay a solid color on the video stream.`,
	props: {
		hue: {
			__name__: "Hue",
			__description__: "Set the color hue.",
			__default__: 0,
			__min__: 0,
			__max__: 360
		},
		saturation: {
			__name__: "Saturation",
			__description__: "Set the color saturation.",
			__default__: 0.5,
			__min__: 0,
			__max__: 1
		},
		lightness: {
			__name__: "Lightness",
			__description__: "Set the color lightness.",
			__default__: 0.5,
			__min__: 0,
			__max__: 1
		},
		mix: {
			__name__: "Mix",
			__description__: "Set the mix of source lightness.",
			__default__: 1.0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorize=hue=${$.hue}:saturation=${$.saturation}:lightness=${$.lightness}:mix=${$.mix}[${v1}]`);
		ctx.vid = v1;
	}
});

export default colorize;