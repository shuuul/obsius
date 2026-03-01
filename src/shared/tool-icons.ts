/**
 * Maps tool titles and kinds to Obsidian Lucide icon names.
 * Follows the Claudian pattern for consistent visual language.
 */

import type { ToolKind } from "../domain/models/chat-message";

const TOOL_TITLE_ICONS: Record<string, string> = {
	Read: "file-text",
	Write: "file-plus",
	Edit: "file-pen",
	NotebookEdit: "file-pen",
	Bash: "terminal",
	Shell: "terminal",
	BashOutput: "terminal",
	KillShell: "terminal",
	Glob: "folder-search",
	Grep: "search",
	LS: "list",
	TodoWrite: "list-checks",
	Task: "bot",
	ListMcpResources: "list",
	ReadMcpResource: "file-text",
	Mcp: "wrench",
	WebSearch: "globe",
	WebFetch: "download",
	TaskOutput: "bot",
	AskUserQuestion: "help-circle",
	AskQuestion: "help-circle",
	Skill: "zap",
	EnterPlanMode: "map",
	ExitPlanMode: "check-circle",
	SwitchMode: "arrow-right-left",
	Delete: "trash-2",
	Move: "move",
};

const KIND_ICONS: Record<ToolKind, string> = {
	read: "file-text",
	edit: "file-pen",
	delete: "trash-2",
	move: "move",
	search: "search",
	execute: "terminal",
	think: "brain",
	fetch: "download",
	switch_mode: "arrow-right-left",
	other: "wrench",
};

/**
 * Resolve the Lucide icon name for a tool call.
 * Tries title-based lookup first, then falls back to kind-based.
 */
export function getToolIconName(
	title: string | null | undefined,
	kind: ToolKind | undefined,
): string {
	if (title) {
		const cleanTitle = title.replace(/\s+/g, "");
		if (TOOL_TITLE_ICONS[cleanTitle]) {
			return TOOL_TITLE_ICONS[cleanTitle];
		}
		if (title.startsWith("mcp__") || title.startsWith("CallMcpTool")) {
			return "wrench";
		}
	}

	if (kind && KIND_ICONS[kind]) {
		return KIND_ICONS[kind];
	}

	return "wrench";
}

/**
 * Get the display name for a tool call.
 * Cleans up raw tool titles into user-friendly labels.
 */
export function getToolDisplayName(
	title: string | null | undefined,
	kind: ToolKind | undefined,
): string {
	if (title) return title;
	if (kind) return kind.charAt(0).toUpperCase() + kind.slice(1);
	return "Tool";
}

/**
 * Extract a human-readable summary from tool call data.
 * Shows the most relevant parameter for each tool type.
 */
export function getToolSummary(
	title: string | null | undefined,
	kind: ToolKind | undefined,
	rawInput: Record<string, unknown> | undefined,
	locations: { path: string; line?: number | null }[] | undefined,
	vaultPath: string,
): string {
	if (!rawInput && !locations) return "";

	if (rawInput) {
		const titleLower = (title ?? "").toLowerCase();

		if (titleLower === "bash" || titleLower === "shell" || kind === "execute") {
			return extractCommandSummary(rawInput);
		}

		const filePath = extractFilePath(rawInput);
		if (filePath) {
			return fileNameOnly(filePath);
		}

		if (titleLower === "grep" || titleLower === "glob") {
			const pattern =
				(rawInput.pattern as string) || (rawInput.glob_pattern as string) || "";
			return truncate(pattern, 50);
		}

		if (titleLower === "websearch" || titleLower === "web_search") {
			return truncate(
				(rawInput.query as string) || (rawInput.search_term as string) || "",
				50,
			);
		}

		if (titleLower === "webfetch" || titleLower === "web_fetch") {
			return truncate((rawInput.url as string) || "", 50);
		}

		if (titleLower === "ls") {
			return fileNameOnly((rawInput.path as string) || ".");
		}

		if (titleLower === "task") {
			return truncate((rawInput.description as string) || "", 50);
		}
	}

	if (locations && locations.length > 0) {
		const loc = locations[0];
		const rel = toRelativeFromVault(loc.path, vaultPath);
		return loc.line != null ? `${rel}:${loc.line}` : rel;
	}

	return "";
}

function extractCommandSummary(rawInput: Record<string, unknown>): string {
	let cmd = (rawInput.command as string) || "";
	if (Array.isArray(rawInput.args) && rawInput.args.length > 0) {
		cmd += ` ${(rawInput.args as string[]).join(" ")}`;
	}
	return truncate(cmd, 60);
}

function extractFilePath(rawInput: Record<string, unknown>): string {
	return (
		(rawInput.file_path as string) ||
		(rawInput.path as string) ||
		(rawInput.filePath as string) ||
		""
	);
}

function fileNameOnly(filePath: string): string {
	if (!filePath) return "";
	const normalized = filePath.replace(/\\/g, "/");
	return normalized.split("/").pop() ?? normalized;
}

function toRelativeFromVault(absolutePath: string, vaultPath: string): string {
	const normalizedBase = vaultPath.replace(/\/+$/, "");
	const normalizedPath = absolutePath.replace(/\/+$/, "");
	if (normalizedPath.startsWith(normalizedBase + "/")) {
		return normalizedPath.slice(normalizedBase.length + 1);
	}
	return absolutePath;
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen) + "\u2026";
}

/**
 * Map domain status to CSS class suffix.
 * Bridges the gap between ACP status values and display states.
 */
export function getStatusDisplayClass(
	status: string | null | undefined,
): string {
	switch (status) {
		case "in_progress":
		case "running":
			return "running";
		case "completed":
			return "completed";
		case "failed":
		case "error":
			return "error";
		default:
			return "";
	}
}

/**
 * Get the Lucide icon name for a status indicator.
 * Returns empty string for statuses that use animation instead of icon.
 */
export function getStatusIconName(status: string | null | undefined): string {
	switch (status) {
		case "completed":
			return "check";
		case "failed":
		case "error":
			return "x";
		default:
			return "";
	}
}
