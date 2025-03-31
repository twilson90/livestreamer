import { Filter } from "../Filter.js";
export default new Filter({
	name: "acompressor",
	descriptive_name: "Compressor",
	type: "audio",
	description: `A compressor is mainly used to reduce the dynamic range of a signal. Especially modern music is mostly compressed at a high ratio to improve the overall loudness. It’s done to get the highest attention of a listener, "fatten" the sound and bring more "power" to the track. If a signal is compressed too much it may sound dull or "dead" afterwards or it may start to "pump" (which could be a powerful effect but can also destroy a track completely). The right compression is the key to reach a professional sound and is the high art of mixing and mastering. Because of its complex settings it may take a long time to get the right feeling for this kind of effect.`,
	props: {
		level_in: {
			__name__: "Input Gain",
			__description__: "Set input gain.",
			__default__: 1,
			__min__: 0.015625,
			__max__: 64,
		},
		mode: {
			__name__: "Mode",
			__description__: "Set mode of compressor operation. Can be upward or downward.",
			__default__: "downward",
			__options__: ["upward", "downward"],
		},
		threshold: {
			__name__: "Threshold",
			__description__: "If a signal of stream rises above this level it will affect the gain reduction.",	
			__default__: 0.125,
			__min__: 0.00097563,
			__step__: 0.001,
			__max__: 1,
		},
		ratio: {
			__name__: "Ratio",
			__description__: "Set a ratio by which the signal is reduced. 1:2 means that if the level rose 4dB above the threshold, it will be only 2dB above after the reduction.",
			__default__: 2,
			__min__: 1,
			__max__: 20,
		},
		attack: {
			__name__: "Attack",
			__description__: "Amount of milliseconds the signal has to rise above the threshold before gain reduction starts.",
			__default__: 20,
			__min__: 0.01,
			__max__: 2000,
			__step__: 1,
		},
		release: {
			__name__: "Release",
			__description__: "Amount of milliseconds the signal has to fall below the threshold before reduction is decreased again.",
			__default__: 250,
			__min__: 0.01,
			__max__: 9000,
			__step__: 1,
		},
		makeup: {
			__name__: "Makeup",
			__description__: "Set the amount by how much signal will be amplified after processing.",
			__default__: 1,
			__min__: 1,
			__max__: 64,
		},
		knee: {
			__name__: "Knee",
			__description__: "Curve the sharp knee around the threshold to enter gain reduction more softly.",
			__default__: 2.82843,
			__min__: 1,
			__max__: 8,
		},
		link: {
			__name__: "Link",
			__description__: "Choose if the average level between all channels of input stream or the louder(maximum) channel of input stream affects the reduction.",
			__default__: "average",
			__options__: ["average", "maximum"],
		},
		detection: {
			__name__: "Detection",
			__description__: "Should the exact signal be taken in case of peak or an RMS one in case of rms. Default is rms which is mostly smoother.",
			__default__: "rms",
			__options__: ["peak", "rms"],
		},
		mix: {
			__name__: "Mix",
			__description__: "How much to use compressed signal in output.",
			__default__: 1,
			__min__: 0,
			__max__: 1,
			__step__: 0.01,
		}
	},
	apply(ctx, $) {
		let a1 = ctx.id("a");
		ctx.stack.push(`[${ctx.aid}]acompressor=level_in=${$.level_in}:mode=${$.mode}:threshold=${$.threshold}:ratio=${$.ratio}:attack=${$.attack}:release=${$.release}:makeup=${$.makeup}:knee=${$.knee}:link=${$.link}:detection=${$.detection}:mix=${$.mix}[${a1}]`);
		ctx.aid = a1;
	}
});