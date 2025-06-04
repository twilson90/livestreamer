import path from "node:path";
import fs from "fs-extra";
import readline from "node:readline";
import cron from "node-cron";
import os from "node:os";
import { glob } from "glob";
import http_proxy from "http-proxy-node16";
import http from "node:http";
import https from "node:https";
import child_process, { ChildProcess } from "node:child_process";
import { program } from 'commander';
import chokidar from "chokidar";
import { pathToFileURL, fileURLToPath } from "node:url";
import {minimatch} from "minimatch";
import express from "express";
import stringArgv from "string-argv";
import {Logger, IPCMaster, IPCFork, utils, DataNode, globals, config_default} from "./exports.js";
import basic_auth from "basic-auth";
import Cookies from "cookies";
import minimist from "minimist";
import pidusage from "pidusage";
import { createRequire } from 'node:module';

const moduleTimestamps = new Map();
function require_fresh(modulePath) {
    const require = createRequire(import.meta.url);
    const resolvedPath = require.resolve(modulePath);
    const stat = fs.statSync(resolvedPath);
    const lastModified = stat.mtimeMs;
    if (!moduleTimestamps.has(resolvedPath) || moduleTimestamps.get(resolvedPath) < lastModified) {
        const Module = require('node:module');
        delete Module._cache[resolvedPath];
        moduleTimestamps.set(resolvedPath, lastModified);
    }
    return require(resolvedPath);
}



/** @import {IncomingMessage, ServerResponse} from "node:http" */

/** @typedef {typeof import("../config.default.js").default} Conf */

const dirname = import.meta.dirname;
const filename = import.meta.filename;
const root = path.dirname(dirname);
const js_exts = [`js`,`ts`,`cjs`,`mjs`,`cts`,`mts`];
const portable_file = fs.existsSync("portable");
let conf_loads = 0;

/** @template T @extends {DataNode<T>} */
export class Core extends DataNode {
    /** @type {Logger} */
    #logger;
    #name = "";
    #appdata_dir = "";
    #tmp_dir = "";
    #logs_dir = "";
    #cache_dir = "";
    #clients_dir = "";
    #files_dir = "";
    #saves_dir = "";
    #targets_dir = "";
    #screenshots_dir = "";
    #resources_dir = "";
    #mpv_lua_dir = "";
    /** @type {Conf} */
    #conf = {};
    #exitting = false;
    
