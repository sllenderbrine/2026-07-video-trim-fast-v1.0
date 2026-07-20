import { Signal } from "../Signal.js"

export const renderEvent: Signal<[dt: number]> = new Signal();

let frameTime = performance.now();
function render() {
    let now = performance.now();
    let dt = (now - frameTime) / 1000;
    frameTime = now;
    renderEvent.fire(dt);
    requestAnimationFrame(render);
}
render();