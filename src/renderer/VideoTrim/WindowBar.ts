import { ConnectionOwner } from "../EventSignals/ConnectionOwner.js";
import { EventObject } from "../EventSignals/EventObject.js";
import { Signal } from "../EventSignals/Signal.js";
import { joinPaths } from "../Utility/FilePathUtility.js";
import { ContextMenu } from "./ContextMenu.js";
import { ContextMenuLayout } from "./ContextMenu.js";
import { ContextMenuButton } from "./ContextMenu.js";

const PATH_RESOURCES = "..";
const PATH_ICONS = joinPaths(PATH_RESOURCES, "icons");

export class WindowBarMenuClickEvent extends EventObject {
    contextMenu?: ContextMenu;
    contextMenuButton?: ContextMenuButton;
    windowBarButton?: WindowBarButton;
    index: number = 0;
    constructor() {
        super();
    }
    clone() {
        return new WindowBarMenuClickEvent().copy(this) as this;
    }
    copy(other: WindowBarMenuClickEvent) {
        this.contextMenu = other.contextMenu;
        this.contextMenuButton = other.contextMenuButton;
        this.windowBarButton = other.windowBarButton;
        this.index = other.index;
        return this;
    }
}

export class WindowBarButton {
    containerEl: HTMLDivElement;
    buttonEl: HTMLButtonElement;
    titleEl: HTMLDivElement;
    childContextMenu?: ContextMenu;
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor(
        public parent: WindowBar,
        title: string | null,
        icon: string | null,
        public getContextMenuLayout: (() => ContextMenuLayout[]) | null,
        public onClick: (() => void) | null,
        danger: boolean = false,
        overrideSize: number | null = null,
        overrideWidth: number | null = null,
    ) {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("wbar-button-container");
        if(danger) {
            this.containerEl.classList.add("wbar-button-danger");
        }
        this.buttonEl = document.createElement("button");
        this.containerEl.appendChild(this.buttonEl);
        this.buttonEl.classList.add("wbar-button");
        this.titleEl = document.createElement("div");
        this.containerEl.appendChild(this.titleEl);
        this.titleEl.classList.add("wbar-title");
        if(title != null) {
            this.setTitle(title, overrideSize, overrideWidth);
        }
        if(icon != null) {
            this.setIcon(icon, overrideSize, overrideWidth);
        }
        if(onClick || getContextMenuLayout) {
            this.buttonEl.addEventListener("click", e => {
                if(onClick) {
                    onClick();
                }
                this.parent.buttonClickEvent.fire(this);
                if(this.childContextMenu) {
                    this.childContextMenu.remove();
                    delete this.childContextMenu;
                } else if(getContextMenuLayout) {
                    const rect = this.containerEl.getBoundingClientRect();
                    const layout = getContextMenuLayout();
                    const menu = new ContextMenu(null, rect.left, rect.top + rect.height);
                    menu.addLayout(layout);
                    parent.contextMenus.push(menu);
                    this.childContextMenu = menu;
                    menu.buttonClickEvent.connect((e) => {
                        parent.menuButtonClickEvent.fire(e);
                    }, { owners: [ parent.connectionOwner, menu.connectionOwner, this.connectionOwner ] });
                    menu.clickOffEvent.connect((e) => {
                        if(e.target == this.buttonEl)
                            return;
                        if(e.target && this.parent.elementToButton.get(e.target))
                            return;
                        menu.remove();
                    }, { owners: [ parent.connectionOwner, menu.connectionOwner, this.connectionOwner ] });
                    menu.removeEvent.connect(() => {
                        if(this.childContextMenu == menu) {
                            delete this.childContextMenu;
                        }
                        const index = parent.contextMenus.indexOf(menu);
                        if(index !== -1) {
                            parent.contextMenus.splice(index, 1);
                        }
                    }, { owners: [ parent.connectionOwner, menu.connectionOwner, this.connectionOwner ] });
                    this.parent.buttonClickEvent.connect(btn => {
                        if(btn == this)
                            return;
                        menu.remove();
                    }, { owners: [ parent.connectionOwner, menu.connectionOwner, this.connectionOwner ] });
                }
            });
        }
    }
    
    setTitle(title: string, overrideSize: number | null, overrideWidth: number | null) {
        this.titleEl.innerHTML = "";
        this.titleEl.textContent = title;
        if(overrideSize != null) {
            this.titleEl.style.fontSize = overrideSize + "px";
        } else {
            this.titleEl.style.fontSize = "";
        }
        if(overrideWidth != null) {
            this.titleEl.style.width = overrideWidth + "px";
        } else {
            this.titleEl.style.width = "";
        }
    }

