import * as vite from 'vite';
import path from "node:path";
import fs from "fs-extra";
import { program } from 'commander';
import { glob } from 'glob';
import { builtinModules } from 'module';
import { viteStaticCopy } from "vite-plugin-static-copy";
import esmShim from '@rollup/plugin-esm-shim';
import { api as electron_api } from "@electron-forge/core";
import pkg from "./package.json" with {type:"json"};
// import find_package from "find-package-json";
// import { externalizeDepsPlugin } from 'electron-vite'

const dirname = import.meta.dirname;
async function copy_to(srcs, dir) {
    if (!Array.isArray(srcs)) srcs = [srcs];
    for (var src of srcs) {
        var name = path.basename(src);
        await fs.copy(src, path.join(dir, name));
    }
}

/* function get_dependencies(dir) {
    var seen = new Set();
    var get = (dir)=>{
        var f = find_package(dir || dirname);
        var curr = f.next();
        if (seen.has(curr.filename)) return [];
        seen.add(curr.filename);
        var pkg = curr.value;
        var deps = Object.keys({
            ...pkg.dependencies,
            ...pkg.devDependencies,
        });
        return [
            ...deps,
            ...deps.flatMap(dep=>get(path.join(curr.filename, `../node_modules/${dep}`)))
        ]
    }
    return [...new Set(get(dir))];
} */

export function generate_configs() {
    var node_version = process.versions.node.split(".")[0];
    var target = `node${node_version}`;
    var format = "cjs"; // "es";
    var production = !!program.opts().production;

    /** @return {vite.Plugin} */
    function finalize_plugin() {
        let output;
        return {
            async buildEnd() {
              output = false;
            },
            async writeBundle(ctx, options, bundle) {
                if (output) return
                output = true;
                let main = glob.sync("index.*", {cwd:"dist"})[0];
                let type = format == "cjs" ? "commonjs" : "module";
                let new_pkg = { ...pkg, main, type };
                await fs.writeFile("dist/package.json", JSON.stringify(new_pkg, null, "  "), "utf8");
                // await fs.rm(glob.sync("dist/bundle.*"));
            },
        }
    };
    function importMetaPlugin() {
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
        };
    }
    /** @type {vite.UserConfig} */
    var node_config = {
        plugins: [
            importMetaPlugin(),
            esmShim(),
            viteStaticCopy({
                targets: [
                    { src: ['src/assets'], dest: path.resolve('dist') },
                    { src: ['src/media-server/assets'], dest: path.resolve('dist/media-server') },
                    { src: ['src/main/assets'], dest: path.resolve('dist/main') },
                    { src: ['src/file-manager/assets'], dest: path.resolve('dist/file-manager') },
                ]
            }),
            finalize_plugin()
        ],
        resolve: {
            browserField: false,
            mainFields: ['module', 'jsnext:main', 'jsnext'],
            conditions: ['node']
        },
        build: {
            assetsDir: 'chunks',
            reportCompressedSize: false,
            minify: (production)?false:'inline',
            commonjsOptions: {
                include: [/node_modules/],
                transformMixedEsModules: true,
            },
            modulePreload: false,
            target,
            ssr: true,
            // ssrEmitAssets: true,
            sourcemap: (production)?false:'inline',
            outDir: "dist",
            lib: {
                name: "livestreamer",
                entry: "src/index.js",
                formats: [format]
            },
            rollupOptions: {
                input: "src/bundle.js",
                /* input: {
                    // "bundle": "src/bundle.js",
                    "index": "src/index.js",
                    "media-server/index": "src/media-server/index.js",
                    "media-server/config.default": "src/media-server/config.default.js",
                    "file-manager/index": "src/file-manager/index.js",
                    "file-manager/config.default": "src/file-manager/config.default.js",
                    // ...Object.fromEntries(glob.sync("src/file-manager/drivers/*").map(f=>[`file-manager/drivers/${path.basename(f, path.extname(f))}`, f])),
                    "main/index": "src/main/index.js",
                    "main/config.default": "src/main/config.default.js",
                }, */
                output: {
                    /* manualChunks: (id) => {
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                        var c = path.relative("src", id).split(path.sep)[0];
                        console.log(id, c);
                        if (c != "..") return c;
                    }, */
                    entryFileNames: `[name].js`,
                    chunkFileNames: `[name].js`,
                    preserveModules: true,
                    preserveModulesRoot: "src",
                },
                external: [
                    'electron',
                    /^electron\/.+/,
                    "pm2", 
                    ...builtinModules.flatMap(m => [m, `node:${m}`])
                ],
            }
        },
        ssr: {
            noExternal: true,
            // optimizeDeps: deps,
            // noExternal: deps,
            // noExternal: glob.sync("*", {cwd:"node_modules"}),
        }
    };
    var web_configs = [
        "src/media-server/public_html/player/index.html",
        "src/file-manager/public_html/index.html",
        "src/main/public_html/index.html"
    ]
        .flatMap((input)=>{
            /** @type {vite.InlineConfig} */
            var a = {
                base: "./",
                root: path.dirname(input),
                build: {
                    target: "es2015",
                    emptyOutDir: true,
                    outDir: path.resolve("dist", path.relative("src", input), ".."),
                    sourcemap: true
                }
            }
            return a;
        });
    return [node_config, ...web_configs];
}

export async function build() {
    for (var config of generate_configs()) {
        await vite.build(config);
    }
}

export async function dev() {
    for (var config of generate_configs()) {
        await vite.createServer(config);
    }
}

export async function _package() {
    // var f = await glob("forge.config.*")[0];
    // await fs.copy(f, path.join("dist", f));
    await fs.copy("forge.config.cjs", "dist/forge.config.cjs");
    electron_api.package({
        dir: path.resolve("dist"),
        interactive: true
    })
}

program.name('Live Streamer Builder')
program.command("build").action(build)
program.command("dev").action(dev)
program.command("package").action(_package)
program.option(`-p --production`, "Production");
program.parse();