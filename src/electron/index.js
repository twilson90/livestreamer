import squirrel from 'electron-squirrel-startup';
import electron from "electron";
import path from "node:path";

import { CoreFork } from "../core/index.js";

const dirname = import.meta.dirname;

/** @type {electron.BrowserWindow} */
var window;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrel) {
    electron.app.quit();
}

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

        electron.ipcMain.handle('request', async (event, request)=>{
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
        });
        
        // ----------------------------

        class ElectronApp extends CoreFork {
            constructor() {
                super("electron");
            }
            async init() {
                this.data = await this.ipc.request("core", "electron-data");
            }
        }
        var app = new ElectronApp();
        await app.ready;

        var menu = electron.Menu.buildFromTemplate([
            {
                label: 'Menu',
                submenu: [
                    { type: 'separator' },
                    {
                        label:'Save', 
                        accelerator: 'CommandOrControl+S',
                        click: ()=>app.ipc.request("main", "save-sessions")
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
                        label:'Open Installation Folder', 
                        click: ()=>electron.shell.openPath(app.appdata_dir),
                    },
                ],
            },
        ]);

        electron.Menu.setApplicationMenu(menu);

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
                    preload: path.resolve(dirname, "preload.cjs"),
                    nodeIntegration: true
                    // webSecurity: false,
                    // contextIsolation: false,
                    // enableRemoteModule: true,
                    // nodeIntegration: true,
                    // nativeWindowOpen: true,
                }
            });
            if (app.debug) window.webContents.openDevTools();
            window.loadURL(app.get_urls("main").url);
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