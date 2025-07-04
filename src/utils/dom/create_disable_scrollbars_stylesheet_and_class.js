import {uuidb64} from "./uuidb64.js";
import {$} from "./render_html.js";

export function create_disable_scrollbars_stylesheet_and_class() {
    var disable_scroll_class = `disable-scroll-${uuidb64()}`;
    var disable_scroll_style = $(`<style>.${disable_scroll_class} { overflow: hidden; }</style>`)[0]; // position: fixed;height: 100%;
    document.head.append(disable_scroll_style);
    return disable_scroll_class;
};

export default create_disable_scrollbars_stylesheet_and_class;