import { shell } from "electron";
import { spawn } from "child_process";
import path from "path";
import fsPromises from "fs/promises";
import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "crypto";

export type Result<T, E> = {
    success: true,
    value: T,
} | {
    success: false,
    error: E,
};

export function replaceBackslashesWithForward(str: string) {
    return str.replace(/\\/g, "/");
}

export function makeEndWithForwardSlash(str: string) {
    if(str.substring(str.length - 1) != "/")
        return str + "/";
    return str;
}

export function fileNameContainsInvalidCharacter(name: string) {
    return /[<>:"/\\|?*\0]/.test(name);
}

export function fileNameContainsPath(name: string) {
    return name.includes("/") || name.includes("\\");
}

export function isFiniteAndNonNegative(n: number) {
    return Number.isFinite(n) && n >= 0;
}

export function isFiniteAndNonNegativeInteger(n: number) {
    return Number.isInteger(n) && isFiniteAndNonNegative(n);
}

export function runProcess(
    command: string,
    args: string[],
    env?: NodeJS.ProcessEnv
): Promise<Result<{
    exitCode: number | null,
    stdout: string,
    stderr: string,
}, {
    message: string,
}>> {
    return new Promise(res => {
        const child = spawn(command, args, { windowsHide: true, env });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data: Buffer) => stdout += data.toString());
        child.stderr.on("data", (data: Buffer) => stderr += data.toString());
        child.once("error", err => res({ success: false, error: { message: err.message } }));
        child.once("close", exitCode => res({ success: true, value: { exitCode, stdout, stderr } }));
    });
}

export async function fileExists(
    filePath: string
): Promise<Result<boolean, { message: string}>> {
    try {
        await fsPromises.access(filePath);
        return {
            success: true,
            value: true,
        };
    } catch (error) {
        if(error instanceof Error) {
            if((error as any).code === "ENOENT") {
                return {
                    success: true,
                    value: false,
                }
            }
            return {
                success: false,
                error: { message: `Error checking if file ${filePath} exists: ${error.message}` },
            }
        }
        return {
            success: false,
            error: { message: `Error checking if file ${filePath} exists: An unknown error occurred` },
        };
    }
}

export const FILE_NAME_INCREMENTAL_MAX = 9999;

export async function getAvailableNameIncremental(
    directory: string,
    name: string,
    extension: string,
): Promise<Result<string, { message: string }>> {
    name = name.trim();
    if(name === "")
        return {
            success: false,
            error: { message: `Error getting incremental file name: "${name}" cannot be an empty string` },
        };
    if(fileNameContainsPath(name))
        return {
            success: false,
            error: { message: `Error getting incremental file name: "${name}"  must not include a path` },
        };
    if(fileNameContainsInvalidCharacter(name))
        return {
            success: false,
            error: { message: `Error getting incremental file name: "${name}" must not include invalid characters` },
        };
    if (!extension.startsWith("."))
        extension = "." + extension;

    // Check if original file name is available
    const res = await fileExists(path.join(directory, name + extension));
    if(!res.success)
        return {
            success: false,
            error: { message: `Error getting incremental file name: ${res.error.message}` },
        };
    if(!res.value)
        return {
            success: true,
            value: name,
        };

    // "test" may become "test (2)",
    // "test (2)" may become "test (3)", etc.
    const numberMatch = name.match(/^(.*) \((\d+)\)$/);
    const baseName = numberMatch?.[1] ?? name;
    let number = numberMatch ? Number(numberMatch[2]) + 1 : 2;
    while(number <= FILE_NAME_INCREMENTAL_MAX) {
        let testName = `${baseName} (${number})`;
        const res = await fileExists(path.join(directory, testName + extension));
        if(!res.success)
            return {
                success: false,
                error: { message: `Error getting incremental file name: ${res.error.message}` },
            };
        if(!res.value)
            return {
                success: true,
                value: testName,
            };
        number++;
    }
    return {
        success: false,
        error: { message: `Error getting incremental file name: file name increment cannot exceed ${FILE_NAME_INCREMENTAL_MAX}` },
    };
}

