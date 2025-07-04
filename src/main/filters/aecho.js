import { Filter } from "../Filter.js";

export const aecho = new Filter({
	name: "aecho",
	descriptive_name: "Echo",
	type: "audio",
	description: `Apply echoing to the input audio. Echoes are reflected sound and can occur naturally amongst mountains (and sometimes large buildings) when talking or shouting; digital echo effects emulate this behaviour and are often used to help fill out the sound of a single instrument or vocal. The time difference between the original signal and the reflection is the delay, and the loudness of the reflected signal is the decay. Multiple echoes can have different delays and decays.`,
	props: {
        in_gain: {
            __name__: "Input Gain",
            __description__: "Set input gain of reflected signal.",
            __default__: 0.6,
            __min__: 0,
            __max__: 1,
        },
        out_gain: {
            __name__: "Output Gain",
            __description__: "Set output gain of reflected signal.",
            __default__: 0.3,
            __min__: 0,
            __max__: 1,
        },
        delays: {
            __name__: "Delays",
            __description__: "Set list of time intervals in milliseconds between original signal and reflections separated by '|'. Allowed range for each delay is (0 - 90000.0). Default is 1000.",
            __default__: "1000",
        },
        decays: {
            __name__: "Decays",
            __description__: "Set list of loudness of reflected signals separated by '|'. Allowed range for each decay is (0 - 1.0). Default is 0.5.",
            __default__: "0.5",
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        var fix = (k)=>{
            var list = $[k];
            var min = this.props[k].__min__;
            var max = this.props[k].__max__;
            var def = this.props[k].__default__;
            return list.split("|").map(a=>clamp(+a, min, max)).filter(a=>!isNaN(a)).join("|")||def;
        }
        $ = {...$};
        $.delays = fix($.delays);
        $.decays = fix($.decays);
        ctx.stack.push(`[${ctx.aid}]aecho=in_gain=${$.in_gain}:out_gain=${$.out_gain}:delays=${$.delays}:decays=${$.decays}[${a1}]`);
        ctx.aid = a1;
	}
});
export default aecho;