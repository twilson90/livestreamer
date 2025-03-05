import path from "node:path";
import fs from "fs-extra";
import events from "node:events";
// import inspector from "node:inspector";
import readline from "node:readline";
import cron from "node-cron";
import os from "node:os";
import { glob } from "glob";
import http_proxy from "http-proxy";
import http from "node:http";
import https from "node:https";
import child_process, { ChildProcess } from "node:child_process";
import { program } from 'commander';
import chokidar from "chokidar";
import { pathToFileURL, fileURLToPath } from "node:url";
import Logger from "./Logger.js";
import IPC from "./IPC.js";
import * as utils from "./utils.js";
import globals from "./globals.js";
import config_default from "../config.default.js";
import {minimatch} from "minimatch";
import express from "express";
import which from "which";
import osInfo from "linux-os-info";
import stringArgv from "string-argv";

/** @import {BuildOptions} from "vite" */
/** @typedef {typeof import("../config.default.js").default} Conf */
/** @import {StartOptions} from "pm2" */

const pm2 = async (func, ...args)=>{
    var _pm2 = (await import("pm2")).default;
    var promised_func = utils.promisify(_pm2[func]);
    return promised_func.apply(_pm2, args);
};

const dirname = import.meta.dirname;
const filename = import.meta.filename;
const root = path.dirname(dirname);
const js_exts = [`js`,`ts`,`cjs`,`mjs`,`cts`,`mts`];

// import pkg from "./package.json" with { type: "json" };

