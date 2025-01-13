import path from "node:path";

const dirname = import.meta.dirname;
const app_js = path.resolve(dirname, "main/public_html/app.js");

/** @param {string[]} plugins @return {import("vite").PluginOption} */
export default function(plugins) {
    return {
        transform(code, id) {
            if (path.resolve(id) === app_js) {
                // code = code.replace(/process\.platform/g, process.platform)
                code += `\nplugins=[${plugins.map((p)=>`import(${JSON.stringify(path.resolve(p))})`).join(", ")}];`;
                return code;
            }
        }
    };
}