import { describe, expect, it } from "vitest";
import { createInitialChatState } from "../src/hooks/state/chat.actions";
import { chatReducer } from "../src/hooks/state/chat.reducer";

describe("chatReducer", () => {
	it("handles basic chat state transitions", () => {
		let state = createInitialChatState();
		state = chatReducer(state, { type: "send_start" });
		expect(state.isSending).toBe(true);

		state = chatReducer(state, {
			type: "set_last_user_message",
			message: "hello",
		});
		expect(state.lastUserMessage).toBe("hello");

		state = chatReducer(state, {
			type: "set_error",
			error: { title: "Send", message: "failed" },
		});
		expect(state.errorInfo?.message).toBe("failed");

		state = chatReducer(state, { type: "clear_error" });
		expect(state.errorInfo).toBeNull();

		state = chatReducer(state, { type: "send_complete" });
		expect(state.isSending).toBe(false);
	});

	it("supports set_messages and clear_messages actions", () => {
		const state = chatReducer(createInitialChatState(), {
			type: "set_messages",
			messages: [
				{
					id: "1",
					role: "assistant",
					content: [{ type: "text", text: "hello" }],
					timestamp: new Date(),
				},
			],
		});
		expect(state.messages).toHaveLength(1);
		expect(
			chatReducer(state, { type: "clear_messages" }).messages,
		).toHaveLength(0);
	});

	it("preserves all tool call updates across rapid apply_messages actions", () => {
		const baseState = createInitialChatState();

		const withToolCall = chatReducer(baseState, {
			type: "apply_messages",
			updater: () => [
				{
					id: "assistant-1",
					role: "assistant",
					timestamp: new Date(),
					content: [
						{
							type: "tool_call",
							toolCallId: "tc-1",
							status: "pending",
							content: [],
						},
					],
				},
			],
		});

		const withFirstUpdate = chatReducer(withToolCall, {
			type: "apply_messages",
			updater: (messages) =>
				messages.map((message) => ({
					...message,
					content: message.content.map((item) => {
						if (item.type !== "tool_call") {
							return item;
						}
						return {
							...item,
							content: [{ type: "terminal", terminalId: "term-1" }],
						};
					}),
				})),
		});

		const withSecondUpdate = chatReducer(withFirstUpdate, {
			type: "apply_messages",
			updater: (messages) =>
				messages.map((message) => ({
					...message,
					content: message.content.map((item) => {
						if (item.type !== "tool_call") {
							return item;
						}
						return {
							...item,
							status: "completed",
							content: [
								...(item.content ?? []),
								{
									type: "diff",
									path: "foo.ts",
									oldText: "a",
									newText: "b",
								},
							],
						};
					}),
				})),
		});

		expect(withSecondUpdate.messages).toHaveLength(1);
		const toolCall = withSecondUpdate.messages[0].content[0];
		expect(toolCall.type).toBe("tool_call");
		if (toolCall.type === "tool_call") {
			expect(toolCall.status).toBe("completed");
			expect(toolCall.content).toHaveLength(2);
		}
	});
});
