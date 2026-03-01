import { useEffect } from "react";
import type { Workspace } from "obsidian";
import { pluginNotice } from "../shared/plugin-notice";

type CustomEventCallback = (targetViewId?: string) => void;

/**
 * Cast helper — Obsidian's Workspace.on() is typed for known events only;
 * custom plugin events need the cast to register listeners.
 */
function onCustomEvent(
	workspace: Workspace,
	name: string,
	callback: CustomEventCallback,
): ReturnType<Workspace["on"]> {
	return (
		workspace as unknown as {
			on: (
				name: string,
				callback: CustomEventCallback,
			) => ReturnType<Workspace["on"]>;
		}
	).on(name, callback);
}

interface UseWorkspaceEventsParams {
	workspace: Workspace;
	viewId: string;
	lastActiveChatViewId: string | null;
	autoMentionToggle: (force?: boolean) => void;
	handleNewChat: (agentId?: string) => void | Promise<void>;
	approveActivePermission: () => Promise<boolean>;
	rejectActivePermission: () => Promise<boolean>;
	handleStopGeneration: () => Promise<void>;
}

/**
 * Subscribes to workspace-level hotkey events: toggle-auto-mention,
 * new-chat-requested, approve/reject permission, and cancel-message.
 */
export function useWorkspaceEvents({
	workspace,
	viewId,
	lastActiveChatViewId,
	autoMentionToggle,
	handleNewChat,
	approveActivePermission,
	rejectActivePermission,
	handleStopGeneration,
}: UseWorkspaceEventsParams): void {
	useEffect(() => {
		const ref = onCustomEvent(
			workspace,
			"agent-client:toggle-auto-mention",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				autoMentionToggle();
			},
		);
		return () => workspace.offref(ref);
	}, [workspace, autoMentionToggle, viewId]);

	useEffect(() => {
		const ref = onCustomEvent(
			workspace,
			"agent-client:new-chat-requested",
			(agentId?: string) => {
				if (lastActiveChatViewId && lastActiveChatViewId !== viewId) {
					return;
				}
				void handleNewChat(agentId);
			},
		);
		return () => workspace.offref(ref);
	}, [workspace, lastActiveChatViewId, handleNewChat, viewId]);

	useEffect(() => {
		const approveRef = onCustomEvent(
			workspace,
			"agent-client:approve-active-permission",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				void (async () => {
					const success = await approveActivePermission();
					if (!success) {
						pluginNotice("No active permission request");
					}
				})();
			},
		);

		const rejectRef = onCustomEvent(
			workspace,
			"agent-client:reject-active-permission",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				void (async () => {
					const success = await rejectActivePermission();
					if (!success) {
						pluginNotice("No active permission request");
					}
				})();
			},
		);

		const cancelRef = onCustomEvent(
			workspace,
			"agent-client:cancel-message",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				void handleStopGeneration();
			},
		);

		return () => {
			workspace.offref(approveRef);
			workspace.offref(rejectRef);
			workspace.offref(cancelRef);
		};
	}, [
		workspace,
		approveActivePermission,
		rejectActivePermission,
		handleStopGeneration,
		viewId,
	]);
}
