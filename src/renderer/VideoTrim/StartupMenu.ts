export class StartupMenu {
    containerEl: HTMLDivElement;
    columnEl0: HTMLDivElement;
    columnEl1: HTMLDivElement;
    constructor() {
        this.containerEl = document.createElement("div");
        this.containerEl.classList.add("startup-container");

        this.columnEl0 = document.createElement("div");
        this.containerEl.appendChild(this.columnEl0)
        this.columnEl0.classList.add("startup-content-column");

        this.columnEl0.innerHTML = `
            <div>
                <h1>Simple Video Trimmer</h1>
                <h3>Gameplay Clip Editor</h3>
            </div>
            <div>
                <h2>Recents</h2>
            </div>
        `;

        this.columnEl1 = document.createElement("div");
        this.containerEl.appendChild(this.columnEl1)
        this.columnEl1.classList.add("startup-content-column");

        this.columnEl1.innerHTML = `
            <div>
                <h2>Start</h2>
            </div>
        `;
    }
}