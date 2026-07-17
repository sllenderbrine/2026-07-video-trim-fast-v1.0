import { FileListView } from "./FileListView.js";
import { NotificationIconType, NotificationSystem } from "./NotificationSystem.js";
import { TrimView } from "./TrimView.js";
import { WindowBar, WindowBarSide } from "./WindowBar.js";

export class VideoTrimApp {
    excludedFileNames: Set<string> = new Set()
    fileListView: FileListView;
    trimView?: TrimView;
    windowBar: WindowBar;
    notificationSystem: NotificationSystem;
    constructor() {
        this.fileListView = new FileListView(this.getExcludedFileNames.bind(this));
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
        
        const notifBtn = this.windowBar.addIconButton("notification", null, () => {

        }, WindowBarSide.RIGHT, false, 22, 8);
        const notifCounter = document.createElement("div");
        notifBtn.containerEl.appendChild(notifCounter);
        notifCounter.classList.add("wbar-notif-counter");
        notifCounter.textContent = "1";

        this.notificationSystem = new NotificationSystem();
        document.body.appendChild(this.notificationSystem.activeContainerEl);

        setInterval(() => {
            this.notificationSystem.sendActiveNotification({
                title: "Error",
                iconType: NotificationIconType.CHECK,
                description: "Error opening directory",
                timeout: 5,
            });
        }, 1100);
    }

    getExcludedFileNames() {
        return this.excludedFileNames;
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
        }
    }
}