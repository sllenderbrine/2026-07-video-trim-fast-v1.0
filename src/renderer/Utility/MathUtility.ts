export function degreesToRadians(x: number) {
    return x * Math.PI / 180;
}

export function clamp(x: number, minX: number, maxX: number) {
    return Math.min(Math.max(x, minX), maxX);
}

export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function lerpClamped(a: number, b: number, t: number) {
    return a + (b - a) * clamp(t, 0, 1);
}

export function pmod(x: number, n: number) {
    return ((x % n) + n) % n;
}