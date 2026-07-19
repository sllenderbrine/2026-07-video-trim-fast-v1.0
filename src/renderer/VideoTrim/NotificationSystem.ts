import { Color } from "../Color/Color.js";
import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { renderEvent } from "../EventSignals/events/RenderEvent.js";
import { HtmlConnection } from "../EventSignals/HtmlConnection.js";
import { Signal } from "../EventSignals/Signal.js";
import { joinPaths } from "../Utility/FilePathUtility.js";
import { lerpClamped, roundDecimals } from "../Utility/MathUtility.js";
import { Vec2 } from "../Vectors/Vec2.js";
import { WindowBar, WindowBarButton, WindowBarSide } from "./WindowBar.js";

const PATH_RESOURCES = "..";
const PATH_ICONS = joinPaths(PATH_RESOURCES, "icons");

export class ActiveNotification {
    containerEl: HTMLDivElement;
    textContentEl: HTMLDivElement;
    titleEl: HTMLDivElement;
    iconEl: HTMLDivElement;
    descriptionEl: HTMLDivElement;
    closeButtonEl?: HTMLButtonElement;
    progressEl?: HTMLDivElement;
    progressValueEl?: HTMLDivElement;
    icon: string = "";
    iconType: NotificationIconType = NotificationIconType.NONE;
    timeout: number = -1;
    timeoutStart: number = -1;
    currentPosition: Vec2 = Vec2.zero();
    targetPosition: Vec2 = Vec2.zero();
    targetOffset: Vec2 = Vec2.zero();
    currentOpacity: number = 0;
    targetOpacity: number = 1;
    removed: boolean = false;
    removeEvent: Signal<[]> = new Signal();
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(public parent: NotificationSystem) {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("ntf-container");

        this.iconEl = document.createElement("div");
        this.containerEl.appendChild(this.iconEl);
        this.iconEl.classList.add("ntf-icon-container");

        this.textContentEl = document.createElement("div");
        this.containerEl.appendChild(this.textContentEl);
        this.textContentEl.classList.add("ntf-text-content");

        this.titleEl = document.createElement("div");
        this.textContentEl.appendChild(this.titleEl);
        this.titleEl.classList.add("ntf-title");

        this.descriptionEl = document.createElement("div");
        this.textContentEl.appendChild(this.descriptionEl);
        this.descriptionEl.classList.add("ntf-description");

        const tempVec = Vec2.zero();
        renderEvent.connect(dt => {
            this.targetPosition.add(this.targetOffset, tempVec);
            this.currentPosition.lerpClampedSelf(tempVec, dt * 20);
            this.currentOpacity = lerpClamped(this.currentOpacity, this.targetOpacity, dt * 20);
            this.updateTransform();
            if(this.timeout >= 0 && (performance.now() - this.timeoutStart) / 1000 > this.timeout) {
                this.remove();
            }
        }, { owners: [ this.connectionOwner, this.parent.connectionOwner ] });
    }

    setCloseButton(v: boolean) {
        if(v && this.closeButtonEl == null) {
            const btn = document.createElement("button");
            this.closeButtonEl = btn;
            this.containerEl.appendChild(this.closeButtonEl);
            this.closeButtonEl.classList.add("ntf-close-button");
            fetch(joinPaths(PATH_ICONS, "small-cross.svg")).then(res => res.text()).then(text => {
                btn.innerHTML = text;
            });
            btn.onclick = () => {
                this.remove();
            }
        } else if(!v && this.closeButtonEl != null) {
            this.closeButtonEl.remove();
            delete this.closeButtonEl;
        }
    }

    setProgress(v: number) {
        if(v == -1 && this.progressEl != null) {
            this.progressEl.remove();
            return;
        }
        if(this.progressEl == null) {
            
        }
    }

    setTitle(v: string) {
        this.titleEl.textContent = v;
    }

    setDescription(v: string) {
        this.descriptionEl.textContent = v;
    }

    addViewDetailsLink() {
        this.descriptionEl.innerHTML += ` <span class="ntf-link">View details</span>`;
    }

