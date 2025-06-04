import * as vite from 'vite';
import {defineConfig} from "vite";
import path from "node:path";
import fs from "fs-extra";
import { glob } from 'glob';
import { builtinModules } from 'module';
import { viteStaticCopy } from "vite-plugin-static-copy";
// import { normalizePath } from 'vite'
import esmShim from '@rollup/plugin-esm-shim';
import { api as forge_api } from "@electron-forge/core";
import finder from "find-package-json";
import open from "open";

// import replace from "@rollup/plugin-replace";
export const dirname = import.meta.dirname;

export const forge_config_path = path.resolve(dirname, "forge.config.cjs");
export const src = path.resolve(dirname, "../src");
export const target = `node22`;
export const format = "esm";
const platforms = ["linux", "win32"];

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

export class API {

    constructor(dir) {
        if (!dir) dir = process.cwd();
        this.out = path.resolve(dir, "out");
        this.dist = path.resolve(dir, "dist");
    }

    async copy_to(srcs, dir) {
        if (!Array.isArray(srcs)) srcs = [srcs];
        for (var src of srcs) {
            var name = path.basename(src);
            await fs.copy(src, path.join(dir, name));
        }
    }

    suppress_warnings() {
        const originalEmit = process.emit;
        process.emit = function (event, error) {
            if (event === 'warning' && error.code == 'DEP0174') {
                return false;
            }
            return originalEmit.apply(process, arguments);
        }
    }

    async config_electron_forge() {
        await this.copy_to(forge_config_path, this.dist);
        this.suppress_warnings();
        process.env.DEBUG = 1;
    }

    /** @returns {Promise<vite.InlineConfig[]>} */
    async generate_configs(opts) {
        opts = {
            input: [],
            external: [],
            entry: path.resolve(src, "index.js"),
            root: src,
            plugins: [],
            /** @type {vite.Plugin[]} */
            vite_plugins: [],
            production: false,
            platform: "windows",
            copy: [],
            ...opts,
        };
        let pkg = { ...finder(src).next().value };
        
        const dist = this.dist;
        
        let roots = [src, opts.root].filter(src=>src);
        roots = [...new Set(roots.map(p=>path.resolve(p)))];

        let user_pkg = finder(opts.root).next().value;
        // let combine_packages = (user_pkg.__path !== pkg.__path);
        
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
        
        var minify = (opts.production) ? true : false;
        var sourcemap = (opts.production) ? false : 'inline';

        // relative to src
        let input = {
            "index": opts.entry,
            "core/index": "./core/index.js",
            "media-server/index": "./media-server/index.js",
            "file-manager/index": "./file-manager/index.js",
            "main/index": "./main/index.js",
            ...opts.input,
        };
        input = Object.fromEntries(Object.entries(input).map(([k,p])=>[k, path.resolve(src, p)]));

        /** @type {vite.AliasOptions} */
        let alias = [];

        let configs = [];
        let platform = opts.platform.match(/^win/i) ? "windows" : "linux";
        let define = {
            "process.env.BUILD": JSON.stringify(1),
        };
        if (opts.production) {
            define["process.env.PRODUCTION"] = "1";
        }
        
        let node_config = defineConfig({
            configFile: false,
            plugins: [
                ...(format.match(/^(cjs|commonjs)$/i) ? [importMetaPlugin()] : []),
                esmShim(),
                viteStaticCopy({
                    targets: [
                        {
                            src: [normalizePath(src, "resources"), ...platforms.filter(p=>p!=platform).map(p=>`!**/${p}`)],
                            dest: path.resolve(dist)
                        },
                        {
                            src: [normalizePath(src, 'pm2.config.cjs')],
                            dest: path.resolve(dist)
                        },
                        {
                            src: [normalizePath(src, 'media-server/assets')],
                            dest: path.resolve(dist, 'media-server')
                        },
                        {
                            src: [normalizePath(src, 'main/assets')],
                            dest: path.resolve(dist, 'main')
                        },
                        {
                            src: [normalizePath(src, 'file-manager/assets')],
                            dest: path.resolve(dist, 'file-manager')
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
                        await fs.writeFile(dist_package_path, JSON.stringify(new_pkg, null, "  "), "utf8");
                        // await fs.rm(glob.sync("dist/bundle.*"));
                    },
                },
                ...opts.vite_plugins
            ],
            define,
            resolve: {
                mainFields: ['module', 'jsnext:main', 'jsnext'],
                conditions: ['node'],
                alias: [
                    { find: "livestreamer", replacement: path.resolve(src, "core/exports.js") },
                    ...alias,
                ]
            },
            
            /* esbuild: {
                minifyIdentifiers: false,
                keepNames: true,
            }, */
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
                sourcemap,
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
                        chunkFileNames: `chunks/[name]-[hash].js`,
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

        var preload = path.join(src, "electron", "preload.cjs");
        let preload_config = defineConfig({
            configFile: false,
            build: {
                minify,
                target,
                ssr: true,
                sourcemap,
                emptyOutDir: false,
                outDir: path.join(dist, "electron"),
                lib: {
                    name: "livestreamer",
                    entry: preload,
                    formats: [format]
                },
                rollupOptions: {
                    input: preload,
                    output: {
                        entryFileNames: `[name].cjs`,
                    },
                    external: [
                        'electron',
                        /^electron\/.+/
                    ],
                }
            }
        });
        configs.push(preload_config);

        for (let name of ["media-server", "file-manager", "main"]) {
            let dir = path.resolve(src, name, "public_html");
            let indexes = glob.sync(`**/index.html`, {cwd: dir, absolute:true});
            let pages = glob.sync(`**/*.html`, {cwd: dir, absolute:true});
            let root_dir = path.resolve(path.dirname(indexes[0]));
            let web_config = defineConfig({
                configFile: false,
                css: {
                    preprocessorOptions: {
                        scss: {
                            api: 'modern-compiler' // or "modern"
                        }
                    }
                },
                plugins: opts.plugins??[],
                // base: `/${name}/`,
                root: root_dir,
                build: {
                    minify,
                    rollupOptions: {
                        input: pages
                    },
                    target: "es2015",
                    emptyOutDir: true,
                    outDir: path.resolve(dist, path.relative(src, dir)),
                    sourcemap: true
                }
            });
            configs.push(web_config);
        }
        return configs;
    }

    async start() {
        await this.config_electron_forge();
        forge_api.start({
            dir: this.dist,
            interactive: true,
        })
    }

    async package() {
        await this.config_electron_forge();
        forge_api.package({
            dir: this.dist,
            outDir: this.out,
            interactive: true,
        })
    }

    async make() {
        await this.config_electron_forge();
        forge_api.make({
            dir: this.dist,
            outDir: this.out,
            interactive: true,
        })
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