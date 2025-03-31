import { Filter } from "../Filter.js";

export default new Filter({
	name: "vibrato",
	descriptive_name: "Vibrato",
	type: "audio",
	description: `Sinusoidal phase modulation.`,
	props: {
        f: {
            __name__: "Frequency",
            __description__: `Modulation frequency in Hertz. Range is 0.1 - 20000.0. Default value is 5.0 Hz.`,
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
        ctx.stack.push(`[${ctx.aid}]vibrato=f=${$.f}:d=${$.d}[${a1}]`);
        ctx.aid = a1;
	}
});