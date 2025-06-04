export function force_reflow(element) {
    void element.offsetWidth; // This triggers a layout recalculation
}

export default force_reflow;