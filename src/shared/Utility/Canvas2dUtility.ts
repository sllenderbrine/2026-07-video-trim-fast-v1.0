export function get2dContext(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
    const ctx = canvas.getContext("2d", options);
    if(!ctx)
        throw new Error("2d context is not supported!");
    return ctx;
}