import { Filter } from "../Filter.js";
export const tblend = new Filter({
	name: "tblend",
	descriptive_name: "Frame Blend",
	type: "video",
	description: `Blend consecutive frames, outputting the result obtained by blending the new frame on top of the old frame.`,
	props: {
		mode: {
			__name__: "Blend Mode",
			__description__: "Set blend mode for blending frames together.",
			__default__: "normal",
			__options__: [
				"addition", "and", "average", "bleach", "burn", "darken", "difference",
				"divide", "dodge", "exclusion", "extremity", "freeze", "geometric",
				"glow", "grainextract", "grainmerge", "hardlight", "hardmix",
				"hardoverlay", "harmonic", "heat", "interpolate", "lighten",
				"linearlight", "multiply", "multiply128", "negation", "normal", "or",
				"overlay", "phoenix", "pinlight", "reflect", "screen", "softdifference",
				"softlight", "stain", "subtract", "vividlight", "xor"
			]
		},
		opacity: {
			__name__: "Opacity",
			__description__: "Set blend opacity between frames.",
			__default__: 1.0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]tblend=all_mode=${$.mode}:all_opacity=${$.opacity}[${v1}]`);
		ctx.vid = v1;
	}
});
export default tblend;