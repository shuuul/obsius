import type * as acp from "@agentclientprotocol/sdk";
import type { SlashCommand } from "../../domain/models/chat-session";
import type { SessionUpdate } from "../../domain/models/session-update";
import { AcpTypeConverter } from "./acp-type-converter";

export function routeSessionUpdate(
	update: acp.SessionUpdate,
	sessionId: string,
	handleSessionUpdate: (update: SessionUpdate) => void,
): void {
	switch (update.sessionUpdate) {
		case "agent_message_chunk": {
			if (update.content.type !== "text") {
				return;
			}
			handleSessionUpdate({
				type: "agent_message_chunk",
				sessionId,
				text: update.content.text,
			});
			return;
		}

		case "agent_thought_chunk": {
			if (update.content.type !== "text") {
				return;
			}
			handleSessionUpdate({
				type: "agent_thought_chunk",
				sessionId,
				text: update.content.text,
			});
			return;
		}

		case "user_message_chunk": {
			if (update.content.type !== "text") {
				return;
			}
			handleSessionUpdate({
				type: "user_message_chunk",
				sessionId,
				text: update.content.text,
			});
			return;
		}

		case "tool_call":
		case "tool_call_update": {
			handleSessionUpdate({
				type: update.sessionUpdate,
				sessionId,
				toolCallId: update.toolCallId,
				title: update.title ?? undefined,
				status: update.status || "pending",
				kind: update.kind ?? undefined,
				content: AcpTypeConverter.toToolCallContent(update.content),
				locations: update.locations ?? undefined,
				rawInput: update.rawInput as { [k: string]: unknown } | undefined,
			});
			return;
		}

		case "plan": {
			handleSessionUpdate({
				type: "plan",
				sessionId,
				entries: update.entries,
			});
			return;
		}

		case "available_commands_update": {
			const commands: SlashCommand[] = (update.availableCommands || []).map(
				(cmd) => ({
					name: cmd.name,
					description: cmd.description,
					hint: cmd.input?.hint ?? null,
				}),
			);

			handleSessionUpdate({
				type: "available_commands_update",
				sessionId,
				commands,
			});
			return;
		}

		case "current_mode_update": {
			handleSessionUpdate({
				type: "current_mode_update",
				sessionId,
				currentModeId: update.currentModeId,
			});
			return;
		}

		default: {
			return;
		}
	}
}
