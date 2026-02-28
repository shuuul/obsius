import { describe, expect, it } from "vitest";
import {
	createInitialPermissionState,
	permissionReducer,
} from "../src/hooks/state/permission.reducer";
import { createInitialSessionState } from "../src/hooks/state/session.actions";
import { sessionReducer } from "../src/hooks/state/session.reducer";

describe("permissionReducer", () => {
	it("sets and clears permission errors", () => {
		const initial = createInitialPermissionState();
		const withError = permissionReducer(initial, {
			type: "set_error",
			error: {
				title: "Permission",
				message: "Denied",
			},
		});

		expect(withError.errorInfo?.message).toBe("Denied");
		expect(
			permissionReducer(withError, { type: "clear_error" }).errorInfo,
		).toBeNull();
	});
});

describe("sessionReducer", () => {
	it("updates session through set_session and clears errors", () => {
		const initial = createInitialSessionState({
			sessionId: null,
			state: "disconnected",
			agentId: "codex-acp",
			agentDisplayName: "Codex",
			authMethods: [],
			availableCommands: undefined,
			modes: undefined,
			models: undefined,
			createdAt: new Date(),
			lastActivityAt: new Date(),
			workingDirectory: "/tmp",
		});

		const withError = sessionReducer(initial, {
			type: "set_error",
			error: {
				title: "Session",
				message: "Failure",
			},
		});
		expect(withError.errorInfo?.title).toBe("Session");

		const ready = sessionReducer(withError, {
			type: "set_session",
			updater: (session) => ({ ...session, state: "ready" }),
		});
		expect(ready.session.state).toBe("ready");

		const cleared = sessionReducer(ready, { type: "clear_error" });
		expect(cleared.errorInfo).toBeNull();
	});
});
