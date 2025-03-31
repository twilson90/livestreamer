import { Filter } from "../Filter.js";
export default new Filter({
	name: "edgedetect",
	descriptive_name: "Edge Detect",
	type: "video",
	description: `Detect and draw edges using the Canny Edge Detection algorithm.`,
	presets: {
		"Standard": {
			low: 0.1,
			high: 0.4,
			mode: "wires"
		},
		"Paint": {
			mode: "colormix",
			high: 0
		}
	},
	props: {
		low: {
			__name__: "Low Threshold",
			__description__: "Set low threshold value used by the Canny thresholding algorithm. The low threshold selects 'weak' edge pixels.",
			__default__: 0.07843137254,
			__min__: 0,
			__max__: 1
		},
		high: {
			__name__: "High Threshold", 
			__description__: "Set high threshold value used by the Canny thresholding algorithm. The high threshold selects 'strong' edge pixels.",
			__default__: 0.19607843137,
			__min__: 0,
			__max__: 1
		},
		mode: {
			__name__: "Mode",
			__description__: "Set the drawing mode for edge detection.",
			__default__: "wires",
			__options__: [
				["wires", "White/gray wires on black background"],
				["colormix", "Mix colors for paint/cartoon effect"],
				["canny", "Apply Canny edge detector"]
			]
		},
		planes: {
			__name__: "Planes",
			__description__: "Select planes for filtering.",
			__default__: "all",
			__options__: ["all", "y", "u", "v"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]edgedetect=low=${$.low}:high=${$.high}:mode=${$.mode}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});
