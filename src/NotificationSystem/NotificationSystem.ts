import { renderEvent } from "../VecLib/EventSignals/events/RenderEvent.js";
import { Canvas2dUtility, Color, ConnectionOwner, MathUtility, StringUtility, Vec2 } from "../VecLib/index.js";

export type NotifcationParams = {
    title: string,
    desc?: string,
    id?: string,
};

export class Notification {
    containerEl: HTMLDivElement;
    contentEl: HTMLDivElement;
    titleEl: HTMLDivElement;
    descriptionEl: HTMLDivElement;
    iconEl: HTMLDivElement;
    iconAnimIndex: number = 0;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(public id?: string) {
        const container = document.createElement("div");
        this.containerEl = container;
        NotificationSystem.containerEl.prepend(container);
        container.classList.add("notification");

        const icon = document.createElement("div");
        this.iconEl = icon;
        container.appendChild(icon);
        icon.classList.add("notification-icon");

        const content = document.createElement("div");
        this.contentEl = content;
        container.appendChild(content);
        content.classList.add("notification-content");

        const titleLabel = document.createElement("div");
        this.titleEl = titleLabel;
        content.appendChild(titleLabel);
        titleLabel.classList.add("notification-title");

        const descriptionLabel = document.createElement("div");
        this.descriptionEl = descriptionLabel;
        content.appendChild(descriptionLabel);
        descriptionLabel.classList.add("notification-description");
    }
    async setIcon(icon?: string) {
        let animI = ++this.iconAnimIndex;
        await new Promise<void>(res => { 
            fetch("resources/icons/" + icon + ".svg").then(res => res.text()).then(text => {
                this.iconEl.innerHTML = text;
                res();
            });
        });
        return animI;
    }
    setLoading(v: boolean) {
        let animI = ++this.iconAnimIndex;
        if(v) {
            this.iconEl.innerHTML = "";
            const canvas = document.createElement("canvas");
            this.iconEl.appendChild(canvas);
            const ctx = Canvas2dUtility.get2dContext(canvas);
            canvas.width = 80;
            canvas.height = 80;
            let data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let center = new Vec2(canvas.width / 2, canvas.height / 2)
            let r1 = Math.min(canvas.width, canvas.height) / 2 - 15;
            let r0 = r1 - 5;
            for(let i=0; i<data.data.length; i+=4) {
                let point = new Vec2(
                    (i / 4) % canvas.width,
                    Math.floor((i / 4) / canvas.width),
                );
                const dist = point.dist(center);
                const angle = MathUtility.pmod(center.look(point).roll(), 2 * Math.PI);
                if(dist <= r1 && dist >= r0) {
                    const color = Color.fromRgb(50, 150, 255, -50 + 150 * angle / (2 * Math.PI));
                    data.data[i] = color.r;
                    data.data[i+1] = color.g;
                    data.data[i+2] = color.b;
                    data.data[i+3] = Math.floor(color.a / 100 * 255);
                } else {
                    data.data[i] = 0;
                    data.data[i+1] = 0;
                    data.data[i+2] = 0;
                    data.data[i+3] = 0;
                }
            }
            ctx.putImageData(data, 0, 0);
            let rot = 0;
            const c0 = renderEvent.connect(dt => {
                if(animI != this.iconAnimIndex) {
                    c0.disconnect();
                    return;
                }
                rot = MathUtility.pmod(rot + dt * 2 * Math.PI, 2 * Math.PI);
                canvas.style.rotate = rot + "rad";
            }, { owners: [ this.connectionOwner ] });
        }
    }
    async setCheckmark(v: boolean) {
        let animI = await this.setIcon("checkmark-circle");
        if(animI != this.iconAnimIndex)
            return;
        const svg = this.iconEl.querySelector("svg");
        if(!svg)
            return;
        svg.style.color = "rgb(60, 138, 44)";
        svg.style.width = "60%";
        svg.style.height = "60%";
        svg.animate([
            { scale: "0.5", opacity: "0" },
            { scale: "1", opacity: "1" },
        ], { duration: 300, easing: "ease" });
    }
    setTitle(v: string) {
        this.titleEl.textContent = v;
    }
    setDescription(v: string) {
        this.descriptionEl.textContent = StringUtility.clipStartEllipses(v, 42);
    }
    moveToBottom() {
        NotificationSystem.containerEl.appendChild(this.containerEl);
    }
    remove() {
        this.connectionOwner.disconnectAll();
        if(this.id)
            NotificationSystem.idToNotification.delete(this.id);
        this.containerEl.animate([
            { transform: "translateX(0px)", opacity: "1" },
            { transform: "translateX(-50px)", opacity: "0" },
        ], { duration: 500, easing: "ease-in-out" });
        setTimeout(() => {
            this.containerEl.remove();
        }, 500);
    }
}

export abstract class NotificationSystem {
    static idToNotification: Map<string, Notification> = new Map();
    static containerEl: HTMLDivElement
    constructor() {

    }
    static createNotification(params: NotifcationParams): Notification {
        const notif = new Notification(params.id);
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
        notif.setLoading(true);
        return notif;
    }
    static createInfo(params: NotifcationParams): Notification {
        const notif = this.createNotification(params);
        notif.setIcon("info-circle").then(animI => {
            if(notif.iconAnimIndex != animI)
                return;
            const svg = notif.iconEl.querySelector("svg");
            if(!svg)
                return;
            svg.style.color = "rgb(82, 82, 82)";
            svg.style.width = "60%";
            svg.style.height = "60%";
        });
        return notif;
    }
    static getNotificationById(id: string): Notification | undefined {
        return this.idToNotification.get(id);
    }
}

NotificationSystem.containerEl = document.createElement("div");
NotificationSystem.containerEl.classList.add("notification-system");