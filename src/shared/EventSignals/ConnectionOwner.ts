import { _Connection } from "./_Connection.js";
import { HtmlConnection } from "./HtmlConnection.js";

export class ConnectionOwner {
    connections: _Connection<any>[] = [];
    htmlConnections: HtmlConnection[] = [];
    constructor() {

    }
    addConnection(conn: _Connection<any>) {
        this.connections.push(conn);
        conn.owners.push(this);
    }
    addHtmlConnection(conn: HtmlConnection) {
        this.htmlConnections.push(conn);
        conn.owners.push(this);
    }
    _removeConnectionLocally(conn: _Connection<any>) {
        const index = this.connections.indexOf(conn);
        if(index === -1)
            return;
        this.connections.splice(index, 1);
    }
    _removeHtmlConnectionLocally(conn: HtmlConnection) {
        const index = this.htmlConnections.indexOf(conn);
        if(index === -1)
            return;
        this.htmlConnections.splice(index, 1);
    }
    removeConnection(conn: _Connection<any>) {
        this._removeConnectionLocally(conn);
        const index = conn.owners.indexOf(this);
        if(index === -1)
            return;
        conn.owners.splice(index, 1);
    }
    removeHtmlConnection(conn: HtmlConnection) {
        this._removeHtmlConnectionLocally(conn);
        const index = conn.owners.indexOf(this);
        if(index === -1)
            return;
        conn.owners.splice(index, 1);
    }
    disconnectAllConnections() {
        for(const conn of [...this.connections]) {
            conn.disconnect();
        }
        this.connections = [];
    }
    disconnectAllHtmlConnections() {
        for(const conn of [...this.htmlConnections]) {
            conn.disconnect();
        }
        this.htmlConnections = [];
    }
    disconnectAll() {
        this.disconnectAllConnections();
        this.disconnectAllHtmlConnections();
    }
}