import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const MAX_LINES = 600;
const ROOT = "src";
const TARGET_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_SEGMENTS = new Set(["__tests__"]);
const LEGACY_EXEMPTIONS = new Set([
	"src/adapters/acp/acp.adapter.ts",
	"src/plugin.ts",
	"src/components/settings/AgentClientSettingTab.ts",
	"src/components/chat/ChatInput.tsx",
	"src/hooks/useAgentSession.ts",
	"src/hooks/useChatController.ts",
	"src/hooks/useChat.ts",
	"src/hooks/useSessionHistory.ts",
	"src/shared/message-service.ts",
	"src/shared/chat-exporter.ts",
]);

function walk(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.name.startsWith(".")) {
			continue;
		}

		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (EXCLUDED_SEGMENTS.has(entry.name)) {
				continue;
			}
			files.push(...walk(fullPath));
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const extension = extname(entry.name);
		if (TARGET_EXTENSIONS.has(extension)) {
			files.push(fullPath);
		}
	}

	return files;
}

const offenders = [];
for (const filePath of walk(ROOT)) {
	if (LEGACY_EXEMPTIONS.has(filePath)) {
		continue;
	}

	if (statSync(filePath).size === 0) {
		continue;
	}

	const content = readFileSync(filePath, "utf8");
	const lines = content.split(/\r?\n/).length;
	if (lines > MAX_LINES) {
		offenders.push({ filePath, lines });
	}
}

if (offenders.length > 0) {
	console.error(
		`File size budget exceeded (${MAX_LINES} lines max for .ts/.tsx files):`,
	);
	for (const offender of offenders.sort((a, b) => b.lines - a.lines)) {
		console.error(`- ${offender.filePath}: ${offender.lines} lines`);
	}
	process.exit(1);
}

console.log("File size budget check passed.");
