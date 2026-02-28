import { pluginNotice } from "../shared/plugin-notice";
import type { AgentClientPluginSettings } from "../plugin";
import type { IChatViewContainer } from "../domain/ports/chat-view-container.port";

export interface AgentSummary {
	id: string;
	displayName: string;
}

export interface AgentOpsHost {
	settings: AgentClientPluginSettings;
	viewRegistry: {
		getAll: () => IChatViewContainer[];
		getFocusedId: () => string | null;
		toFocused: <T>(fn: (view: IChatViewContainer) => T) => T | null;
	};
	addCommand: (config: {
		id: string;
		name: string;
		callback: () => void | Promise<void>;
	}) => void;
	activateView: () => Promise<void>;
	openNewChatViewWithAgent: (agentId: string) => Promise<void>;
	openNewFloatingChat: (initialExpanded?: boolean) => void;
	expandFloatingChat: (viewId: string) => void;
	getFloatingChatInstances: () => string[];
	lastActiveChatViewId: string | null;
	app: {
		workspace: {
			trigger: (event: "quit", ...data: unknown[]) => void;
		};
	};
}

export const getAvailableAgents = (
	settings: AgentClientPluginSettings,
): AgentSummary[] => {
	return [
		{
			id: settings.claude.id,
			displayName: settings.claude.displayName || settings.claude.id,
		},
		{
			id: settings.codex.id,
			displayName: settings.codex.displayName || settings.codex.id,
		},
		{
			id: settings.gemini.id,
			displayName: settings.gemini.displayName || settings.gemini.id,
		},
		...settings.customAgents.map((agent) => ({
			id: agent.id,
			displayName: agent.displayName || agent.id,
		})),
	];
};

export const collectAvailableAgentIds = (
	settings: AgentClientPluginSettings,
): string[] => {
	const ids = new Set<string>();
	ids.add(settings.claude.id);
	ids.add(settings.codex.id);
	ids.add(settings.gemini.id);
	for (const agent of settings.customAgents) {
		if (agent.id && agent.id.length > 0) {
			ids.add(agent.id);
		}
	}
	return Array.from(ids);
};

export const ensureDefaultAgentId = (
	settings: AgentClientPluginSettings,
	fallbackId: string,
): void => {
	const availableIds = collectAvailableAgentIds(settings);
	if (availableIds.length === 0) {
		settings.defaultAgentId = fallbackId;
		return;
	}
	if (!availableIds.includes(settings.defaultAgentId)) {
		settings.defaultAgentId = availableIds[0];
	}
};

export const openChatWithAgent = async (
	host: AgentOpsHost,
	agentId: string,
): Promise<void> => {
	await host.activateView();
	host.app.workspace.trigger("agent-client:new-chat-requested" as "quit", agentId);
};

export const registerAgentCommands = (host: AgentOpsHost): void => {
	const agents = getAvailableAgents(host.settings);
	for (const agent of agents) {
		host.addCommand({
			id: `open-chat-with-${agent.id}`,
			name: `New chat with ${agent.displayName}`,
			callback: async () => {
				await openChatWithAgent(host, agent.id);
			},
		});
	}
};

