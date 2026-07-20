import type { ConnectionOwner } from "./ConnectionOwner.js";

export type HtmlConnectionOptions = {
    owners?: ConnectionOwner[] | null;
}

export class HtmlConnection {
    owners: ConnectionOwner[] = [];
    constructor(public el: EventTarget, public eventName: string, public callback: any, options: HtmlConnectionOptions) {
        el.addEventListener(eventName, callback);
        if(options.owners != null) {
            for(const group of options.owners) {
                group.addHtmlConnection(this);
            }
        } else if(options.owners === undefined) {
            const err = new Error();
            const stackLines = err.stack ? err.stack.split("\n") : [];
            const callerFrame = (stackLines[2] || "").trim();
            console.warn("Warning: HtmlConnection created without any connection owners. Set parameter to null or [] to silence.\n" + callerFrame);
        }
    }
    disconnect() {
        this.el.removeEventListener(this.eventName, this.callback);
        for(const group of [...this.owners]) {
            group._removeHtmlConnectionLocally(this);
        }
        this.owners = [];
    }
}