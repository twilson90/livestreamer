import { Filter } from "../Filter.js";
export default new Filter({
	name: "deblock",
	descriptive_name: "Deblock",
	type: "video",
	description: `Remove blocking artifacts from input video.`,
	presets: {
		"Weak": {
			filter: "weak",
			block: 4
		},
		"Strong": {
			filter: "strong", 
			block: 4,
			alpha: 0.12,
			beta: 0.07,
			gamma: 0.06,
			delta: 0.05
		}
	},
	props: {
		filter: {
			__name__: "Filter Type",
			__description__: "Set filter type, can be weak or strong. This controls what kind of deblocking is applied.",
			__default__: "strong",
			__options__: ["weak", "strong"]
		},
		block: {
			__name__: "Block Size",
			__description__: "Set size of block.",
			__default__: 8,
			__min__: 4,
			__max__: 512
		},
		alpha: {
			__name__: "Alpha Threshold",
			__description__: "Set blocking detection threshold at exact edge of block.",
			__default__: 0.098,
			__min__: 0,
			__max__: 1
		},
		beta: {
			__name__: "Beta Threshold",
			__description__: "Set blocking detection threshold near the edge.",
			__default__: 0.05, 
			__min__: 0,
			__max__: 1
		},
		gamma: {
			__name__: "Gamma Threshold",
			__description__: "Set blocking detection threshold near the edge.",
			__default__: 0.05,
			__min__: 0,
			__max__: 1
		},
		delta: {
			__name__: "Delta Threshold",
			__description__: "Set blocking detection threshold near the edge.",
			__default__: 0.05,
			__min__: 0,
			__max__: 1
		},
		planes: {
			__name__: "Planes",
			__description__: "Set planes to filter. Default is to filter all available planes.",
			__default__: "all",
			__options__: ["all", "y", "u", "v"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]deblock=filter=${$.filter}:block=${$.block}:alpha=${$.alpha}:beta=${$.beta}:gamma=${$.gamma}:delta=${$.delta}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});