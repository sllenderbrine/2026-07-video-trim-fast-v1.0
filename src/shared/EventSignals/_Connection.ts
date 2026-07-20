import type { ConnectionOwner } from "./ConnectionOwner.js";
import { EventObject } from "./EventObject.js";
import type { Signal } from "./Signal.js";

export type ConnectionOptions<T extends any> = {
    owners?: ConnectionOwner[] | null;
    initArgs?: T,
    minInterval?: number,
}

export class _Connection<T extends any[]> {
    owners: ConnectionOwner[] = [];
    disconnected = false;
    constructor(public signal: Signal<T>, public callback: ((...args: T) => void), options: ConnectionOptions<T>) {
        signal.connections.push(this);
        if(options.minInterval != null && options.minInterval > 0) {
            let lastFiredTime = -Infinity;
            let isScheduled = false;
            let savedArgs: T = [] as unknown as T;
            let asyncCallback: () => void;
            let originalHandler = this.callback;

            const updateSavedArgs = (args: T) => {
                for(let i=0; i<args.length; i++) {
                    const arg = args[i]!;
                    const saved = savedArgs[i]!;
                    if(arg instanceof EventObject) {
                        if(saved instanceof EventObject) {
                            saved.copy(arg);
                        } else {
                            savedArgs[i] = arg.clone();
                        }
                    } else {
                        savedArgs[i] = arg;
                    }
                }
            }
            asyncCallback = () => {
                if(!isScheduled)
                    return;
                const now = performance.now();
                if((now - lastFiredTime) / 1000 < options.minInterval!) {
                    requestAnimationFrame(asyncCallback);
                    return;
                }
                isScheduled = false;
                lastFiredTime = performance.now();
                originalHandler(...savedArgs);
            }
            this.callback = (...args: T) => {
                if(isScheduled) {
                    updateSavedArgs(args);
                    return;
                }
                const now = performance.now();
                if((now - lastFiredTime) / 1000 < options.minInterval!) {
                    isScheduled = true;
                    updateSavedArgs(args);
                    requestAnimationFrame(asyncCallback);
                    return;
                }
                lastFiredTime = performance.now();
                originalHandler(...args);
            }
        }
        if(options.owners != null) {
            for(const owner of options.owners) {
                owner.addConnection(this);
            }
        } else if(options.owners === undefined) {
            const err = new Error();
            const stackLines = err.stack ? err.stack.split("\n") : [];
            const callerFrame = (stackLines[3] || "").trim();
            console.warn("Warning: Connection created without any connection owners. Set parameter to null or [] to silence.\n" + callerFrame);
        }
        if(options.initArgs != null) {
            this.callback(...options.initArgs);
        }
    }
    disconnect() {
        this.disconnected = true;
        this.signal.disconnect(this);
        for(const owner of [...this.owners]) {
            owner._removeConnectionLocally(this);
        }
        this.owners = [];
    }
}