import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { CustomScrollbar } from "./CustomScrollbar.js";

async function delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

async function startThumbnailLoader(vdv: VideoDirectoryViewer) {
    while(true) {
        let rect = vdv.containerEl.getBoundingClientRect();
        let gridWidth = Math.floor(rect.width / 200);
        let index = Math.floor(vdv.containerEl.scrollTop / 150) * gridWidth;
        await delay(100);
    }
}

export class VdvVideo {
    containerEl: HTMLDivElement;
    contentEl: HTMLDivElement;
    thumbnailEl?: HTMLImageElement;
    titleEl: HTMLDivElement;
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
    directory: string = "";
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor() {
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
        }
    }

    unloadVideos() {
        this.containerEl.innerHTML = "";
    }
}