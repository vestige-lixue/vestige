import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "resources", "icons");
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsTypes = new Map([
    [16, "icp4"], [32, "icp5"], [64, "icp6"], [128, "ic07"],
    [256, "ic08"], [512, "ic09"], [1024, "ic10"]
]);

function render(color, sizes) {
    const svg = readFileSync(join(root, "renderer", "assets", "logo-square.svg"), "utf8")
        .replaceAll("currentColor", color);
    return new Map(sizes.map(size => [size, new Resvg(svg, {
        fitTo: { mode: "width", value: size }
    }).render().asPng()]));
}

function createIco(images) {
    const directory = Buffer.alloc(6 + icoSizes.length * 16);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(icoSizes.length, 4);
    const frames = [];
    let offset = directory.length;

    for (const [index, size] of icoSizes.entries()) {
        const png = images.get(size);
        const entry = 6 + index * 16;
        directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
        directory.writeUInt16LE(1, entry + 4);
        directory.writeUInt16LE(32, entry + 6);
        directory.writeUInt32LE(png.length, entry + 8);
        directory.writeUInt32LE(offset, entry + 12);
        frames.push(png);
        offset += png.length;
    }

    return Buffer.concat([directory, ...frames]);
}

function createIcns(images) {
    const frames = [...icnsTypes].map(([size, type]) => {
        const png = images.get(size);
        const header = Buffer.alloc(8);
        header.write(type, 0, "ascii");
        header.writeUInt32BE(png.length + 8, 4);
        return Buffer.concat([header, png]);
    });
    const header = Buffer.alloc(8);
    header.write("icns", 0, "ascii");
    header.writeUInt32BE(8 + frames.reduce((length, frame) => length + frame.length, 0), 4);
    return Buffer.concat([header, ...frames]);
}

const black = render("black", [...new Set([...icoSizes, ...icnsTypes.keys()])]);
const white = render("white", icoSizes);
mkdirSync(join(output, "white"), { recursive: true });
writeFileSync(join(output, "icon.png"), black.get(512));
writeFileSync(join(output, "icon.ico"), createIco(black));
writeFileSync(join(output, "icon.icns"), createIcns(black));
writeFileSync(join(output, "white", "icon.ico"), createIco(white));
console.log("Generated Windows black/white ICO, macOS ICNS, and Linux PNG icons.");