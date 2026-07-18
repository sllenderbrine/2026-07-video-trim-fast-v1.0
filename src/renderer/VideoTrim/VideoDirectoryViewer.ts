import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";

async function delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

async function startThumbnailLoader(vdv: VideoDirectoryViewier) {
    while(true) {
        let rect = vdv.containerEl.getBoundingClientRect();
        let gridWidth = Math.floor(rect.width / 200);
        let index = Math.floor(vdv.containerEl.scrollTop / 150) * gridWidth;
    }
}

export class VideoDirectoryViewier {
    containerEl: HTMLDivElement;
    contentEl?: HTMLDivElement;
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
            dateModified: number,
        }[],
    ) {
        if(this.contentEl) {
            this.contentEl.remove();
            delete this.contentEl;
        }
        const content = document.createElement("div");
        this.containerEl.appendChild(content);
        content.classList.add("vdv-content");
        this.contentEl = content;
        this.directory = directory;
    }
}