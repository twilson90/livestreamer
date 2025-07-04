import { Filter } from "../Filter.js";

export const asoftclip = new Filter({
	name: "asoftclip",
	descriptive_name: "Soft Clip",
	type: "audio",
	description: `Soft clipping is a type of distortion effect where the amplitude of a signal is saturated along a smooth curve, rather than the abrupt shape of hard-clipping.`,
	props: {
        type: {
            __name__: "Type",
            __description__: "Set type of soft-clipping.",
            __options__: [
                ["hard", "Hard"],
                ["tanh", "Tanh"],
                ["atan", "Atan"], 
                ["cubic", "Cubic"],
                ["exp", "Exp"],
                ["alg", "Alg"],
                ["quintic", "Quintic"], 
                ["sin", "Sin"],
                ["erf", "Erf"]
            ],
            __default__: "hard"
        },
        threshold: {
            __name__: "Threshold",
            __description__: "Set threshold from where to start clipping. Default value is 1.",
            __default__: 1,
            __min__: 0,
            __max__: 1,
        },
        output: {
            __name__: "Output Gain",
            __description__: "Set gain applied to output. Default value is 1.",
            __default__: 1,
            __min__: 0,
            __max__: 1,
        },
        param: {
            __name__: "Parameter",
            __description__: "Set additional parameter which controls sigmoid function.",
            __default__: 1,
            __min__: 0,
            __max__: 1,
        },
        oversample: {
            __name__: "Oversampling",
            __description__: "Set oversampling factor.",
            __default__: 1,
            __min__: 1,
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]asoftclip=type=${$.type}:threshold=${$.threshold}:output=${$.output}:param=${$.param}:oversample=${$.oversample}[${a1}]`);
        ctx.aid = a1;
    }
});
export default asoftclip;