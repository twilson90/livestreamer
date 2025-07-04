import { Filter } from "../Filter.js";
export const tmix = new Filter({
	name: "tmix",
	descriptive_name: "Temporal Mix",
	type: "video",
	description: `Mix successive video frames.`,
	presets: {
		"Average 7 frames": {
			frames: 7,
			weights: "1 1 1 1 1 1 1"
		},
		"Temporal convolution": {
			frames: 3,
			weights: "-1 3 -1"
		},
		"Show differences": {
			frames: 3,
			weights: "-1 2 -1",
			scale: 1
		}
	},
	props: {
		frames: {
			__name__: "Frames",
			__description__: "The number of successive frames to mix.",
			__default__: 3,
			__min__: 1,
			__max__: 32
		},
		weights: {
			__name__: "Weights",
			__description__: "Weight of each input video frame. Each weight is separated by space. If number of weights is smaller than number of frames, last specified weight will be used for remaining frames.",
			__default__: "1 1 1",
		},
		scale: {
			__name__: "Scale",
			__description__: "Scale factor to multiply with weighted pixel values. By default auto-scales to sum of weights.",
			__default__: 0,
			__min__: 0,
			__max__: 32
		},
		planes: {
			__name__: "Planes",
			__description__: "Set which planes to filter.",
			__default__: "all",
			__options__: ["all", "y", "u", "v"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		var weights = String($.weights).trim().split(/\s+/).map(w=>+w);
		$.weights = Array(frames).fill(1).map((d,i)=>weights[i] ?? d);
		ctx.stack.push(`[${ctx.vid}]tmix=frames=${$.frames}:weights='${$.weights}':scale=${$.scale}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});

export default tmix;