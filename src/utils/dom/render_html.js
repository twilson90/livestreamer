const _temp_div = document.createElement('div');
/** @return {ChildNode[]} */
export function render_html(htmlString) {
    if (typeof htmlString !== "string") return null;
    _temp_div.innerHTML = htmlString.trim();
    return Array.from(_temp_div.childNodes);
}
export { render_html as $ };

export default render_html;