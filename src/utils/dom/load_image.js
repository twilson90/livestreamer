/** @param {string} src */
export function load_image(src) {
    var on_resolve, on_reject, img = new Image();
    return new Promise((resolve, reject) => {
        img.src = src;
        img.addEventListener("load", on_resolve = () => resolve(img));
        img.addEventListener("error", on_reject = () => reject());
    }).finally(() => {
        img.removeEventListener("load", on_resolve);
        img.removeEventListener("error", on_reject);
    });
}

export default load_image;