    get name() { return this.#name; }
    get logger() { return this.#logger; }
    get appspace() { return process.env.LIVESTREAMER_APPSPACE || "livestreamer"; }
    get portable() { return !!(process.env.LIVESTREAMER_PORTABLE || portable_file); }
    get debug() { return !!process.env.LIVESTREAMER_DEBUG; }
    
    get use_pm2() { return !!("pm_id" in process.env || this.conf["core.pm2"]); }
    get hostname() { return this.conf["core.hostname"] || os.hostname(); }
    get change_log_path() { return path.resolve(this.conf["core.changelog"]); }
    get mpv_path() { return this.conf["core.mpv_path"] || "mpv"; }
    get ffmpeg_path() { return this.conf["core.ffmpeg_path"] || "ffmpeg"; }
    get cwd() { return process.cwd(); }
    get appdata_dir() { return this.#appdata_dir; }
    get tmp_dir() { return this.#tmp_dir; }
    get logs_dir() { return this.#logs_dir; }
    get cache_dir() { return this.#cache_dir; }
    get clients_dir() { return this.#clients_dir; }
    get files_dir() { return this.#files_dir; }
    get saves_dir() { return this.#saves_dir; }
    get targets_dir() { return this.#targets_dir; }
    get screenshots_dir() { return this.#screenshots_dir; }
    get resources_dir() { return this.#resources_dir; }
    get mpv_lua_dir() { return this.#mpv_lua_dir; }
    get conf() { return this.#conf; }
    
    /** @param {string} name @param {T} $ */
    constructor(name, $) {
        super($);

        globalThis.app = this;
        globals.app = this;
        this.#name = name;

        this.#logger = new Logger(this.#name, {stdout:true, file:true, prefix:this.#name});
        this.#logger.console_adapter();

        var on_exit = (code=0)=>this.exit(code);
        process.on('beforeExit', on_exit);
        process.on('SIGINT', on_exit);
        process.on('SIGTERM', on_exit);
        process.on('message', async (msg)=>{
            if (msg == 'shutdown') await on_exit();
        });
    }

    __init() {
        var appdata_dir;
        if (this.portable) {
            appdata_dir = "appdata";
        } else {
            appdata_dir = path.join((utils.is_windows() ? process.env.PROGRAMDATA : "/var/opt"), this.appspace);
        }
        this.#appdata_dir = path.resolve(appdata_dir);
        this.#tmp_dir = path.resolve(appdata_dir, "tmp");
        this.#logs_dir = path.resolve(appdata_dir, "logs");
        this.#cache_dir = path.resolve(appdata_dir, "cache");
        this.#clients_dir = path.resolve(appdata_dir, "clients");
        this.#files_dir = path.resolve(appdata_dir, "files");
        this.#saves_dir = path.resolve(appdata_dir, "saves");
        this.#targets_dir = path.resolve(appdata_dir, "targets");
        this.#screenshots_dir = path.resolve(this.cache_dir, "screenshots");
        this.#resources_dir = path.resolve((process.versions.electron && process.env.BUILD) ? process.resourcesPath : path.join(root, "resources"));
        let bin_dirs = [path.join(this.#resources_dir, "bin"), path.join(this.#resources_dir, process.platform, "bin")];
        this.#mpv_lua_dir = path.resolve(this.#resources_dir, "mpv_lua");
        process.env.PATH = [...new Set([...bin_dirs, ...process.env.PATH.split(path.delimiter)].filter(p=>p))].join(path.delimiter);

        if (!this.debug) {
            process.on('unhandledRejection', (e)=>{
                this.logger.error(`Unhandled Rejection:`, e);
            });
        }
    }

    get_socket_path(sock_name) {
        return utils.is_windows() ? `\\\\.\\pipe\\${this.appspace}_${sock_name}` : path.join("/tmp", `${this.appspace}_${sock_name}.sock`);
    }

    get_ssl_certs(){
        try {
            return {
                key: fs.readFileSync(this.conf["core.ssl_key"]),
                cert: fs.readFileSync(this.conf["core.ssl_cert"])
            };
        } catch {}
    }
    
    get_urls(subdomain) {
        if (!subdomain && subdomain !== false) subdomain = globals.app.name;
        var hostname = subdomain ? `${subdomain}.${this.hostname}` : this.hostname;
        var http = `http://${hostname}:${this.conf["core.http_port"]}`;
        var https = `https://${hostname}:${this.conf["core.https_port"]}`;
        var ws = `ws://${hostname}:${this.conf["core.http_port"]}`;
        var wss = `wss://${hostname}:${this.conf["core.https_port"]}`;
        var ssl = !!(this.conf["core.https_port"]);
        return {
            http,
            https,
            ws,
            wss,
            ssl,
            domain: hostname,
            url: ssl ? https : http,
        }
    }

    set_priority(pid, pri) {
        try {
            if (pid) os.setPriority(pid, pri);
            else os.setPriority(pri);
        } catch (e) {
            this.logger.warn(`Could not set process priority for pid: ${pid||process.pid}`);
        }
    }

    async exit(code=0) {
        if (this.#exitting) return;
        this.#exitting = true;
        await this.destroy();
        process.exit(code);
    }
}

/**
 *  @typedef {{
 *   modules:string[],
 *   configs:string[],
 *   config:Conf,
 *   cwd: string,
 *   auth:Function
 * }} MasterOpts
 */

export class CoreMaster extends Core {
    /** @type {Record<PropertyKey,string>} */
    modules = {}; // just a map of name:path to dir
    /** @type {(http.Server | https.Server)[]} */
    #servers = [];
    /** @type {string[]} */
    #conf_paths = [];
    /** @type {MasterOpts} */
    #opts;
    /** @type {IPCMaster} */
    #ipc;
    #ready;
    #netstats = [];
    /** @type {Record<PropertyKey,utils.Deferred>} */
    #processes = {};

    get ipc() { return this.#ipc; }
    get auth() { return this.#opts.auth; }
    get ready() { return this.#ready; }
    
    /** @param {MasterOpts} opts */
    constructor(opts) {
        super("core");
        
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
        
        this.#opts = Object.assign({}, program.opts(), opts);

        if (this.#opts.cwd) process.chdir(this.#opts.cwd);
        
        // a neat idea but doesn't work in practise.
        // {
        //     let pkg, pkg_hash;
        //     try { pkg = fs.readFileSync(path.join(this.cwd, "package.json"), "utf8"); } catch (e) {}
        //     try { pkg_hash = fs.readFileSync(path.join(this.cwd, "last_package"), "utf8"); } catch (e) {}
        //     if (pkg_hash != pkg) {
        //         fs.writeFileSync(path.join(this.cwd, "last_package"), pkg);
        //         console.log("Packages changed, installing dependencies...");
        //         child_process.execSync("npm install --omit=dev", { stdio: "inherit" });
        //         console.log("Packages installed.");
        //     }
        // }

        this.__init();
        
        fs.mkdirSync(this.appdata_dir, { recursive: true });
        fs.mkdirSync(this.tmp_dir, { recursive: true });
        fs.mkdirSync(this.logs_dir, { recursive: true });
        fs.mkdirSync(this.cache_dir, { recursive: true });
        fs.mkdirSync(this.clients_dir, { recursive:true });
        fs.mkdirSync(this.files_dir, { recursive:true });
        fs.mkdirSync(this.saves_dir, { recursive:true });
        fs.mkdirSync(this.targets_dir, { recursive:true });
        fs.mkdirSync(this.screenshots_dir, { recursive:true });
        // try { fs.emptyDirSync(this.tmp_dir, { recursive:true }); } catch (e) {}
        
        this.#cleanup_sockets(); // this deletes the socket files immediately after creation...
        
        this.#ipc = new IPCMaster(this.name, this.get_socket_path(`ipc`));
        
        let nethogs = child_process.spawn(`nethogs`, ["-t"]);
        readline.createInterface(nethogs.stdout).on("line", line=>{
            if (String(line).match(/^Refreshing:/)) {
                this.#netstats = [];
                return;
            }
            var m = String(line).match(/^(.+?)\/(\d+)\/(\d+)\s+([\d.]+)\s+([\d.]+)$/);
            if (!m) return;
            var [_, program, pid, userid, sent, received] = m;
            sent *= 1024;
            received *= 1024;
            this.#netstats.push({ program, pid, userid, sent, received });
        });
        nethogs.on("error", (e)=>{
            console.error(e.message);
        });
        
        this.#ipc.respond("core", ()=>{
            return {
                conf: this.conf,
                appspace: this.appspace,
                debug: this.debug,
                modules: this.modules,
                auth: !!this.auth,
                portable: this.portable,
                cwd: this.cwd,
            }
        });
        this.#ipc.respond("sysinfo", ()=>this.#sysinfo());
        this.#ipc.respond("authorise", (...args)=>this.auth(...args));
        this.#ipc.respond("electron-data", ()=>({
            appdata_dir: this.appdata_dir,
            conf: this.conf,
            debug: this.debug,
            url: this.get_urls("main").url,
        }));
        this.#ipc.respond("module_restart", (...args)=>this.module_restart(...args));
        this.#ipc.respond("module_start", (...args)=>this.module_start(...args));
        this.#ipc.respond("module_stop", (...args)=>this.module_stop(...args));

        this.#ready = this.#init();
    }
    
    async #init() {
        
        let modules = this.#opts.modules.flatMap(p=>p.split(path.delimiter));
        let resolved_modules = [...new Set(modules.map(p=>resolve_module(p)))].filter(p=>p);

        if (this.auth) process.env.LIVESTREAMER_AUTH = 1;
        if (this.portable) process.env.LIVESTREAMER_PORTABLE = 1;
        
        this.modules = Object.fromEntries(resolved_modules.map(p=>[path.basename(path.dirname(p)), p]))
        
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
        await this.#load_conf();

        var stdin_listener = readline.createInterface(process.stdin);
        stdin_listener.on("line", (line)=>{
            var args = minimist(line.split(" "));
            if (args[0] == "connect") {
                
            }
            var [proc, ...command] = args;
            if (proc in this.modules) {
                this.#ipc.emit_to(proc, "internal:input", {command});
            } else {
                console.error(`${proc} is not a module`)
            }
        });
        
        await this.#setup_proxies();
        await this.#compress_logs();

        cron.schedule(this.conf["core.compress_logs_schedule"], ()=>this.#compress_logs());
        
        if (this.use_pm2) {
            await pm2.connect(true);
            var pm2_bus = await pm2.launchBus();
            pm2_bus.on("process:event", (data)=>{
                if (data.event == "stopped" || data.event == "exit") {
                    let [appspace, m] = data.process.name.split(".");
                    if (appspace === this.appspace) {
                        if (m === "core") {
                            for (var c of Object.keys(this.modules)) {
                                this.module_stop(c);
                            }
                        }
                        if (m in this.#processes) {
                            this.#exit_handler(m);
                        }
                    }
                }
            });
            /* var procs = await pm2.list();
            for (var p of procs) {
                console.log(p)
                let [appspace, m] = p.name.split(".");
                if (appspace === this.appspace) {
                    if (p.pm2_env.status === "online") {
                        this.#processes[m] = new utils.Deferred();
                    }
                }
            } */
        }

        for (let m in this.modules) {
            this.module_start(m);
        }
        
        this.logger.info(`Initializing ${this.name}...`);
        this.logger.info(`  cwd: ${this.cwd}`);
        this.logger.info(`  appdata: ${this.appdata_dir}`);
        if (utils.has_root_privileges()) {
            this.logger.info(`  root: true`);
        } else {
            this.logger.warn(`  root: false (Without root privileges some functionality will be limited.)`);
        }

        if (this.use_pm2) {
            process.send('ready');
        }
    }

    async module_start(m) {
        if (this.#processes[m]) {
            console.warn(`Module '${m}' is already running.`)
            return;
        }
        var run_path = this.modules[m];
        this.logger.info(`Starting ${m} [${run_path}]...`);
        
        this.#processes[m] = new utils.Deferred();
        var args = [];
        var node_args = [];
        if (this.debug && this.conf[`${m}.inspect`]) {
            node_args.push(`--inspect=${this.conf[`${m}.inspect`]}`);
        }
        if (this.use_pm2) {
            let p = {
                "wait_ready": true,
                "namespace": this.appspace,
                "name": `${this.appspace}.${m}`,
                "script": run_path,
                "args": args,
                "node_args": node_args,
                "windowsHide": true,

                "max_restarts": 5,
                "autorestart": true,
                "restart_delay": 5000,
                // "cron_restart" : null // prevent inheriting
            };
            await pm2.start(p);
        } else {
            let p = child_process.fork(run_path, args, {
                execArgv: node_args,
                stdio: ["ignore", "inherit", "inherit", "ipc"]
            });
            p.on("error", (err)=>{
                console.error(err);
            });
            p.on("close", ()=>{
                this.#exit_handler(m);
            });
        }
    }

    async module_restart(m) {
        if (this.use_pm2) {
            return pm2.restart(`${this.appspace}.${m}`);
        } else {
            await this.module_stop(m);
            await this.module_start(m);
        }
    }

    async module_stop(m) {
        if (!this.#processes[m]) return;
        this.logger.info(`Stopping ${m}...`);
        if (this.use_pm2) {
            return pm2.stop(`${this.appspace}.${m}`);
        } else {
            this.#ipc.emit_to(m, "core:shutdown");
        }
        return this.#processes[m].promise;
    }

    #cleanup_sockets() {
        if (utils.is_windows()) return;
        let socket_files = glob.sync(`${this.appspace}_*.sock`, {cwd: "/tmp", absolute: true});
        for (let socket_file of socket_files) {
            fs.unlinkSync(socket_file);
        }
    }
    
    async #setup_proxies() {
        var ssl_certs = this.get_ssl_certs();
        const agent = new http.Agent({
            maxSockets: Number.MAX_SAFE_INTEGER,
            keepAlive: true,
            keepAliveMsecs: 30 * 1000,
        });
        const proxies = {};
        console.info(`Starting HTTP Server on port ${this.conf["core.http_port"]}`);
        /** @param {IncomingMessage} req @param {ServerResponse} res */
        var get_proxy = async (req, res)=>{
            var host_parts = req.headers.host.split(".");
            var name = host_parts[0];
            /** @type {http_proxy} */
            var proxy;
            /** @type {http_proxy.ProxyTarget} */
            var target;
            
            if (this.modules[name] && await this.#ipc.wait_for_process(name)) {
                // req.url = "/"+parts.slice(1).join("/") + url.search;
                if (!proxies[name]) {
                    proxies[name] = http_proxy.createProxy({ agent });
                    proxies[name].on("error", (e)=>{
                        console.warn(`Proxy error '${name}':`,e);
                    });
                }
                proxy = proxies[name];
                target = {
                    socketPath: this.get_socket_path(`${name}_http`)
                };
            }
            return { proxy, target };
        };
        /** @type {(req: IncomingMessage, socket: import("stream").Duplex, head: Buffer) => void} */
        this.ws_upgrade_handler = async (req, socket, head)=>{
            var { proxy, target } = await get_proxy(req);
            if (!proxy) {
                socket.end();
                return;
            }
            proxy.ws(req, socket, head, {
                xfwd: true,
                target,
                // ssl: {...this.#ssl_certs},
            });
        };
        
        var create_request_listener = (ssl)=>{
        /** @param {IncomingMessage} req @param {ServerResponse} res */
            return async (req, res)=>{
                var ref = req.headers.referer || "";
                if (!ssl && this.conf["core.redirect_http_to_https"] && this.conf["core.https_port"] && ssl_certs && (!ref || ref.startsWith("https://"))) {
                    var url = new URL(`http://${req.headers.host}${req.url}`);
                    url.port = this.conf["core.https_port"];
                    url.protocol = "https:";
                    res.writeHead(301, {
                        'Location': url.toString()
                    });
                    res.end();
                    return;
                }
                if (req.url == "/favicon.ico") {
                    let f = path.join(this.resources_dir, "icon.ico");
                    res.writeHead(200, { 'Content-Type': "image/x-icon" });
                    res.end(await fs.readFile(f));
                    return;
                }
                let {proxy,target} = await get_proxy(req, res);
                if (proxy) {
                    proxy.web(req, res, {
                        xfwd: true,
                        target
                    }, (e)=>{
                        if (res) res.end();
                    });
                    return;
                }
                res.statusCode = 500;
                res.end();
            };
        }
        /** @type {http.Server} */
        let proxy_http_server;
        /** @type {https.Server} */
        let proxy_https_server;

        if (this.conf["core.http_port"]) {
            proxy_http_server = http.createServer(create_request_listener(false));
            proxy_http_server.listen(this.conf["core.http_port"]);
            this.#servers.push(proxy_http_server);
        }

        if (this.conf["core.https_port"] && ssl_certs) {
            console.info(`Starting HTTPS Server on port ${this.conf["core.https_port"]}`);
            proxy_https_server = https.createServer({
                ...ssl_certs,
            }, create_request_listener(true));
            proxy_https_server.listen(this.conf["core.https_port"]);
            this.#servers.push(proxy_https_server);
            setInterval(async ()=>{
                ssl_certs = this.get_ssl_certs();
                if (ssl_certs) {
                    console.info(`Updating SSL certs...`);
                    proxy_https_server.setSecureContext({...ssl_certs});
                }
            }, 1000*60*60*24) // every day
        }
        // }

        for (var s of this.#servers) {
            s.keepAliveTimeout = (60 * 1000);
            s.headersTimeout = (60 * 1000);
            s.on('upgrade', this.ws_upgrade_handler);
        }
    }

    async #compress_logs() {
        await utils.compress_logs_directory(this.logs_dir);
        this.#ipc.emit("compress_logs");
    }

    async #load_conf() {
        utils.clear(this.conf);
        Object.assign(this.conf, config_default);
        for (let conf_path of this.#conf_paths) {
            if (!(await fs.exists(conf_path))) {
                console.error(`conf file '${conf_path}' does not exist.`)
            }
            let conf_json = require_fresh(path.resolve(conf_path));
            console.info(`conf file '${conf_path}' successfully loaded.`);
            for (var k in conf_json) {
                this.conf[k] = conf_json[k];
            }
        }
        if (this.#opts.config) {
            Object.assign(this.conf, this.#opts.config);
        }
        this.#ipc.emit("conf", this.conf);
    }

    async #sysinfo() {
        var cpu_avg = await utils.get_cpu_load_avg();
        var received = 0;
        var sent = 0;
        var processes = {};
        var results = await utils.pidtree(process.pid, {root:true, advanced:true});
        var all_pids = [...Object.values(results).map(r=>r.pid).flat()];
        var tree = utils.tree(results, (p)=>[p.pid, p.ppid])[0];
        var stats_lookup = all_pids.length ? await pidusage(all_pids) : {};
        for (let p of tree.children) {
            let pids = utils.flatten_tree(p, o=>o.children).map(o=>o.value.pid);
            let cpu = 0;
            let memory = 0;
            let received = 0;
            let sent = 0;
            let elapsed = (stats_lookup[p.value.pid]) ? stats_lookup[p.value.pid].elapsed : 0;
            for (var pid of pids) {
                var stat = stats_lookup[pid];
                for (var d of this.#netstats) {
                    if (d.pid == pid) {
                        received += d.received;
                        sent += d.sent;
                    }
                }
                if (stat) {
                    cpu += stat.cpu/100;
                    memory += stat.memory;
                }
            }
            processes[p.value.pid] = { sent, received, elapsed, cpu, memory };
        }

        for (var p of Object.values(processes)) {
            received += p.received;
            sent += p.sent;
        }
        return {
            memory_total: os.totalmem(),
            memory_free: os.freemem(),
            uptime: os.uptime(),
            cpu_avg: cpu_avg,
            received,
            sent,
            processes,
        }
    }

    async ondestroy() {
        console.info("Shutting down...");
        await Promise.all(Object.keys(this.#processes).map((m)=>this.module_stop(m)));
        await this.#ipc.destroy();
        return super.ondestroy();
    }

    #exit_handler(m) {
        this.#processes[m].resolve();
        delete this.#processes[m];
    }
}

class Module extends utils.Deferred {
    #proc;
    get pid() { return this.#proc.pid; }
    constructor(proc) {
        super();
        this.#proc = proc;
    }
    async kill() {
        process.kill(this.pid, "SIGINT");
        return this.promise;
    }
}

/** @template [T=any] @extends {Core<T>} */
export class CoreFork extends Core {
    #ready;
    /** @type {IPCFork} */
    #ipc;
    #auth_cache = new utils.Cache(30 * 1000);
    /** @type {Record<PropertyKey, string>} */
    #modules = {};
    #title = "";
    #description = "";

    get ready() { return this.#ready; }
    get ipc() { return this.#ipc; }
    get auth() { return !!process.env.LIVESTREAMER_AUTH; }
    get modules() { return this.#modules; }
    get module_id() { return Object.keys(this.#modules).indexOf(this.name); }
    get title() { return this.#title; }
    get description() { return this.#description; }
    
    /** @param {string} name @param {T} $ */
    constructor(name, $) {
        super(name, $);
        this.#ready = this.#init();
    }
    
    async #init() {
        this.#ipc = new IPCFork(this.name, this.get_socket_path(`ipc`));

        var core = await this.#ipc.request("core", "core", null, 0);

        process.chdir(core.cwd);
        process.env.LIVESTREAMER_APPSPACE = core.appspace;
        process.env.LIVESTREAMER_AUTH = core.auth ? "1" : "";
        process.env.LIVESTREAMER_DEBUG = core.debug ? "1" : "";
        process.env.LIVESTREAMER_PORTABLE = core.portable ? "1" : "";
        Object.assign(this.conf, core.conf);

        this.#modules = core.modules;

        this.__init();

        this.logger.on("log", (log)=>{
            this.#ipc.emit("internal:log", log).catch(utils.noop); // IMPORTANT: will create log feedback loop if socket is closed (logs error, collects error, tries to emit, and so on).
        });
        this.#ipc.on("core:shutdown", async ()=>{
            await this.exit();
        });

        this.#ipc.on("conf", (conf)=>{
            utils.clear(this.conf);
            Object.assign(this.conf, conf);
            this.emit("update-conf", this.conf);
        });

        var stdin_listener = readline.createInterface(process.stdin);
        stdin_listener.on("line", (line)=>{
            var args = stringArgv(line);
            this.emit("input", args);
        });
        
        this.#ipc.on("internal:input", ({command})=>{
            this.emit("input", command);
        });
        
        await this.#ipc.ready;

        await this.init();

        if (this.use_pm2) {
            process.send('ready');
        }
    }

    init() {}

    async module_start(m) {
        return this.#ipc.request("core", "module_start", [m], 0);
    }

    async module_restart(m) {
        return this.#ipc.request("core", "module_restart", [m], 0);
    }

    async module_stop(m) {
        return this.#ipc.request("core", "module_stop", [m], 0);
    }

    async serve({root, build, plugins}) {
        build = build ?? {};
        plugins = plugins ?? [];
        root = path.resolve(root);
        var pages = await glob("**/*.html", {cwd: root});
        if (process.env.BUILD) {
            return express.static(root);
        } else {
            var ssl_certs = this.get_ssl_certs();
            var node_modules_dir = utils.get_node_modules_dir("vite");
            let vite = await import("vite");
            /** @type {import("vite").UserConfig} */
            var config = {
                configFile: false,
                base: `/${this.name}/`,
                root,
                // outDir: path.resolve(this.tmp_dir, "web", utils.md5(dir)),
                server: {
                    https: ssl_certs ? ({...ssl_certs}) : false,
                    hmr: {
                        port: 24679 + this.module_id,
                    },
                    allowedHosts: true,
                    middlewareMode: true,
                },
                plugins: [
                    ...plugins
                ],
                css: {
                    preprocessorOptions: {
                        scss: {
                            api: 'modern-compiler' // or "modern"
                        }
                    }
                },
                build: {
                    minify: false,
                    cssMinify: false,
                    target: "esnext",
                    // modulePreload: false,
                    rollupOptions: {
                        input: pages,
                    },
                    commonjsOptions: {
                        include: [/node_modules/],
                        transformMixedEsModules: true,
                    },
                    sourcemap: "inline",
                    ...build,
                },
                cacheDir: path.join(node_modules_dir, `.vite/${this.name}`),
                optimizeDeps: {
                    force: true,
                    // include: ["hls.js"],
                    // exclude: ["video.js"],
                    /* esbuildOptions: {
                        format: "cjs",
                    }, */
                }
            }
            const server = await vite.createServer(config);
            server.restart(true);
            return server.middlewares;
        }
    }

    /** @param {IncomingMessage} req @param {string} key @param {ServerResponse} res */
    async authorise(req, key, res) {
        let name = os.userInfo().username || "admin";
        let data = {
            user_id: 0,
            username: name,
            email: `${name}@localhost`,
            is_admin: true,
        };

        if (this.auth) {

            let cookies = new Cookies(req, res);
            let username, password;
            let basic_auth_res = basic_auth(req);
            let url = new URL(`http://localhost${req.url}`);
            
            let user_pass = url.searchParams.get(key) || cookies.get(key);
            if (user_pass) user_pass = decodeURIComponent(user_pass);
            if (basic_auth_res) user_pass = [basic_auth_res.name, basic_auth_res.pass].join(":");
            
            if (user_pass) {
                [username, password] = user_pass.split(":");
            } else {
                return;
            }
            
            var cache_key = `${username}:${password}`;
            if (!this.#auth_cache.has(cache_key)) {
                this.#auth_cache.set(cache_key, this.#ipc.request("core", "authorise", [username, password]));
            }
            let user = await this.#auth_cache.get(cache_key);

            if (!user) return;

            if (res) {
                cookies.set(key, user.hash, {
                    httpOnly: false,
                    expires: new Date(Date.now()+(1000*60*60*24*365)),
                    domain: "."+globals.app.hostname
                });
            }
            Object.assign(data, user);
        }
        return data;
    }

    /** @param {IncomingMessage} req @param {string} key @param {ServerResponse} res */
    async unauthorise(req, key, res) {
        if (this.auth) {
            var cookies = new Cookies(req, res);
            cookies.set(key, '', {
                httpOnly:false,
                expires: new Date(0)
            });
        }
        return true;
    }

    async ondestroy() {
        await this.#ipc.destroy();
        return super.ondestroy();
    }
}
    
function resolve_module(m) {
    if (!fs.existsSync(m)) m = path.join(root, m);
    var js_exts_str = js_exts.join(",");
    if (fs.statSync(m).isDirectory()) return glob.sync(`${m}/index.{${js_exts_str}}`, {absolute:true})[0];
    else if (minimatch(path.basename(m), `*.{${js_exts_str}}`)) return path.resolve(m);
    console.warn(`Could not resolve module '${m}'`);
}

var _pm2;
/** @type {import("pm2")} */
var pm2 = new Proxy({}, {
    get(target, prop) {
        return async function(...args) {
            if (!_pm2) _pm2 = import("pm2");
            var pm2 = (await _pm2).default;
            var promised_func = utils.promisify(pm2[prop]);
            return promised_func.bind(pm2)(...args);
        }
    }
});


/** @param {MasterOpts} opts */
export function start(opts) {
    class App extends CoreMaster {
        constructor() {
            super({...opts});
        }
    }
    return new App();
}