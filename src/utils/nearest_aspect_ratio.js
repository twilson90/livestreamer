/** @typedef {{name:string, value:number, description:string}} AspectRatio */  
  
  // Expanded list of aspect ratios
export const COMMON_ASPECT_RATIOS = [
    { name: '32:9', value: 32 / 9, description: "Super Ultrawide" },
    { name: '21:9', value: 21 / 9, description: "Ultrawide" },
    { name: '19.5:9', value: 19.5 / 9, description: "Modern smartphones" },
    { name: '18:9', value: 18 / 9, description: "2:1" },
    { name: '17:9', value: 17 / 9, description: "DCI standard" },
    { name: '16:10', value: 16 / 10, description: "Widescreen monitors" },
    { name: '16:9', value: 16 / 9, description: "Standard HD" },
    { name: '5:3', value: 5 / 3, description: "WXGA" },
    { name: '3:2', value: 3 / 2, description: "DSLR, old tablets" },
    { name: '4:3', value: 4 / 3, description: "SD TV" },
    { name: '5:4', value: 5 / 4, description: "Old monitors" },
    { name: '1:1', value: 1, description: "Square" },
    { name: '9:16', value: 9 / 16, description: "Vertical video" },
    { name: '2.39:1', value: 2.39 / 1, description: "CinemaScope" },
    { name: '2.35:1', value: 2.35 / 1, description: "Widescreen cinema" },
    { name: '2.20:1', value: 2.20 / 1, description: "70mm film" },
    { name: '2:1', value: 2 / 1, description: "Univisium" },
    { name: '1.85:1', value: 1.85 / 1, description: "Theatrical widescreen" },
    { name: '1.43:1', value: 1.43 / 1, description: "IMAX" },
].sort((a, b) => a.value - b.value);

/** @return {AspectRatio} */
export function nearest_aspect_ratio(aspect) {
    let closest = COMMON_ASPECT_RATIOS[0];
    let minDiff = Math.abs(aspect - closest.value);

    for (let i = 1; i < COMMON_ASPECT_RATIOS.length; i++) {
        const diff = Math.abs(aspect - COMMON_ASPECT_RATIOS[i].value);
        if (diff < minDiff) {
            minDiff = diff;
            closest = COMMON_ASPECT_RATIOS[i];
        }
    }

    return closest;
}


export default nearest_aspect_ratio;