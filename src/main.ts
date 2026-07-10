import AccessMenu from "./AccessMenu/AccessMenu.js";
import { Notification, NotificationSystem } from "./NotificationSystem/NotificationSystem.js";
import { HtmlConnection, StringUtility } from "./VecLib/index.js";
import { FileListView, ListItem } from "./VideoTrim/FileListView.js";
import { TrimView } from "./VideoTrim/TrimView.js";

let editQueue: {
    path:string, start: number, end: number,
    left: number, right: number, top: number, bottom: number,
    name: string, item: ListItem
}[] = [];

let excludedNames = new Set<string>()

const getExcludedFiles = () => {
    return excludedNames;
}

const fileList = new FileListView(getExcludedFiles);

function updateQueueNotif() {
    let queuedNotif = NotificationSystem.getNotificationById("queuedTasks");
    if(queuedNotif && editQueue.length < 2) {
        queuedNotif.remove();
    } else if(queuedNotif && editQueue.length > 1) {
        queuedNotif.setTitle((editQueue.length - 1) + " edit(s) queued");
        queuedNotif.moveToBottom();
    } else if(!queuedNotif && editQueue.length > 1) {
        queuedNotif = NotificationSystem.createInfo({ title: (editQueue.length - 1) + " edit(s) queued", desc: "Waiting for current edit to complete...", id: "queuedTasks"});
        queuedNotif.moveToBottom();
    }
}

(async () => {
    while(true) {
        await new Promise(res => setTimeout(res, 500));
        if(!editQueue[0])
            continue;
        const queued = editQueue[0];
        let currentNotif = NotificationSystem.createTask({ title: "Applying Edits", desc: queued.item.file.path + " -> " + queued.name, id: "currentTask" });
        updateQueueNotif();
        const res = await window.videoEditApi.editAndApply(
            queued.path, queued.start, queued.end,
            queued.left, queued.right, queued.top, queued.bottom,
            queued.name
        );
        let remq = editQueue.shift()!;
        excludedNames.delete(remq.item.file.name);
        fileList.refresh();
        currentNotif.setCheckmark(true);
        setTimeout(() => {
            currentNotif.remove();
        }, 1000)
    }
})()

let trim: TrimView | null = null;
fileList.videoOpenEvent.connect(item => {
    if(trim) {
        trim.remove();
    }
    trim = new TrimView(item);
    fileList.setVisible(false);
    new HtmlConnection(window, "keydown", async (e: KeyboardEvent) => {
        if(!trim)
            return;
        const key = e.key.toLowerCase();
        if(key == "s" && e.ctrlKey) {
            editQueue.push({
                path: trim.item.file.path,
                start: trim.trimStart,
                end: trim.trimEnd,
                left: trim.cropLeft,
                right: trim.cropRight,
                top: trim.cropTop,
                bottom: trim.cropBottom,
                name: trim.videoName,
                item: item,
            });
            excludedNames.add(item.file.name);
            updateQueueNotif();
            trim.remove();
            trim = null;
            fileList.refresh();
            fileList.setVisible(true);
        }
    }, { owners: [ trim.connectionOwner ] });
    trim.backEvent.connect(() => {
        if(!trim)
            return;
        trim.remove();
        trim = null;
        fileList.setVisible(true);
    }, { owners: null });
}, { owners: null });

const accessMenu = new AccessMenu([]);
let title = document.createElement("div");
title.textContent = "Simple Video Trimmer";
accessMenu.containerEl.appendChild(title);
title.classList.add("access-menu-main-title");

accessMenu.containerEl.appendChild(NotificationSystem.containerEl);