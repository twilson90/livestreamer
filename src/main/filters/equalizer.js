import { Filter } from "../Filter.js";

export const equalizer = new Filter({
	name: "equalizer",
	descriptive_name: "Equalizer",
	type: "audio",
	description: `Apply a two-pole peaking equalisation (EQ) filter. With this filter, the signal-level at and around a selected frequency can be increased or decreased, whilst (unlike bandpass and bandreject filters) that at all other frequencies is unchanged. In order to produce complex equalisation curves, this filter can be given several times, each with a different central frequency.`,
	props: {
		frequency: {
			__name__: "Frequency",
			__description__: "Set the filter's central frequency in Hz.",
			__min__: 20,
			__default__: 1000,
		},
		width_type: {
			__name__: "Width Type",
			__description__: "Set method to specify band-width of filter.",
			__options__: [["h", "Hz"],["q", "Q-Factor"],["o", "Octave"],["s", "Slope"],["k", "kHz"]],
			__default__: "h",
		},
		width: {
			__name__: "Width",
			__description__: "Specify the band-width of a filter in width_type units.",
			__default__: 100,
		},
		gain: {
			__name__: "Gain",
			__description__: "Set the required gain or attenuation in dB. Beware of clipping when using a positive gain.",
			__default__: 0,
		},
		mix: {
			__name__: "Mix",
			__description__: "How much to use filtered signal in output.",
			__default__: 1,
			__min__: 0,
			__max__: 1,
		},
		normalize: {
			__name__: "Normalize",
			__description__: "Normalize biquad coefficients, by default is disabled. Enabling it will normalize magnitude response at DC to 0dB.",
			__default__: false,
		},
		transform: {
			__name__: "Transform",
			__description__: "Set transform type of IIR filter.",
			__options__: ["di", "dii","tdi", "tdii","latt", "svf","zdf"],
			__default__: "di",
		},
		block_size: {
			__name__: "Block Size",
			__description__: "Set block size used for reverse IIR processing. If this value is set to high enough value (higher than impulse response length truncated when reaches near zero values) filtering will become linear phase otherwise if not big enough it will just produce nasty artifacts. Note that filter delay will be exactly this many samples when set to non-zero value.",
			__default__: 0,
		}
	},
	apply(ctx, $) {
		let a1 = ctx.id("a");
		ctx.stack.push(`[${ctx.aid}]equalizer=frequency=${$.frequency}:width_type=${$.width_type}:width=${$.width}:gain=${$.gain}:mix=${$.mix}:normalize=${$.normalize}:transform=${$.transform}:block_size=${$.block_size}[${a1}]`);
		ctx.aid = a1;
	}
});
export default equalizer;