export class Core extends events.EventEmitter {
    modules = {}; // just a map of name:path to dir
    ppid = process.ppid;
    /** @type {Logger} */
    logger;
    #auth;
    #is_master = false;
    /** @type {cron.ScheduledTask} */
    #compress_logs_cron;
    /** @type {(http.Server | https.Server)[]} */
    #servers = [];
    /** @type {Record<PropertyKey,ChildProcess>} */
    #subprocesses = {};
    #opts = new class {
        /** @type {string[]} */
        modules = [];
        /** @type {string[]} */
        configs = [];
        /** @type {Conf} */
        config = null;
    };
    /** @type {string[]} */
    #conf_paths = [];
    #ssl_certs;
    /** @type {Conf} */
    conf = {};
    observer = new utils.Observer();
    
    #portable_file;
    get appspace() { return process.env.LIVESTREAMER_APPSPACE || "livestreamer"; }
    get portable() {
        if (this.#portable_file === undefined) this.#portable_file = fs.existsSync("portable");
        return !!(process.env.LIVESTREAMER_PORTABLE || this.#portable_file);
    }
    get debug() { return !!(process.env.LIVESTREAMER_DEBUG || this.conf["core.debug"]); }
    get is_electron() { return !!(process.versions['electron']); }
    get use_pm2() { return !!("pm_id" in process.env || this.conf["core.pm2"]); }
    get hostname() { return this.conf["core.hostname"] || os.hostname(); }
    get change_log_path() { return path.resolve(this.conf["core.changelog"]); }
    get $() { return this.observer.$; }
    
    constructor(name, master_opts) {
        super();
        globalThis.app = globalThis.core = this;
        globals.core = this;
        if (!name || typeof name !== "string") throw new Error("Bad init()");
        this.name = name || "livestreamer";
        this.#is_master = !!master_opts;

        var opts = {};

        if (this.#is_master) {
            program
                .name('Live Streamer')
                .description('Live Streamer CLI')
                // .version(pkg.version);

            program
                .argument(`[script]`, "(Internal) Script path to module")
                .option(`-m --modules [string...]`, "Module paths", [])
                .option(`-c --configs [string...]`, "Config paths", [])
                .option(`-d --debug`, "Debug")
                .option(`--pm2`, "Use PM2")

            program.parse();
            Object.assign(opts, program.opts());
        }

        Object.assign(this.#opts, opts, typeof master_opts === "object" ? master_opts : null);

        this.logger = new Logger(this.name, {stdout:true, file:true, prefix:this.#is_master?"":this.name});
        this.logger.console_adapter();

        this.cwd = process.cwd();
        this.ready = this.#init();
    }

    async init() {}
    async destroy() {}
    
    resolve_module(m) {
        var _resolve = (m)=>{
            var js_exts_str = js_exts.join(",");
            if (fs.statSync(m).isDirectory()) return glob.sync(`${m}/index.{${js_exts_str}}`, {absolute:true})[0];
            else if (minimatch(path.basename(m), `*.{${js_exts_str}}`)) return path.resolve(m);
            console.warn(`Could not resolve module '${m}'`);
        };
        return (fs.existsSync(m)) ? _resolve(m) : _resolve(path.join(root, m));
    }
    
    async #init() {

        this.resources_dir = path.resolve((process.versions.electron && process.env.BUILD) ? process.resourcesPath : path.join(root, "resources"));
        let bin_dirs = [...glob.sync("**/bin", { cwd: this.resources_dir, absolute:true, dot:true })];
        this.mpv_lua_dir = path.resolve(this.resources_dir, "mpv_lua");
        process.env.PATH = [...new Set([...bin_dirs, ...process.env.PATH.split(path.delimiter)].filter(p=>p))].join(path.delimiter);

        if (this.#is_master) {
            let os_info = osInfo({ mode:"sync" });
            let linux_re = /(debian|ubuntu)/i;
            let is_debian = process.platform === "linux" && os_info.id.match(linux_re);
            let is_windows = utils.is_windows();
            if (!is_windows && !is_debian) {
                console.log("This system is not supported. Exiting.");
                console.log(process.platform, os_info.id, os_info.id_like);
                process.exit(1);
            }

            // let ffmpeg_path = which.sync("ffmpeg", { nothrow: true });
            // let mpv_path = which.sync("mpv", { nothrow: true });

            /* if (is_windows) {
                if (!mpv_path) {
                    throw new Error("mpv cannot be installed.");
                }
                if (!ffmpeg_path) {
                    await run("winget", ["install", "--id=Gyan.FFmpeg", "-e"]);
                }
            } else if (is_debian) {
                console.log("Installing prerequisites...");
                await run("apt-get", ["update", "-y"]);
                await run("apt-get", ["install", "ffmpeg", "nethogs", path.join(this.resources_dir, "linux", "mpv.deb"), "-fy"]);
                await run("python3", ["-m", "pip", "install", "-U", "yt-dlp[default]"]);
            } */
        }
        
        let modules = [
            ...(process.env.LIVESTREAMER_MODULES ? [process.env.LIVESTREAMER_MODULES] : []),
            ...(this.#opts.modules)
        ].flatMap(p=>p.split(path.delimiter));
            
        let resolved_modules = [...new Set(modules.map(p=>this.resolve_module(p)))].filter(p=>p);

        // necessary for child processes.
        process.env.LIVESTREAMER_MODULES = resolved_modules.join(path.delimiter);
        if (this.portable) process.env.LIVESTREAMER_PORTABLE = 1;
        if (this.debug) process.env.LIVESTREAMER_DEBUG = 1
        
        this.modules = Object.fromEntries(resolved_modules.map(p=>[path.basename(path.dirname(p)), p]));

        /* const session = new inspector.Session();
        session.connect();
        session.on('disconnect', () => {
            console.log('Debugger disconnected – running cleanup');
        }); */

        process.on('beforeExit', ()=>this.shutdown());
        process.on('SIGINT', ()=>this.shutdown());
        process.on('SIGTERM', ()=>this.shutdown());

        process.on('unhandledRejection', (e)=>{
            // is this a good idea?
            this.logger.error(`Unhandled Rejection:`, e);
        });

        var appdata_dir = config_default["core.appdata_dir"];
        if (this.portable) {
            appdata_dir = "appdata";
        } else {
            appdata_dir = path.join((utils.is_windows() ? process.env.PROGRAMDATA : "/var/opt"), this.appspace);
        }
        this.appdata_dir = path.resolve(appdata_dir);
        this.tmp_dir = path.resolve(appdata_dir, "tmp");
        this.logs_dir = path.resolve(appdata_dir, "logs");
        this.cache_dir = path.resolve(appdata_dir, "cache");
        this.clients_dir = path.resolve(appdata_dir, "clients");
        this.files_dir = path.resolve(appdata_dir, "files");
        this.saves_dir = path.resolve(appdata_dir, "saves");
        this.targets_dir = path.resolve(appdata_dir, "targets");
        this.socket_dir = path.join(this.tmp_dir, "socks");
        this.conf_path = path.resolve(appdata_dir, "config");
        this.screenshots_dir = path.resolve(this.cache_dir, "screenshots");

        if (this.#is_master) {
            await fs.mkdir(this.appdata_dir, { recursive: true });
            await fs.mkdir(this.tmp_dir, { recursive: true });
            await fs.mkdir(this.logs_dir, { recursive: true });
            await fs.mkdir(this.cache_dir, { recursive: true });
            await fs.mkdir(this.clients_dir, { recursive:true });
            await fs.mkdir(this.files_dir, { recursive:true });
            await fs.mkdir(this.saves_dir, { recursive:true });
            await fs.mkdir(this.targets_dir, { recursive:true });
            await fs.mkdir(this.socket_dir, { recursive:true });
            await fs.mkdir(this.screenshots_dir, { recursive:true });
            await this.#cleanup_sockets();
        }
        this.ipc_socket_path = this.get_socket_path(`ipc`);
        this.ipc = new IPC(this.#is_master, this.name, this.ipc_socket_path);

        /* if (process.env.LIVESTREAMER_DOCKER) {
            if (this.#is_master) {
                this.ipc.on("internal:log", (log)=>this.logger.log_to_stdout(log));
            } else {
                this.logger.on("log", (log)=>this.ipc.emit("internal:log", log));
            }
        } */

        if (this.#is_master) {
            this.ipc.on("core:module_restart", (m)=>this.module_restart(m));
            this.ipc.on("core:module_start", (m)=>this.module_start(m));
            this.ipc.on("core:module_stop", (m)=>this.module_stop(m));
            
            if (process.env.LIVESTREAMER_CONF_PATH) this.#conf_paths.push(process.env.LIVESTREAMER_CONF_PATH);
            if (this.#opts.configs) {
                this.#conf_paths.push(...this.#opts.configs);
            }
            this.#conf_paths.push(...await glob("config.*"));
            let conf_watcher = chokidar.watch([...this.#conf_paths], {awaitWriteFinish:true});
            conf_watcher.on("change", async()=>{
                console.info("Conf was updated.");
                await this.#load_conf();
            });
        } else {
            this.ipc.on("core:shutdown", ()=>{
                this.shutdown();
            });
        }

        await this.#load_conf();
        
        this.logger.info(`Initializing ${this.name} [${this.#is_master?"MASTER":"FORK"}]...`);
        this.logger.info(`  cwd: ${this.cwd}`);
        this.logger.info(`  appdata: ${this.appdata_dir}`);
        if (utils.has_root_privileges()) {
            this.logger.info(`  root: true`);
        } else {
            this.logger.warn(`  root: false (Without root privileges some functionality will be limited.)`);
        }

        this.stdin_listener = readline.createInterface(process.stdin);
        this.stdin_listener.on("line", (line)=>{
            var args = stringArgv(line);
            if (this.#is_master) {
                var [proc, ...command] = args;
                if (proc in this.modules) {
                    this.ipc.send(proc, "internal:input", {command})
                } else {
                    console.error(`${proc} is not a module`)
                }
            } else {
                this.emit("input", args);
            }
        });
        if (!this.#is_master) {
            this.ipc.on("internal:input", ({command})=>{
                this.emit("input", command);
            })
        }

        if (this.#is_master) {
            await this.#setup_proxies();
            await this.#compress_logs();
            this.#compress_logs_cron = cron.schedule(this.conf["core.compress_logs_schedule"], ()=>this.#compress_logs());
            if (this.use_pm2) {
                await pm2("connect", true);
            }
            for (let m in this.modules) {
                this.module_start(m);
            }
        }

        await this.init();
        
        await this.ipc.connect();
    }

    async module_start(m) {
        if (this.#is_master) {
            if (this.#subprocesses[m]) {
                console.warn(`Module '${m}' is already running.`)
                return;
            }
            var run_path = this.modules[m];
            this.logger.info(`Starting ${m} [${run_path}]...`);
            var args = [];
            var node_args = [];
            if (this.debug && this.conf[`${m}.inspect`]) {
                node_args.push(`--inspect=${this.conf[`${m}.inspect`]}`);
            }
            if (this.use_pm2) {
                /** @type {StartOptions} */
                let p = {
                    "max_restarts": 5,
                    "name": `${this.appspace}.${m}`,
                    "script": run_path,
                    "args": args,
                    "autorestart": true,
                    "restart_delay": 5000,
                    "node_args": node_args,
                    // "cron_restart" : null // prevent inheriting
                };
                return pm2("start", p);
            } else {
                /** @type {child_process.ChildProcess} */
                let p;
                let exit_handler = ()=>{
                    delete this.#subprocesses[m];
                    this.emit(`core.stopped.${m}`);
                };
                if (process.versions.electron) {
                    const {utilityProcess} = (await import("electron"));
                    p = utilityProcess.fork(run_path, args, {
                        execArgv: node_args,
                        stdio: ["ignore", "inherit", "inherit", "ipc"]
                    });
                    // p.send = (msg)=>p.postMessage(msg);
                    p.on("exit", exit_handler);
                } else {
                    p = child_process.fork(run_path, args, {
                        execArgv: node_args,
                        stdio: ["ignore", "inherit", "inherit", "ipc"]
                    });
                    p.on("error", (err)=>{
                        console.error(err);
                    });
                    p.on("close", exit_handler);
                }
                this.#subprocesses[m] = p;
            }
        } else {
            this.ipc.emit("core:module_start", m);
        }
    }

    async module_restart(m) {
        if (this.#is_master) {
            if (this.use_pm2) {
                return pm2("restart", `${this.appspace}.${m}`);
            } else {
                await this.module_stop(m);
                await this.module_start(m);
            }
        } else {
            this.ipc.emit("core:module_restart", m);
        }
    }

    async module_stop(m) {
        if (this.#is_master) {
            this.logger.info(`Stopping ${m}...`);
            if (this.use_pm2) {
                return pm2("stop", `${this.appspace}.${m}`);
            } else {
                if (this.#subprocesses[m]) {
                    this.ipc.send(m, "core:shutdown");
                }
                await new Promise(resolve=>this.once(`core.stopped.${m}`, resolve));
            }
        } else {
            this.ipc.emit("core:module_stop", m);
        }
    }

    get_socket_path(sock_name) {
        return utils.is_windows() ? `\\\\.\\pipe\\${this.appspace}_${sock_name}` : path.join(this.socket_dir, `${sock_name}.sock`);
    }

    async #cleanup_sockets() {
        if (utils.is_windows()) return;
        await fs.emptyDir(this.socket_dir);
    }
    
    async #setup_proxies() {
        const agent = new http.Agent({
            maxSockets: Number.MAX_SAFE_INTEGER,
            keepAlive: true,
            keepAliveMsecs: 30 * 1000,
        });
        const proxies = {};
        console.info(`Starting HTTP Server on port ${this.conf["core.http_port"]}`);
        /** @param {http.IncomingMessage} req @param {string} name */
        var get_proxy = async (req)=>{
            var host_parts = req.headers.host.split(".");
            // var url = new URL(req.url, "http://localhost");
            // var parts = url.pathname.slice(1).split("/");
            // var name = parts[0];
            var name = host_parts[0];
            /** @type {http_proxy} */
            var proxy, target;
            
            if (this.modules[name] && await this.ipc.wait_for_process(name)) {
                // req.url = "/"+parts.slice(1).join("/") + url.search;
                if (!proxies[name]) {
                    proxies[name] = http_proxy.createProxy({ agent });
                    proxies[name].on("error", (e)=>{
                        console.warn(`Proxy error '${name}':`,e);
                    })
                }
                proxy = proxies[name];
                target = {
                    socketPath: this.get_socket_path(`${name}_http`)
                };
            }
            return { proxy, target };
        };
        /** @type {(req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => void} */
        this.ws_upgrade_handler = async (req, socket, head)=>{
            var { proxy, target } = await get_proxy(req);
            if (!proxy) {
                socket.end();
                return;
            }
            proxy.ws(req, socket, head, {
                xfwd: true,
                target
            });
        };
        /** @param {Request} req @param {Response} res */
        this.web_request_listener = async (req, res)=>{
            // if (http and https is available) {
            //   res.redirect("https://" + req.headers.host + req.path);
            // }
            if (req.url == "/favicon.ico") {
                let f = path.join(this.resources_dir, "icon.ico");
                res.writeHead(200, { 'Content-Type': "image/x-icon" });
                res.end(await fs.readFile(f));
                return;
            }
            let {proxy,target} = await get_proxy(req);
            if (proxy) {
                proxy.web(req, res, {
                    xfwd: true,
                    target
                });
                return;
            }
            res.statusCode = 500;
            res.end();
        };

        // if (process.versions.electron) {
        //     // let proxy_http_server = http.createServer(request_listener);
        //     // proxy_http_server.listen(this.get_socket_path("http"));
        //     // this.#servers.push(proxy_http_server);
        // } else {
        if (this.conf["core.http_port"]) {
            let proxy_http_server = http.createServer(this.web_request_listener);
            proxy_http_server.listen(this.conf["core.http_port"]);
            this.#servers.push(proxy_http_server);
        }

        this.#ssl_certs = await this.#get_certs();
        if (this.conf["core.https_port"] && this.#ssl_certs) {
            console.info(`Starting HTTPS Server on port ${this.conf["core.https_port"]}`);
            let proxy_https_server = https.createServer(this.#ssl_certs, this.web_request_listener);
            proxy_https_server.listen(this.conf["core.https_port"]);
            this.#servers.push(proxy_https_server);
            setInterval(async ()=>{
                this.#ssl_certs = await this.#get_certs();
                if (this.#ssl_certs) proxy_https_server.setSecureContext(this.#ssl_certs);
            }, 1000*60*60*24*7) // every week
        }
        // }

        for (var s of this.#servers) {
            s.keepAliveTimeout = (60 * 1000);
            s.headersTimeout = (60 * 1000);
            s.on('upgrade', this.ws_upgrade_handler);
        }
    }

    async #get_certs(){
        try { return { key: await fs.readFile(this.conf["core.ssl_key"]), cert: await fs.readFile(this.conf["core.ssl_cert"]) }; } catch {}
    }

    async #compress_logs() {
        await utils.compress_logs_directory(this.logs_dir);
        this.ipc.emit("compress_logs");
    }

    async #load_conf() {
        utils.clear(this.conf);
        if (this.#is_master) {
            Object.assign(this.conf, config_default);
            for (let conf_path of this.#conf_paths) {
                if (!(await fs.exists(conf_path))) {
                    console.error(`conf file '${conf_path}' does not exist.`)
                }
                let conf_json = (await import(pathToFileURL(conf_path))).default;
                console.info(`conf file '${conf_path}' successfully loaded.`);
                for (var k in conf_json) {
                    this.conf[k] = conf_json[k];
                }
            }
            if (this.#opts.config) {
                Object.assign(this.conf, this.#opts.config);
            }
            await fs.writeFile(this.conf_path, JSON.stringify(this.conf));
        } else {
            Object.assign(this.conf, JSON.parse(await fs.readFile(this.conf_path, "utf-8")));
        }
        this.emit("update-conf");
    }
    
    get_urls(subdomain) {
        if (!subdomain && subdomain !== false) subdomain = globals.core.name;
        var hostname = subdomain ? `${subdomain}.${this.hostname}` : this.hostname;
        var http = `http://${hostname}:${this.conf["core.http_port"]}`;
        var https = `https://${hostname}:${this.conf["core.https_port"]}`;
        var ssl = !!(this.conf["core.https_port"] && this.#ssl_certs);
        return {
            http,
            https,
            ssl,
            domain: hostname,
            url: ssl ? https : http,
        }
    }
    
    get auth() {
        if (!this.#auth && this.conf["core.auth"]) this.#auth = import(pathToFileURL(this.conf["core.auth"]));
        return this.#auth;
    }

    /** @return {Promise<{user_id:number,username:string,email:string,is_admin:boolean}>} */
    async authorise(req, res) {
        let name = os.userInfo().username || "admin";
        let data = {
            user_id: 0,
            username: name,
            email: `${name}@localhost`,
            is_admin: true,
        };
        if (this.conf["core.auth"]) {
            let auth;
            try {
                auth = await (await this.auth).login(req, res);
            } catch (e) {
                console.error("authorise error", e);
            }
            if (!auth) return;
            Object.assign(data, auth);
        }
        return data;
    }

    async unauthorise(req, res) {
        if (this.conf["core.auth"]) {
            try {
                return (await this.auth).logout(req, res);
            } catch (e) {
                console.error("unauthorise error", e);
                return false;
            }
        }
        return true;
    }

    set_priority(pid, pri) {
        try {
            if (pid) os.setPriority(pid, pri);
            else os.setPriority(pri);
        } catch (e) {
            this.logger.warn(`Could not set process priority for pid: ${pid||process.pid}`);
        }
    }

    // #get_inspect() {
    //     var argv = process.argv;
    //     if (this.#pm2_description) {
    //         argv = this.#pm2_description.pm2_env.node_args || this.#pm2_description.pm2_env.interpreter_args;
    //     }
    //     var inspect_arg = argv.find(a=>a.match(/^--inspect(-)?/)) || "";
    //     var inspect_hostname = "127.0.0.1";
    //     var inspect_port = 9229;
    //     var inspect_host = inspect_arg.split("=")[1] || `${inspect_hostname}:${inspect_port}`;
    //     if (inspect_host.match(/^[^:]+:\d+$/)) [inspect_hostname, inspect_port] = inspect_host.split(":");
    //     else inspect_hostname = inspect_host || inspect_hostname;
    //     return [inspect_hostname, +inspect_port];
    // }

    async serve({root, build, plugins}) {
        build = build ?? {};
        plugins = plugins ?? [];
        root = path.resolve(root);
        var pages = await glob("**/*.html", {cwd: root});
        if (process.env.BUILD) {
            return express.static(root);
        } else {
            let vite = await import("vite");
            const server = await vite.createServer({
                configFile: false,
                base: `/${this.name}/`,
                root,
                // outDir: path.resolve(this.tmp_dir, "web", utils.md5(dir)),
                server: {
                    middlewareMode: true
                },
                plugins: [
                    ...plugins
                ],
                build: {
                    modulePreload: false,
                    rollupOptions: {
                        input: pages,
                    },
                    sourcemap: "inline",
                    ...build
                },
            });
            server.restart(true);
            return server.middlewares;
        }
    }

    async shutdown() {
        if (this.#is_master) {
            console.info("Shutting down...")
            await this.ipc.emit("core:shutdown");
            await Promise.all(Object.values(this.#subprocesses).map(p=>new Promise(r=>p.on("exit", r))));
        }
        await this.ipc.destroy();
        await this.destroy();
        process.exit(0);
    }
}

/* if (program.args.length) {
    var script = program.args[0];
    // necessary so file importing core/index.js is exported and not undefined (ugh) 
    setImmediate(async()=>{
        try {
            await import(pathToFileURL(script));
        } catch (e) {
            require(script);
        }
    });
} */

/* let run = (command, args)=>{
    let cp = child_process.spawn(command, args);
    return new Promise((resolve,reject)=>{
        readline.createInterface(cp.stdout).on("line", (line)=>{
            console.debug(line);
        });
        readline.createInterface(cp.stderr).on("line", (line)=>{
            console.warn(line);
        });
        cp.on("close", resolve);
        cp.on("error", reject);
    });
} */

export function start(opts) {
    class App extends Core {
        constructor() {
            super("livestreamer", {...opts});
        }
    }
    return new App();
}

export default Core;