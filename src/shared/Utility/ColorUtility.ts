import { Color } from "../Color/Color.js";

export function blendColors(bottom: Color, top: Color): Color {
    const alphaTop = top.a / 100;
    const alphaBottom = bottom.a / 100;
    const remainder = (1 - alphaTop);
    const alphaResult = (alphaTop + alphaBottom * remainder);

    if(alphaResult == 0)
        return Color.fromRgb(0, 0, 0, 0);

    return Color.fromRgb(
        (top.r * alphaTop + bottom.r * alphaBottom * remainder) / alphaResult,
        (top.g * alphaTop + bottom.g * alphaBottom * remainder) / alphaResult,
        (top.b * alphaTop + bottom.b * alphaBottom * remainder) / alphaResult,
        alphaResult * 100
    );
}