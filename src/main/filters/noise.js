import { Filter } from "../Filter.js";
export default new Filter({
	name: "noise",
	descriptive_name: "Noise",
	type: "video",
	description: `Add noise on video input frame.`,
	props: {
		all_seed: {
			__name__: "Seed",
			__description__: "Set noise seed for all pixel components.",
			__default__: 123457,
			__min__: 0,
			__max__: 999999
		},
		all_strength: {
			__name__: "Strength", 
			__description__: "Set noise strength for all pixel components.",
			__default__: 0,
			__min__: 0,
			__max__: 100
		},
		all_flags: {
			__name__: "Flags",
			__description__: "Set flags for all components.",
			__default__: "t+u",
			__options__: [
				["a", "Averaged temporal noise (smoother)"],
				["p", "Mix with pattern"],
				["t", "Temporal noise"],
				["u", "Uniform noise"],
				["t+u", "Temporal + Uniform noise"],
			]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]noise=all_seed=${$.all_seed}:all_strength=${$.all_strength}:all_flags=${$.all_flags}[${v1}]`);
		ctx.vid = v1;
	}
});