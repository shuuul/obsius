import type { ChatAction, ChatState } from "./chat.actions";

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
	switch (action.type) {
		case "send_start":
			return {
				...state,
				isSending: true,
			};
		case "send_complete":
			return {
				...state,
				isSending: false,
			};
		case "set_error":
			return {
				...state,
				errorInfo: action.error,
			};
		case "clear_error":
			return {
				...state,
				errorInfo: null,
			};
		case "set_last_user_message":
			return {
				...state,
				lastUserMessage: action.message,
			};
		case "clear_messages":
			return {
				...state,
				messages: [],
			};
		case "set_messages":
			return {
				...state,
				messages: action.messages,
			};
		case "apply_messages":
			return {
				...state,
				messages: action.updater(state.messages),
			};
		default: {
			const exhaustiveCheck: never = action;
			return exhaustiveCheck;
		}
	}
}
