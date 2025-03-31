import { Filter } from "../Filter.js";

export default new Filter({
	name: "tremolo",
	descriptive_name: "Tremolo",
	type: "audio",
	description: `Sinusoidal amplitude modulation.`,
	props: {
        f: {
            __name__: "Frequency",
            __description__: `Modulation frequency in Hertz. Modulation frequencies in the subharmonic range (20 Hz or lower) will result in a tremolo effect. This filter may also be used as a ring modulator by specifying a modulation frequency higher than 20 Hz.`,
            __default__: 5,
            __min__: 0.1,
            __max__: 20000,
        },
        d: {
            __name__: "Depth",
            __description__: "Depth of modulation as a percentage.",
            __default__: 0.5,
            __min__: 0,
            __max__: 1,
        },
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]tremolo=f=${$.f}:d=${$.d}[${a1}]`);
        ctx.aid = a1;
	}
});