import type { ErrorInfo } from "../../domain/models/agent-error";
import type { ChatMessage } from "../../domain/models/chat-message";

export interface ChatState {
	messages: ChatMessage[];
	isSending: boolean;
	lastUserMessage: string | null;
	errorInfo: ErrorInfo | null;
}

export type ChatAction =
	| { type: "send_start" }
	| { type: "send_complete" }
	| { type: "set_error"; error: ErrorInfo }
	| { type: "clear_error" }
	| { type: "set_last_user_message"; message: string | null }
	| { type: "clear_messages" }
	| { type: "set_messages"; messages: ChatMessage[] }
	| {
			type: "apply_messages";
			updater: (messages: ChatMessage[]) => ChatMessage[];
	  };

export const createInitialChatState = (): ChatState => ({
	messages: [],
	isSending: false,
	lastUserMessage: null,
	errorInfo: null,
});
