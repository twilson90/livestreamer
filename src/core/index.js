import path from "node:path";
import fs from "fs-extra";
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
import {minimatch} from "minimatch";
import express from "express";
import stringArgv from "string-argv";
import {Logger, IPCMaster, IPCFork, utils, DataNode, globals, config_default} from "./exports.js";

/** @typedef {import("../config.default.js").default} Conf */

const dirname = import.meta.dirname;
const filename = import.meta.filename;
const root = path.dirname(dirname);
const js_exts = [`js`,`ts`,`cjs`,`mjs`,`cts`,`mts`];
const portable_file = fs.existsSync("portable");

/** @template T @extends {DataNode<T>} */
export class Core extends DataNode {
    #ppid = process.ppid;
    /** @type {Logger} */
    #logger;
    #auth;
    #cwd;
    #name = "";
    #appdata_dir = "";
    #tmp_dir = "";
    #logs_dir = "";
    #cache_dir = "";
    #clients_dir = "";
    #files_dir = "";
    #saves_dir = "";
    #targets_dir = "";
    #socket_dir = "";
    #conf_path = "";
    #screenshots_dir = "";
    #resources_dir = "";
    #mpv_lua_dir = "";
    
    get name() { return this.#name; }
    get ppid() { return this.#ppid; }
    get logger() { return this.#logger; }
    get appspace() { return process.env.LIVESTREAMER_APPSPACE || "livestreamer"; }
    get portable() { return !!(process.env.LIVESTREAMER_PORTABLE || portable_file); }
    get debug() { return !!(process.env.LIVESTREAMER_DEBUG || this.conf["core.debug"]); }
    get is_electron() { return !!(process.versions['electron']); }
    get use_pm2() { return !!("pm_id" in process.env || this.conf["core.pm2"]); }
    get hostname() { return this.conf["core.hostname"] || os.hostname(); }
    get change_log_path() { return path.resolve(this.conf["core.changelog"]); }
    get mpv_path() { return this.conf["core.mpv_path"] || "mpv"; }
    get ffmpeg_path() { return this.conf["core.ffmpeg_path"] || "ffmpeg"; }
    get cwd() { return this.#cwd; }
    get appdata_dir() { return this.#appdata_dir; }
    get tmp_dir() { return this.#tmp_dir; }
    get logs_dir() { return this.#logs_dir; }
    get cache_dir() { return this.#cache_dir; }
    get clients_dir() { return this.#clients_dir; }
    get files_dir() { return this.#files_dir; }
    get saves_dir() { return this.#saves_dir; }
    get targets_dir() { return this.#targets_dir; }
    get socket_dir() { return this.#socket_dir; }
    get conf_path() { return this.#conf_path; }
    get screenshots_dir() { return this.#screenshots_dir; }
    get resources_dir() { return this.#resources_dir; }
    get mpv_lua_dir() { return this.#mpv_lua_dir; }
    
    /** @type {Conf} */
    get conf() { throw new Error("Not implemented"); }
    
    /** @param {string} name @param {T} $ */
    constructor(name, $) {
        super($);

        globalThis.app = this;
        globals.app = this;
        this.#name = name;

        this.#logger = new Logger(this.#name, {stdout:true, file:true, prefix:this.#name});
        this.#logger.console_adapter();
        this.#cwd = process.cwd();

        this.#resources_dir = path.resolve((process.versions.electron && process.env.BUILD) ? process.resourcesPath : path.join(root, "resources"));
        let bin_dirs = [path.join(this.#resources_dir, "bin"), path.join(this.#resources_dir, process.platform, "bin")];
        this.#mpv_lua_dir = path.resolve(this.#resources_dir, "mpv_lua");
        process.env.PATH = [...new Set([...bin_dirs, ...process.env.PATH.split(path.delimiter)].filter(p=>p))].join(path.delimiter);

        var on_exit = async()=>{
            await this.destroy();
            process.exit(0);
        }
        process.on('beforeExit', on_exit);
        process.on('SIGINT', on_exit);
        process.on('SIGTERM', on_exit);

        // is this a good idea?
        process.on('unhandledRejection', (e)=>{
            this.logger.error(`Unhandled Rejection:`, e);
        });

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
        this.#socket_dir = path.join(this.tmp_dir, "socks");
        this.#conf_path = path.resolve(appdata_dir, "config");
        this.#screenshots_dir = path.resolve(this.cache_dir, "screenshots");
    }

    get_socket_path(sock_name) {
        return utils.is_windows() ? `\\\\.\\pipe\\${this.appspace}_${sock_name}` : path.join(this.socket_dir, `${sock_name}.sock`);
    }

    async get_ssl_certs(){
        try { return { key: await fs.readFile(this.conf["core.ssl_key"]), cert: await fs.readFile(this.conf["core.ssl_cert"]) }; } catch {}
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
    
    get auth() {
        if (!this.#auth && this.conf["core.auth"]) this.#auth = import(pathToFileURL(this.conf["core.auth"]));
        return this.#auth;
    }

    /** @returns {Promise<{user_id:number,username:string,email:string,is_admin:boolean}>} */
    async authorise(req, key, res) {
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
                auth = await (await this.auth).login(req, key, res);
            } catch (e) {
                console.error("authorise error", e);
            }
            if (!auth) return;
            Object.assign(data, auth);
        }
        return data;
    }

    async unauthorise(req, key, res) {
        if (this.conf["core.auth"]) {
            try {
                return (await this.auth).logout(req, key, res);
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
}

/** @typedef {{modules:string[],configs:string[], config:Conf}} MasterOpts */

export class CoreMaster extends Core {
    modules = {}; // just a map of name:path to dir
    /** @type {(http.Server | https.Server)[]} */
    #servers = [];
    /** @type {Record<PropertyKey,ChildProcess>} */
    #subprocesses = {};
    /** @type {string[]} */
    #conf_paths = [];
    /** @type {MasterOpts} */
    #opts;
    /** @type {Conf} */
    #conf = {};
    /** @type {IPCMaster} */
    #ipc;

    get conf() { return this.#conf; }
    get ipc() { return this.#ipc; }
    
    constructor(opts) {
        super("livestreamer");
        
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
        
        this.#ipc = new IPCMaster(this.name, this.get_socket_path(`ipc`));
        
        this.#ipc.on("core:module_restart", (m)=>this.module_restart(m));
        this.#ipc.on("core:module_start", (m)=>this.module_start(m));
        this.#ipc.on("core:module_stop", (m)=>this.module_stop(m));

        this.#init();
    }
    
    async #init() {
        
        let modules = this.#opts.modules.flatMap(p=>p.split(path.delimiter));
        let resolved_modules = [...new Set(modules.map(p=>resolve_module(p)))].filter(p=>p);

        // necessary for child processes.
        process.env.LIVESTREAMER_MODULES = resolved_modules.join(path.delimiter);
        if (this.portable) process.env.LIVESTREAMER_PORTABLE = 1;
        if (this.debug) process.env.LIVESTREAMER_DEBUG = 1
        
        this.modules = module_map(resolved_modules);

        await fs.mkdir(this.appdata_dir, { recursive: true });
        await fs.mkdir(this.tmp_dir, { recursive: true });
        await fs.emptyDir(this.tmp_dir, {recursive:true}).catch(utils.noop);
        await fs.mkdir(this.logs_dir, { recursive: true });
        await fs.mkdir(this.cache_dir, { recursive: true });
        await fs.mkdir(this.clients_dir, { recursive:true });
        await fs.mkdir(this.files_dir, { recursive:true });
        await fs.mkdir(this.saves_dir, { recursive:true });
        await fs.mkdir(this.targets_dir, { recursive:true });
        await fs.mkdir(this.socket_dir, { recursive:true });
        await fs.mkdir(this.screenshots_dir, { recursive:true });

        await this.#cleanup_sockets();
        
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
            var [proc, ...command] = args;
            if (proc in this.modules) {
                this.#ipc.send(proc, "internal:input", {command})
            } else {
                console.error(`${proc} is not a module`)
            }
        });
        await this.#setup_proxies();
        await this.#compress_logs();

        cron.schedule(this.conf["core.compress_logs_schedule"], ()=>this.#compress_logs());
        
        if (this.use_pm2) {
            await pm2("connect", true);
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
    }

    async module_start(m) {
        if (this.#subprocesses[m]) {
            console.warn(`Module '${m}' is already running.`)
            return;
        }
        var run_path = this.modules[m];
        this.logger.info(`Starting ${m} [${run_path}]...`);
        var args = [];
        var node_args = [];
        var env = {
            ...process.env,
            LIVESTREAMER_MODULE_ID: Object.keys(this.modules).indexOf(m)+1,
        };
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
                env,
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
                    env,
                    stdio: ["ignore", "inherit", "inherit", "ipc"]
                });
                // p.send = (msg)=>p.postMessage(msg);
                p.on("exit", exit_handler);
            } else {
                p = child_process.fork(run_path, args, {
                    execArgv: node_args,
                    env,
                    stdio: ["ignore", "inherit", "inherit", "ipc"]
                });
                p.on("error", (err)=>{
                    console.error(err);
                });
                p.on("close", exit_handler);
            }
            this.#subprocesses[m] = p;
        }
    }

    async module_restart(m) {
        if (this.use_pm2) {
            return pm2("restart", `${this.appspace}.${m}`);
        } else {
            await this.module_stop(m);
            await this.module_start(m);
        }
    }

    async module_stop(m) {
        this.logger.info(`Stopping ${m}...`);
        if (this.use_pm2) {
            return pm2("stop", `${this.appspace}.${m}`);
        } else {
            if (this.#subprocesses[m]) {
                this.#ipc.send(m, "core:shutdown");
            }
            await new Promise(resolve=>this.once(`core.stopped.${m}`, resolve));
        }
    }

    async #cleanup_sockets() {
        if (utils.is_windows()) return;
        await fs.emptyDir(this.socket_dir);
    }
    
    async #setup_proxies() {
        var ssl_certs = await this.get_ssl_certs();
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
        /** @type {(req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => void} */
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
        /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
            return async (req, res)=>{
                if (!ssl && this.conf["core.https_port"] && this.conf["core.redirect_http_to_https"]) {
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
            proxy_https_server = https.createServer({...ssl_certs}, create_request_listener(true));
            proxy_https_server.listen(this.conf["core.https_port"]);
            this.#servers.push(proxy_https_server);
            setInterval(async ()=>{
                ssl_certs = await this.get_ssl_certs();
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
        utils.clear(this.#conf);
        Object.assign(this.#conf, config_default);
        for (let conf_path of this.#conf_paths) {
            if (!(await fs.exists(conf_path))) {
                console.error(`conf file '${conf_path}' does not exist.`)
            }
            let conf_json = (await import(pathToFileURL(conf_path))).default;
            console.info(`conf file '${conf_path}' successfully loaded.`);
            for (var k in conf_json) {
                this.#conf[k] = conf_json[k];
            }
        }
        if (this.#opts.config) {
            Object.assign(this.#conf, this.#opts.config);
        }
        await fs.writeFile(this.conf_path, JSON.stringify(this.#conf));
        this.#ipc.emit("update-conf", this.#conf);
    }

    async destroy() {
        console.info("Shutting down...");
        await this.#ipc.emit("core:shutdown");
        await Promise.all(Object.values(this.#subprocesses).map(p=>new Promise(r=>p.on("exit", r))));
        await this.#ipc.destroy();
    }
}

/** @template T @extends {Core<T>} */
export class CoreFork extends Core {
    modules = {}; // just a map of name:path to dir
    #module_id = 0;
    #ready;
    /** @type {Conf} */
    #conf = {};
    /** @type {IPCFork} */
    #ipc;

    get conf() { return this.#conf; }
    get ready() { return this.#ready; }
    get ipc() { return this.#ipc; }
    
    /** @param {string} name @param {T} $ */
    constructor(name, $) {
        super(name, $);
        this.#module_id = +(process.env.LIVESTREAMER_MODULE_ID || 0);
        this.#ready = this.#init();
    }
    
    async #init() {
        let resolved_modules = process.env.LIVESTREAMER_MODULES.split(path.delimiter);
        
        this.modules = module_map(resolved_modules);

        this.#ipc = new IPCFork(this.name, this.get_socket_path(`ipc`));
        this.logger.on("log", (log)=>{
            this.#ipc.emit("internal:log", log);
        });
        
        this.#ipc.respond("internal:get", (...paths)=>{
            return paths.map(p=>utils.reflect.get(this, p));
        });
        
        this.#ipc.on("core:shutdown", async ()=>{
            await this.destroy();
            process.exit(0);
        });

        await this.#load_conf();

        this.#ipc.on("update-conf", ()=>{
            this.#load_conf();
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
    }

    init() {}

    async module_start(m) {
        this.#ipc.emit("core:module_start", m);
    }

    async module_restart(m) {
        this.#ipc.emit("core:module_restart", m);
    }

    async module_stop(m) {
        this.#ipc.emit("core:module_stop", m);
    }

    async #load_conf() {
        utils.clear(this.#conf);
        Object.assign(this.#conf, JSON.parse(await fs.readFile(this.conf_path, "utf-8")));
        this.emit("update-conf", this.#conf);
    }

    async serve({root, build, plugins}) {
        build = build ?? {};
        plugins = plugins ?? [];
        root = path.resolve(root);
        var pages = await glob("**/*.html", {cwd: root});
        if (process.env.BUILD) {
            return express.static(root);
        } else {
            var ssl_certs = await this.get_ssl_certs();
            let vite = await import("vite");
            /** @type {import("vite").UserConfig} */
            var config = {
                configFile: false,
                base: `/${this.name}/`,
                root,
                // outDir: path.resolve(this.tmp_dir, "web", utils.md5(dir)),
                server: {
                    https: {
                        ...ssl_certs,
                    },
                    hmr: {
                        port: 24679 + this.#module_id,
                    },
                    allowedHosts: true,
                    middlewareMode: true
                },
                plugins: [
                    ...plugins
                ],
                build: {
                    minify: false,
                    cssMinify: false,
                    target: "es2020",
                    modulePreload: false,
                    rollupOptions: {
                        input: pages,
                    },
                    sourcemap: "inline",
                    ...build
                },
            }
            const server = await vite.createServer(config);
            server.restart(true);
            return server.middlewares;
        }
    }

    async destroy() {
        super.destroy();
        await this.#ipc.destroy();
    }
}
    
function resolve_module(m) {
    if (!fs.existsSync(m)) m = path.join(root, m);
    var js_exts_str = js_exts.join(",");
    if (fs.statSync(m).isDirectory()) return glob.sync(`${m}/index.{${js_exts_str}}`, {absolute:true})[0];
    else if (minimatch(path.basename(m), `*.{${js_exts_str}}`)) return path.resolve(m);
    console.warn(`Could not resolve module '${m}'`);
}

function module_map(modules) {
    return Object.fromEntries(modules.map(p=>[path.basename(path.dirname(p)), p]));
}

async function pm2(func, ...args) {
    var _pm2 = (await import("pm2")).default;
    var promised_func = utils.promisify(_pm2[func]);
    return promised_func.apply(_pm2, args);
}

export function start(opts) {
    class App extends CoreMaster {
        constructor() {
            super({...opts});
        }
    }
    return new App();
}