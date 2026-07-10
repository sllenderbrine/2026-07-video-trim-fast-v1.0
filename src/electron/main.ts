import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from "electron";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const NO_EDIT_THRESHOLD_SECONDS = 0.01;

type VideoEditResult = {
    path: string;
    recycledOriginal: boolean;
};

function assertFiniteNonNegative(value: number, name: string) {
    if(!Number.isFinite(value) || value < 0)
        throw new Error(`${name} must be a finite, non-negative number.`);
}

function assertCropValue(value: number, name: string) {
    assertFiniteNonNegative(value, name);
    if(!Number.isInteger(value))
        throw new Error(`${name} must be a whole number of pixels.`);
}

function runProcess(command: string, args: string[], env?: NodeJS.ProcessEnv) {
    return new Promise<{ exitCode: number | null, stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true, env });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data: Buffer) => stdout += data.toString());
        child.stderr.on("data", (data: Buffer) => stderr += data.toString());
        child.once("error", reject);
        child.once("close", exitCode => resolve({ exitCode, stdout, stderr }));
    });
}

async function getVideoDuration(videoPath: string) {
    if(!ffmpegPath)
        throw new Error("The bundled FFmpeg binary is unavailable on this platform.");

    // FFmpeg writes input metadata, including Duration, to stderr and exits with
    // code 1 when no output file is supplied. This only inspects the video.
    const result = await runProcess(ffmpegPath, ["-hide_banner", "-i", videoPath]);
    const match = result.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if(!match)
        throw new Error(`Could not determine the duration of "${videoPath}". ${result.stderr.trim()}`);

    const [, hours, minutes, seconds] = match;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

async function getOutputPath(originalPath: string, requestedName?: string) {
    const directory = path.dirname(originalPath);
    const originalExtension = path.extname(originalPath);
    if(!requestedName)
        return originalPath;

    const trimmedName = requestedName.trim();
    if(!trimmedName)
        throw new Error("The new video name cannot be empty.");
    if(trimmedName.includes("/") || trimmedName.includes("\\") || trimmedName.includes("\0"))
        throw new Error("The new video name must not include a path.");

    const requestedBaseName = trimmedName.toLowerCase().endsWith(originalExtension.toLowerCase())
        ? trimmedName.slice(0, -originalExtension.length)
        : trimmedName;
    const requestedPath = path.join(directory, requestedBaseName + originalExtension);
    if(requestedPath === originalPath || !await fileExists(requestedPath))
        return requestedPath;

    // "test" becomes "test (2)", then "test (3)", and so on. If a numbered
    // name was explicitly requested, continue counting from that number.
    const numberMatch = requestedBaseName.match(/^(.*) \((\d+)\)$/);
    const baseName = numberMatch?.[1] ?? requestedBaseName;
    let number = numberMatch ? Number(numberMatch[2]) + 1 : 2;
    while(true) {
        const candidatePath = path.join(directory, `${baseName} (${number})${originalExtension}`);
        if(!await fileExists(candidatePath))
            return candidatePath;
        number++;
    }
}

async function fileExists(filePath: string) {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        if((error as NodeJS.ErrnoException).code === "ENOENT")
            return false;
        throw error;
    }
}

async function setPreservedTimestamps(videoPath: string, birthtime: Date, mtime: Date) {
    // Node can set the modified time on every platform. On Windows, PowerShell
    // also provides the creation-time operation that Node's fs API lacks.
    await fs.utimes(videoPath, birthtime, mtime);
    if(process.platform !== "win32")
        return;

    const command = [
        "$target = $env:VIDEO_EDIT_TIMESTAMP_PATH",
        "$created = [DateTime]::FromFileTimeUtc([Int64]$env:VIDEO_EDIT_CREATED_FILETIME)",
        "$modified = [DateTime]::FromFileTimeUtc([Int64]$env:VIDEO_EDIT_MODIFIED_FILETIME)",
        "[System.IO.File]::SetCreationTimeUtc($target, $created)",
        "[System.IO.File]::SetLastWriteTimeUtc($target, $modified)"
    ].join("; ");
    // -EncodedCommand is UTF-16LE. Passing the values through a child-only
    // environment avoids interpreting a user-controlled path as PowerShell code.
    const encodedCommand = Buffer.from(command, "utf16le").toString("base64");
    const result = await runProcess("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodedCommand
    ], {
        ...process.env,
        VIDEO_EDIT_TIMESTAMP_PATH: videoPath,
        VIDEO_EDIT_CREATED_FILETIME: toWindowsFileTime(birthtime),
        VIDEO_EDIT_MODIFIED_FILETIME: toWindowsFileTime(mtime)
    });
    if(result.exitCode !== 0)
        throw new Error(`Failed to preserve video timestamps. ${result.stderr.trim()}`);
}

function toWindowsFileTime(date: Date) {
    // Windows FILETIME is 100-nanosecond ticks since 1601-01-01. BigInt avoids
    // losing precision for present-day dates.
    return ((BigInt(date.getTime()) + 11644473600000n) * 10000n).toString();
}

async function moveOriginalToRecycleBin(originalPath: string) {
    try {
        await shell.trashItem(originalPath);
        return true;
    } catch (error) {
        console.warn("Could not move original video to the Recycle Bin", error);
        return false;
    }
}