    setIcon(icon: string, overrideSize: number | null, overrideWidth: number | null) {
        this.titleEl.innerHTML = "";
        const iconContainer = document.createElement("div");
        this.titleEl.appendChild(iconContainer);
        iconContainer.classList.add("wbar-icon");
        fetch(joinPaths(PATH_ICONS, icon + ".svg")).then(res => res.text()).then(inner => {
            iconContainer.innerHTML = inner;
        });
        if(overrideSize != null) {
            iconContainer.style.width = overrideSize + "px";
            iconContainer.style.height = overrideSize + "px";
        }
        if(overrideWidth != null) {
            this.titleEl.style.width = overrideWidth + "px";
        } else {
            this.titleEl.style.width = "";
        }
    }
}

export enum WindowBarSide {
    LEFT = 0,
    RIGHT = 1,
};

export class WindowBar {
    containerEl: HTMLDivElement;
    leftContentEl: HTMLDivElement;
    rightContentEl: HTMLDivElement;
    buttons: WindowBarButton[] = [];
    contextMenus: ContextMenu[] = [];
    elementToButton: Map<EventTarget, WindowBarButton> = new Map();
    closeFunc: () => void;
    maximizeFunc: () => void;
    minimizeFunc: () => void;
    menuButtonClickEvent: Signal<[e: WindowBarMenuClickEvent]> = new Signal();
    buttonClickEvent: Signal<[btn: WindowBarButton]> = new Signal();
    connectionOwner: ConnectionOwner = new ConnectionOwner();
    constructor() {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("wbar-container");
        document.body.appendChild(this.containerEl);

        this.leftContentEl = document.createElement("div");
        this.leftContentEl.classList.add("wbar-left");
        this.containerEl.appendChild(this.leftContentEl);

        this.rightContentEl = document.createElement("div");
        this.rightContentEl.classList.add("wbar-right");
        this.containerEl.appendChild(this.rightContentEl);

        this.closeFunc = () => {
            window.windowApi.close();
        }

        this.maximizeFunc = () => {
            window.windowApi.maximize();
        }

        this.minimizeFunc = () => {
            window.windowApi.minimize();
        }

        this.addIconButton("small-cross", null, () => {
            this.closeFunc();
        }, WindowBarSide.RIGHT, true, 24, 22);

        this.addIconButton("maximize", null, () => {
            this.maximizeFunc();
        }, WindowBarSide.RIGHT, false, 13, 22);

        this.addIconButton("dash", null, () => {
            this.minimizeFunc();
        }, WindowBarSide.RIGHT, false, 14, 22);
    }

    addTextButton(
        title: string,
        getContextMenuLayout: (() => ContextMenuLayout[]) | null,
        onClick: (() => void) | null,
        side: WindowBarSide,
        danger: boolean = false,
        overrideSize: number | null = null,
        overrideWidth: number | null = null,
    ) {
        const btn = new WindowBarButton(
            this,
            title,
            null,
            getContextMenuLayout,
            onClick,
            danger,
            overrideSize,
            overrideWidth,
        );
        if(side == WindowBarSide.LEFT) {
            this.leftContentEl.appendChild(btn.containerEl);
        } else if(side == WindowBarSide.RIGHT) {
            this.rightContentEl.appendChild(btn.containerEl);
        }
        this.buttons.push(btn);
        this.elementToButton.set(btn.buttonEl, btn);
        return btn;
    }
    
    addIconButton(
        icon: string,
        getContextMenuLayout: (() => ContextMenuLayout[]) | null,
        onClick: (() => void) | null,
        side: WindowBarSide,
        danger: boolean = false,
        overrideSize: number | null = null,
        overrideWidth: number | null = null,
    ) {
        const btn = new WindowBarButton(
            this,
            null,
            icon,
            getContextMenuLayout,
            onClick,
            danger,
            overrideSize,
            overrideWidth,
        );
        if(side == WindowBarSide.LEFT) {
            this.leftContentEl.appendChild(btn.containerEl);
        } else if(side == WindowBarSide.RIGHT) {
            this.rightContentEl.appendChild(btn.containerEl);
        }
        this.buttons.push(btn);
        this.elementToButton.set(btn.containerEl, btn);
        return btn;
    }
}