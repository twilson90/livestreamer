import * as vite from 'vite';
import {defineConfig} from "vite";
import path from "node:path";
import fs from "node:fs";
import { glob } from 'glob';
import { builtinModules } from 'module';
import { viteStaticCopy } from "vite-plugin-static-copy";
// import { normalizePath } from 'vite'
import esmShim from '@rollup/plugin-esm-shim';
import { api as forge_api } from "@electron-forge/core";
import finder from "find-package-json";
import open from "open";
import { createHash } from "node:crypto";
// import replace from "@rollup/plugin-replace";
export const dirname = import.meta.dirname;

export const root = path.dirname(dirname);
export const target = `node22`;
export const format = "commonjs";
export const platforms = ["linux", "win32"];
export const js_exts = [`js`,`ts`,`cjs`,`mjs`,`cts`,`mts`];
export const js_exts_str = js_exts.join(",");

const default_opts = {
    input: [],
    external: [],
    entry: "",
    mode: "development",
    plugins: [],
    /** @type {vite.Plugin[]} */
    vite_plugins: [],
    platform: "win32",
    copy: [],
    define: {},
};

export function get_index_file(src, dir = ".") {
    var p = glob.sync(`${dir.replace(/\\/g, "/")}/index*.{${js_exts_str}}`, {absolute:true, cwd:src}).sort()[0];
    var dirname = path.basename(dir);
    var ext = path.extname(p);
    var name = path.basename(p, ext);
    return { [dirname+"/"+name]: p };
}

export function normalizePath(...args) {
    return path.resolve(...args).replace(/\\/g, "/");
}

/** @returns {vite.Plugin} */
export function importMetaPlugin() {
    return {
        resolveImportMeta(property, { format }) {
            if (property === 'url' && format === 'cjs') {
                return `require("url").pathToFileURL(__filename).href`;
            }
            if (property === 'filename' && format === 'cjs') {
                return `__filename`;
            }
            if (property === 'dirname' && format === 'cjs') {
                return `__dirname`;
            }
            return null;
        }
    }
}

export function md5(str) {
    return createHash('md5').update(str).digest('hex');
}

export class API {

    /* suppress_warnings() {
        const originalEmit = process.emit;
        process.emit = function (event, error) {
            if (event === 'warning' && error.code == 'DEP0174') {
                return false;
            }
            return originalEmit.apply(process, arguments);
        }
    } */