    createIconContainer(scale: number = 1) {
        this.iconEl.innerHTML = "";
        const iconContainer = document.createElement("div");
        this.iconEl.appendChild(iconContainer);
        iconContainer.classList.add("ntf-icon");
        this.iconEl.style.scale = scale + "";
        return iconContainer;
    }

    createCustomIconContainer(v: string, color: Color, scale: number = 1) {
        const iconContainer = this.createIconContainer(scale);
        iconContainer.style.color = color.toCss();
        fetch(joinPaths(PATH_ICONS, v + ".svg")).then(res => res.text()).then(text => {
            iconContainer.innerHTML = text;
        });
        return iconContainer;
    }

    setIconType(v: NotificationIconType, color: Color) {
        this.iconType = v;
        let iconContainer: HTMLDivElement;
        switch(v) {
            case NotificationIconType.CUSTOM:
                this.createCustomIconContainer(this.icon, color);
                break;
            case NotificationIconType.CHECK:
                iconContainer = this.createCustomIconContainer("check-circle", Color.fromRgb(30, 165, 55), 1);
                iconContainer.style.scale = "0.5";
                setTimeout(() => {
                    iconContainer.style.scale = "1";
                    iconContainer.animate([
                        { scale: "0.5", },
                        { scale: "1", },
                    ], { duration: 500, easing: "cubic-bezier(0.68, -0.55, 0.27, 1.55)" });
                }, 100);
                break;
            case NotificationIconType.ERROR:
                iconContainer = this.createCustomIconContainer("cross-circle", Color.fromRgb(205, 30, 55), 1.1);
                iconContainer.style.scale = "0.5";
                setTimeout(() => {
                    iconContainer.style.scale = "1";
                    iconContainer.animate([
                        { scale: "0.5", },
                        { scale: "1", },
                    ], { duration: 500, easing: "cubic-bezier(0.68, -0.55, 0.27, 1.55)" });
                }, 0);
                break;
            case NotificationIconType.INFO:
                break;
            case NotificationIconType.LOADING:
                break;
            case NotificationIconType.NONE:
                this.iconEl.innerHTML = "";
                break;
        }
    }

    setIcon(v: string, scale: number = 1) {
        this.icon = v;
        if(this.iconType == NotificationIconType.CUSTOM) {
            const iconContainer = this.createIconContainer(scale);
            fetch(joinPaths(PATH_ICONS, this.icon + ".svg")).then(res => res.text()).then(text => {
                iconContainer.innerHTML = text;
            });
        }
    }

    setTimeout(v: number) {
        this.timeout = v;
        this.timeoutStart = performance.now();
    }

    snapToActualPosition(initialOffset: Vec2 = Vec2.zero()) {
        this.currentPosition.copy(this.targetPosition).addSelf(initialOffset);
        this.updateTransform();
    }

    updateTransform() {
        const dx = this.currentPosition.x - this.targetPosition.x;
        const dy = this.currentPosition.y - this.targetPosition.y;
        this.containerEl.style.transform = `translate(${roundDecimals(dx, 0.2)}px, ${roundDecimals(dy, 0.2)}px)`;
        this.containerEl.style.opacity = roundDecimals(this.currentOpacity, 1) + "";
    }

    updateTargetPosition() {
        this.containerEl.style.transform = "";
        const rect = this.containerEl.getBoundingClientRect();
        this.targetPosition.fromComponents(rect.left, rect.top);
        this.updateTransform();
    }

    remove() {
        if(this.removed)
            return;
        this.removed = true;
        this.targetOpacity = 0;
        this.targetOffset.x = -50;
        setTimeout(() => {
            this.containerEl.remove();
            this.parent.updateActiveNotificationsLayout();
            this.removeEvent.fire();
            this.connectionOwner.disconnectAll();
        }, 100);
    }
}

export enum NotificationIconType {
    CUSTOM = 0,
    ERROR = 1,
    LOADING = 2,
    CHECK = 3,
    INFO = 4,
    NONE = 5,
}

