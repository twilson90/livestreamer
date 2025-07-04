import { Filter } from "../Filter.js";
export const convolution = new Filter({
	name: "convolution",
	descriptive_name: "Convolution", 
	type: "video",
	description: `Apply convolution of 3x3, 5x5, 7x7 or horizontal/vertical up to 49 elements.`,
	presets: {
		"Sharpen": {
			data: "0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0"
		},
		"Blur": {
			data: "1 1 1 1 1 1 1 1 1:1 1 1 1 1 1 1 1 1:1 1 1 1 1 1 1 1 1:1 1 1 1 1 1 1 1 1:1/9:1/9:1/9:1/9"
		},
		"Edge Enhance": {
			data: "0 0 0 -1 1 0 0 0 0:0 0 0 -1 1 0 0 0 0:0 0 0 -1 1 0 0 0 0:0 0 0 -1 1 0 0 0 0:5:1:1:1:0:128:128:128"
		},
		"Edge Detect": {
			data: "0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:5:5:5:1:0:128:128:128"
		},
		"Laplacian Edge Detect": {
			data: "1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:5:5:5:1:0:128:128:0"
		},
		"Emboss": {
			data: "-2 -1 0 -1 1 1 0 1 2:-2 -1 0 -1 1 1 0 1 2:-2 -1 0 -1 1 1 0 1 2:-2 -1 0 -1 1 1 0 1 2"
		}
	},
	props: {
		data: {
			__name__: "Data",
			__description__: "Set the convolution data.",
			__default__: "0 0 0 0 0 0 0 0 0:0 0 0 0 0 0 0 0 0:0 0 0 0 0 0 0 0 0:0 0 0 0 0 0 0 0 0",
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colortemperature=temperature=${$.temperature}:mix=${$.mix}:pl=${$.pl}[${v1}]`);
		ctx.vid = v1;
	}
});
export default convolution;