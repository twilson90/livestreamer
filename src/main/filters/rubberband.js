import { Filter } from "../Filter.js";
export const rubberband = new Filter({
	name: "rubberband",
	descriptive_name: "Rubberband",
	type: "audio",
	description: `Apply time-stretching and pitch-shifting with librubberband`,
	props: {
        tempo: {
            __name__: "Tempo",
            __description__: "Set tempo scale factor.",
            __default__: 1,
            __min__: 0.1,
            __max__: 10,
        },
        pitch: {
            __name__: "Pitch",
            __description__: "Set pitch scale factor.",
            __default__: 1,
            __min__: 0.1,
            __max__: 10,
        },
        transients: {
            __name__: "Transients",
            __description__: "Set transients detector.",
            __options__: ["crisp", "mixed", "smooth"],
            __default__: "mixed",
        },
        detector: {
            __name__: "Detector",
            __description__: "Set detector.",
            __options__: ["compound", "percussive", "soft"],
            __default__: "compound",
        },
        phase: {
            __name__: "Phase",
            __description__: "Set phase.",
            __options__: ["laminar", "independent"],
            __default__: "laminar",
        },
        window: {
            __name__: "Window",
            __description__: "Set processing window size.",
            __options__: ["standard", "short", "long"],
            __default__: "standard",
        },
        smoothing: {
            __name__: "Smoothing",
            __description__: "Set smoothing.",
            __options__: ["off", "on"],
            __default__: "off",
        },
        formant: {
            __name__: "Formant",
            __description__: "Enable formant preservation when shift pitching.",
            __options__: ["shifted", "preserved"],
            __default__: "shifted",
        },
        pitchq: {
            __name__: "Pitch Quality",
            __description__: "Set pitch quality.",
            __options__: ["quality", "speed", "consistency"],
            __default__: "quality",
        },
        channels: {
            __name__: "Channels",
            __description__: "Set channels.",
            __options__: ["apart", "together"],
            __default__: "apart",
        }
	},
	apply(ctx, $) {
		let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]rubberband=tempo=${$.tempo}:pitch=${$.pitch}:transients=${$.transients}:detector=${$.detector}:phase=${$.phase}:window=${$.window}:smoothing=${$.smoothing}:formant=${$.formant}:pitchq=${$.pitchq}:channels=${$.channels}[${a1}]`);
		ctx.aid = a1;
	}
});
export default rubberband;