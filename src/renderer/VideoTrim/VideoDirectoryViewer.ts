import { ConnectionOwner } from "../../shared/EventSignals/ConnectionOwner.js";
import { HtmlConnection } from "../../shared/EventSignals/HtmlConnection.js";
import { shuffleInPlace } from "../../shared/Utility/ArrayUtility.js";
import { pmod } from "../../shared/Utility/MathUtility.js";
import { formatVideoDuration } from "../../shared/Utility/StringUtility.js";
import { CustomScrollbar } from "../Ui/CustomScrollbar.js";
import { NotificationIconType, NotificationSystem } from "../Ui/NotificationSystem.js";

async function delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

function setVideoSrcAndWaitForMetadata(
    video: HTMLVideoElement,
    src: string
) {
    return new Promise<boolean>(res => {
        let connectionOwner = new ConnectionOwner();
        new HtmlConnection(video, "loadedmetadata", () => {
            connectionOwner.disconnectAll();
            res(true);
        }, { owners: [ connectionOwner ] });
        new HtmlConnection(video, "error", () => {
            connectionOwner.disconnectAll();
            res(false);
        }, { owners: [ connectionOwner ] });
        video.src = src;
    });
}

function setVideoCurrentTimeAndWait(video: HTMLVideoElement, currentTime: number) {
    return new Promise<void>(res => {
        let connectionOwner = new ConnectionOwner();
        new HtmlConnection(video, "seeked", () => {
            connectionOwner.disconnectAll();
            res();
        }, { owners: [ connectionOwner ] });
        video.currentTime = currentTime;
    });
}

async function startThumbnailLoader(vdv: VideoDirectoryViewer) {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = 140;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if(ctx == null) {
        const notif = vdv.notificationSystem.sendActiveNotification({
            title: "Fatal Error",
            iconType: NotificationIconType.ERROR,
            description: "CanvasRenderingContext2D not supported",
        });
        notif.addViewDetailsLink();
        throw new Error("CanvasRenderingContext2D not supported");
    }
    const iteration = async () => {
        const content = vdv.contentEl;
        if(content == null) {
            await delay(500);
            return;
        }
        let rect = vdv.containerEl.getBoundingClientRect();
        let gridWidth = Math.floor(rect.width / 160);
        let startIndex = pmod(Math.floor(content.scrollTop / 120) * gridWidth, vdv.videos.length);
        if(!Number.isFinite(startIndex))
            startIndex = 0;
        let index = startIndex;
        let hasThumbCount = 0;
        while(hasThumbCount < vdv.videos.length && vdv.videos[index]!.hasThumbnail) {
            index = pmod(index + 1, vdv.videos.length);
            hasThumbCount++;
        }
        if(hasThumbCount >= vdv.videos.length) {
            await delay(500);
            return;
        }
        const fileView = vdv.videos[index]!;

        const img = document.createElement("img");
        fileView.containerEl.appendChild(img);
        img.classList.add("vdv-video-thumbnail");
        fileView.thumbnailEl = img;
        img.style.display = "none";

        const durationEl = document.createElement("div");
        fileView.contentEl.appendChild(durationEl);
        durationEl.classList.add("vdv-video-duration");
        durationEl.textContent = "0:00";

        fileView.hasThumbnail = true;
        
        video.pause();
        video.removeAttribute("src");
        video.load();
        const success_src = await setVideoSrcAndWaitForMetadata(video, fileView.path);
        if(!success_src) {
            await delay(10);
            return;
        }
        await setVideoCurrentTimeAndWait(video, 0);

        durationEl.textContent = formatVideoDuration(video.duration);
        fileView.duration = video.duration;

        let sourceWidth = 0;
        let sourceHeight = 0;
        if(video.videoWidth / video.videoHeight > canvas.width / canvas.height) {
            sourceHeight = video.videoHeight;
            sourceWidth = sourceHeight * canvas.width / canvas.height;
        } else {
            sourceWidth = video.videoWidth;
            sourceHeight = sourceWidth * canvas.height / canvas.width;
        }
        ctx.drawImage(
            video,
            Math.floor((video.videoWidth - sourceWidth) / 2),
            Math.floor((video.videoHeight - sourceHeight) / 2),
            Math.floor(sourceWidth),
            Math.floor(sourceHeight),
            0, 0, canvas.width, canvas.height
        );
        let url: string | undefined = undefined;
        await new Promise<void>(res => {
            canvas.toBlob(blob => {
                if(blob) {
                    url = URL.createObjectURL(blob);
                    fileView.thumbnailUrl = url;
                }
                res();
            });
        });
        if(!url) {
            await delay(10);
            return;
        }

        img.onload = () => {
            img.style.display = "block";
        }
        img.src = url;

        await delay(10);
    }
    while(true) {
        await iteration();
        if(vdv.sortMethod == VdvSortMethod.DURATION_LONG || vdv.sortMethod == VdvSortMethod.DURATION_SHORT)
            vdv.updateVideoSort();
    }
}

