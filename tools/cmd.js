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

program.command("generate_google_drive_offline_refresh_token")
    .description("Generate a Google Drive offline refresh token")
    .option(`--client_id <string>`, "Client ID")
    .option(`--client_secret <string>`, "Client Secret")
    .action(({client_id, client_secret})=>api.generate_google_drive_offline_refresh_token({client_id, client_secret}));

program.parse();

async function build() {
    var opts = {...program.opts()};
    var configs = await api.generate_configs(opts);
    for (var c of configs) {
        await vite.build(c);
    }
}