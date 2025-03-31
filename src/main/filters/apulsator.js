import { Filter } from "../Filter.js";

export default new Filter({
	name: "apulsator",
	descriptive_name: "Pulsator",
	type: "audio",
	description: `Audio pulsator is something between an autopanner and a tremolo. But it can produce funny stereo effects as well. Pulsator changes the volume of the left and right channel based on a LFO (low frequency oscillator) with different waveforms and shifted phases. This filter have the ability to define an offset between left and right channel. An offset of 0 means that both LFO shapes match each other. The left and right channel are altered equally - a conventional tremolo. An offset of 50% means that the shape of the right channel is exactly shifted in phase (or moved backwards about half of the frequency) - pulsator acts as an autopanner. At 1 both curves match again. Every setting in between moves the phase shift gapless between all stages and produces some "bypassing" sounds with sine and triangle waveforms. The more you set the offset near 1 (starting from the 0.5) the faster the signal passes from the left to the right speaker.`,
	props: {
        level_in: {
            __name__: "Input Gain",
            __description__: "Set input gain.",
            __default__: 1,
            __min__: 0.015625,
            __max__: 64,
        },
        level_out: {
            __name__: "Output Gain",
            __description__: "Set output gain.",
            __default__: 1,
            __min__: 0.015625,
            __max__: 64,
        },
        mode:{
            __name__: "Waveform Shape",
            __description__: "Set waveform shape the LFO will use. Can be one of: sine, triangle, square, sawup or sawdown.",
            __options__: ["sine", "triangle", "square", "sawup", "sawdown"],
            __default__: "sine",
        },
        amount: {
            __name__: "Modulation",
            __description__: "Set modulation. Define how much of original signal is affected by the LFO.",
            __default__: 1,
            __min__: 0,
            __max__: 1,
        },
        offset_l: {
            __name__: "Left Channel Offset",
            __description__: "Set left channel offset.",
            __default__: 0,
            __min__: 0,
            __max__: 1,
        },
        offset_r: {
            __name__: "Right Channel Offset",
            __description__: "Set right channel offset.",
            __default__: 0.5,
            __min__: 0,
            __max__: 1,
        },
        width: {
            __name__: "Pulse Width",
            __description__: "Set pulse width.",
            __default__: 1,
            __min__: 0,
            __max__: 2,
        },
        timing: {
            __name__: "Timing Mode",
            __description__: "Set possible timing mode. Can be one of: bpm, ms or hz.",
            __options__: ["bpm", "ms", "hz"],
            __default__: "hz",
        },
        bpm: {
            __name__: "BPM",
            __description__: "Set bpm. Only used if timing is set to bpm.",
            __default__: 120,
            __min__: 30,
            __max__: 300,
        },
        ms: {
            __name__: "Milliseconds",
            __description__: "Set ms. Only used if timing is set to ms.",
            __default__: 500,
            __min__: 10,
            __max__: 2000,
        },
        hz: {
            __name__: "Frequency",
            __description__: "Set frequency in Hz. Only used if timing is set to hz.",
            __default__: 2,
            __min__: 0.01,
            __max__: 100,
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]apulsator=level_in=${$.level_in}:level_out=${$.level_out}:mode=${$.mode}:amount=${$.amount}:offset_l=${$.offset_l}:offset_r=${$.offset_r}:width=${$.width}:timing=${$.timing}:bpm=${$.bpm}:ms=${$.ms}:hz=${$.hz}[${a1}]`);
        ctx.aid = a1;
	}
});