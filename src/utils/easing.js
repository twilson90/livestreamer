// no easing, no acceleration
export const linear = t => t;
// accelerating from zero velocity
export const inQuad = t => t * t;
// decelerating to zero velocity
export const outQuad = t => t * (2 - t);
// acceleration until halfway, then deceleration
export const inOutQuad = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
// accelerating from zero velocity 
export const inCubic = t => t * t * t;
// decelerating to zero velocity 
export const outCubic = t => (--t) * t * t + 1;
// acceleration until halfway, then deceleration 
export const inOutCubic = t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
// accelerating from zero velocity 
export const inQuart = t => t * t * t * t;
// decelerating to zero velocity 
export const outQuart = t => 1 - (--t) * t * t * t;
// acceleration until halfway, then deceleration
export const inOutQuart = t => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
// accelerating from zero velocity
export const inQuint = t => t * t * t * t * t;
// decelerating to zero velocity
export const outQuint = t => 1 + (--t) * t * t * t * t;
// acceleration until halfway, then deceleration 
export const inOutQuint = t => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t;