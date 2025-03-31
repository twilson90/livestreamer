export const path_separator_regex = /[\\\/]+/g;
export const emoji_regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;

export const TIME_DIVIDERS = {
	d: 24 * 60 * 60 * 1000,
	h: 60 * 60 * 1000,
	m: 60 * 1000,
	s: 1000,
};

export const Ease = {
	// no easing, no acceleration
	linear: t => t,
	// accelerating from zero velocity
	inQuad: t => t * t,
	// decelerating to zero velocity
	outQuad: t => t * (2 - t),
	// acceleration until halfway, then deceleration
	inOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
	// accelerating from zero velocity 
	inCubic: t => t * t * t,
	// decelerating to zero velocity 
	outCubic: t => (--t) * t * t + 1,
	// acceleration until halfway, then deceleration 
	inOutCubic: t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
	// accelerating from zero velocity 
	inQuart: t => t * t * t * t,
	// decelerating to zero velocity 
	outQuart: t => 1 - (--t) * t * t * t,
	// acceleration until halfway, then deceleration
	inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
	// accelerating from zero velocity
	inQuint: t => t * t * t * t * t,
	// decelerating to zero velocity
	outQuint: t => 1 + (--t) * t * t * t * t,
	// acceleration until halfway, then deceleration 
	inOutQuint: t => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
};

export const mime_ext_map = {
    image: ["jpeg", "jpg", "png", "bmp", "webp", "tif", "tiff", "svg", "ico", "gif"],
    video: ["mp4", "mkv", "mov", "m4v", "avi", "mpeg", "ogv", "ts", "webm", "3gp", "3g2", "gif"],
    audio: ["mp3", "wav", "flac", "m4a", "aac", "oga", "opus", "weba", "3gp", "3g2"],
    text: ["idx", "sup", "srt", "ass", "txt", "sub"],
}