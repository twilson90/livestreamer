import { program, Option } from 'commander';
import child_process from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

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

async function run(cmd, args=[]) {
    return new Promise((resolve, reject) => {
        child_process.spawn(cmd, args, {stdio: "inherit"})
            .on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`Command '${cmd}' failed with exit code ${code}`));
                } else {
                    resolve();
                }
            });
    });
}

async function build_electron(opts) {
    var name = "LiveStreamer";
    var target_dir = `out/${name}-${opts.platform}-${opts.arch}`;

    await fs.promises.rm(target_dir, { recursive: true, force: true }).catch(()=>{});
    await fs.promises.rm(target_dir+".7z", { recursive: true, force: true }).catch(()=>{});
    await fs.promises.rm(target_dir+".tar.gz", { recursive: true, force: true }).catch(()=>{});
    
    await run('docker', [
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
    ]);

    await fs.promises.cp("resources", path.join(target_dir, `resources`), { recursive: true, force: true });
    await fs.promises.cp(opts.platform, path.join(target_dir, `resources/${opts.platform}`), { recursive: true, force: true });

    if (opts.platform == "win32") {
        await run("7za", ["a", "-t7z", "-mx=9", target_dir+".7z", target_dir+"/*"]);
    } else if (opts.platform == "linux") {
        await run("7za", ["a", "-ttar", target_dir+".tar", target_dir+"/*"]);
        await run("7za", ["a", "-tgzip", "-mx=9", target_dir+".tar.gz", target_dir+".tar"]);
        await fs.promises.rm(target_dir+".tar");
    }
}