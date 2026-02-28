import { describe, expect, it, vi } from "vitest";
import { routeSessionUpdate } from "../src/adapters/acp/update-routing";

describe("routeSessionUpdate", () => {
	it("routes available_commands_update into domain command shape", () => {
		const handleSessionUpdate = vi.fn();
		routeSessionUpdate(
			{
				sessionUpdate: "available_commands_update",
				availableCommands: [
					{
						name: "compact",
						description: "Compact context",
						input: { hint: "recent" },
					},
				],
			},
			"session-1",
			handleSessionUpdate,
		);

		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "available_commands_update",
			sessionId: "session-1",
			commands: [
				{
					name: "compact",
					description: "Compact context",
					hint: "recent",
				},
			],
		});
	});

	it("ignores unsupported content for agent_message_chunk", () => {
		const handleSessionUpdate = vi.fn();
		routeSessionUpdate(
			{
				sessionUpdate: "agent_message_chunk",
				content: { type: "image", data: "abc", mimeType: "image/png" },
			},
			"session-1",
			handleSessionUpdate,
		);

		expect(handleSessionUpdate).not.toHaveBeenCalled();
	});

	it("routes text chunk updates", () => {
		const handleSessionUpdate = vi.fn();

		routeSessionUpdate(
			{
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "hello" },
			},
			"session-2",
			handleSessionUpdate,
		);

		routeSessionUpdate(
			{
				sessionUpdate: "agent_thought_chunk",
				content: { type: "text", text: "thinking" },
			},
			"session-2",
			handleSessionUpdate,
		);

		routeSessionUpdate(
			{
				sessionUpdate: "user_message_chunk",
				content: { type: "text", text: "user" },
			},
			"session-2",
			handleSessionUpdate,
		);

		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "agent_message_chunk",
			sessionId: "session-2",
			text: "hello",
		});
		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "agent_thought_chunk",
			sessionId: "session-2",
			text: "thinking",
		});
		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "user_message_chunk",
			sessionId: "session-2",
			text: "user",
		});
	});

	it("routes tool_call, plan, and current_mode_update", () => {
		const handleSessionUpdate = vi.fn();

		routeSessionUpdate(
			{
				sessionUpdate: "tool_call",
				toolCallId: "tc-1",
				title: "Run terminal",
				status: "pending",
				content: [{ type: "terminal", terminalId: "term-1" }],
			},
			"session-3",
			handleSessionUpdate,
		);

		routeSessionUpdate(
			{
				sessionUpdate: "plan",
				entries: [
					{
						content: "do work",
						status: "pending",
						priority: "medium",
					},
				],
			},
			"session-3",
			handleSessionUpdate,
		);

		routeSessionUpdate(
			{
				sessionUpdate: "current_mode_update",
				currentModeId: "edit",
			},
			"session-3",
			handleSessionUpdate,
		);

		expect(handleSessionUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "tool_call",
				sessionId: "session-3",
				toolCallId: "tc-1",
			}),
		);
		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "plan",
			sessionId: "session-3",
			entries: [
				{
					content: "do work",
					status: "pending",
					priority: "medium",
				},
			],
		});
		expect(handleSessionUpdate).toHaveBeenCalledWith({
			type: "current_mode_update",
			sessionId: "session-3",
			currentModeId: "edit",
		});
	});

	it("ignores unsupported session update kinds", () => {
		const handleSessionUpdate = vi.fn();
		routeSessionUpdate(
			{
				sessionUpdate: "session_title_update",
				title: "foo",
			} as unknown as Parameters<typeof routeSessionUpdate>[0],
			"session-4",
			handleSessionUpdate,
		);
		expect(handleSessionUpdate).not.toHaveBeenCalled();
	});
});
