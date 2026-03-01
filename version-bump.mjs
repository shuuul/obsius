import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const targetVersion =
	process.argv[2] || process.env.npm_package_version || pkg.version;

if (!targetVersion) {
	throw new Error("Missing target version");
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = manifest.minAppVersion;

writeFileSync("manifest.json", `${JSON.stringify(manifest, null, "\t")}\n`);
writeFileSync("versions.json", `${JSON.stringify(versions, null, "\t")}\n`);
