import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const DOMAIN_ROOT = "src/domain";
const TARGET_EXTENSIONS = new Set([".ts", ".tsx"]);
const FORBIDDEN_PATTERNS = [
	/from\s+["']obsidian["']/,
	/from\s+["']@agentclientprotocol\/sdk["']/,
	/from\s+["']react["']/,
];

function walk(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(fullPath));
			continue;
		}
		if (TARGET_EXTENSIONS.has(extname(entry.name))) {
			files.push(fullPath);
		}
	}
	return files;
}

const violations = [];
for (const filePath of walk(DOMAIN_ROOT)) {
	const content = readFileSync(filePath, "utf8");
	for (const pattern of FORBIDDEN_PATTERNS) {
		if (pattern.test(content)) {
			violations.push(filePath);
			break;
		}
	}
}

if (violations.length > 0) {
	console.error("Domain boundary violations found:");
	for (const filePath of violations) {
		console.error(`- ${filePath}`);
	}
	process.exit(1);
}

console.log("Domain boundary check passed.");
