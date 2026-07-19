import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { HtmlConnection } from "../EventSignals/HtmlConnection.js";
import { pmod } from "../Utility/MathUtility.js";
import { CustomScrollbar } from "./CustomScrollbar.js";
import { NotificationIconType, NotificationSystem } from "./NotificationSystem.js";

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
    while(true) {
        const content = vdv.contentEl;
        if(content == null) {
            await delay(500);
            continue;
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
            continue;
        }
        const fileView = vdv.videos[index]!;

        const img = document.createElement("img");
        fileView.containerEl.appendChild(img);
        img.classList.add("vdv-video-thumbnail");
        fileView.thumbnailEl = img;
        img.style.display = "none";

        fileView.hasThumbnail = true;
        video.pause();
        video.removeAttribute("src");
        video.load();
        const success_src = await setVideoSrcAndWaitForMetadata(video, fileView.path);
        if(!success_src) {
            await delay(10);
            continue;
        }
        await setVideoCurrentTimeAndWait(video, 0);
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
            continue;
        }

        img.onload = () => {
            img.style.display = "block";
        }
        img.src = url;

        await delay(10);
    }
}

export class VdvVideo {
    containerEl: HTMLDivElement;
    contentEl: HTMLDivElement;
    thumbnailEl?: HTMLImageElement;
    thumbnailUrl?: string = "";
    titleEl: HTMLDivElement;
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
}

export class VideoDirectoryViewer {
    containerEl: HTMLDivElement;
    contentEl?: HTMLDivElement;
    scrollbar?: CustomScrollbar;
    videos: VdvVideo[] = [];
    directory: string = "";
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(
        public notificationSystem: NotificationSystem,
    ) {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("vdv-container");

        startThumbnailLoader(this);
    }

    loadVideos(
        directory: string,
        videos: {
            name: string,
            path: string,
            dateModified: number,
        }[],
    ) {
        if(this.contentEl) {
            this.contentEl.remove();
            delete this.contentEl;
        }
        if(this.scrollbar) {
            this.scrollbar.remove();
            delete this.scrollbar;
        }
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
    }

    unloadVideos() {
        this.containerEl.innerHTML = "";
    }
}