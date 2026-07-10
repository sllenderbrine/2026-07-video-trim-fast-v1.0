import ContextMenu from "../ContextMenu/ContextMenu.js";
import { ConnectionOwner, HtmlConnection, MathUtility, Signal } from "../VecLib/index.js";
import type { ListItem } from "./FileListView.js";

export class TrimView {
    containerEl: HTMLDivElement;
    videoEl: HTMLVideoElement;
    trimContainerEl: HTMLDivElement;
    timelineHandleEl: HTMLDivElement;
    trimContainerLeftEl: HTMLDivElement;
    trimContainerRightEl: HTMLDivElement;
    trimHandleLeftEl: HTMLDivElement;
    trimHandleRightEl: HTMLDivElement;
    nameLabelEl: HTMLDivElement;
    cropOutlineEl: HTMLDivElement;
    accessContainerEl: HTMLDivElement;
    isUserPaused: boolean = false;
    isDragPaused: boolean = false;
    isSeeking: boolean = false;
    looped: boolean = false;
    lastPauseValue: boolean | null = null;
    targetSeekTime: number = 0;
    trimStart: number = 0;
    trimEnd: number = 0;
    cropLeft: number = 0;
    cropRight: number = 0;
    cropTop: number = 0;
    cropBottom: number = 0;
    videoName: string;
    backEvent: Signal<[]> = new Signal();
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(public item: ListItem) {
        const container = document.createElement("div");
        this.containerEl = container;
        document.body.appendChild(container);
        container.classList.add("trim-view-container");

        const accessContainer = document.createElement("div");
        this.accessContainerEl = accessContainer;
        document.body.appendChild(accessContainer);
        accessContainer.classList.add("flv-access-menu");

        const backButton = document.createElement("button");
        accessContainer.appendChild(backButton);
        backButton.classList.add("flv-am-button");
        fetch("resources/icons/back.svg").then(res => res.text()).then(text => {
            backButton.innerHTML = text;
        });
        backButton.onclick = () => {
            this.backEvent.fire();
        }

        const video = document.createElement("video");
        this.videoEl = video;
        container.appendChild(video);
        video.classList.add("tv-video");

        const trimContainer = document.createElement("div");
        this.trimContainerEl = trimContainer;
        container.appendChild(trimContainer);
        trimContainer.classList.add("tv-trim-container");

        const timelineHandle = document.createElement("div");
        this.timelineHandleEl = timelineHandle;
        trimContainer.appendChild(timelineHandle);
        timelineHandle.classList.add("tv-timeline-handle");

        const trimLeftContainer = document.createElement("div");
        this.trimContainerLeftEl = trimLeftContainer;
        trimContainer.appendChild(trimLeftContainer);
        trimLeftContainer.classList.add("tv-trim-left");

        const trimLeftContent = document.createElement("div");
        trimLeftContainer.appendChild(trimLeftContent);
        trimLeftContent.classList.add("tv-trim-content");

        const trimLeftHandle = document.createElement("div");
        this.trimHandleLeftEl = trimLeftHandle;
        trimLeftContent.appendChild(trimLeftHandle);
        trimLeftHandle.classList.add("tv-trim-left-handle");

        const trimLeftArrow = document.createElement("div");
        trimLeftContainer.appendChild(trimLeftArrow);
        trimLeftArrow.classList.add("tv-trim-left-arrow");

        const trimRightContainer = document.createElement("div");
        this.trimContainerRightEl = trimRightContainer;
        trimContainer.appendChild(trimRightContainer);
        trimRightContainer.classList.add("tv-trim-right");

        const trimRightContent = document.createElement("div");
        trimRightContainer.appendChild(trimRightContent);
        trimRightContent.classList.add("tv-trim-content");

        const trimRightHandle = document.createElement("div");
        this.trimHandleRightEl = trimRightHandle;
        trimRightContent.appendChild(trimRightHandle);
        trimRightHandle.classList.add("tv-trim-right-handle");

        const trimRightArrow = document.createElement("div");
        trimRightContainer.appendChild(trimRightArrow);
        trimRightArrow.classList.add("tv-trim-right-arrow");

        const cropOutline = document.createElement("div");
        this.cropOutlineEl = cropOutline;
        container.appendChild(cropOutline);
        cropOutline.classList.add("tv-crop-outline");

        const resize = () => {
            this.updateCropOutline();
        }
        resize();
        new HtmlConnection(window, "resize", () => {
            resize();
        }, { owners: [ this.connectionOwner ] });

        let isDraggingTrimLeft = false;
        let hasArrowTrimLeft = true;
        let isDraggingTrimRight = false;
        let hasArrowTrimRight = true;

        const seekMouse = (e: MouseEvent) => {
            const rect = trimContainer.getBoundingClientRect();
            let t = (e.clientX - rect.left) / rect.width * video.duration;
            t = MathUtility.clamp(t, 0, video.duration);
            if(isDraggingTrimLeft) {
                t = Math.min(t, this.trimEnd);
                this.trimStart = t;
                let tp = t / video.duration * 100;
                trimLeftContainer.style.width = tp + "%";
                if(tp > 10 && hasArrowTrimLeft) {
                    hasArrowTrimLeft = false;
                    trimLeftArrow.style.transform = "translate(-10px, -50%)";
                    trimLeftArrow.style.opacity = "0";
                    trimLeftArrow.animate([
                        { transform: "translate(25px, -50%)", opacity: "1" },
                        { transform: "translate(-10px, -50%)", opacity: "0" },
                    ], { duration: 200, easing: "ease-in-out" });
                } else if(tp <= 10 && !hasArrowTrimLeft) {
                    hasArrowTrimLeft = true;
                    trimLeftArrow.style.transform = "translate(25px, -50%)";
                    trimLeftArrow.style.opacity = "1";
                    trimLeftArrow.animate([
                        { transform: "translate(-10px, -50%)", opacity: "0" },
                        { transform: "translate(25px, -50%)", opacity: "1" },
                    ], { duration: 200, easing: "ease-in-out" });
                }
            }
            if(isDraggingTrimRight) {
                t = Math.max(t, this.trimStart);
                this.trimEnd = t;
                let tp = 100 - t / video.duration * 100;
                trimRightContainer.style.width = tp + "%";
                if(tp > 10 && hasArrowTrimRight) {
                    hasArrowTrimRight = false;
                    trimRightArrow.style.transform = "translate(10px, -50%)";
                    trimRightArrow.style.opacity = "0";
                    trimRightArrow.animate([
                        { transform: "translate(-25px, -50%)", opacity: "1" },
                        { transform: "translate(10px, -50%)", opacity: "0" },
                    ], { duration: 200, easing: "ease-in-out" });
                } else if(tp <= 10 && !hasArrowTrimRight) {
                    hasArrowTrimRight = true;
                    trimRightArrow.style.transform = "translate(-25px, -50%)";
                    trimRightArrow.style.opacity = "1";
                    trimRightArrow.animate([
                        { transform: "translate(10px, -50%)", opacity: "0" },
                        { transform: "translate(-25px, -50%)", opacity: "1" },
                    ], { duration: 200, easing: "ease-in-out" });
                }
            }
            this.seekTo(t);
        }

        const mouseIsOverDiv = (e: MouseEvent, div: HTMLDivElement) => {
            const rect = div.getBoundingClientRect();
            const { clientX: x, clientY: y } = e;
            return x > rect.left && x < rect.left + rect.width && y > rect.top && y < rect.top + rect.height;
        }

        new HtmlConnection(window, "mousedown", (e: MouseEvent) => {
            if(mouseIsOverDiv(e, trimLeftHandle)) {
                isDraggingTrimLeft = true;
                this.isDragPaused = true;
                seekMouse(e);
            } else if(mouseIsOverDiv(e, trimRightHandle)) {
                isDraggingTrimRight = true;
                this.isDragPaused = true;
                seekMouse(e);
            } else if(hasArrowTrimLeft && e.target == trimLeftArrow) {
                if(hasArrowTrimLeft)
                    isDraggingTrimLeft = true;
                this.isDragPaused = true;
                seekMouse(e);
            } else if(hasArrowTrimRight && e.target == trimRightArrow) {
                if(hasArrowTrimRight)
                    isDraggingTrimRight = true;
                this.isDragPaused = true;
                seekMouse(e);
            } else if(mouseIsOverDiv(e, trimContainer)) {
                this.isDragPaused = true;
                seekMouse(e);
            }
        }, { owners: [ this.connectionOwner ] });
        new HtmlConnection(window, "mouseup", (e: MouseEvent) => {
            this.isDragPaused = false;
            isDraggingTrimLeft = false;
            isDraggingTrimRight = false;
        }, { owners: [ this.connectionOwner ] });
        new HtmlConnection(window, "mousemove", (e: MouseEvent) => {
            if(this.isDragPaused) {
                seekMouse(e);
            }
        }, { owners: [ this.connectionOwner ] });

        new HtmlConnection(window, "keydown", (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if(e.target == nameLabel)
                return;
            if(key == " ") {
                if(this.videoEl.ended && this.isUserPaused) {
                    this.seekTo(this.trimStart);
                    this.isUserPaused = false;
                } else {
                    this.isUserPaused = !this.isUserPaused;
                    this.updateVideoPause();
                }
            }
        }, { owners: [ this.connectionOwner ] });

        const settingsContainer = document.createElement("div");
        trimContainer.appendChild(settingsContainer);
        settingsContainer.classList.add("tv-settings-container");
        const nameContainer = document.createElement("div");
        this.nameLabelEl = nameContainer;
        settingsContainer.appendChild(nameContainer);
        nameContainer.classList.add("tv-name-container");
        const nameLabel = document.createElement("div");
        this.nameLabelEl = nameLabel;
        nameContainer.appendChild(nameLabel);
        nameLabel.classList.add("tv-name-label");
        nameLabel.contentEditable = "true";
        nameLabel.textContent = item.file.name.substring(0, item.file.name.length - 4);
        this.videoName = nameLabel.textContent;
        nameLabel.oninput = () => {
            this.videoName = nameLabel.textContent;
        };
        const extensionLabel = document.createElement("div");
        nameContainer.appendChild(extensionLabel);
        extensionLabel.classList.add("tv-name-extension");
        extensionLabel.textContent = ".mp4";
        const cropButton = document.createElement("button");
        cropButton.classList.add("tv-settings-button");
        cropButton.textContent = "Select Crop [None]";
        settingsContainer.prepend(cropButton);
        cropButton.onclick = (e) => {
            let ctx = ContextMenu.fromLayout([
                { name: "None", data: "None" },
                { name: "Left Half", data: "Left Half" },
                { name: "Right Half", data: "Right Half" },
            ], e.clientX, e.clientY);
            ctx.clickOffEvent.connect(() => {
                ctx.remove();
            }, { owners: null });
            ctx.buttonClickEvent.connect((e, btn, i) => {
                if(btn.data == "None") {
                    this.cropLeft = 0;
                    this.cropRight = 0;
                    this.cropTop = 0;
                    this.cropBottom = 0;
                    this.updateCropOutline();
                } else if(btn.data == "Left Half") {
                    this.cropLeft = 0;
                    this.cropRight = this.videoEl.videoWidth / 2;
                    this.cropTop = 0;
                    this.cropBottom = 0;
                    this.updateCropOutline();
                } else if(btn.data == "Right Half") {
                    this.cropLeft = this.videoEl.videoWidth / 2;
                    this.cropRight = 0;
                    this.cropTop = 0;
                    this.cropBottom = 0;
                    this.updateCropOutline();
                }
                cropButton.textContent = `Select Crop [${btn.data}]`;
                ctx.remove();
            }, { owners: null });
        }

        video.onloadedmetadata = () => {
            this.trimStart = 0;
            this.trimEnd = video.duration;
            this.updateVideoPause();
            this.updateCropOutline();
        }

        video.ontimeupdate = () => {
            timelineHandle.style.left = (video.currentTime / video.duration * 100) + "%";
        }

        video.onended = () => {
            if(this.looped) {
                this.seekTo(this.trimStart);
            } else {
                this.isUserPaused = true;
                this.updateVideoPause();
            }
        }

        this.videoEl.src = item.file.path;
    }
    updateCropOutline() {
        const rect = this.videoEl.getBoundingClientRect();
        const vw = this.videoEl.videoWidth;
        const vh = this.videoEl.videoHeight;
        const cw = rect.width;
        const ch = rect.height;
        let vsw = 0;
        let vsh = 0;
        if(vw / vh > cw / ch) {
            vsw = cw;
            vsh = cw * vh / vw;
        } else {
            vsh = ch;
            vsw = ch * vw / vh;
        }
        let vsx = (cw - vsw) / 2;
        let vsy = (ch - vsh) / 2;
        let vswCrop = vsw * (1 - this.cropLeft / vw - this.cropRight / vw);
        let vshCrop = vsh * (1 - this.cropTop / vh - this.cropBottom / vh);
        let vsxCrop = vsx + (this.cropLeft / vw * vsw);
        let vsyCrop = vsy + (this.cropTop / vh * vsh);
        this.cropOutlineEl.style.left = vsxCrop + "px";
        this.cropOutlineEl.style.top = vsyCrop + "px";
        this.cropOutlineEl.style.width = vswCrop + "px";
        this.cropOutlineEl.style.height = vshCrop + "px";
    }
    seekTo(t: number) {
        this.timelineHandleEl.style.left = (t / this.videoEl.duration * 100) + "%";
        this.targetSeekTime = t;
        if(this.isSeeking)
            return;
        this.isSeeking = true;
        this.updateVideoPause();
        this.videoEl.onseeked = () => {
            this.isSeeking = false;
            this.updateVideoPause();
            if(this.targetSeekTime != t) {
                return requestAnimationFrame(() => {
                    this.seekTo(this.targetSeekTime);
                });
            }
        }
        this.videoEl.currentTime = t;
    }
    updateVideoPause() {
        const pause = this.isUserPaused || this.isSeeking || this.isDragPaused;
        if(pause == this.lastPauseValue)
            return;
        if(pause)
            this.videoEl.pause();
        else
            this.videoEl.play();
    }
    remove() {
        this.videoEl.pause();
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
        this.containerEl.remove();
        this.videoEl.remove();
        this.accessContainerEl.remove();
        this.trimContainerEl.remove();
        this.connectionOwner.disconnectAll();
    }
}