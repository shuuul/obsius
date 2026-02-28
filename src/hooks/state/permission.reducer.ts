import type { ErrorInfo } from "../../domain/models/agent-error";

export interface PermissionState {
	errorInfo: ErrorInfo | null;
}

export type PermissionAction =
	| { type: "set_error"; error: ErrorInfo }
	| { type: "clear_error" };

export const createInitialPermissionState = (): PermissionState => ({
	errorInfo: null,
});

export function permissionReducer(
	state: PermissionState,
	action: PermissionAction,
): PermissionState {
	switch (action.type) {
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
