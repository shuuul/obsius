import { ItemView, Platform, type WorkspaceLeaf } from "obsidian";
import * as React from "react";

import type {
	ChatViewType,
	IChatViewContainer,
} from "../../domain/ports/chat-view-container.port";

const { useState, useRef, useEffect, useCallback, useMemo } = React;

import { createRoot, type Root } from "react-dom/client";
import type { ChatInputState } from "../../domain/models/chat-input-state";
import { useTabs } from "../../hooks/useTabs";
import { useWorkspaceEvents } from "../../hooks/useWorkspaceEvents";
import type AgentClientPlugin from "../../plugin";
import { getLogger, type Logger } from "../../shared/logger";
import { ChatHeader } from "./ChatHeader";
import { TabContent, type TabContentActions } from "./TabContent";

interface AppWithSettings {
	setting: {
		open: () => void;
		openTabById: (id: string) => void;
	};
}

export const VIEW_TYPE_CHAT = "agent-client-chat-view";

// ============================================================
// ChatComponent - Manages header, tabs, and per-tab content
// ============================================================

function ChatComponent({
	plugin,
	view,
	viewId,
}: {
	plugin: AgentClientPlugin;
	view: ChatView;
	viewId: string;
}) {
	if (!Platform.isDesktopApp) {
		throw new Error("Obsius is only available on desktop");
	}

	const logger = getLogger();

	const [restoredAgentId, setRestoredAgentId] = useState<string | undefined>(
		view.getInitialAgentId() ?? undefined,
	);

	const availableAgents = useMemo(() => {
		return plugin.getAvailableAgents();
	}, [plugin]);

	const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

	useEffect(() => {
		plugin
			.checkForUpdates()
			.then(setIsUpdateAvailable)
			.catch((error) => {
				logger.error("Failed to check for updates:", error);
			});
	}, [plugin, logger]);

	// Agent ID restoration from workspace
	useEffect(() => {
		const unsubscribe = view.onAgentIdRestored((agentId) => {
			logger.log(`[ChatView] Agent ID restored from workspace: ${agentId}`);
			setRestoredAgentId(agentId);
		});
		return unsubscribe;
	}, [view, logger]);

	// Focus tracking
	useEffect(() => {
		const handleFocus = () => {
			plugin.setLastActiveChatViewId(viewId);
		};

		const container = view.containerEl;
		container.addEventListener("focus", handleFocus, true);
		container.addEventListener("click", handleFocus);
		plugin.setLastActiveChatViewId(viewId);

		return () => {
			container.removeEventListener("focus", handleFocus, true);
			container.removeEventListener("click", handleFocus);
		};
	}, [plugin, viewId, view.containerEl]);

	// Tab close handler: clean up adapter
	const handleTabClose = useCallback(
		(tabId: string) => {
			void plugin.removeAdapter(tabId);
			view.unregisterTabAdapter(tabId);
		},
		[plugin, view],
	);

	const tabState = useTabs({
		initialAgentId: restoredAgentId || plugin.settings.defaultAgentId,
		defaultAgentId: plugin.settings.defaultAgentId,
		availableAgents,
		onTabClose: handleTabClose,
	});

	// Track tab actions for routing header actions to active tab
	const tabActionsMapRef = useRef<Map<string, TabContentActions>>(new Map());
	const [activeTabCanShowHistory, setActiveTabCanShowHistory] = useState(false);

	const handleActionsReady = useCallback(
		(tabId: string, actions: TabContentActions | null) => {
			if (actions) {
				tabActionsMapRef.current.set(tabId, actions);
			} else {
				tabActionsMapRef.current.delete(tabId);
			}
			if (tabId === tabState.activeTabId) {
				setActiveTabCanShowHistory(actions?.canShowSessionHistory ?? false);
			}
		},
		[tabState.activeTabId],
	);

	// Update canShowHistory when active tab changes
	useEffect(() => {
		const actions = tabActionsMapRef.current.get(tabState.activeTabId);
		setActiveTabCanShowHistory(actions?.canShowSessionHistory ?? false);
	}, [tabState.activeTabId]);

	// Register tab adapters with the view for cleanup on close
	useEffect(() => {
		for (const tab of tabState.tabs) {
			view.registerTabAdapter(tab.id);
		}
	}, [tabState.tabs, view]);

	// Compute agent label from active tab's agentId
	const activeAgentLabel = useMemo(() => {
		const activeId = tabState.activeTab.agentId;
		if (activeId === plugin.settings.claude.id) {
			return plugin.settings.claude.displayName || plugin.settings.claude.id;
		}
		if (activeId === plugin.settings.opencode.id) {
			return (
				plugin.settings.opencode.displayName || plugin.settings.opencode.id
			);
		}
		if (activeId === plugin.settings.codex.id) {
			return plugin.settings.codex.displayName || plugin.settings.codex.id;
		}
		if (activeId === plugin.settings.gemini.id) {
			return plugin.settings.gemini.displayName || plugin.settings.gemini.id;
		}
		const custom = plugin.settings.customAgents.find(
			(agent) => agent.id === activeId,
		);
		return custom?.displayName || custom?.id || activeId;
	}, [tabState.activeTab.agentId, plugin.settings]);

	const handleOpenSettings = useCallback(() => {
		const appWithSettings = plugin.app as unknown as AppWithSettings;
		appWithSettings.setting.open();
		appWithSettings.setting.openTabById(plugin.manifest.id);
	}, [plugin]);

	const handleNewSession = useCallback(() => {
		const actions = tabActionsMapRef.current.get(tabState.activeTabId);
		if (actions) {
			void actions.handleNewChat();
		}
	}, [tabState.activeTabId]);

	const handleOpenHistory = useCallback(() => {
		const actions = tabActionsMapRef.current.get(tabState.activeTabId);
		if (actions) {
			actions.handleOpenHistory();
		}
	}, [tabState.activeTabId]);

	const handleAgentChangeForTab = useCallback(
		(agentId: string) => {
			tabState.handleAgentChangeForTab(agentId);
			view.setAgentId(agentId);
		},
		[tabState, view],
	);

	// Workspace events routed to active tab
	const wsAutoMentionToggle = useCallback(
		(force?: boolean) => {
			tabActionsMapRef.current.get(tabState.activeTabId)?.autoMentionToggle(force);
		},
		[tabState.activeTabId],
	);
	const wsHandleNewChat = useCallback(
		(agentId?: string) => {
			const actions = tabActionsMapRef.current.get(tabState.activeTabId);
			if (actions) void actions.handleNewChat(agentId);
		},
		[tabState.activeTabId],
	);
	const wsApprovePermission = useCallback(async () => {
		return (
			(await tabActionsMapRef.current
				.get(tabState.activeTabId)
				?.approveActivePermission()) ?? false
		);
	}, [tabState.activeTabId]);
	const wsRejectPermission = useCallback(async () => {
		return (
			(await tabActionsMapRef.current
				.get(tabState.activeTabId)
				?.rejectActivePermission()) ?? false
		);
	}, [tabState.activeTabId]);
	const wsStopGeneration = useCallback(async () => {
		await tabActionsMapRef.current
			.get(tabState.activeTabId)
			?.handleStopGeneration();
	}, [tabState.activeTabId]);

	useWorkspaceEvents({
		workspace: plugin.app.workspace,
		viewId,
		lastActiveChatViewId: plugin.lastActiveChatViewId,
		autoMentionToggle: wsAutoMentionToggle,
		handleNewChat: wsHandleNewChat,
		approveActivePermission: wsApprovePermission,
		rejectActivePermission: wsRejectPermission,
		handleStopGeneration: wsStopGeneration,
	});

	// Register broadcast callbacks from active tab
	useEffect(() => {
		const getActiveActions = () =>
			tabActionsMapRef.current.get(tabState.activeTabId);

		view.registerInputCallbacks({
			getDisplayName: () =>
				getActiveActions()?.getDisplayName() ?? activeAgentLabel,
			getInputState: () => getActiveActions()?.getInputState() ?? null,
			setInputState: (state) => getActiveActions()?.setInputState(state),
			sendMessage: async () =>
				(await getActiveActions()?.sendMessage()) ?? false,
			canSend: () => getActiveActions()?.canSend() ?? false,
			cancel: async () => {
				await getActiveActions()?.cancel();
			},
		});

		return () => {
			view.unregisterInputCallbacks();
		};
	}, [view, tabState.activeTabId, activeAgentLabel]);

	return (
		<div className="agent-client-chat-view-container">
			<ChatHeader
				agentLabel={activeAgentLabel}
				availableAgents={availableAgents}
				currentAgentId={tabState.activeTab.agentId}
				isUpdateAvailable={isUpdateAvailable}
				onAgentChange={handleAgentChangeForTab}
				onNewTab={tabState.handleNewTab}
				onNewSession={handleNewSession}
				onOpenSettings={handleOpenSettings}
				onOpenHistory={
					activeTabCanShowHistory ? handleOpenHistory : undefined
				}
				tabs={tabState.tabsWithLabels}
				activeTabId={tabState.activeTabId}
				canAddTab={tabState.canAddTab}
				canCloseTab={tabState.canCloseTab}
				onTabClick={tabState.handleTabClick}
				onTabClose={tabState.handleTabClose}
			/>

			{tabState.tabs.map((tab) => (
				<TabContent
					key={tab.id}
					plugin={plugin}
					view={view}
					tabId={tab.id}
					agentId={tab.agentId}
					isActive={tab.id === tabState.activeTabId}
					viewId={viewId}
					onActionsReady={handleActionsReady}
				/>
			))}
		</div>
	);
}

