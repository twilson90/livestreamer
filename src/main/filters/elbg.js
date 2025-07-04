import { Filter } from "../Filter.js";
export const elbg = new Filter({
	name: "elbg",
	descriptive_name: "ELBG Posterize",
	type: "video",
	description: `Apply a posterize effect using the ELBG (Enhanced LBG) algorithm. For each input image, the filter will compute the optimal mapping from the input to the output given the codebook length, that is the number of distinct output colors.`,
	props: {
		codebook_length: {
			__name__: "Codebook Length",
			__description__: "Set codebook length. The value must be a positive integer, and represents the number of distinct output colors.",
			__default__: 256,
			__min__: 1,
			__max__: 65536
		},
		nb_steps: {
			__name__: "Number of Steps",
			__description__: "Set the maximum number of iterations to apply for computing the optimal mapping. The higher the value the better the result and the higher the computation time.",
			__default__: 1,
			__min__: 1,
			__max__: 1000
		},
		seed: {
			__name__: "Random Seed",
			__description__: "Set a random seed. If set to -1, the filter will try to use a good random seed on a best effort basis.",
			__default__: -1,
			__min__: -1,
			__max__: 4294967295
		},
		pal8: {
			__name__: "PAL8 Output",
			__description__: "Set pal8 output pixel format. This option does not work with codebook length greater than 256.",
			__default__: false
		},
		use_alpha: {
			__name__: "Use Alpha Channel",
			__description__: "Include alpha values in the quantization calculation. Allows creating palettized output images with multiple alpha smooth blending.",
			__default__: false
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]elbg=codebook_length=${$.codebook_length}:nb_steps=${$.nb_steps}:seed=${$.seed}:pal8=${$.pal8}:use_alpha=${$.use_alpha}[${v1}]`);
		ctx.vid = v1;
	}
});
export default elbg;