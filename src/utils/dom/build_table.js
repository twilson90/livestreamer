import { $ } from "./render_html.js";

/** @returns {HTMLTableElement} */
export function build_table(datas, opts) {
    opts = Object.assign({
        header: true,
        empty: "No Data"
    }, opts);
    var thead = "";
    var header = opts.header;
    if (typeof header == "boolean") {
        if (datas.length) header = Object.fromEntries(Object.keys(datas[0]).map(k => [k, k]));
        else header = {};
    }
    header = Object.fromEntries(Object.entries(header).map(([k, h]) => [k, (typeof h === "string") ? { name: h } : h]));
    var num_headers = Object.keys(header).length;
    thead = num_headers ? `<thead><tr>${Object.values(header).map((h) => `<th style="${h.style || ""}">${h.name}</th>`).join("")}</tr></thead>` : ``;
    var tbody = `<tbody>${datas.length ? datas.map(d => `<tr>${Object.keys(header).map((k) => `<td style="${header[k].style || ""}">${d[k]}</td>`).join("")}</tr>`).join("") : `<td class="empty" colspan="${num_headers || 1}" style="text-align:center">${opts.empty}</td>`}</tbody>`;
    var html = `<table>${thead}${tbody}</table>`;
    return $(html)[0];
}

export default build_table;