// ============================================================
// ChatView (Obsidian ItemView)
// ============================================================

/** State stored for view persistence */
interface ChatViewState extends Record<string, unknown> {
	initialAgentId?: string;
}

type GetDisplayNameCallback = () => string;
type GetInputStateCallback = () => ChatInputState | null;
type SetInputStateCallback = (state: ChatInputState) => void;
type SendMessageCallback = () => Promise<boolean>;
type CanSendCallback = () => boolean;
type CancelCallback = () => Promise<void>;

export class ChatView extends ItemView implements IChatViewContainer {
	private root: Root | null = null;
	private plugin: AgentClientPlugin;
	private logger: Logger;
	readonly viewId: string;
	readonly viewType: ChatViewType = "sidebar";
	private initialAgentId: string | null = null;
	private agentIdRestoredCallbacks: Set<(agentId: string) => void> = new Set();
	private tabAdapterIds: Set<string> = new Set();

	private getDisplayNameCallback: GetDisplayNameCallback | null = null;
	private getInputStateCallback: GetInputStateCallback | null = null;
	private setInputStateCallback: SetInputStateCallback | null = null;
	private sendMessageCallback: SendMessageCallback | null = null;
	private canSendCallback: CanSendCallback | null = null;
	private cancelCallback: CancelCallback | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AgentClientPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.logger = getLogger();
		this.viewId = (leaf as { id?: string }).id ?? crypto.randomUUID();
	}

	getViewType() {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText() {
		return "Agent client";
	}

	getIcon() {
		return "bot-message-square";
	}

	getState(): ChatViewState {
		return {
			initialAgentId: this.initialAgentId ?? undefined,
		};
	}

	async setState(
		state: ChatViewState,
		result: { history: boolean },
	): Promise<void> {
		const previousAgentId = this.initialAgentId;
		this.initialAgentId = state.initialAgentId ?? null;
		await super.setState(state, result);

		const restoredId = this.initialAgentId;
		if (restoredId && restoredId !== previousAgentId) {
			for (const cb of this.agentIdRestoredCallbacks) {
				cb(restoredId);
			}
		}
	}

	getInitialAgentId(): string | null {
		return this.initialAgentId;
	}

	setAgentId(agentId: string): void {
		this.initialAgentId = agentId;
		this.app.workspace.requestSaveLayout();
	}

	onAgentIdRestored(callback: (agentId: string) => void): () => void {
		this.agentIdRestoredCallbacks.add(callback);
		return () => {
			this.agentIdRestoredCallbacks.delete(callback);
		};
	}

	registerTabAdapter(tabId: string): void {
		this.tabAdapterIds.add(tabId);
	}

	unregisterTabAdapter(tabId: string): void {
		this.tabAdapterIds.delete(tabId);
	}

	registerInputCallbacks(callbacks: {
		getDisplayName: GetDisplayNameCallback;
		getInputState: GetInputStateCallback;
		setInputState: SetInputStateCallback;
		sendMessage: SendMessageCallback;
		canSend: CanSendCallback;
		cancel: CancelCallback;
	}): void {
		this.getDisplayNameCallback = callbacks.getDisplayName;
		this.getInputStateCallback = callbacks.getInputState;
		this.setInputStateCallback = callbacks.setInputState;
		this.sendMessageCallback = callbacks.sendMessage;
		this.canSendCallback = callbacks.canSend;
		this.cancelCallback = callbacks.cancel;
	}

	unregisterInputCallbacks(): void {
		this.getDisplayNameCallback = null;
		this.getInputStateCallback = null;
		this.setInputStateCallback = null;
		this.sendMessageCallback = null;
		this.canSendCallback = null;
		this.cancelCallback = null;
	}

	getDisplayName(): string {
		return this.getDisplayNameCallback?.() ?? "Chat";
	}

	getInputState(): ChatInputState | null {
		return this.getInputStateCallback?.() ?? null;
	}

	setInputState(state: ChatInputState): void {
		this.setInputStateCallback?.(state);
	}

	async sendMessage(): Promise<boolean> {
		return (await this.sendMessageCallback?.()) ?? false;
	}

	canSend(): boolean {
		return this.canSendCallback?.() ?? false;
	}

	async cancelOperation(): Promise<void> {
		await this.cancelCallback?.();
	}

	onActivate(): void {
		this.logger.log(`[ChatView] Activated: ${this.viewId}`);
	}

	onDeactivate(): void {
		this.logger.log(`[ChatView] Deactivated: ${this.viewId}`);
	}

	focus(): void {
		void this.app.workspace.revealLeaf(this.leaf).then(() => {
			const textarea = this.containerEl.querySelector(
				"textarea.agent-client-chat-input-textarea",
			);
			if (textarea instanceof HTMLTextAreaElement) {
				textarea.focus();
			}
		});
	}

	hasFocus(): boolean {
		return this.containerEl.contains(document.activeElement);
	}

	expand(): void {
		// Sidebar views don't have expand/collapse state
	}

	collapse(): void {
		// Sidebar views don't have expand/collapse state
	}

	getContainerEl(): HTMLElement {
		return this.containerEl;
	}

	onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.root = createRoot(container);
		this.root.render(
			<ChatComponent plugin={this.plugin} view={this} viewId={this.viewId} />,
		);

		this.plugin.viewRegistry.register(this);

		return Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.logger.log("[ChatView] onClose() called");

		this.plugin.viewRegistry.unregister(this.viewId);

		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		// Clean up all tab adapters
		for (const tabId of this.tabAdapterIds) {
			await this.plugin.removeAdapter(tabId);
		}
		this.tabAdapterIds.clear();
	}
}