async function replaceOriginalWithEdited(sourcePath: string, temporaryPath: string, outputPath: string) {
    const backupPath = path.join(
        path.dirname(sourcePath),
        `.${path.basename(sourcePath, path.extname(sourcePath))}.${randomUUID()}.original${path.extname(sourcePath)}`
    );

    // Do not discard the original until the edited file has taken its place.
    // If the second rename fails, move the untouched original back immediately.
    await fs.rename(sourcePath, backupPath);
    try {
        await fs.rename(temporaryPath, outputPath);
    } catch (error) {
        await fs.rename(backupPath, sourcePath);
        throw error;
    }

    return moveOriginalToRecycleBin(backupPath);
}

async function editAndApply(
    originalVideoPath: string,
    trimStart: number,
    trimEnd: number,
    cropLeft: number,
    cropRight: number,
    cropTop: number,
    cropBottom: number,
    name?: string
): Promise<VideoEditResult> {
    if(typeof originalVideoPath !== "string" || !path.isAbsolute(originalVideoPath))
        throw new Error("originalVideoPath must be an absolute file path.");
    assertFiniteNonNegative(trimStart, "trimStart");
    assertFiniteNonNegative(trimEnd, "trimEnd");
    assertCropValue(cropLeft, "cropLeft");
    assertCropValue(cropRight, "cropRight");
    assertCropValue(cropTop, "cropTop");
    assertCropValue(cropBottom, "cropBottom");

    const sourcePath = path.normalize(originalVideoPath);
    const sourceStats = await fs.stat(sourcePath);
    if(!sourceStats.isFile())
        throw new Error("originalVideoPath must point to a file.");

    const duration = await getVideoDuration(sourcePath);
    if(trimEnd <= trimStart)
        throw new Error("trimEnd must be after trimStart.");
    if(trimEnd > duration + NO_EDIT_THRESHOLD_SECONDS)
        throw new Error(`trimEnd (${trimEnd}) is after the video duration (${duration}).`);

    const outputPath = await getOutputPath(sourcePath, name);

    const hasCrop = cropLeft !== 0 || cropRight !== 0 || cropTop !== 0 || cropBottom !== 0;
    const hasTrim = trimStart > NO_EDIT_THRESHOLD_SECONDS
        || Math.abs(trimEnd - duration) > NO_EDIT_THRESHOLD_SECONDS;
    if(!hasCrop && !hasTrim) {
        if(outputPath !== sourcePath)
            await fs.rename(sourcePath, outputPath);
        return { path: outputPath, recycledOriginal: false };
    }

    if(!ffmpegPath)
        throw new Error("The bundled FFmpeg binary is unavailable on this platform.");

    const extension = path.extname(outputPath);
    const temporaryPath = path.join(
        path.dirname(sourcePath),
        `.${path.basename(sourcePath, path.extname(sourcePath))}.${randomUUID()}.editing${extension}`
    );
    const filter = hasCrop
        ? `crop=iw-${cropLeft}-${cropRight}:ih-${cropTop}-${cropBottom}:${cropLeft}:${cropTop}`
        : undefined;
    const ffmpegArgs = [
        "-hide_banner", "-y", "-i", sourcePath,
        // Putting -ss after -i makes the trim frame-accurate rather than snapping to a keyframe.
        "-ss", trimStart.toString(), "-t", (trimEnd - trimStart).toString(),
        "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"
    ];
    if(filter)
        ffmpegArgs.push("-vf", filter);
    ffmpegArgs.push(temporaryPath);

    try {
        const result = await runProcess(ffmpegPath, ffmpegArgs);
        if(result.exitCode !== 0)
            throw new Error(`FFmpeg could not edit the video. ${result.stderr.trim()}`);

        await setPreservedTimestamps(temporaryPath, sourceStats.birthtime, sourceStats.mtime);
        const recycledOriginal = await replaceOriginalWithEdited(sourcePath, temporaryPath, outputPath);
        return { path: outputPath, recycledOriginal };
    } catch (error) {
        await fs.rm(temporaryPath, { force: true });
        throw error;
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        autoHideMenuBar: true,
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

    win.loadFile(path.join(__dirname, "..", "..", "index.html"));
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
    async (_, dirPath: string): Promise<{
        files: {
            path: string,
            name: string,
            modified: number
        }[],
        success: boolean
    }> => {
        try {
            let entries = await fs.readdir(dirPath, { withFileTypes: true });
            entries = entries.filter(entry => entry.isFile());
            const files = await Promise.all(
                entries.map(async entry => {
                    const fullPath = backslashesToForward(path.join(dirPath, entry.name));
                    const stats = await fs.stat(fullPath);

                    return {
                        path: fullPath,
                        name: entry.name,
                        modified: stats.mtimeMs
                    };
                })
            );

            return { files, success: true };
        } catch (err) {
            console.error("Failed to get directory list:", err);
            return { files: [], success: false };
        }
    }
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
    (_, originalVideoPath: string, trimStart: number, trimEnd: number, cropLeft: number, cropRight: number, cropTop: number, cropBottom: number, name?: string) =>
        editAndApply(originalVideoPath, trimStart, trimEnd, cropLeft, cropRight, cropTop, cropBottom, name)
);

// initialize
init();
