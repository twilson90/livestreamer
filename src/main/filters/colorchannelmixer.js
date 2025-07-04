import { Filter } from "../Filter.js";
export const colorchannelmixer = new Filter({
	name: "colorchannelmixer",
	descriptive_name: "Color Channel Mixer",
	type: "video",
	description: `Adjust video input frames by re-mixing color channels.
This filter modifies a color channel by adding the values associated to the other channels of the same pixels.`,
	presets: {
		greyscale: {
			rr: .3,
			rg: .4,
			rb: .3,
			gr: .3,
			gg: .4,
			gb: .3,
			br: .3,
			bg: .4,
			bb: .3,
		},
		sepia: {
			rr: .393,
			rg: .769,
			rb: .189,
			gr: .349,
			gg: .686,
			gb: .168,
			br: .272,
			bg: .534,
			bb: .131
		}
	},
	props: {
		rr: {
			__name__: "Red Red",
			__description__: "Adjust contribution of input red channel for output red channel.",
			__default__: 1,
			__min__: -2,
			__max__: 2
		},
		rg: {
			__name__: "Red Green",
			__description__: "Adjust contribution of input green channel for output red channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		rb: {
			__name__: "Red Blue",
			__description__: "Adjust contribution of input blue channel for output red channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		gr: {
			__name__: "Green Red",
			__description__: "Adjust contribution of input red channel for output green channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		gg: {
			__name__: "Green Green",
			__description__: "Adjust contribution of input green channel for output green channel.",
			__default__: 1,
			__min__: -2,
			__max__: 2
		},
		gb: {
			__name__: "Green Blue",
			__description__: "Adjust contribution of input blue channel for output green channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		br: {
			__name__: "Blue Red",
			__description__: "Adjust contribution of input red channel for output blue channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		bg: {
			__name__: "Blue Green",
			__description__: "Adjust contribution of input green channel for output blue channel.",
			__default__: 0,
			__min__: -2,
			__max__: 2
		},
		bb: {
			__name__: "Blue Blue",
			__description__: "Adjust contribution of input blue channel for output blue channel.",
			__default__: 1,
			__min__: -2,
			__max__: 2
		},
		pc: {
			__name__: "Preserve Color",
			__description__: "Set preserve color mode.",
			__default__: "none",
			__options__: ["none", "lum", "max", "avg", "sum", "nrm", "pwr"]
		},
		pa: {
			__name__: "Preserve Color Amount",
			__description__: "Set the preserve color amount when changing colors.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorchannelmixer=rr=${$.rr}:rg=${$.rg}:rb=${$.rb}:gr=${$.gr}:gg=${$.gg}:gb=${$.gb}:br=${$.br}:bg=${$.bg}:bb=${$.bb}:pc=${$.pc}:pa=${$.pa}[${v1}]`);
		ctx.vid = v1;
	}
});
export default colorchannelmixer;