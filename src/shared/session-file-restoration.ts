import type { ChatMessage } from "../domain/models/chat-message";

export interface FileChange {
	path: string;
	originalText: string | null;
	finalText: string;
}

export interface SessionChangeSet {
	changes: FileChange[];
}

export function extractSessionChangeSet(
	messages: ChatMessage[],
): SessionChangeSet {
	const fileMap = new Map<string, FileChange>();

	for (const msg of messages) {
		for (const content of msg.content) {
			if (content.type !== "tool_call" || !content.content) continue;
			for (const item of content.content) {
				if (item.type !== "diff") continue;
				const diff = item;
				const existing = fileMap.get(diff.path);
				if (existing) {
					existing.finalText = diff.newText;
				} else {
					fileMap.set(diff.path, {
						path: diff.path,
						originalText: diff.oldText ?? null,
						finalText: diff.newText,
					});
				}
			}
		}
	}

	return { changes: Array.from(fileMap.values()) };
}

export function getLastAssistantMessage(
	messages: ChatMessage[],
): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;
		for (const content of msg.content) {
			if (content.type === "text" && content.text.trim()) {
				return content.text;
			}
		}
	}
	return null;
}