export const registerPermissionCommands = (host: AgentOpsHost): void => {
	host.addCommand({
		id: "approve-active-permission",
		name: "Approve active permission",
		callback: async () => {
			const focusedId = host.lastActiveChatViewId;
			const isFloatingFocused = focusedId?.startsWith("floating-chat-");
			if (!isFloatingFocused) {
				await host.activateView();
			}
			host.app.workspace.trigger(
				"agent-client:approve-active-permission" as "quit",
				host.lastActiveChatViewId,
			);
		},
	});

	host.addCommand({
		id: "reject-active-permission",
		name: "Reject active permission",
		callback: async () => {
			const focusedId = host.lastActiveChatViewId;
			const isFloatingFocused = focusedId?.startsWith("floating-chat-");
			if (!isFloatingFocused) {
				await host.activateView();
			}
			host.app.workspace.trigger(
				"agent-client:reject-active-permission" as "quit",
				host.lastActiveChatViewId,
			);
		},
	});

	host.addCommand({
		id: "toggle-auto-mention",
		name: "Toggle auto-mention",
		callback: async () => {
			const focusedId = host.lastActiveChatViewId;
			const isFloatingFocused = focusedId?.startsWith("floating-chat-");
			if (!isFloatingFocused) {
				await host.activateView();
			}
			host.app.workspace.trigger(
				"agent-client:toggle-auto-mention" as "quit",
				host.lastActiveChatViewId,
			);
		},
	});

	host.addCommand({
		id: "cancel-current-message",
		name: "Cancel current message",
		callback: () => {
			host.app.workspace.trigger(
				"agent-client:cancel-message" as "quit",
				host.lastActiveChatViewId,
			);
		},
	});
};

export const broadcastPrompt = (host: AgentOpsHost): void => {
	const allViews = host.viewRegistry.getAll();
	if (allViews.length === 0) {
		pluginNotice("No chat views open");
		return;
	}

	const inputState = host.viewRegistry.toFocused((v) => v.getInputState());
	if (!inputState || (inputState.text.trim() === "" && inputState.images.length === 0)) {
		pluginNotice("No prompt to broadcast");
		return;
	}

	const focusedId = host.viewRegistry.getFocusedId();
	const targetViews = allViews.filter((v) => v.viewId !== focusedId);
	if (targetViews.length === 0) {
		pluginNotice("No other chat views to broadcast to");
		return;
	}

	for (const view of targetViews) {
		view.setInputState(inputState);
	}
};

export const broadcastSend = async (host: AgentOpsHost): Promise<void> => {
	const allViews = host.viewRegistry.getAll();
	if (allViews.length === 0) {
		pluginNotice("No chat views open");
		return;
	}

	const sendableViews = allViews.filter((v) => v.canSend());
	if (sendableViews.length === 0) {
		pluginNotice("No views ready to send");
		return;
	}

	await Promise.allSettled(sendableViews.map((v) => v.sendMessage()));
};

export const broadcastCancel = async (host: AgentOpsHost): Promise<void> => {
	const allViews = host.viewRegistry.getAll();
	if (allViews.length === 0) {
		pluginNotice("No chat views open");
		return;
	}

	await Promise.allSettled(allViews.map((v) => v.cancelOperation()));
	pluginNotice("Cancel broadcast to all views");
};

export const registerBroadcastCommands = (host: AgentOpsHost): void => {
	host.addCommand({
		id: "broadcast-prompt",
		name: "Broadcast prompt",
		callback: () => {
			broadcastPrompt(host);
		},
	});

	host.addCommand({
		id: "broadcast-send",
		name: "Broadcast send",
		callback: () => {
			void broadcastSend(host);
		},
	});

	host.addCommand({
		id: "broadcast-cancel",
		name: "Broadcast cancel",
		callback: () => {
			void broadcastCancel(host);
		},
	});
};

export const registerFloatingCommands = (host: AgentOpsHost): void => {
	host.addCommand({
		id: "open-floating-chat",
		name: "Open floating chat window",
		callback: () => {
			if (!host.settings.showFloatingButton) {
				return;
			}
			const instances = host.getFloatingChatInstances();
			if (instances.length === 0) {
				host.openNewFloatingChat(true);
				return;
			}
			if (instances.length === 1) {
				host.expandFloatingChat(instances[0]);
				return;
			}
			host.expandFloatingChat(instances[instances.length - 1]);
		},
	});

	host.addCommand({
		id: "open-new-floating-chat",
		name: "Open new floating chat window",
		callback: () => {
			if (!host.settings.showFloatingButton) {
				return;
			}
			host.openNewFloatingChat(true);
		},
	});
};
