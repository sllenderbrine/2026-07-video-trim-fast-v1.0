import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { NotificationIconType, NotificationSystem } from "./NotificationSystem.js";
import { StartupMenu } from "./StartupMenu.js";
import { VideoDirectoryViewer } from "./VideoDirectoryViewer.js";
import { WindowBar, WindowBarSide } from "./WindowBar.js";

export class VideoTrimApp {
    contentEl: HTMLDivElement;
    excludedFileNames: Set<string> = new Set()
    vdirViewer: VideoDirectoryViewer;
    startupMenu: StartupMenu;
    windowBar: WindowBar;
    notificationSystem: NotificationSystem;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor() {
        this.contentEl = document.createElement("div");
        document.body.appendChild(this.contentEl);
        this.contentEl.classList.add("video-trim-app-content");

        this.windowBar = new WindowBar();
        this.windowBar.addTextButton("File", () => {
            return [
                {
                    title: "Open Folder...",
                    icon: "folder",
                    data: { action: "open-folder", },
                },
                {
                    title: "Close Folder",
                    icon: "close-folder",
                    data: { action: "close-folder", },
                },
            ];
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("Edit", () => {
            return [
                
            ];
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("View", () => {
            return [
                
            ];
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("Help", () => {
            return [
                {
                    title: "Github ↪",
                    icon: "github",
                    data: { action: "open-github-repo" },
                },
            ];
        }, null, WindowBarSide.LEFT);

        this.windowBar.menuButtonClickEvent.connect((e) => {
            if(e.contextMenuButton != null && e.contextMenuButton.data != null && e.contextMenuButton.data.action != null) {
                this.runAppAction(e.contextMenuButton.data.action);
                e.contextMenu!.remove();
            }
        }, { owners: [ this.connectionOwner ] });
        
        this.notificationSystem = new NotificationSystem(this.windowBar);
        document.body.appendChild(this.notificationSystem.activeContainerEl);

        const vdv = new VideoDirectoryViewer();
        this.vdirViewer = vdv;
        this.contentEl.appendChild(vdv.containerEl);
        
        this.startupMenu = new StartupMenu();
        this.contentEl.appendChild(this.startupMenu.containerEl);
    }

    async promptOpenDirectory() {
        const dir = await window.fileApi.promptChooseDirectory();
        if(dir != null) {
            let res = await window.fileApi.getDirectoryFileList(dir);
            if(res.success) {
                this.vdirViewer.loadVideos(dir, res.value);
                this.startupMenu.containerEl.style.display = "none";
            } else {
                const notif = this.notificationSystem.sendActiveNotification({
                    title: "Error",
                    iconType: NotificationIconType.ERROR,
                    description: "Failed to get directory",
                });
                notif.addViewDetailsLink();
            }
        } else {

        }
    }

    runAppAction(action: string) {
        switch(action) {
            case "open-folder":
                this.promptOpenDirectory();
                break;
            case "close-folder":
                this.vdirViewer.unloadVideos();
                this.startupMenu.containerEl.style.display = "flex";
                break;
            case "open-github-repo":
                window.redirectApi.openGithubRepo();
                break;
        }
    }
}