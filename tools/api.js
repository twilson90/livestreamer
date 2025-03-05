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
import replace from "@rollup/plugin-replace";
export const dirname = import.meta.dirname;

export const forge_config_path = path.resolve(dirname, "forge.config.cjs");
export const src = path.resolve(dirname, "../src");
export const node_version = process.versions.node.split(".")[0];
export const target = `node${node_version}`;
export const format = "cjs";
const platforms = ["linux", "win32"];

export function normalizePath(...args) {
    return path.resolve(...args).replace(/\\/g, "/");
}

/** @return {vite.Plugin} */
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

export default class {

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

    /** @return {Promise<vite.InlineConfig[]>} */
    async generate_configs(opts) {
        opts = {
            input: [],
            external: [],
            entry: path.resolve(src, "index.js"),
            root: src,
            plugins: [],
            production: false,
            platform: "windows",
            ...opts,
        };
        let pkg = { ...finder(src).next().value };
        
        const dist = this.dist;
        // const format = "es";
        
        let roots = [src, opts.root].filter(src=>src);
        roots = [...new Set(roots.map(p=>path.resolve(p)))];

        let user_pkg = finder(opts.root).next().value;
        let combine_packages = (user_pkg.__path !== pkg.__path);

        // Object.assign(pkg.devDependencies, user_pkg.devDependencies);
        pkg.type = format.match(/^(cjs|commonjs)$/i) ? "commonjs" : "module";

        // delete pkg.devDependencies;
        delete pkg.exports;
        delete pkg.bin;
        
        var minify = (opts.production) ? true : false;
        var sourcemap = (opts.production) ? false : 'inline';

        let input = [
            "core/exports.js",
            "media-server/index.js",
            "main/index.js",
            "file-manager/index.js",
        ]

        input = [...new Set([
            ...input.map(p=>path.resolve(src,p)),
            opts.entry,
            ...opts.input,
        ])].filter(p=>p);

        /** @type {vite.AliasOptions} */
        let alias = [];
        if (combine_packages) {
            for (let k in user_pkg.dependencies) {
                if (k === "livestreamer") continue;
                if (!(k in pkg.dependencies)) {
                    pkg.dependencies[k] = user_pkg.dependencies[k];
                }
                let p = path.resolve(dirname, "../node_modules", k);
                if (user_pkg.dependencies[k] == pkg.dependencies[k] && fs.existsSync(p)) {
                    // removes duplicates, assumes dependencies are the same version, may lead to breaks so be careful!
                    alias.push({ find:k, replacement:p });
                }
            }
        }

        let configs = [];
        let platform = opts.platform.match(/^win/i) ? "windows" : "linux";
        let define = {
            "process.env.BUILD": JSON.stringify(1),
        };
        if (opts.production) {
            define["process.env.PRODUCTION"] = "1";
        }
        let node_config = defineConfig({
            plugins: [
                /* {
                    renderDynamicImport(options) {
                        if (options.format === "cjs") {
                            if (options.targetModuleId == normalizePath("src/electron/index.js")) {
                                return {left:"require(", right:")"}
                            }
                        }
                    }
                }, */
                
                // {
                //     /* renderDynamicImport(options) {
                //         if (options.format === "cjs" && options.targetModuleId == normalizePath(src, "electron/index.js")) {
                //             return {left:"require(", right:")"}
                //         }
                //     }, */
                //     // transform(code, id) {
                //     //     if (format === "cjs" && id === normalizePath(src, "index.js")) {
                //     //         code = code.replace(/await\s+import\s*\((.+)\)/g, "import(")
                //     //         return { code, map: null };
                //     //     }
                //     // },
                //     // renderChunk(code, chunk, opts, meta) {
                //     //     if (chunk.moduleIds.includes(normalizePath(src, "index.js"))) {
                //     //         code = code.replace(`await import`, "require")
                //     //     }
                //     //     return { code, map: null };
                //     // }
                //     transform(code, id) {
                //         if (format === "cjs" && id === normalizePath(src, "index.js")) {
                //             code = code.replace(/await\s+import\s*\((.+)\)/g, "require($1); import($1)");
                //             return { code, map: null };
                //         }
                //     },
                // },
                importMetaPlugin(),
                esmShim(),
                viteStaticCopy({
                    targets: [
                        {
                            src: [normalizePath(src, "resources"), platforms.filter(p=>p!=platform).map(p=>`!**/${p}`)],
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
                    ]
                }),
                {
                    async writeBundle(ctx, options, bundle) {
                        let dist_package_path = path.resolve(dist, "package.json");
                        let main = glob.sync("index.*", {cwd: dist})[0];
                        let new_pkg = { ...pkg, main };
                        // delete new_pkg.dependencies;
                        // delete new_pkg.__path;
                        await fs.writeFile(dist_package_path, JSON.stringify(new_pkg, null, "  "), "utf8");
                        // await fs.rm(glob.sync("dist/bundle.*"));
                    },
                }
            ],
            define,
            resolve: {
                browserField: false,
                mainFields: ['module', 'jsnext:main', 'jsnext'],
                conditions: ['node'],
                alias: [
                    { find: "livestreamer", replacement: path.resolve(src, "core/exports.js") },
                    ...alias,
                ]
            },
            build: {
                assetsDir: 'chunks',
                reportCompressedSize: false,
                minify,
                commonjsOptions: {
                    include: [/node_modules/],
                    transformMixedEsModules: true,
                },
                modulePreload: false,
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
                        chunkFileNames: `[name].js`,
                        // exports: "named", // disables warning // but fucks up config files
                        entryFileNames(chunkInfo) {
                            // var {isEntry, isDynamicEntry, isImplicitEntry} = chunkInfo;
                            // console.log(chunkInfo.name, {isEntry, isDynamicEntry, isImplicitEntry})
                            var parts = chunkInfo.name.split("/");
                            var name = chunkInfo.name;
                            if (parts[0] !== "_virtual") {
                                if (chunkInfo.name.includes("node_modules")) {
                                    name = parts.slice(parts.findIndex(p=>p==="node_modules")).join("/")
                                } else {
                                    // what is this about again?
                                    var rels = roots.map(r=>path.relative(r, chunkInfo.facadeModuleId)).sort((a,b)=>a.length-b.length);
                                    name = rels[0].replace(/\.[^.]+$/, "");
                                }
                            }
                            return `${name}.js`;
                        },
                        preserveModules: true,
                        // preserveModulesRoot: config.root,
                    },
                    external: [
                        'vite',
                        'electron',
                        /^electron\/.+/,
                        "pm2",
                        "bufferutil",
                        "utf-8-validate",
                        ...builtinModules.flatMap(m => [m, `node:${m}`]),
                        ...opts.external,
                    ],
                }
            },
            ssr: {
                noExternal: true,
                // optimizeDeps: deps,
                // noExternal: deps,
                // noExternal: glob.sync("*", {cwd:"node_modules"}),
            }
        });
        configs.push(node_config);

        var preload = path.join(src, "electron", "preload.cjs");
        let preload_config = defineConfig({
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
                plugins: opts.plugins??[],
                base: `/${name}/`,
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
        for (var c of configs) {
            c.configFile = false;
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
}

export {vite, esmShim, viteStaticCopy, defineConfig};