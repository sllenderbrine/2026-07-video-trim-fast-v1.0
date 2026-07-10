export type NotifcationParams = {
    title: string,
    desc?: string,
    id?: string,
};

export class Notification {
    constructor() {

    }
    setIcon(path: string) {

    }
    setTitle(v: string) {

    }
    setDescription(v: string) {

    }
    setCompleted(v: boolean) {

    }
    moveToBottom() {

    }
    remove() {

    }
}

export abstract class NotificationSystem {
    static idToNotification: Map<string, Notification> = new Map();
    constructor() {

    }
    static createNotification(params: NotifcationParams): Notification {
        const notif = new Notification();
        if(params.id) {
            this.idToNotification.set(params.id, notif);
        }
        if(params.title) {
            notif.setTitle(params.title);
        }
        if(params.desc) {
            notif.setDescription(params.desc);
        }
        return notif;
    }
    static createTask(params: NotifcationParams): Notification {
        const notif = this.createNotification(params);
        return notif;
    }
    static createInfo(params: NotifcationParams): Notification {
        const notif = this.createNotification(params);
        return notif;
    }
    static getNotificationById(id: string): Notification | undefined {
        return this.idToNotification.get(id);
    }
}