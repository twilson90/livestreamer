import { program } from 'commander';
import {API, vite} from "./api.js";
    
const api = new API();

program.name('Live Streamer Builder')
    .option(`-p --production`, "Production")
    .option(`--platform <string>`, "Platform", "windows")

program.command("build").action(()=>build());
program.command("start").action(()=>api.start());
program.command("package").action(()=>api.package());
program.command("make").action(()=>api.make());

program.parse();

async function build() {
    var opts = {...program.opts()};
    var configs = await api.generate_configs(opts);
    for (var c of configs) {
        // c.build.watch = watch;
        await vite.build(c);
    }
}