export class VdvVideo {
    containerEl: HTMLDivElement;
    contentEl: HTMLDivElement;
    thumbnailEl?: HTMLImageElement;
    thumbnailUrl?: string = "";
    titleEl: HTMLDivElement;
    duration?: number;
    hasThumbnail: boolean = false;
    constructor(
        public title: string,
        public path: string,
        public dateModified: number,
    ) {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("vdv-video-container");

        this.contentEl = document.createElement("div");
        this.containerEl.appendChild(this.contentEl);
        this.contentEl.classList.add("vdv-video-content");

        this.titleEl = document.createElement("div");
        this.contentEl.appendChild(this.titleEl);
        this.titleEl.classList.add("vdv-video-title");
        this.titleEl.textContent = title;
    }
    remove() {
        if(this.thumbnailUrl) {
            URL.revokeObjectURL(this.thumbnailUrl);
            delete this.thumbnailUrl;
        }
        this.containerEl.remove();
    }
}

export enum VdvSortMethod {
    DATE_RECENT = 0,
    DATE_OLD = 1,
    NAME_A_Z = 2,
    NAME_Z_A = 3,
    DURATION_LONG = 5,
    DURATION_SHORT = 6,
    SIZE_BIG = 7,
    SIZE_SMALL = 8,
    OTHER_RANDOM = 4,
};

export class VideoDirectoryViewer {
    containerEl: HTMLDivElement;
    contentEl?: HTMLDivElement;
    scrollbar?: CustomScrollbar;
    videos: VdvVideo[] = [];
    directory: string = "";
    isLoaded: boolean = false;
    sortMethod: VdvSortMethod = VdvSortMethod.DATE_RECENT;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(
        public notificationSystem: NotificationSystem,
    ) {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("vdv-container");

        startThumbnailLoader(this);
    }

    updateVideoSort() {
        switch(this.sortMethod) {
            case VdvSortMethod.DATE_RECENT:
                this.sortVideos((a, b) => {
                    return b.dateModified - a.dateModified;
                });
                break;
            case VdvSortMethod.DATE_OLD:
                this.sortVideos((a, b) => {
                    return a.dateModified - b.dateModified;
                });
                break;
            case VdvSortMethod.NAME_A_Z:
                this.sortVideos((a, b) => {
                    return a.title.localeCompare(b.title);
                });
                break;
            case VdvSortMethod.NAME_Z_A:
                this.sortVideos((a, b) => {
                    return b.title.localeCompare(a.title);
                });
                break;
            case VdvSortMethod.DURATION_LONG:
                this.sortVideos((a, b) => {
                    if(a.duration != null && b.duration == null)
                        return -1;
                    if(a.duration == null && b.duration != null)
                        return 1;
                    if(a.duration == null && b.duration == null)
                        return b.dateModified - a.dateModified;
                    return b.duration! - a.duration!;
                });
                break;
            case VdvSortMethod.DURATION_SHORT:
                this.sortVideos((a, b) => {
                    if(a.duration != null && b.duration == null)
                        return -1;
                    if(a.duration == null && b.duration != null)
                        return 1;
                    if(a.duration == null && b.duration == null)
                        return b.dateModified - a.dateModified;
                    return a.duration! - b.duration!;
                });
                break;
            case VdvSortMethod.OTHER_RANDOM:
                shuffleInPlace(this.videos);
                this.videos.forEach(video => this.contentEl!.appendChild(video.containerEl));
                break;
        }
    }

    sortVideos(callback: (a: VdvVideo, b: VdvVideo) => number) {
        if(this.contentEl == null)
            return;
        this.videos.sort((a, b) => {
            return callback(a, b);
        });
        this.videos.forEach(video => this.contentEl!.appendChild(video.containerEl));
    }

    loadVideos(
        directory: string,
        videos: {
            name: string,
            path: string,
            dateModified: number,
        }[],
    ) {
        this.unloadVideos();
        this.isLoaded = true;
        videos = videos.filter(file => {
            const name = file.name.toLowerCase();
            if(name.endsWith(".mp4"))
                return true;
            return false;
        });
        const content = document.createElement("div");
        this.containerEl.appendChild(content);
        content.classList.add("vdv-content");
        this.contentEl = content;
        this.directory = directory;
        this.scrollbar = new CustomScrollbar(content);
        this.containerEl.appendChild(this.scrollbar.containerEl);
        this.scrollbar.containerEl.style.right = "0px";
        this.scrollbar.containerEl.style.top = "0px";
        this.scrollbar.updateHandlePosition();

        for(let i=0; i<videos.length; i++) {
            const file = videos[i]!;
            let vdvv = new VdvVideo(file.name, file.path, file.dateModified);
            content.appendChild(vdvv.containerEl);
            this.videos.push(vdvv);
        }

        this.updateVideoSort();
    }

    unloadVideos() {
        if(this.contentEl) {
            this.contentEl.remove();
            delete this.contentEl;
        }
        if(this.scrollbar) {
            this.scrollbar.remove();
            delete this.scrollbar;
        }
        this.isLoaded = false;
        this.videos.forEach(video => video.remove());
        this.videos = [];
    }
}