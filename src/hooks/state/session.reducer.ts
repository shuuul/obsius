import type { SessionAction, SessionState } from "./session.actions";

export function sessionReducer(
	state: SessionState,
	action: SessionAction,
): SessionState {
	switch (action.type) {
		case "set_session":
			return {
				...state,
				session: action.updater(state.session),
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
		default: {
			const exhaustiveCheck: never = action;
			return exhaustiveCheck;
		}
	}
}
