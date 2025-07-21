import { Filter } from "../Filter.js";

export const vignette = new Filter({
    name: "vignette",
    descriptive_name: "Vignette",
    type: "video",
    description: `Make or reverse a natural vignetting effect.`,
    presets: {
        "Flickering": {
            angle_expr: "PI/4+random(1)*PI/50",
            eval: "frame",
        }
    },
    props: {
        angle: {
            __name__: "Angle",
            __description__: "Lens angle as a number of radians. The value is clipped in the [0,PI/2] range.",
            __default__: 0.62831853071,
            __min__: 0,
            __max__: 1.57079632679,
        },
        angle_expr: {
            __name__: "Angle Expression",
            __description__: "Lens angle expression.",
        },
        x0: {
            __name__: "Center X",
            __description__: "Center x-coordinate expression.",
            __default__: 0.5,
            __min__: 0,
            __max__: 1
        },
        y0: {
            __name__: "Center Y", 
            __description__: "Center y-coordinate expression.", 
            __default__: 0.5,
            __min__: 0,
            __max__: 1
        },
        mode: {
            __name__: "Mode",
            __description__: "Set forward/backward mode. In forward mode, the image gets darker further from center. In backward mode, the image gets brighter further from center.",
            __default__: "forward",
            __options__: ["forward", "backward"]
        },
        eval: {
            __name__: "Evaluation Mode",
            __description__: "Evaluation mode for expressions (angle, x0, y0). 'init' evaluates once during initialization, 'frame' evaluates per frame but is slower.",
            __default__: "init",
            __options__: ["init", "frame"]
        },
        dither: {
            __name__: "Dither",
            __description__: "Enable dithering to reduce circular banding effects.",
            __default__: 1,
            __min__: 0,
            __max__: 1
        },
        aspect: {
            __name__: "Aspect Ratio",
            __description__: "Vignette aspect ratio. Set to input SAR for rectangular vignetting matching video dimensions.",
            __default__: 1,
            __min__: 0,
        }
    },
    apply(ctx, $) {
        let v1 = ctx.id("v");
        $.angle_expr = String($.angle_expr || "").trim();
        var args = [`x0=w*${$.x0}`, `y0=h*${$.y0}`, `mode=${$.mode}`, `eval=${$.eval}`, `dither=${$.dither}`, `aspect=${$.aspect}`];
        if ($.angle_expr) args.push(`angle=${$.angle_expr}`);
        ctx.stack.push(`[${ctx.vid}]vignette=${args.join(":")}[${v1}]`);
        ctx.vid = v1;
    }
});

export default vignette;