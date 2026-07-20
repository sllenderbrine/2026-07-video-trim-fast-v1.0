import { pmod } from "./MathUtility.js";

export function clipEllipses(str: string, maxLength: number) {
    if(str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength) + "...";
}

export function clipStartEllipses(str: string, maxLength: number) {
    if(str.length <= maxLength) {
        return str;
    }
    return "..." + str.substring(str.length - maxLength, str.length);
}

export function trimEveryLine(str: string) {
    return str.split("\n").map(v => v.trim()).join("\n");
}

export function formatVideoDuration(duration: number) {
    duration = Math.floor(duration);
    let hours = Math.floor(duration / 60 / 60);
    let minutes = pmod(Math.floor(duration / 60), 60);
    let seconds = pmod(duration, 60);
    if(hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
}