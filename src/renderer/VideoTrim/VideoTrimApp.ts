import { ConnectionOwner } from "../../shared/EventSignals/ConnectionOwner.js";
import { NotificationIconType, NotificationSystem } from "../Ui/NotificationSystem.js";
import { StartupMenu } from "./StartupMenu.js";
import { VdvSortMethod, VideoDirectoryViewer } from "./VideoDirectoryViewer.js";
import { WindowBar, WindowBarSide } from "../Ui/WindowBar.js";

export class VideoTrimApp {
    contentEl: HTMLDivElement;
    excludedFileNames: Set<string> = new Set()
    vdirViewer: VideoDirectoryViewer;
    startupMenu: StartupMenu;
    windowBar: WindowBar;
    notificationSystem: NotificationSystem;
    editorOpened: boolean = false;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor() {
        this.contentEl = document.createElement("div");
        document.body.appendChild(this.contentEl);
        this.contentEl.classList.add("video-trim-app-content");

        this.windowBar = new WindowBar();
        this.windowBar.addTextButton("File", () => {
            if(this.editorOpened) {
                return [

                ];
            } else {
                return [
                    {
                        title: "Open Folder...",
                        icon: "folder",
                        keybind: "Ctrl + O",
                        data: { action: "open-folder", },
                    },
                    {
                        title: "Recents",
                        icon: "library",
                        children: [

                        ],
                        separator: true,
                    },
                    {
                        title: "Preferences...",
                        icon: "settings",
                        separator: true,
                    },
                    {
                        title: "Close Folder",
                        icon: "close-folder",
                        data: { action: "close-folder", },
                        disabled: !this.vdirViewer.isLoaded,
                        dangerSeparator: true,
                    },
                    {
                        title: "Exit",
                        icon: "small-cross",
                        data: { action: "exit", },
                        danger: true,
                    },
                ];
            }
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("Edit", () => {
            if(this.editorOpened) {
                return [
                    {
                        title: "Undo",
                        keybind: "Ctrl + Z",
                        icon: "undo",
                        data: { action: "undo-editor", },
                    },
                    {
                        title: "Redo",
                        keybind: "Ctrl + Shift + Z",
                        icon: "redo",
                        data: { action: "redo-editor", },
                    },
                ];
            } else {
                return [
                    
                ];
            }
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("View", () => {
            if(this.editorOpened) {
                return [

                ];
            } else {
                return [
                    {
                        title: "Sort By",
                        icon: "sort-down",
                        children: [
                            {
                                title: "Date",
                                icon: (
                                    this.vdirViewer.sortMethod == VdvSortMethod.DATE_RECENT
                                    || this.vdirViewer.sortMethod == VdvSortMethod.DATE_OLD
                                ) ? "small-check" : undefined,
                                children: [
                                    {
                                        title: "Recent",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.DATE_RECENT ? "small-check" : undefined,
                                        data: { action: "sort-date-recent", },
                                    },
                                    {
                                        title: "Old",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.DATE_OLD ? "small-check" : undefined,
                                        data: { action: "sort-date-old", },
                                    },
                                ],
                            },
                            {
                                title: "Name",
                                icon: (
                                    this.vdirViewer.sortMethod == VdvSortMethod.NAME_A_Z
                                    || this.vdirViewer.sortMethod == VdvSortMethod.NAME_Z_A
                                ) ? "small-check" : undefined,
                                children: [
                                    {
                                        title: "A-Z",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.NAME_A_Z ? "small-check" : undefined,
                                        data: { action: "sort-name-a-z", },
                                    },
                                    {
                                        title: "Z-A",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.NAME_Z_A ? "small-check" : undefined,
                                        data: { action: "sort-name-z-a", },
                                    },
                                ],
                            },
                            {
                                title: "Duration",
                                icon: (
                                    this.vdirViewer.sortMethod == VdvSortMethod.DURATION_LONG
                                    || this.vdirViewer.sortMethod == VdvSortMethod.DURATION_SHORT
                                ) ? "small-check" : undefined,
                                children: [
                                    {
                                        title: "Long",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.DURATION_LONG ? "small-check" : undefined,
                                        data: { action: "sort-duration-long", },
                                    },
                                    {
                                        title: "Short",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.DURATION_SHORT ? "small-check" : undefined,
                                        data: { action: "sort-duration-short", },
                                    },
                                ],
                            },
                            {
                                title: "Size",
                                icon: (
                                    this.vdirViewer.sortMethod == VdvSortMethod.SIZE_BIG
                                    || this.vdirViewer.sortMethod == VdvSortMethod.SIZE_SMALL
                                ) ? "small-check" : undefined,
                                children: [
                                    {
                                        title: "Big",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.SIZE_BIG ? "small-check" : undefined,
                                        data: { action: "sort-size-big", },
                                    },
                                    {
                                        title: "Small",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.SIZE_SMALL ? "small-check" : undefined,
                                        data: { action: "sort-size-small", },
                                    },
                                ],
                            },
                            {
                                title: "Other",
                                icon: (
                                    this.vdirViewer.sortMethod == VdvSortMethod.OTHER_RANDOM
                                ) ? "small-check" : undefined,
                                children: [
                                    {
                                        title: "Random",
                                        icon: this.vdirViewer.sortMethod == VdvSortMethod.OTHER_RANDOM ? "small-check" : undefined,
                                        data: { action: "sort-random", },
                                    },
                                ],
                            },
                        ],
                    },
                ];
            }
        }, null, WindowBarSide.LEFT);
        this.windowBar.addTextButton("Help", () => {
            return [
                {
                    title: "↪ Github",
                    icon: "github",
                    data: { action: "open-github-repo" },
                },
            ];
        }, null, WindowBarSide.LEFT);

        this.windowBar.menuButtonClickEvent.connect((e) => {
            if(e.contextMenuButton != null && e.contextMenuButton.data != null && e.contextMenuButton.data.action != null) {
                this.runAppAction(e.contextMenuButton.data.action);
                let parent = e.contextMenu!;
                while(parent.parent && parent.parent != parent)
                    parent = parent.parent;
                parent.remove();
            }
        }, { owners: [ this.connectionOwner ] });

        this.windowBar.closeFunc = () => {
            this.runAppAction("exit");
        }
        
        this.notificationSystem = new NotificationSystem(this.windowBar);
        document.body.appendChild(this.notificationSystem.activeContainerEl);

        const vdv = new VideoDirectoryViewer(this.notificationSystem);
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
            case "sort-date-recent":
                this.vdirViewer.sortMethod = VdvSortMethod.DATE_RECENT;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-date-old":
                this.vdirViewer.sortMethod = VdvSortMethod.DATE_OLD;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-name-a-z":
                this.vdirViewer.sortMethod = VdvSortMethod.NAME_A_Z;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-name-z-a":
                this.vdirViewer.sortMethod = VdvSortMethod.NAME_Z_A;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-duration-long":
                this.vdirViewer.sortMethod = VdvSortMethod.DURATION_LONG;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-duration-short":
                this.vdirViewer.sortMethod = VdvSortMethod.DURATION_SHORT;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-size-big":
                this.vdirViewer.sortMethod = VdvSortMethod.SIZE_BIG;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-size-small":
                this.vdirViewer.sortMethod = VdvSortMethod.SIZE_SMALL;
                this.vdirViewer.updateVideoSort();
                break;
            case "sort-random":
                this.vdirViewer.sortMethod = VdvSortMethod.OTHER_RANDOM;
                this.vdirViewer.updateVideoSort();
                break;
            case "exit":
                window.windowApi.close();
                break;
            case "open-github-repo":
                window.redirectApi.openGithubRepo();
                break;
        }
    }
}