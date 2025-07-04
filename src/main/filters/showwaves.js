import { Filter } from "../Filter.js";

export const showwaves = new Filter({
	name: "showwaves",
	descriptive_name: "Visualize Audio Waves",
	type: "video",
	description: `Convert input audio to a video output, representing the samples waves.`,
	props: {
		mode: {
			__name__: "Mode",
			__default__: "line",
			__description__:
				`Set waveform mode.
				• point: Draw a point for each sample
				• line: Draw a vertical line for each sample.
				• p2p: Draw a point for each sample and a line between them.
				• cline: Draw a centered vertical line for each sample.`,
			__options__: ["point", "line", "p2p","cline"],
		},
		color: {
			__name__: "Color",
			__description__: "Set waveform color.",
			__default__: "#ffffff",
			__type__: "color",
		},
		alpha: {
			__name__: "Alpha",
			__description__: "Set waveform alpha (transparency).",
			__default__: 1,
			__min__: 0,
			__max__: 1,
			__step__: 0.01,
		},
		/* overlay: {
			__name__: "Overlay",
			__description__: "Overlay the waveform on the main video.",
			__default__: true,
		}, */
		height: {
			__name__: "Height",
			__description__: `Set the height of the spectrum relative to the video height.`,
			__default__: 0.5,
			__min__: 0,
			__max__: 1,
		},
		normalize: {
			__name__: "Normalize",
			__description__: `Normalize the audio spectrum.`,
			__default__: true,
		}
	},
	apply(ctx, $) {
		let ar = ctx.aspect_ratio;
		let h = Math.min(720, ctx.height) // cap it at 720 or it lags.
		let w = Math.ceil(h * ar);
		h *= $.height;
		let a1 = ctx.id("a");
		let a2 = ctx.id("a");
		let wf1 = ctx.id("wf");
		ctx.stack.push(
			`[${ctx.aid}]asplit[${a1}][${a2}]`,
			`[${a1}]aformat=channel_layouts=mono${$.normalize?",loudnorm=I=-5:TP=-0.5:LRA=1":""},showwaves=mode=${$.mode}:size=${w}x${h}:colors=${$.color}@${$.alpha}:rate=${ctx.fps}:draw=full,scale=${ctx.width}:${ctx.height}:force_original_aspect_ratio=decrease[${wf1}]`,
		);
		// if ($.overlay) {
		ctx.vid = ctx.overlay(ctx.vid, wf1);
		// } else {
		// 	ctx.vid = wf1;
		// }
		ctx.aid = a2;
	}
});
export default showwaves;