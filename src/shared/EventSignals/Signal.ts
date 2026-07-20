import { _Connection, ConnectionOptions } from "./_Connection.js";
import type { ConnectionOwner } from "./ConnectionOwner.js";

export class Signal<T extends any[]> {
    connections: _Connection<T>[] = [];
    constructor() {

    }
    connect(callback: (...args: T) => void, options: ConnectionOptions<T>): _Connection<T> {
        const conn = new _Connection(this, callback, options);
        return conn;
    }
    disconnect(connection: _Connection<T>) {
        const index = this.connections.indexOf(connection);
        if(index === -1)
            return
        this.connections.splice(index, 1);
    }
    fire(...args: T) {
        for(const conn of [...this.connections]) {
            conn.callback(...args);
        }
    }
}