import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/domain/models/chat-message";
import {
	extractSessionChangeSet,
	getLastAssistantMessage,
} from "../src/shared/session-file-restoration";

function makeMessage(
	role: "user" | "assistant",
	content: ChatMessage["content"],
): ChatMessage {
	return {
		id: crypto.randomUUID(),
		role,
		content,
		timestamp: new Date(),
	};
}

describe("extractSessionChangeSet", () => {
	it("extracts diffs from tool calls", () => {
		const messages: ChatMessage[] = [
			makeMessage("assistant", [
				{
					type: "tool_call",
					toolCallId: "tc1",
					status: "completed",
					content: [
						{
							type: "diff",
							path: "src/foo.ts",
							oldText: "old content",
							newText: "new content",
						},
					],
				},
			]),
		];

		const cs = extractSessionChangeSet(messages);
		expect(cs.changes).toHaveLength(1);
		expect(cs.changes[0].path).toBe("src/foo.ts");
		expect(cs.changes[0].originalText).toBe("old content");
		expect(cs.changes[0].finalText).toBe("new content");
	});

	it("tracks latest change per file", () => {
		const messages: ChatMessage[] = [
			makeMessage("assistant", [
				{
					type: "tool_call",
					toolCallId: "tc1",
					status: "completed",
					content: [
						{
							type: "diff",
							path: "src/foo.ts",
							oldText: "v1",
							newText: "v2",
						},
					],
				},
			]),
			makeMessage("assistant", [
				{
					type: "tool_call",
					toolCallId: "tc2",
					status: "completed",
					content: [
						{
							type: "diff",
							path: "src/foo.ts",
							oldText: "v2",
							newText: "v3",
						},
					],
				},
			]),
		];

		const cs = extractSessionChangeSet(messages);
		expect(cs.changes).toHaveLength(1);
		expect(cs.changes[0].originalText).toBe("v1");
		expect(cs.changes[0].finalText).toBe("v3");
	});

	it("returns empty for messages without diffs", () => {
		const messages: ChatMessage[] = [
			makeMessage("user", [{ type: "text", text: "hello" }]),
			makeMessage("assistant", [{ type: "text", text: "hi" }]),
		];

		const cs = extractSessionChangeSet(messages);
		expect(cs.changes).toHaveLength(0);
	});
});

describe("getLastAssistantMessage", () => {
	it("returns last assistant text", () => {
		const messages: ChatMessage[] = [
			makeMessage("assistant", [{ type: "text", text: "first" }]),
			makeMessage("user", [{ type: "text", text: "question" }]),
			makeMessage("assistant", [{ type: "text", text: "last answer" }]),
		];

		expect(getLastAssistantMessage(messages)).toBe("last answer");
	});

	it("returns null when no assistant messages", () => {
		const messages: ChatMessage[] = [
			makeMessage("user", [{ type: "text", text: "hello" }]),
		];

		expect(getLastAssistantMessage(messages)).toBeNull();
	});

	it("skips empty text content", () => {
		const messages: ChatMessage[] = [
			makeMessage("assistant", [{ type: "text", text: "real content" }]),
			makeMessage("assistant", [{ type: "text", text: "   " }]),
		];

		expect(getLastAssistantMessage(messages)).toBe("real content");
	});
});
