import type { ChatSession } from "../../domain/models/chat-session";
import type { SessionErrorInfo } from "../useAgentSession";

export interface SessionState {
	session: ChatSession;
	errorInfo: SessionErrorInfo | null;
}

export type SessionAction =
	| {
			type: "set_session";
			updater: (session: ChatSession) => ChatSession;
	  }
	| { type: "set_error"; error: SessionErrorInfo }
	| { type: "clear_error" };

export const createInitialSessionState = (
	session: ChatSession,
): SessionState => ({
	session,
	errorInfo: null,
});
