import { Filter } from "../Filter.js";

export const showspectrum = new Filter({
	name: "showspectrum",
	descriptive_name: "Visualize Audio Spectrum",
	type: "video",
	description: `Convert input audio to a video output, representing the audio frequency spectrum.`,
	props: {
		slide: {
			__name__: "Slide Mode",
			__description__:
				`Specify how the spectrum should slide along the window.
				• replace: the samples start again on the left when they reach the right.
				• scroll: the samples scroll from right to left.
				• fullframe: frames are only produced when the samples reach the right.
				• rscroll: the samples scroll from left to right.
				• lreplace: the samples start again on the right when they reach the left.`,
			__default__: "replace",
			__options__: ["replace", "scroll", "fullframe", "rscroll"],
		},
		scale: {
			__name__: "Scale",
			__description__: `Specify scale used for calculating intensity color values.`,
			__options__: ["lin", "sqrt", "cbrt", "log", "4thrt", "5thrt"],
			__default__: "sqrt",
		},
		fscale: {
			__name__: "Frequency Scale",
			__description__: `Specify frequency scale.`,
			__options__: ["lin", "log"],
			__default__: "lin",
		},
		saturation: {
			__name__: "Saturation",
			__description__: `Set saturation modifier for displayed colors. Negative values provide alternative color scheme. 0 is no saturation at all.`,
			__default__: 1,
			__min__: -10,
			__max__: 10,
		},		
		win_func: {
			__name__: "Window Function",
			__description__: `Set window function.`,
			__options__: ["rect", "bartlett", "hann", "hanning", "hamming", "blackman", "welch", "flattop", "bharris", "bnuttall", "bhann", "sine", "nuttall", "lanczos", "gauss", "tukey", "dolph", "cauchy", "parzen", "poisson", "bohman", "kaiser"],
			__default__: "hann",
		},
		orientation: {
			__name__: "Orientation",
			__description__: `Set orientation of time vs frequency axis. Can be vertical or horizontal.`,
			__options__: ["vertical", "horizontal"],
			__default__: "vertical",
		},
		overlap: {
			__name__: "Overlap",
			__description__: `Set ratio of overlap window. Default value is 0. When value is 1 overlap is set to recommended size for specific window function currently used.`,
			__default__: 0,
			__min__: 0,
			__max__: 1,
		},		
		gain: {
			__name__: "Gain",
			__description__: `Set scale gain for calculating intensity color values.`,
			__default__: 1,
			__min__: 0,
			__max__: 10,
		},
		data:{
			__name__: "Data Type",
			__description__: `Set which data to display. Can be magnitude, default or phase, or unwrapped phase: uphase.`,
			__options__: ["magnitude", "default", "phase", "uphase"],
			__default__: "default",
		},
		rotation: {
			__name__: "Color Rotation",
			__description__: `Set color rotation`,
			__default__: 0,
			__min__: -1,
			__max__: 1,
		},
		start: {
			__name__: "Start Frequency",
			__description__: `Set start frequency from which to display spectrogram.`,
			__default__: 0,
			__min__: 0,
		},
		stop: {
			__name__: "Stop Frequency",
			__description__: `Set stop frequency to which to display spectrogram.`,
			__default__: 0,
			__min__: 0,
		},
		drange: {
			__name__: "Dynamic Range",
			__description__: `Set dynamic range used to calculate intensity color values (dBFS).`,
			__default__: 120,
			__min__: 10,
			__max__: 200,
		},
		limit: {
			__name__: "Volume Limit",
			__description__: `Set upper limit of input audio samples volume (dBFS).`,
			__default__: 0,
			__min__: -100,
			__max__: 100,
		},
		/* overlay: {
			__name__: "Overlay",
			__description__: `Overlay the spectrum on the main video.`,
			__default__: true,
		}, */
		height: {
			__name__: "Height",
			__description__: `Set the height of the spectrum relative to the video height.`,
			__default__: 0.5,
			__min__: 0,
			__max__: 1,
		},
		color: {
			__name__: "Color",
			__description__: `Set the color of the spectrum.`,
			__default__: "#ffffff",
			__type__: "color",
		},
		alpha: {
			__name__: "Alpha",
			__description__: `Set the alpha of the spectrum.`,
			__default__: 1,
			__min__: 0,
			__max__: 1,
		}
	},
	apply(ctx, $) {
		let ar = ctx.aspect_ratio;
		let h = Math.min(720, ctx.height) // cap it at 720 or it lags.
		let w = Math.ceil(h * ar);
		h *= $.height;
		let a1 = ctx.id("a");
		let a2 = ctx.id("a");
		let ss1 = ctx.id("ss");
		ctx.stack.push(
			`[${ctx.aid}]asplit[${a1}][${a2}]`,
			`[${a1}]dynaudnorm,showspectrum=slide=${$.slide}:size=${w}x${h}:scale=${$.scale}:fscale=${$.fscale}:saturation=${$.saturation}:win_func=${$.win_func}:orientation=${$.orientation}:overlap=${$.overlap}:gain=${$.gain}:data=${$.data}:rotation=${$.rotation}:start=${$.start}:stop=${$.stop}:drange=${$.drange}:limit=${$.limit}:fps=${ctx.fps},scale=${ctx.width}:${ctx.height}:force_original_aspect_ratio=decrease[${ss1}]`,
		);
		// if ($.overlay) {
		let c = ctx.colorgen($.color, $.alpha, w, h);
		let am = ctx.alphamerge(c, ss1);
		ctx.vid = ctx.overlay(ctx.vid, am);
		// } else {
		// 	ctx.vid = ss1;
		// }
		ctx.aid = a2;
	}
});
export default showspectrum;