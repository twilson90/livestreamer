import { defineConfig } from 'electron-vite';
import path from "node:path";
import { glob } from "glob";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    main: {
        plugins: [
            viteStaticCopy({
                targets: [
                    { src: 'src/assets', dest: path.resolve('dist') },
                    { src: ['src/media-server/assets', 'src/media-server/config.default.js'], dest: path.resolve('dist/media-server') },
                    { src: ['src/main/assets', 'src/main/config.default.js'], dest: path.resolve('dist/main') },
                    { src: ['src/file-manager/assets', 'src/file-manager/config.default.js'], dest: path.resolve('dist/file-manager') },
                ]
            })
        ],
        entry: 'src/index.js',
        build: {
            outDir: './dist',
            // sourcemap: true,
            rollupOptions: {
                input: {
                    // "index": 'src/index.js',
                    "bundle": "src/bundle.js"

                    // "media-server/index": 'src/media-server/index.js',
                    // "media-server/config.default": 'src/media-server/config.default.js',
                    // "file-manager/index": 'src/file-manager/index.js',
                    // "file-manager/config.default": 'src/file-manager/config.default.js',
                    // "main/index": 'src/main/index.js',
                    // "main/config.default": 'src/main/config.default.js',

                    // ...Object.fromEntries(glob.sync("src/file-manager/drivers/*").map(f=>[`file-manager/drivers/${path.basename(f, path.extname(f))}`, f]))
                },
                output: {
                    preserveModules: true,
                    preserveModulesRoot: "src",
                },
                external: ["pm2"],
            }
        },
        ssr: {
            noExternal: true
        }
    },
    preload: {
        build: {
            emptyOutDir: false,
            outDir: './dist',
            sourcemap: true,
            rollupOptions: {
                input: {
                    "preload": 'src/electron/preload.cjs'
                }
            }
        }
    }
});