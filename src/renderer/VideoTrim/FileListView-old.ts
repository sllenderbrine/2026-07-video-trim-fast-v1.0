import { Signal } from "../EventSignals/Signal.js";
import { get2dContext } from "../Utility/Canvas2dUtility.js";
import { joinPaths } from "../Utility/FilePathUtility.js";
import { pmod } from "../Utility/MathUtility.js";

const PATH_RESOURCES = "..";
const PATH_ICONS = joinPaths(PATH_RESOURCES, "icons");

export enum FlvSortMethod {
    RECENT = 0,
    OLD = 1,
    A_Z = 2,
    Z_A = 3,
};

export type ListItem = {
    file: {
        path: string,
        name: string,
        modified: number
    },
    container: HTMLDivElement,
    nameLabel: HTMLDivElement,
    hasThumb: boolean,
};

export class FileListView {
    accessContainerEl: HTMLDivElement;
    directoryLabelEl: HTMLDivElement;
    changeDirectoryButtonEl: HTMLButtonElement;
    refreshButtonEl: HTMLButtonElement;
    containerEl: HTMLDivElement;
    videoListContainerEl?: HTMLDivElement;
    processingFileSystem: boolean = false;
    videoLoadingId: number = 0;
    videoDirectory: string = "";
    sortMethod: FlvSortMethod = FlvSortMethod.RECENT;
    visible: boolean = true;
    listItems: ListItem[] = [];
    videoOpenEvent: Signal<[item: ListItem]> = new Signal();
    constructor(public getExcludedFiles: () => Set<string>) {
        const accessContainer = document.createElement("div");
        this.accessContainerEl = accessContainer;
        document.body.appendChild(accessContainer);
        accessContainer.classList.add("flv-access-menu");

        const directoryLabel = document.createElement("div");
        this.directoryLabelEl = directoryLabel;
        document.body.appendChild(directoryLabel);
        directoryLabel.classList.add("flv-directory");
        directoryLabel.textContent = "directory/";

        const changeDirectoryButton = document.createElement("button");
        this.changeDirectoryButtonEl = changeDirectoryButton;
        accessContainer.appendChild(changeDirectoryButton);
        changeDirectoryButton.classList.add("flv-am-button");
        fetch(joinPaths(PATH_ICONS, "open-folder.svg")).then(res => res.text()).then(text => {
            changeDirectoryButton.innerHTML = text;
        });
        changeDirectoryButton.onclick = () => {
            this.chooseDirectory();
        }

        const refreshButton = document.createElement("button");
        this.refreshButtonEl = refreshButton;
        accessContainer.appendChild(refreshButton);
        refreshButton.classList.add("flv-am-button");
        fetch(joinPaths(PATH_ICONS, "refresh.svg")).then(res => res.text()).then(text => {
            refreshButton.innerHTML = text;
        });
        refreshButton.onclick = () => {
            this.refresh();
        }

        const container = document.createElement("div");
        this.containerEl = container;
        document.body.appendChild(container);
        container.classList.add("flv-container");
    }
    _setProcessingFileSystem(v: boolean) {
        this.processingFileSystem = v;
        if(v) {
            this.refreshButtonEl.style.opacity = "0.5";
            this.changeDirectoryButtonEl.style.opacity = "0.5";
        } else {
            this.refreshButtonEl.style.opacity = "1";
            this.changeDirectoryButtonEl.style.opacity = "1";
        }
    }
    _removeVideoList(container?: HTMLDivElement) {
        if(!this.videoListContainerEl)
            return;
        if(!container || this.videoListContainerEl == container) {
            this.videoListContainerEl.remove();
            delete this.videoListContainerEl;
            this.listItems = [];
        }
    }
    async chooseDirectory() {
        if(this.processingFileSystem)
            return;
        this._setProcessingFileSystem(true);
        const dir = await window.fileApi.promptChooseDirectory();
        if(!dir) return;
        this.directoryLabelEl.textContent = dir;
        this.videoDirectory = dir;
        this._setProcessingFileSystem(false);
        this.refresh();
    }
    refresh() {
        if(this.processingFileSystem)
            return;
        this.loadVideos();
    }
    async loadVideos() {
        if(this.videoListContainerEl) {
            this._removeVideoList();
        }
        if(this.videoDirectory === "")
            return;
        const vlid = ++this.videoLoadingId;
        const videoListContainer = document.createElement("div");
        this.videoListContainerEl = videoListContainer;
        this.containerEl.appendChild(videoListContainer);
        videoListContainer.classList.add("flv-list-container");
        let thumbUrls: string[] = [];
        const checkValidity = () => {
            if(vlid === this.videoLoadingId)
                return false;
            this._removeVideoList(videoListContainer);
            for(let i=0; i<thumbUrls.length; i++) {
                const url = thumbUrls[i]!;
                URL.revokeObjectURL(url);
            }
            return true;
        }
        const result = await window.fileApi.getDirectoryFileList(this.videoDirectory);
        if(checkValidity()) return;
        if(!result.success) return;
        const videoFiles = result.files.filter(file => file.name.toLowerCase().endsWith(".mp4"));
        switch(this.sortMethod) {
            case FlvSortMethod.RECENT:
                videoFiles.sort((a, b) => { return b.modified - a.modified; });
                break;
            case FlvSortMethod.OLD:
                videoFiles.sort((a, b) => { return a.modified - b.modified; });
                break;
            case FlvSortMethod.A_Z:
                videoFiles.sort((a, b) => { return b.name.localeCompare(a.name); });
                break;
            case FlvSortMethod.Z_A:
                videoFiles.sort((a, b) => { return a.name.localeCompare(b.name); });
                break;
        }
        const listItems: ListItem[] = [];
        this.listItems = listItems;
        for(let i=0; i<videoFiles.length; i++) {
            const file = videoFiles[i]!;

            if(this.getExcludedFiles().has(file.name))
                continue;

            const fileContainer = document.createElement("div");
            videoListContainer.appendChild(fileContainer);
            fileContainer.classList.add("flv-list-file");
            const fileNameLabel = document.createElement("div");
            fileContainer.appendChild(fileNameLabel);
            fileNameLabel.classList.add("flv-list-file-name");
            fileNameLabel.textContent = file.name;
            const item: ListItem = {
                file,
                container: fileContainer,
                nameLabel: fileNameLabel,
                hasThumb: false,
            }
            listItems.push(item);

            fileContainer.ondblclick = () => {
                this.videoOpenEvent.fire(item);
            };

            if(i % 10 === 0) {
                await new Promise(res => setTimeout(res, 1));
                if(checkValidity()) return;
            }
        }
        const THUMB_WIDTH = 150;
        const THUMB_HEIGHT = 100;
        const THUMB_GAP = 15;
        const thumbVideo = document.createElement("video");
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = THUMB_WIDTH;
        thumbCanvas.height = THUMB_HEIGHT;
        const ctx = get2dContext(thumbCanvas);
        while(true) {
            let startIndex = Math.floor(this.containerEl.scrollTop / (THUMB_HEIGHT + THUMB_GAP)) * Math.floor((videoListContainer.clientWidth - THUMB_GAP) / (THUMB_WIDTH + THUMB_GAP));
            let endIndex = pmod(startIndex - 1, listItems.length);
            let i = pmod(startIndex, listItems.length);
            while(true) {
                const item = listItems[i]!;
                if(!item.hasThumb)
                    break;
                i = pmod(i + 1, listItems.length);
                if(i == endIndex)
                    break;
            }
            const item = listItems[i]!;
            if(item.hasThumb)
                break;

            let url: string;
            await new Promise<void>(res => {
                let sourceX = 0;
                let sourceY = 0;
                let sourceW = 0;
                let sourceH = 0;
                thumbVideo.onseeked = () => {
                    ctx.drawImage(thumbVideo, sourceX, sourceY, sourceW, sourceH, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
                    thumbCanvas.toBlob(blob => {
                        if(!blob)
                            return;
                        url = URL.createObjectURL(blob);
                        thumbUrls.push(url);
                        res();
                    });
                }
                thumbVideo.onloadedmetadata = () => {
                    const vw = thumbVideo.videoWidth;
                    const vh = thumbVideo.videoHeight;
                    if(vh / THUMB_HEIGHT < vw / THUMB_WIDTH) {
                        sourceH = vh;
                        sourceW = THUMB_WIDTH * vh / THUMB_HEIGHT;
                        sourceX = Math.floor((vw - sourceW) / 2);
                        sourceY = 0;
                    } else {
                        sourceW = vw;
                        sourceH = THUMB_HEIGHT * vw / THUMB_WIDTH;
                        sourceY = Math.floor((vh - sourceH) / 2);
                        sourceX = 0;
                    }
                    thumbVideo.currentTime = 1;
                }
                thumbVideo.onerror = (e) => {
                    console.error("Failed:", item.file.path);
                    res();
                }
                thumbVideo.src = item.file.path;
            });
            if(checkValidity()) return;

            thumbVideo.pause();
            thumbVideo.removeAttribute("src");
            thumbVideo.load();

            const img = document.createElement("img");
            item.container.appendChild(img);
            img.classList.add("flv-list-file-thumb");
            img.src = url!;

            item.hasThumb = true;

            while(!this.visible)
                await new Promise(res => setTimeout(res, 500));
            await new Promise(res => setTimeout(res, 1));
            if(checkValidity()) return;
        }
        thumbVideo.remove();
        thumbCanvas.remove();
    }
    setVisible(v: boolean) {
        this.visible = v;
        if(v) {
            this.containerEl.style.display = "grid";
            this.accessContainerEl.style.display = "flex";
            this.directoryLabelEl.style.display = "block";
        } else {
            this.containerEl.style.display = "none";
            this.accessContainerEl.style.display = "none";
            this.directoryLabelEl.style.display = "none";
        }
    }
}