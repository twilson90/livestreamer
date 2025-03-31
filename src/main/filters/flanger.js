import { Filter } from "../Filter.js";

export default new Filter({
	name: "flanger",
	descriptive_name: "Flanger",
	type: "audio",
	description: `Apply a flanging effect to the audio.`,
	props: {
        delay: {
            __name__: "Base Delay",
            __description__: "Set base delay in milliseconds.",
            __default__: 0,
            __min__: 0,
            __max__: 30,
        },
        depth: {
            __name__: "Sweep Depth", 
            __description__: "Set added sweep delay in milliseconds.",
            __default__: 2,
            __min__: 0,
            __max__: 10,
        },
        regen: {
            __name__: "Regeneration",
            __description__: "Set percentage regeneration (delayed signal feedback).",
            __default__: 0,
            __min__: -95,
            __max__: 95,
        },
        width: {
            __name__: "Mix Width",
            __description__: "Set percentage of delayed signal mixed with original.",
            __default__: 71,
            __min__: 0,
            __max__: 100,
        },
        speed: {
            __name__: "Speed",
            __description__: "Set sweeps per second (Hz).",
            __default__: 0.5,
            __min__: 0.1,
            __max__: 10,
        },
        shape: {
            __name__: "Wave Shape",
            __description__: "Set swept wave shape, can be triangular or sinusoidal.",
            __options__: ["triangular", "sinusoidal"],
            __default__: "sinusoidal",
        },
        phase: {
            __name__: "Phase Shift",
            __description__: "Set swept wave percentage-shift for multi channel.",
            __default__: 25,
            __min__: 0,
            __max__: 100,
        },
        interp: {
            __name__: "Interpolation",
            __description__: "Set delay-line interpolation, linear or quadratic.",
            __options__: ["linear", "quadratic"],
            __default__: "linear",
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]flanger=delay=${$.delay}:depth=${$.depth}:regen=${$.regen}:width=${$.width}:speed=${$.speed}:shape=${$.shape}:phase=${$.phase}:interp=${$.interp}[${a1}]`);
        ctx.aid = a1;
	}
});