    /** @param {typeof default_opts} opts @returns {Promise<vite.InlineConfig[]>} */
    async generate_configs(dist, opts) {
        let src = path.resolve(root, "src");
        dist = dist || path.resolve(root, "dist");
        opts = { ...default_opts, ...opts };
        
        let is_production = opts.mode === "production";
        let pkg = { ...finder(src).next().value };
        
        let external = [
            'vite',
            'electron',
            /^electron\/.+/,
            "pm2",
            "sharp",
            "ws",
            // "bufferutil",
            // "utf-8-validate",
            ...builtinModules.flatMap(m => [m, `node:${m}`]),
            ...opts.external,
        ];

        // Object.assign(pkg.devDependencies, user_pkg.devDependencies);
        pkg.type = format.match(/^(cjs|commonjs)$/i) ? "commonjs" : "module";

        // delete pkg.devDependencies;
        delete pkg.exports;
        delete pkg.bin;
        
        var minify = (is_production) ? true : false;

        // relative to src
        let input = {
            "index": opts.entry || Object.values(get_index_file(src))[0],
            ...get_index_file(src, `core`),
            ...get_index_file(src, `media-server`),
            ...get_index_file(src, `file-manager`),
            ...get_index_file(src, `main`),
            ...get_index_file(src, `electron`),
            ...opts.input,
        };
        input = Object.fromEntries(Object.entries(input).map(([k,p])=>[k, path.resolve(src, p)]));

        /** @type {vite.AliasOptions} */
        let alias = [];

        let configs = [];
        let platform = opts.platform.match(/^win/i) ? "win32" : "linux";
        var date_str = new Date().toISOString().split("T").join("-").split(":").join("-").slice(0,-5);
        let define = {
            "import.meta.env.BUILD": JSON.stringify(1),
            "import.meta.env.BUILD_DATE": JSON.stringify(date_str),
            "import.meta.env.BUILD_VERSION": JSON.stringify(`${pkg.version}-${md5(date_str)}`),
        };
        
        let node_config = defineConfig({
            mode: opts.mode,
            configFile: false,
            plugins: [
                ...(format.match(/^(cjs|commonjs)$/i) ? [importMetaPlugin()] : []),
                esmShim(),
                viteStaticCopy({
                    targets: [
                        // {
                        //     src: [normalizePath(src, "resources"), ...platforms.filter(p=>p!=platform).map(p=>`!**/${p}`)],
                        //     dest: path.resolve(dist)
                        // },
                        {
                            src: [normalizePath(root, "resources")],
                            dest: path.resolve(dist)
                        },
                        {
                            src: [normalizePath(src, "pm2.config.cjs")],
                            dest: path.resolve(dist)
                        },
                        {
                            src: [normalizePath(src, "electron/preload.cjs")],
                            dest: path.resolve(dist, "electron")
                        },
                        ...opts.copy,
                    ]
                }),
                {
                    async writeBundle(ctx, options, bundle) {
                        let dist_package_path = path.resolve(dist, "package.json");
                        let main = glob.sync("index.*", {cwd: dist})[0];
                        let new_pkg = { ...pkg, main };
                        delete new_pkg.devDependencies;
                        delete new_pkg.__path;
                        new_pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).filter(([k,v])=>external.includes(k)));
                        delete new_pkg.scripts;
                        await fs.promises.writeFile(dist_package_path, JSON.stringify(new_pkg, null, "  "), "utf8");
                        // await fs.promises.rm(glob.sync("dist/bundle.*"));
                    },
                },
                ...opts.vite_plugins
            ],
            define,
            resolve: {
                mainFields: ['module', 'jsnext:main', 'jsnext'],
                conditions: ['node'],
                alias: [
                    // { find: /^livestreamer(\/|$)/, replacement: path.resolve(path.dirname(src), "$1") },
                    ...alias,
                ]
            },
            esbuild: {
                // this was commented out, not sure why?
                minifyIdentifiers: false,
                keepNames: true,
            },
            build: {
                assetsDir: 'chunks',
                reportCompressedSize: false,
                minify,
                commonjsOptions: {
                    include: [/node_modules/],
                    transformMixedEsModules: true,
                },
                // modulePreload: false,
                target,
                ssr: true,
                sourcemap: "inline",
                outDir: dist,
                lib: {
                    name: "livestreamer",
                    entry: opts.entry,
                    formats: [format]
                },
                rollupOptions: {
                    input,
                    output: {
                        dir: dist,
                        format: format,
                        chunkFileNames: `chunks/[hash].js`,
                        exports: "named", // disables warning
                    },
                    external,
                }
            },
            ssr: {
                noExternal: true,
            }
        });
        configs.push(node_config);

        for (let name of ["media-server", "file-manager", "main"]) {
            let dir = path.resolve(src, name, "public_html");
            let indexes = glob.sync(`**/index.html`, {cwd: dir, absolute:true});
            for (let index of indexes) {
                let root_dir = path.resolve(path.dirname(index));
                // var rel = path.relative(dir, root_dir);
                let pages = glob.sync(`*.html`, {cwd: root_dir, absolute:true});
                let web_config = defineConfig({
                    mode: opts.mode,
                    configFile: false,
                    css: {
                        preprocessorOptions: {
                            scss: {
                                api: 'modern-compiler', // or "modern"
                                quietDeps: true,
                            }
                        }
                    },
                    plugins: opts.plugins??[],
                    base: `./`,
                    root: root_dir,
                    build: {
                        minify,
                        rollupOptions: {
                            input: pages
                        },
                        target: "es2015",
                        emptyOutDir: true,
                        outDir: path.resolve(dist, path.relative(src, root_dir)),
                        sourcemap: true
                    }
                });
                configs.push(web_config);
            }
        }
        return configs;
    }

    async generate_google_drive_offline_refresh_token({client_id, client_secret}) {
        if (!client_id || !client_secret) {
            throw new Error("Client ID and Client Secret are required");
        }
        var http = await import("node:http");
        var Drive = await import("@googleapis/drive");
        var redirect_uri = "http://localhost:3000";
        var client = new Drive.auth.OAuth2(client_id, client_secret, redirect_uri);

        var url = client.generateAuthUrl({
            access_type: "offline",
            scope: ["https://www.googleapis.com/auth/drive"],
            client_id,
            response_type: "code",
            redirect_uri,
        })

        open(url);

        var code = await new Promise(resolve=>{
            http.createServer((req, res)=>{
                if (req.url.includes("code")) {
                    var url = new URL(req.url, "http://localhost");
                    var code = url.searchParams.get("code");
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.end(code);
                    resolve(code);
                }
            }).listen(3000);
        });
        var token = await client.getToken(code);
        console.log("Your refresh token is:");
        console.log(token.tokens.refresh_token);
        process.exit(0);
    }
}

export {vite, esmShim, viteStaticCopy, defineConfig};

export default API;