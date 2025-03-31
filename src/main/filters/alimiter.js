import { Filter } from "../Filter.js";

export default new Filter({
	name: "alimiter",
	descriptive_name: "Limiter",
	type: "audio",
	description: `The limiter prevents an input signal from rising over a desired threshold. This limiter uses lookahead technology to prevent your signal from distorting. It means that there is a small delay after the signal is processed. Keep in mind that the delay it produces is the attack time you set.`,
	props: {
        level_in: {
            __name__: "Input Gain",
            __description__: "Set input gain.",
            __default__: 1,
        },
        level_out: {
            __name__: "Output Gain",
            __description__: "Set output gain.",
            __default__: 1,
        },
        limit: {
            __name__: "Limit",
            __description__: "Don't let signals above this level pass the limiter.",
            __default__: 1,
        },
        attack: {
            __name__: "Attack",
            __description__: "The limiter will reach its attenuation level in this amount of time in milliseconds.",
            __default__: 5,
        },
        release: {
            __name__: "Release",
            __description__: "Come back from limiting to attenuation 1.0 in this amount of milliseconds.",
            __default__: 50,
        },
        asc: {
            __name__: "ASC",
            __description__: "When gain reduction is always needed ASC takes care of releasing to an average reduction level rather than reaching a reduction of 0 in the release time.",
            __default__: false,
        },
        asc_level: {
            __name__: "ASC Level",
            __description__: "Select how much the release time is affected by ASC, 0 means nearly no changes in release time while 1 produces higher release times.",
            __default__: 0.5,
            __min__: 0,
            __max__: 1,
        },
        level: {
            __name__: "Auto Level",
            __description__: "Auto level output signal. This normalizes audio back to 0dB if enabled.",
            __default__: true,
        },
        latency: {
            __name__: "Latency",
            __description__: "Compensate the delay introduced by using the lookahead buffer set with attack parameter. Also flush the valid audio data in the lookahead buffer when the stream hits EOF.",
            __default__: false,
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]alimiter=level_in=${$.level_in}:level_out=${$.level_out}:limit=${$.limit}:attack=${$.attack}:release=${$.release}:asc=${$.asc}:asc_level=${$.asc_level}:level=${$.level}:latency=${$.latency}[${a1}]`);
        ctx.aid = a1;
    }
});