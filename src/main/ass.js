import Color from "color";

/** @param {width:number, height:number} meta @param {(AssStyle|AssStyle[])} styles @param {(AssEvent|AssEvent[])} events */
export function create(meta, styles, events) {
    meta = {...meta};
    if (!Array.isArray(events)) events = [events];
    if (!Array.isArray(styles)) styles = [styles];
    styles = styles.map(s=>style(s));
    events = events.map(e=>event(e));
    return `[Script Info]
ScriptType: v4.00+
WrapStyle: ${meta.wrap_style??2}
ScaledBorderAndShadow: ${(meta.scaled_border_and_shadow??true)?"yes":"no"}
YCbCr Matrix: ${meta.ycbcr_matrix??"None"}
PlayResX: ${meta.width||384}
PlayResY: ${meta.height||288}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles.join("\n")}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}`;
}

/** @typedef {{style:string, fade_in: number, fade_out: number, rotation: [number,number,number], start: number, end: number, text: string}} AssEvent */
/** @param {AssEvent} o */
export function event(o) {
    var props = [
        o.layer||0,
        time(o.start||0),
        time(o.end||0),
        o.style||"Default",
        o.name||"",
        o.margin_l||0,
        o.margin_r||0,
        o.margin_v||0,
        o.effect||"",
        o.text||""
    ]
    return `Dialogue: ${props.join(",")}`;
}

/** @typedef {{style: string, font: string, size: number, color: number, secondary_color: number, outline_color: number, shadow_color: number, bold: number, italic: number, underline: number, spacing: number, outline_thickness: number, shadow_depth: number, alignment: number, margin_l: number, margin_r: number, margin_v: number, encoding: number, border_style: number, angle: number, scale_x: number, scale_y: number, strike_out: number}} AssStyle */
/** @param {AssStyle} o */
export function style(o) {
    if (!o) o = {};
    var props = [
        o.style ?? "Default",
        o.font ?? "Arial",
        o.size ?? 24,
        color(o.color ?? 0xffffff),
        color(o.secondary_color ?? o.color ?? 0xffffff),
        color(o.outline_color ?? 0x000000),
        color(o.shadow_color ?? 0x000000),
        (+o.bold ?? 0)*-1,
        (+o.italic ?? 0)*-1,
        (+o.underline ?? 0)*-1,
        (+o.strike_out ?? 0)*-1,
        (o.scale_x ?? 1)*100,
        (o.scale_y ?? 1)*100,
        o.spacing ?? 0,
        o.angle ?? 0,
        o.border_style ?? 1,
        o.outline_thickness ?? 1,
        o.shadow_depth ?? 0,
        o.alignment ?? 2,
        o.margin_l ?? 10,
        o.margin_r ?? 10,
        o.margin_v ?? 10,
        o.encoding ?? 1
    ]
    return `Style: ${props.join(", ")}`;
}
export function text(txt) {
    return (txt||"").replace(/\r?\n/g, "\\N");
}
export function fade(fade_in=0, fade_out=0) {
    fade_in = +(fade_in || 0);
    fade_out = +(fade_out || 0);
    if (fade_in || fade_out) return `{\\fad(${fade_in*1000},${fade_out*1000})}`;
    return "";
}
export function rotate(x=0, y=0, z=0) {
    if (x || y || z) return `{\\frx${x||0}}{\\fry${y||0}}{\\frz${-(z||0)}}`;
    return "";
}
export function time(a) {
    let h = Math.floor(a/(60*60*1000));
    a -= h*(60*60*1000);
    let m = Math.floor(a/(60*1000));
    a -= m*(60*1000);
    let s = Math.floor(a/1000);
    a -= s*1000;
    a = Math.floor(a/10);
    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(a).padStart(2,"0")}`;
}
export function color(color) { //rrggbbaa
    var c = Color(color);
    // ass color is in BBGGRR or AABBGGRR format
    // (1-c.alpha())*255, 
    return  `&H${[c.blue(), c.green(), c.red()].map(n=>n.toString(16).padStart(2,"0").toUpperCase()).join("")}`;
}
