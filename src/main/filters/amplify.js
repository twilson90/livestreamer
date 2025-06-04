import { Filter } from "../Filter.js";
export default new Filter({
	name: "amplify",
	descriptive_name: "Amplify Differences",
	type: "video",
	description: `Amplify differences between current pixel and pixels of adjacent frames in same pixel location.`,
	props: {
		radius: {
			__name__: "Radius",
			__description__: "Set frame radius. For example radius of 3 will instruct filter to calculate average of 7 frames.",
			__default__: 2,
			__min__: 1,
			__max__: 63
		},
		factor: {
			__name__: "Factor",
			__description__: "Set factor to amplify difference.",
			__default__: 2,
			__min__: 0,
			__step__: 1,
			__max__: 65535
		},
		threshold: {
			__name__: "Threshold",
			__description__: "Set threshold for difference amplification. Any difference greater or equal to this value will not alter source pixel.",
			__default__: 10,
			__min__: 0,
			__step__: 1,
			__max__: 65535
		},
		tolerance: {
			__name__: "Tolerance",
			__description__: "Set tolerance for difference amplification. Any difference lower to this value will not alter source pixel.",
			__default__: 0,
			__min__: 0,
			__step__: 1,
			__max__: 65535
		},
		low: {
			__name__: "Low Limit",
			__description__: "Set lower limit for changing source pixel. This option controls maximum possible value that will decrease source pixel value.",
			__default__: 65535,
			__min__: 0,
			__step__: 1,
			__max__: 65535
		},
		high: {
			__name__: "High Limit",
			__description__: "Set high limit for changing source pixel. This option controls maximum possible value that will increase source pixel value.",
			__default__: 65535,
			__min__: 0,
			__max__: 65535,
			__step__: 1,
		},
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]amplify=radius=${$.radius}:factor=${$.factor}:threshold=${$.threshold}:tolerance=${$.tolerance}:low=${$.low}:high=${$.high}:planes=all[${v1}]`);
		ctx.vid = v1;
	}
});