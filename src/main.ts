import AccessMenu from "./AccessMenu/AccessMenu.js";
import { NotificationSystem } from "./NotificationSystem/NotificationSystem.js";
import { HtmlConnection } from "./VecLib/index.js";
import { FileListView, ListItem } from "./VideoTrim/FileListView.js";
import { TrimView } from "./VideoTrim/TrimView.js";

let editQueue: {
    path:string, start: number, end: number,
    left: number, right: number, top: number, bottom: number,
    name: string, item: ListItem
}[] = [];

const fileList = new FileListView();

(async () => {
    while(true) {
        await new Promise(res => setTimeout(res, 500));
        if(!editQueue[0])
            continue;
        const queued = editQueue[0];
        let currentNotif = NotificationSystem.createTask({ title: "Applying Edits", desc: queued.item.file.path + " -> " + queued.name, id: "currentTask" });
        let queuedNotif = NotificationSystem.getNotificationById("queuedTasks");
        if(queuedNotif && editQueue.length < 2) {
            queuedNotif.remove();
        } else if(queuedNotif && editQueue.length > 1) {
            queuedNotif.setTitle((editQueue.length - 1) + " edits queued");
            queuedNotif.moveToBottom();
        } else if(!queuedNotif && editQueue.length > 1) {
            queuedNotif = NotificationSystem.createInfo({ title: (editQueue.length - 1) + " edits queued", desc: "Waiting for current edit to complete...", id: "queuedTasks"});
            queuedNotif.moveToBottom();
        }
        console.log("EDITING", queued);
        const res = await window.videoEditApi.editAndApply(
            queued.path, queued.start, queued.end,
            queued.left, queued.right, queued.top, queued.bottom,
            queued.name
        );
        console.log("COMPLETED", res);
        editQueue.shift();
        fileList.refresh();
        currentNotif.setCompleted(true);
        await new Promise(res => setTimeout(res, 500));
        currentNotif.remove();
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
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                name: trim.videoName,
                item: item,
            });
            trim.remove();
            trim = null;
            fileList.setVisible(true);
            const videoItemIndex = fileList.listItems.findIndex((v) => {
                if(v.file.name == item.file.name)
                    return true;
                return false;
            });
            if(videoItemIndex != -1) {
                const listItem = fileList.listItems[videoItemIndex]!;
                listItem.container.remove();
                fileList.listItems.splice(videoItemIndex, 1);
            }
        }
    }, { owners: [ trim.connectionOwner ] });
}, { owners: null });

const accessMenu = new AccessMenu([]);
let title = document.createElement("div");
title.textContent = "Simple Video Trimmer";
accessMenu.containerEl.appendChild(title);
title.classList.add("access-menu-main-title");