export function dateToWindowsFileTime(date: Date) {
    // Windows FILETIME is in ticks of 100-nanosecond since 1601-01-01.
    // BigInt avoids losing precision
    return ((BigInt(date.getTime()) + 11644473600000n) * 10000n).toString();
}

export async function setPreservedTimestamps(
    videoPath: string,
    birthtime: Date,
    mtime: Date
): Promise<Result<undefined, { message: string}>> {
    // PowerShell is needed to set the creation time of files
    await fsPromises.utimes(videoPath, birthtime, mtime);
    if(process.platform !== "win32")
        return {
            success: false,
            error: { message: `Error setting file timestamps: Platform must be Windows`, },
        };

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
        VIDEO_EDIT_CREATED_FILETIME: dateToWindowsFileTime(birthtime),
        VIDEO_EDIT_MODIFIED_FILETIME: dateToWindowsFileTime(mtime)
    });
    if(!result.success) {
        return {
            success: false,
            error: { message: `Error setting file timestamps: ${result.error.message}`, },
        }
    }
    if(result.value.exitCode !== 0)
        return {
            success: false,
            error: { message: `Error setting file timestamps: ${result.value.stderr.trim()}`, },
        }
    return {
        success: true,
        value: undefined,
    };
}

export async function getVideoDuration(
    videoPath: string
): Promise<Result<number, { message: string, }>> {
    if(!ffmpegPath) {
        return {
            success: false,
            error: { message: `Error getting video duration for ${videoPath}: FFmpeg path does not exist` },
        };
    }

    const result = await runProcess(ffmpegPath, ["-hide_banner", "-i", videoPath]);
    if(!result.success) {
        return {
            success: false,
            error: result.error,
        };
    }

    const match = result.value.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if(!match) {
        return {
            success: false,
            error: { message: `Error getting video duration for ${videoPath}: ${result.value.stderr.trim()}` },
        };
    }

    const [, hours, minutes, seconds] = match;
    return {
        success: true,
        value: Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds),
    };
}

export async function moveFileToRecycleBin(
    filePath: string
): Promise<Result<undefined, { message: string}>> {
    try {
        await shell.trashItem(filePath);
        return {
            success: true,
            value: undefined,
        };
    } catch (error) {
        if(error instanceof Error) {
            return {
                success: false,
                error: { message: `Error moving file to Recycle Bin: ${error.message}` }
            }
        }
        return {
            success: false,
            error: { message: `Error moving file to Recycle Bin: An unknown error occurred` }
        }
    }
}

