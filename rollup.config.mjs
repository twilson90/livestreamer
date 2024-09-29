import terser from '@rollup/plugin-terser';
import babel from '@rollup/plugin-babel';
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import sass from 'rollup-plugin-sass';
import path from "node:path";
import {glob} from "glob";
import file_url from "file-url";

const PROD = !!(process.env.NODE_ENV||"").match(/PRODUCTION/i);

var entries = [
    ...[
        ['./modules/main/public_html/src/core.js'],
        ['./modules/main/public_html/src/app.js', {core:path.resolve('./modules/main/public_html/src/core.js')}],
        ['./modules/media-server/public_html/player/src/core.js'],
        ['./modules/media-server/public_html/player/src/app.js', {core:path.resolve('./modules/media-server/public_html/player/src/core.js')}],
        ['./modules/file-manager/public_html/src/app.js']
    ].map(([input, externals])=>{
        if (!externals) externals = {};
        var output = path.join(path.resolve(input, "../../dist"), path.basename(input, path.extname(input)+".js"));
        /** @type {import("rollup").RollupFileOptions} */
        return {
            input,
            external: [ ...Object.values(externals) ],
            output: {
                file: output,
                format: 'iife',
                name: path.basename(input, ".js").replace(/[^a-zA-Z0-9_]+/g, "_"),
                sourcemap: true,
                globals: Object.fromEntries(Object.entries(externals).map(s=>s.reverse()))
            }
        }
    }),
    ...(await Promise.all(glob.sync("modules/*/rollup.entries.{js,mjs}").map(async f=>(await import(file_url(f))).default))).flat()
];

export default entries.map(entry=>{
    return {
        ...entry,
        onwarn(warning, warn) {
          if (warning.code !== 'EVAL') warn(warning)
        },
		watch: true,
        plugins: [
            postcss({extract:true, minimize: PROD, sourceMap: true}),
            sass({output: true}),
            ...(entry.plugins ?? []),
            ...(PROD
                ? [babel({
                    presets: ["@babel/preset-env"],
                    exclude: [/node_modules/],
                    skipPreflightCheck: true,
                    babelHelpers: 'runtime'
                })]
                : []
            ),
            resolve(),
            commonjs(),
            ...(PROD
                ? [terser({
                    ecma: '5',
                    compress: true,
                    // mangle: true,
                })]
                : []
            ),
            ...(entry.plugins??[]),
        ],
	};
});