export abstract class EventObject {
    abstract clone(): this;
    abstract copy(other: this): this;   
}