const SKIP_TRIMMING_THRESHOLD_SECONDS = 0.01;
export async function editAndApply(
    originalVideoPath: string,
    trimStart: number,
    trimEnd: number,
    cropLeft: number,
    cropRight: number,
    cropTop: number,
    cropBottom: number,
    renameValueNoExt?: string
): Promise<Result<{
    outputPath: string,
}, {
    message: string
}>> {
    const ERROR_TITLE = "Error saving edited video:";

    if(!ffmpegPath) {
        return {
            success: false,
            error: { message: `${ERROR_TITLE} FFmpeg path does not exist` },
        };
    }

    originalVideoPath = path.normalize(originalVideoPath);
    const originalExtension = path.extname(originalVideoPath);
    const originalVideoBaseNameNoExt = path.basename(originalVideoPath, originalExtension);
    const outputDirectory = path.dirname(originalVideoPath);

    if(!path.isAbsolute(originalVideoPath))
        return {
            success: false,
            error: { message: `${ERROR_TITLE} original video path "${originalVideoPath}" must be an absolute path` },
        };
    if(!isFiniteAndNonNegative(trimStart) || !isFiniteAndNonNegative(trimEnd))
        return {
            success: false,
            error: { message: `${ERROR_TITLE} invalid trim values (${trimStart} to ${trimEnd})` },
        };
    if(
        !isFiniteAndNonNegativeInteger(cropLeft)
        || !isFiniteAndNonNegativeInteger(cropRight)
        || !isFiniteAndNonNegativeInteger(cropTop)
        || !isFiniteAndNonNegativeInteger(cropBottom)
    )
        return {
            success: false,
            error: { message: `${ERROR_TITLE} invalid crop values (${cropLeft}, ${cropRight}, ${cropTop}, ${cropBottom})` },
        };

    const originalStats = await fsPromises.stat(originalVideoPath);
    if(!originalStats.isFile())
        return {
            success: false,
            error: { message: `${ERROR_TITLE} original video path "${originalVideoPath}" must be a file` },
        };

    const res_duration = await getVideoDuration(originalVideoPath);
    if(!res_duration.success)
        return {
            success: false,
            error: { message: `${ERROR_TITLE} ${res_duration.error.message}` },
        };
    const duration = res_duration.value;

    if(trimEnd <= trimStart)
        return {
            success: false,
            error: { message: `${ERROR_TITLE} trim end has to be after trim start (${trimStart} to ${trimEnd})` },
        };
    if(trimEnd > duration + SKIP_TRIMMING_THRESHOLD_SECONDS)
        return {
            success: false,
            error: { message: `${ERROR_TITLE} trim end cannot exceed the video duration (${trimStart} > ${duration})` },
        };

    let outputPath: string;
    if(renameValueNoExt == null || originalVideoBaseNameNoExt == renameValueNoExt) {
        outputPath = originalVideoPath;
    } else {
        const res_outputPath = await getAvailableNameIncremental(originalVideoPath, renameValueNoExt, originalExtension);
        if(!res_outputPath.success)
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${res_outputPath.error.message}` },
            };
        outputPath = res_outputPath.value;
    }

    const hasCrop = cropLeft !== 0 || cropRight !== 0 || cropTop !== 0 || cropBottom !== 0;
    const hasTrim = trimStart > SKIP_TRIMMING_THRESHOLD_SECONDS || Math.abs(trimEnd - duration) > SKIP_TRIMMING_THRESHOLD_SECONDS;
    if(!hasCrop && !hasTrim) {
        if(outputPath !== originalVideoPath) {
            try {
                await fsPromises.rename(originalVideoPath, outputPath);
            } catch(error) {
                if(error instanceof Error) {
                    return {
                        success: false,
                        error: { message: `${ERROR_TITLE} ${error.message}` },
                    };
                }
                return {
                    success: false,
                    error: { message: `${ERROR_TITLE} An unknown error occurred`},
                };
            }
        }
        return {
            success: true,
            value: {
                outputPath
            },
        };
    }

    const originalVideoNewPath = path.join(
        outputDirectory,
        `.${originalVideoBaseNameNoExt}.${randomUUID()}.original${originalExtension}`
    );
    
    try {
        await fsPromises.rename(originalVideoPath, originalVideoNewPath);
    } catch(error) {
        if(error instanceof Error) {
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${error.message}` },
            };
        }
        return {
            success: false,
            error: { message: `${ERROR_TITLE} An unknown error occurred`},
        };
    }
    
    const ffmpegArgs = [
        "-hide_banner", "-y", "-i", originalVideoPath,
        // Putting -ss after -i makes the trim frame-accurate rather than snapping to a keyframe.
        "-ss", trimStart.toString(), "-t", (trimEnd - trimStart).toString(),
        "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"
    ];

    if(hasCrop) {
        ffmpegArgs.push("-vf");
        ffmpegArgs.push(`crop=iw-${cropLeft}-${cropRight}:ih-${cropTop}-${cropBottom}:${cropLeft}:${cropTop}`);
    }
    
    ffmpegArgs.push(outputPath);

    try {
        const res_process = await runProcess(ffmpegPath, ffmpegArgs);
        if(!res_process.success)
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${res_process.error.message}` },
            };
        if(res_process.value.exitCode !== 0)
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${res_process.value.stderr.trim()}` },
            };

        await setPreservedTimestamps(outputPath, originalStats.birthtime, originalStats.mtime);

        const res_recycle = await moveFileToRecycleBin(originalVideoNewPath);
        if(!res_recycle.success)
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${res_recycle.error.message}` },
            };

        return {
            success: true,
            value: {
                outputPath
            },
        };
    } catch (error) {
        if(error instanceof Error) {
            return {
                success: false,
                error: { message: `${ERROR_TITLE} ${error.message}` },
            };
        }
        return {
            success: false,
            error: { message: `${ERROR_TITLE} An unknown error occurred`},
        };
    }
}