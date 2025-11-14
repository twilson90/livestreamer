const electron = require("electron");
const path = require("node:path");
const https = require("https");

/** @type {electron.BrowserWindow} */
var window;

if (electron.app) {

    var api = {
        "showOpenDialog": electron.dialog.showOpenDialog,
        "showSaveDialog": electron.dialog.showSaveDialog,
        "showItemInFolder": electron.shell.showItemInFolder,
        "openExternal": electron.shell.openExternal,
    }

    electron.app.commandLine.appendSwitch('ignore-certificate-errors');
    electron.app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

    electron.protocol.registerSchemesAsPrivileged([
        {
            scheme: "app",
            privileges: {
                standard: true,
                secure: true,
                allowServiceWorkers: true,
                supportFetchAPI: true,
                // corsEnabled: options.isCorsEnabled,
            },
        }
    ]);

    /* electron.ipcMain.on('ondragstart', (event, file_path) => {
    event.sender.startDrag({
        file: path.join(__dirname, file_path),
        // icon: iconName
    })
    }); */

    // Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
    electron.app.on('window-all-closed', function () {
        console.log("electron.app.window-all-closed");
        if (process.platform !== 'darwin') {
            electron.app.quit();
        }
    });

    electron.app.once('before-quit', async (e)=>{
        e.preventDefault();
        console.log("electron.app.quit");
        electron.app.quit();
    });

    electron.app.whenReady().then(async ()=>{

        for (let k in api) {
            electron.ipcMain.handle(k, async (event, ...args)=>{
                return api[k](...args);
            });
        }

        /* electron.ipcMain.handle('request', async (event, request)=>{
            var request = Array.isArray(request) ? request : [request];
            var [fn, args] = request;
            var result = undefined;
            try {
                result = api[fn](...args);
            } catch (e) {
                console.log(e);
            }
            if (typeof result === "function") result = result.apply(null, args);
            result = await Promise.resolve(result);
            return result;
        }); */
        
        // ----------------------------

        var menu = electron.Menu.buildFromTemplate([
            {
                label: 'Menu',
                submenu: [
                    { type: 'separator' },
                    {
                        label:'Save All', 
                        accelerator: 'CommandOrControl+S',
                        click: ()=>app.ipc.request("main", "save_sessions")
                    },
                    { type: 'separator' },
                    {
                        label:'Exit',
                        accelerator: 'CommandOrControl+W',
                        click: ()=>electron.app.quit()
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    {
                        label:'Reload', 
                        accelerator: 'CommandOrControl+R',
                        click: ()=>window.reload()
                    },
                    {
                        label:'Toggle Developer Tools',
                        accelerator: 'CommandOrControl+Shift+I',
                        click: ()=>window.webContents.toggleDevTools()
                    }
                ],
            },
            {
                label: 'Other',
                submenu: [
                    {
                        label:'Open AppData Folder', 
                        click: ()=>electron.shell.openPath(app.appdata_dir),
                    },
                    {
                        label:'Open Installation Folder', 
                        click: ()=>electron.shell.openPath(electron.app.getAppPath()),
                    },
                ],
            },
        ]);

        electron.Menu.setApplicationMenu(menu);

        /** @type {import("../core/exports.js").CoreMaster} */
        const app = globalThis.app

        async function create_window() {
            if (electron.BrowserWindow.getAllWindows().length > 0) {
                return;
            }
            console.log("Creating Window");
            window = new electron.BrowserWindow({
                width: 1280,
                height: 720,
                minHeight: 300,
                minWidth: 500,
                title: 'Live Streamer',
                icon: "icon.png",
                // show: false,
                webPreferences: {
                    preload: path.resolve(__dirname, "preload.cjs"),
                    nodeIntegration: true
                    // webSecurity: false,
                    // contextIsolation: false,
                    // enableRemoteModule: true,
                    // nodeIntegration: true,
                    // nativeWindowOpen: true,
                }
            });
            
            if (app.debug) window.webContents.openDevTools();

            var html = `
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .loader {
                    width: 50px;
                    aspect-ratio: 1;
                    display: grid;
                    border: 4px solid #0000;
                    border-radius: 50%;
                    border-right-color: #25b09b;
                    animation: l15 1s infinite linear;
                }
                .loader::before,
                .loader::after {    
                    content: "";
                    grid-area: 1/1;
                    margin: 2px;
                    border: inherit;
                    border-radius: 50%;
                    animation: l15 2s infinite;
                }
                .loader::after {
                    margin: 8px;
                    animation-duration: 3s;
                }
                @keyframes l15{ 
                    100%{transform: rotate(1turn)}
                }
            </style>
            <div class="loader"></div>`;
            window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
            
            await app.ready;
            var url = app.get_urls("main").url;
            app.ipc.on("main.web.ready", ()=>{
                window.loadURL(url);
            });
        }

        if (process.platform === 'darwin') {
            electron.app.on('activate', ()=>{
                // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
                create_window();
            });
        } else {
            create_window();
        }
    });
}