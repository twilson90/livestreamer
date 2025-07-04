import { Filter } from "../Filter.js";

export const aphaser = new Filter({
	name: "aphaser",
	descriptive_name: "Phaser",
	type: "audio",
	description: `Add a phasing effect to the input audio. A phaser filter creates series of peaks and troughs in the frequency spectrum. The position of the peaks and troughs are modulated so that they vary over time, creating a sweeping effect..`,
	props: {
        in_gain: {
            __name__: "Input Gain",
            __description__: "Set input gain.",
            __default__: 0.4,
            __min__: 0,
            __max__: 1,
        },
        out_gain: {
            __name__: "Output Gain",
            __description__: "Set output gain.",
            __default__: 0.74,
            __min__: 0,
            __max__: 1,
        },
        delay: {
            __name__: "Delay",
            __description__: "Set delay in milliseconds.",
            __default__: 3.0,
            __min__: 0,
            __max__: 5000,
        },
        decay: {
            __name__: "Decay",
            __description__: "Set decay.",
            __default__: 0.4,
            __min__: 0,
            __max__: 1,
        },
        speed: {
            __name__: "Speed",
            __description__: "Set modulation speed in Hz.",
            __default__: 0.5,
            __min__: 0,
            __max__: 1000,
        },
        type: {
            __name__: "Modulation Type",
            __description__: "Set modulation type.",
            __options__: ["triangular", "sinusoidal"],
            __default__: "triangular",
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]aphaser=in_gain=${$.in_gain}:out_gain=${$.out_gain}:delay=${$.delay}:decay=${$.decay}:speed=${$.speed}:type=${$.type}[${a1}]`);
        ctx.aid = a1;
	}
});
export default aphaser;