/** @param {Element} elem @param {string} value */
export function toggle_display(elem, value) {
    if (elem.style.display === "none" && value) elem.style.display = "";
    else if (!value) elem.style.display = "none";
    else elem.style.display = value;
}

export default toggle_display;