import { Filter } from "../Filter.js";
export default new Filter({
	name: "loudnorm",
	descriptive_name: "Loudness Normalization",
	type: "audio",
	description: `EBU R128 loudness normalization. Includes both dynamic and linear normalization modes. Support for both single pass (livestreams, files) and double pass (files) modes. This algorithm can target IL, LRA, and maximum true peak. In dynamic mode, to accurately detect true peaks, the audio stream will be upsampled to 192 kHz. Use the -ar option or aresample filter to explicitly set an output sample rate.`,
	props: {
		i: {
			__name__: "Integrated Loudness Target",
			__description__: "Set integrated loudness target. Range is -70.0 - -5.0. Default value is -24.0.",
			__default__: -24.0,
			__min__: -70.0,
			__max__: -5.0,
		},
		lra: {
			__name__: "Loudness Range Target",
			__description__: "Set loudness range target. Range is 1.0 - 50.0. Default value is 7.0.",
			__default__: 7.0,
			__min__: 1.0,
			__max__: 50.0,
		},
		tp: {
			__name__: "Maximum True Peak",
			__description__: "Set maximum true peak. Range is -9.0 - +0.0. Default value is -2.0.",
			__default__: -2.0,
			__min__: -9.0,
			__max__: 0.0,
		},
		measured_i: {
			__name__: "Measured Integrated Loudness",
			__description__: "Measured IL of input file. Range is -99.0 - +0.0.",
			__default__: 0.0,
			__min__: -99.0,
			__max__: 0.0,
		},
		measured_lra: {
			__name__: "Measured Loudness Range",
			__description__: "Measured LRA of input file. Range is 0.0 - 99.0.",
			__default__: 0.0,
			__min__: 0.0,
			__max__: 99.0,
		},
		measured_tp: {
			__name__: "Measured True Peak",
			__description__: "Measured true peak of input file. Range is -99.0 - +99.0.",
			__default__: 0.0,
			__min__: -99.0,
			__max__: 99.0,
		},
		measured_thresh: {
			__name__: "Measured Threshold",
			__description__: "Measured threshold of input file. Range is -99.0 - +0.0.",
			__default__: 0.0,
			__min__: -99.0,
			__max__: 0.0,
		},
		offset: {
			__name__: "Offset Gain",
			__description__: "Set offset gain. Gain is applied before the true-peak limiter. Range is -99.0 - +99.0. Default is +0.0.",
			__default__: 0.0,
			__min__: -99.0,
			__max__: 99.0,
		},
		linear: {
			__name__: "Linear Normalization",
			__description__: "Normalize by linearly scaling the source audio. measured_I, measured_LRA, measured_TP, and measured_thresh must all be specified. Target LRA shouldn't be lower than source LRA and the change in integrated loudness shouldn't result in a true peak which exceeds the target TP. If any of these conditions aren't met, normalization mode will revert to dynamic. Options are true or false. Default is true.",
			__default__: true,
		},
		dual_mono: {
			__name__: "Dual Mono",
			__description__: "Treat mono input files as 'dual-mono'. If a mono file is intended for playback on a stereo system, its EBU R128 measurement will be perceptually incorrect. If set to true, this option will compensate for this effect. Multi-channel input files are not affected by this option. Options are true or false. Default is false.",
			__default__: false,
		}
	},
	apply(ctx, $) {
		let a1 = ctx.id("a");
		ctx.stack.push(`[${ctx.aid}]loudnorm=i=${$.i}:lra=${$.lra}:tp=${$.tp}:measured_i=${$.measured_i}:measured_lra=${$.measured_lra}:measured_tp=${$.measured_tp}:measured_thresh=${$.measured_thresh}:offset=${$.offset}:linear=${$.linear}:dual_mono=${$.dual_mono}[${a1}]`);
		ctx.aid = a1;
	}
})