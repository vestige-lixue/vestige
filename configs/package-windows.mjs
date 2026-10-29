import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("Windows installers must be packaged on Windows.");

const root = fileURLToPath(new URL("../", import.meta.url));
const arch = process.argv[2] ?? process.arch;
if (!["x64", "arm64"].includes(arch)) throw new Error(`Unsupported Windows architecture: ${arch}`);

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const source = join(root, "dist", "release", arch === "x64" ? "win-unpacked" : `win-${arch}-unpacked`);
if (!existsSync(join(source, "vestige.exe"))) throw new Error(`Packaged application not found: ${source}`);

const programDirectories = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);
const compiler = [7, 6]
    .flatMap(version => programDirectories.map(directory => join(directory, `Inno Setup ${version}`, "ISCC.exe")))
    .find(existsSync) ?? "ISCC.exe";

const result = spawnSync(compiler, [
    `/DAppVersion=${version}`,
    `/DAppArch=${arch}`,
    `/DAppSource=${source}`,
    join(root, "configs", "inno-setup.iss")
], { cwd: root, stdio: "inherit", windowsHide: true });

if (result.error) throw new Error("Could not run Inno Setup. Install Inno Setup 6.3 or newer and make ISCC.exe available.", { cause: result.error });
process.exitCode = result.status ?? 1;