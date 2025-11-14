import { program, Option } from 'commander';
import child_process from 'child_process';
import fs from 'fs';

import {API, vite} from "./api.js";
    
const api = new API();

program.name('Live Streamer Builder')

program.command("build")
    .option(`--mode <string>`, "Mode", "development")
    .option(`--platform <string>`, "Platform", "windows")
    .action(build);

program.command("package-electron")
    .addOption(new Option(`--platform <string>`, "Platform").choices(['win32', 'linux']))
    .addOption(new Option(`--arch <string>`, "Architecture").choices(['x64']))
    .action(build_electron);

program.command("generate_google_drive_offline_refresh_token")
    .description("Generate a Google Drive offline refresh token")
    .option(`--client_id <string>`, "Client ID")
    .option(`--client_secret <string>`, "Client Secret")
    .action(({client_id, client_secret})=>api.generate_google_drive_offline_refresh_token({client_id, client_secret}));

program.parse();

async function build(opts) {
    var configs = await api.generate_configs(null, opts);
    for (var c of configs) {
        await vite.build(c);
    }
}

async function build_electron(opts) {
    var name = "LiveStreamer";
    fs.rmSync(`out/${name}-${opts.platform}-${opts.arch}`, { recursive: true, force: true });
    
    const build = child_process.spawn('docker', [
        'build',
        '--progress', 'plain',
        '--target', 'artifact',
        '--output', `type=local,dest=out`,
        '-f', 'Dockerfile.build',
        '--build-arg', `ARCH=${opts.arch}`,
        '--build-arg', `NAME=${name}`,
        '--build-arg', `TARGETPLATFORM=${opts.platform}`,
        '-t', `${name}-${opts.platform}-${opts.arch}`.toLowerCase(),
        '.'
    ], { stdio: 'inherit' });

    fs.cpSync("resources", `out/${name}-${opts.platform}-${opts.arch}/resources`, { recursive: true, force: true });
    fs.cpSync(opts.platform, `out/${name}-${opts.platform}-${opts.arch}/resources/${opts.platform}`, { recursive: true, force: true });
}