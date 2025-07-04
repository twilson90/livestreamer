import { Filter } from "../Filter.js";
export const deband = new Filter({
	name: "deband",
	descriptive_name: "Deband",
	type: "video", 
	description: `Remove banding artifacts from input video. It works by replacing banded pixels with average value of referenced pixels.`,
	props: {
		thr1: {
			__name__: "Threshold 1",
			__description__: "Set banding detection threshold for first plane.",
			__default__: 0.02,
			__min__: 0.00003,
			__max__: 0.5
		},
		thr2: {
			__name__: "Threshold 2",
			__description__: "Set banding detection threshold for second plane.", 
			__default__: 0.02,
			__min__: 0.00003,
			__max__: 0.5
		},
		thr3: {
			__name__: "Threshold 3",
			__description__: "Set banding detection threshold for third plane.",
			__default__: 0.02,
			__min__: 0.00003,
			__max__: 0.5
		},
		thr4: {
			__name__: "Threshold 4",
			__description__: "Set banding detection threshold for fourth plane.",
			__default__: 0.02,
			__min__: 0.00003,
			__max__: 0.5
		},
		range: {
			__name__: "Range",
			__description__: "Set banding detection range in pixels.",
			__default__: 16,
			__min__: -1000,
			__max__: 1000
		},
		direction: {
			__name__: "Direction",
			__description__: "Set direction in radians for pixel comparison.",
			__default__: 0,
			__min__: -6.28318530718,
			__max__: 6.28318530718
		},
		blur: {
			__name__: "Blur",
			__description__: "Enable comparison with average of surrounding pixels.",
			__default__: true,
		},
		coupling: {
			__name__: "Coupling",
			__description__: "Only change pixel if all components are banded.",
			__default__: false,
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]deband=1thr=${$.thr1}:2thr=${$.thr2}:3thr=${$.thr3}:4thr=${$.thr4}:r=${$.range}:d=${$.direction}:blur=${$.blur}:coupling=${$.coupling}[${v1}]`);
		ctx.vid = v1;
	}
});
export default deband;