export type ActiveNotificationOptions = {
    title?: string,
    iconType?: NotificationIconType,
    icon?: string,
    iconColor?: Color,
    description?: string,
    timeout?: number,
    viewDetails?: boolean,
    iconScale?: number,
    canClose?: boolean,
};

export class NotificationSystem {
    activeContainerEl: HTMLDivElement;
    notificationButton: WindowBarButton;
    notificationCounter: HTMLDivElement;
    activeNotifications: ActiveNotification[] = [];
    activeNotificationCountChanged: Signal<[count: number]> = new Signal();
    activeClosed: boolean = false;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(wbar: WindowBar) {
        this.activeContainerEl = document.createElement("div");
        this.activeContainerEl.classList.add("ntf-active-container");

        const notifBtn = wbar.addIconButton("notification", null, () => {
            if(this.activeClosed) {
                this.activeClosed = false;
                this.setActiveClosed(false);
            } else {
                this.activeClosed = true;
                this.setActiveClosed(true);
            }
            notifBtn.buttonEl.style.cursor = "default";
            setTimeout(() => {
                notifBtn.buttonEl.style.cursor = "pointer";
            }, 50);
        }, WindowBarSide.RIGHT, false, 22, 16);
        this.notificationButton = notifBtn;
        notifBtn.containerEl.classList.add("wbar-notif");
        const notifCounter = document.createElement("div");
        notifBtn.containerEl.appendChild(notifCounter);
        notifCounter.classList.add("wbar-notif-counter");
        this.notificationCounter = notifCounter;
        notifCounter.style.display = "none";
        notifBtn.buttonEl.style.backgroundColor = "rgb(30, 30, 30)";

        this.activeNotificationCountChanged.connect(count => {
            notifCounter.textContent = count + "";
            this.notificationCounter.style.display = !this.activeClosed || this.activeNotifications.length == 0 ? "none" : "block";
        }, { owners: [ this.connectionOwner ], initArgs: [ this.activeNotifications.length ] })

        new HtmlConnection(window, "resize", () => {
            this.updateActiveNotificationsLayout();
        }, { owners: [ this.connectionOwner ] });
    }

    setActiveClosed(v: boolean) {
        if(v) {
            this.activeClosed = true;
            this.activeContainerEl.style.display = "none";
            this.notificationButton.buttonEl.style.backgroundColor = "";
            this.notificationCounter.style.display = this.activeNotifications.length == 0 ? "none" : "block";
        } else {
            this.activeClosed = false;
            this.activeContainerEl.style.display = "flex";
            this.notificationButton.buttonEl.style.backgroundColor = "rgb(30, 30, 30)";
            this.notificationCounter.style.display = "none";
        }
    }

    sendActiveNotification({
        title = "",
        iconType = NotificationIconType.INFO,
        iconColor = Color.BLACK,
        icon = "",
        description = "",
        timeout = -1,
        viewDetails = false,
        iconScale = 1,
        canClose = true,
    }: ActiveNotificationOptions = {}) {
        const notif = new ActiveNotification(this);
        notif.setTitle(title);
        notif.setIconType(iconType, iconColor);
        notif.setIcon(icon, iconScale);
        notif.setDescription(description);
        notif.setTimeout(timeout);
        this.activeContainerEl.appendChild(notif.containerEl);
        this.activeNotifications.push(notif);
        this.activeNotificationCountChanged.fire(this.activeNotifications.length);
        this.updateActiveNotificationsLayout();
        notif.snapToActualPosition(Vec2.LEFT.mulScalar(50));
        notif.removeEvent.connect(() => {
            const index = this.activeNotifications.indexOf(notif);
            if(index !== -1) {
                this.activeNotifications.splice(index, 1);
                this.activeNotificationCountChanged.fire(this.activeNotifications.length);
            }
        }, { owners: null });
        if(viewDetails) {
            notif.addViewDetailsLink();
        }
        notif.setCloseButton(canClose);
        return notif;
    }

    updateActiveNotificationsLayout() {
        this.activeNotifications.forEach(notif => {
            notif.updateTargetPosition();
        });
    }
}