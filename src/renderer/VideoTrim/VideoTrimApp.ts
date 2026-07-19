import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { NotificationIconType, NotificationSystem } from "./NotificationSystem.js";
import { WindowBar, WindowBarSide } from "./WindowBar.js";

export class VideoTrimApp {
    excludedFileNames: Set<string> = new Set()
    
    windowBar: WindowBar;
    notificationSystem: NotificationSystem;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor() {
        this.windowBar = new WindowBar();
        this.windowBar.addTextButton("File", () => {
            return [
                {
                    title: "Open Directory...",
                    icon: "open-folder",
                    data: { action: "open-directory", },
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

        this.notificationSystem.sendActiveNotification({
            title: "Error",
            iconType: NotificationIconType.ERROR,
            description: "Error opening directory",
            timeout: -1,
            viewDetails: true,
        });
        this.notificationSystem.sendActiveNotification({
            title: "Success",
            iconType: NotificationIconType.CHECK,
            description: "Saved video '...ajdoiajdo.mp4'",
            timeout: -1,
            viewDetails: true,
        });
    }

    async promptOpenDirectory() {
        const dir = await window.fileApi.promptChooseDirectory();
        if(dir != null) {
            // this.fileListView.setDirectory(dir);
        } else {
            this.notificationSystem.sendActiveNotification({
                title: "Error",
                iconType: NotificationIconType.ERROR,
                description: "Error opening directory",
                timeout: 5,
            });
            // this.notificationSystem.sendPassiveNotification({
            //     title: "Error opening directory",
            //     description: "empty description",
            //     important: false,
            // });
        }
    }

    runAppAction(action: string) {
        switch(action) {
            case "open-directory":
                this.promptOpenDirectory();
                break;
            case "open-github-repo":
                window.redirectApi.openGithubRepo();
                break;
        }
    }
}