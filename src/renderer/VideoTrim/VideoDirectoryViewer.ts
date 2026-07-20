import { ConnectionOwner } from "../../shared/EventSignals/ConnectionOwner.js";
import { HtmlConnection } from "../../shared/EventSignals/HtmlConnection.js";
import { shuffleInPlace } from "../../shared/Utility/ArrayUtility.js";
import { pmod } from "../../shared/Utility/MathUtility.js";
import { delay } from "../../shared/Utility/PromiseUtility.js";
import { formatVideoDuration } from "../../shared/Utility/StringUtility.js";
import { loadVideo, loadVideoMetadata, seekVideo, unloadVideo } from "../../shared/Utility/VideoUtility.js";
import { CustomScrollbar } from "../Ui/CustomScrollbar.js";
import { NotificationIconType, NotificationSystem } from "../Ui/NotificationSystem.js";

let allMetadataLoaded = false;
let metadataCompleteCount = 0;
let allThumbnailsLoaded = false;
let thumbnailCompleteCount = 0;

async function startMetadataLoader(vdv: VideoDirectoryViewer) {
    const video = document.createElement("video");
    const getIndex = (content: HTMLDivElement) => {
        let rect = vdv.containerEl.getBoundingClientRect();
        let gridWidth = Math.floor(rect.width / 160);
        let index = pmod(Math.floor(content.scrollTop / 120) * gridWidth, vdv.videos.length);
        if(!Number.isFinite(index))
            index = 0;
        return index;
    }
    const loadNextMetadata = async () => {
        const content = vdv.contentEl;
        if(content == null)
            return;
        let index = getIndex(content);
        let completeCount = 0;
        while(completeCount < vdv.videos.length && vdv.videos[index]!.hasMetadata) {
            index = pmod(index + 1, vdv.videos.length);
            completeCount++;
        }
        if(completeCount >= vdv.videos.length) {
            allMetadataLoaded = true;
            vdv.progressEl.style.opacity = "0";
            vdv.progressEl.animate([
                { opacity: "1", },
                { opacity: "1", },
                { opacity: "1", },
                { opacity: "0", },
            ], { duration: 700, easing: "ease-out" });
            return;
        }
        const fileView = vdv.videos[index]!;
        fileView.hasMetadata = true;
        metadataCompleteCount++;
        vdv.progressValueEl.getAnimations().forEach(anim => anim.cancel());
        vdv.progressValueEl.style.width = (metadataCompleteCount / vdv.videos.length * 100) + "%";

        const success_src = await loadVideoMetadata(video, fileView.path);
        if(!success_src)
            return;
        
        fileView.duration = video.duration;

        const durationEl = document.createElement("div");
        fileView.contentEl.appendChild(durationEl);
        durationEl.classList.add("vdv-video-duration");
        durationEl.textContent = "0:00";

        durationEl.textContent = formatVideoDuration(video.duration);

        unloadVideo(video);
    }
    while(true) {
        while(!allMetadataLoaded) {
            await loadNextMetadata();
            await delay(1);
        }
        await delay(500);
    }
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
    const getIndex = (content: HTMLDivElement) => {
        let rect = vdv.containerEl.getBoundingClientRect();
        let gridWidth = Math.floor(rect.width / 160);
        let index = pmod(Math.floor(content.scrollTop / 120) * gridWidth, vdv.videos.length);
        if(!Number.isFinite(index))
            index = 0;
        return index;
    }
    const loadNextThumbnail = async () => {
        const content = vdv.contentEl;
        if(content == null)
            return;
        let index = getIndex(content);
        let completeCount = 0;
        while(completeCount < vdv.videos.length && vdv.videos[index]!.hasThumbnail) {
            index = pmod(index + 1, vdv.videos.length);
            completeCount++;
        }
        if(completeCount >= vdv.videos.length) {
            allThumbnailsLoaded = true;
            return;
        }
        const fileView = vdv.videos[index]!;
        fileView.hasThumbnail = true;
        thumbnailCompleteCount++;

        unloadVideo(video);
        const success_src = await loadVideo(video, fileView.path);
        if(!success_src)
            return;
        await seekVideo(video, 0);

        fileView.duration = video.duration;

        const img = document.createElement("img");
        fileView.containerEl.appendChild(img);
        img.classList.add("vdv-video-thumbnail");
        fileView.thumbnailEl = img;
        img.style.display = "none";

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
            return;
        }

        img.onload = () => {
            img.style.display = "block";
        }
        img.src = url;
    }
    while(true) {
        while(!allThumbnailsLoaded) {
            await loadNextThumbnail();
            if(vdv.sortMethod == VdvSortMethod.DURATION_LONG || vdv.sortMethod == VdvSortMethod.DURATION_SHORT)
                vdv.updateVideoSort();
            await delay(1);
        }
        await delay(500);
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
    hasMetadata: boolean = false;
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
    progressEl: HTMLDivElement;
    progressValueEl: HTMLDivElement;
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

        this.progressEl = document.createElement("div");
        this.containerEl.appendChild(this.progressEl);
        this.progressEl.classList.add("vdv-progress");

        this.progressValueEl = document.createElement("div");
        this.progressEl.appendChild(this.progressValueEl);
        this.progressValueEl.classList.add("vdv-progress-value");

        startThumbnailLoader(this);
        startMetadataLoader(this);
        startMetadataLoader(this);
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
        this.progressEl.getAnimations().forEach(anim => anim.cancel());
        this.progressEl.style.opacity = "1";
        this.isLoaded = true;
        allMetadataLoaded = false;
        metadataCompleteCount = 0;
        allThumbnailsLoaded = false;
        thumbnailCompleteCount = 0;
        this.progressValueEl.getAnimations().forEach(anim => anim.cancel());
        this.progressValueEl.style.width = "0px";
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
        if(!allMetadataLoaded) {
            this.progressEl.style.opacity = "0";
            this.progressEl.animate([
                { opacity: "1", },
                { opacity: "1", },
                { opacity: "1", },
                { opacity: "0", },
            ], { duration: 700, easing: "ease-out", });
        }
    }
}