import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from "electron";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { editAndApply, getVideosInFolder } from "./ElectronUtility.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = app.getAppPath();

let mainWindow: BrowserWindow;

if(app.isPackaged) {
    // Disables dev shortcuts
    Menu.setApplicationMenu(null);
}

function backslashesToForward(str: string) {
    return str.replace(/\\/g, "/");
}

function endWithForwardSlash(str: string) {
    if(str.substring(str.length - 1) != "/")
        return str + "/";
    return str;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 450,
        minHeight: 250,
        frame: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "../../resources/icons/app.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    return mainWindow;
}

async function init() {
    await app.whenReady();

    const win = createMainWindow();

    win.loadFile(path.join(root, "resources", "html", "index.html"));
}

// Window API
ipcMain.on("window-close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("window-minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if(!win) return;
    if(win.isMaximized()) win.restore();
    else win.maximize();
});

ipcMain.on("window-move", (event, x: number, y: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if(!win) return;
    let [x1, y1] = win.getPosition() as [number, number];
    win.setPosition(x1 + x, y1 + y);
});

// File API
ipcMain.handle(
    "get-directory-file-list",
    async (_, directory: string) => getVideosInFolder(directory),
);

ipcMain.handle("prompt-choose-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Choose Folder",
        properties: ["openDirectory"]
    });

    if (result.canceled || !result.filePaths[0]) {
        return null;
    }

    return endWithForwardSlash(backslashesToForward(result.filePaths[0]));
});

// Video editing API
ipcMain.handle(
    "video-edit-and-apply",
    (
        _,
        originalVideoPath: string,
        trimStart: number,
        trimEnd: number,
        cropLeft: number,
        cropRight: number,
        cropTop: number,
        cropBottom: number,
        renameValueNoExt?: string,
    ) =>
        editAndApply(
            originalVideoPath,
            trimStart,
            trimEnd,
            cropLeft,
            cropRight,
            cropTop,
            cropBottom,
            renameValueNoExt,
        )
);

// Redirect API
ipcMain.on("open-github-repo", (event) => {
    shell.openExternal("https://github.com/sllenderbrine/2026-07-simple-video-trimmer-r1");
});

// initialize
init();
