import { ItemView, WorkspaceLeaf, Platform, Menu } from "obsidian";
import type {
	IChatViewContainer,
	ChatViewType,
} from "../../domain/ports/chat-view-container.port";
import * as React from "react";
const { useState, useRef, useEffect, useCallback } = React;
import { createRoot, Root } from "react-dom/client";

import type AgentClientPlugin from "../../plugin";
import type { ChatInputState } from "../../domain/models/chat-input-state";

import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { getLogger, Logger } from "../../shared/logger";

import type { IAcpClient } from "../../adapters/acp/acp.adapter";

import { useChatController } from "../../hooks/useChatController";
import { useWorkspaceEvents } from "../../hooks/useWorkspaceEvents";

import type { ImagePromptContent } from "../../domain/models/prompt-content";

interface AppWithSettings {
	setting: {
		open: () => void;
		openTabById: (id: string) => void;
	};
}

export const VIEW_TYPE_CHAT = "agent-client-chat-view";

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

	const [restoredAgentId, setRestoredAgentId] = useState<string | undefined>(
		view.getInitialAgentId() ?? undefined,
	);

	const controller = useChatController({
		plugin,
		viewId,
		initialAgentId: restoredAgentId,
	});

	const {
		logger,
		acpAdapter,
		settings,
		session,
		isSessionReady,
		messages,
		isSending,
		isUpdateAvailable,
		permission,
		mentions,
		autoMention,
		slashCommands,
		sessionHistory,
		activeAgentLabel,
		availableAgents,
		errorInfo,
		handleSendMessage,
		handleStopGeneration,
		handleNewChat,
		handleExportChat,
		handleRestartAgent,
		handleClearError,
		handleOpenHistory,
		handleSetMode,
		handleSetModel,
		inputValue,
		setInputValue,
		attachedImages,
		setAttachedImages,
		restoredMessage,
		handleRestoredMessageConsumed,
	} = controller;

	// ============================================================
	// Agent ID Restoration (ChatView-specific)
	// ============================================================
	useEffect(() => {
		const unsubscribe = view.onAgentIdRestored((agentId) => {
			logger.log(
				`[ChatView] Agent ID restored from workspace: ${agentId}`,
			);
			setRestoredAgentId(agentId);
		});
		return unsubscribe;
	}, [view, logger]);

	// ============================================================
	// Focus Tracking (ChatView-specific)
	// ============================================================
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

	const acpClientRef = useRef<IAcpClient>(acpAdapter);
	const hasRestoredAgentRef = useRef(false);

	// ============================================================
	// ChatView-specific Callbacks
	// ============================================================
	const handleNewChatWithPersist = useCallback(
		async (requestedAgentId?: string) => {
			await handleNewChat(requestedAgentId);
			if (requestedAgentId) {
				view.setAgentId(requestedAgentId);
			}
		},
		[handleNewChat, view],
	);

	const handleOpenSettings = useCallback(() => {
		const appWithSettings = plugin.app as unknown as AppWithSettings;
		appWithSettings.setting.open();
		appWithSettings.setting.openTabById(plugin.manifest.id);
	}, [plugin]);

	const handleShowMenu = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const menu = new Menu();

			menu.addItem((item) => {
				item.setTitle("Switch agent").setIsLabel(true);
			});

			for (const agent of availableAgents) {
				menu.addItem((item) => {
					item.setTitle(agent.displayName)
						.setChecked(agent.id === (session.agentId || ""))
						.onClick(() => {
							void handleNewChatWithPersist(agent.id);
						});
				});
			}

			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle("Open new view")
					.setIcon("plus")
					.onClick(() => {
						void plugin.openNewChatViewWithAgent(
							plugin.settings.defaultAgentId,
						);
					});
			});

			menu.addItem((item) => {
				item.setTitle("Restart agent")
					.setIcon("refresh-cw")
					.onClick(() => {
						void handleRestartAgent();
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle("Plugin settings")
					.setIcon("settings")
					.onClick(() => {
						handleOpenSettings();
					});
			});

			menu.showAtMouseEvent(e.nativeEvent);
		},
		[
			availableAgents,
			session.agentId,
			handleNewChatWithPersist,
			plugin,
			handleRestartAgent,
			handleOpenSettings,
		],
	);

	// ============================================================
	// Agent ID Restoration Effect
	// ============================================================
	useEffect(() => {
		if (hasRestoredAgentRef.current) return;
		if (!restoredAgentId) return;
		if (session.state === "initializing") return;

		hasRestoredAgentRef.current = true;

		if (session.agentId === restoredAgentId) return;

		logger.log(
			`[ChatView] Switching to restored agent: ${restoredAgentId} (current: ${session.agentId})`,
		);
		void handleNewChat(restoredAgentId);
	}, [
		restoredAgentId,
		session.state,
		session.agentId,
		logger,
		handleNewChat,
	]);

	// ============================================================
	// Broadcast Command Callbacks
	// ============================================================
	const getInputState = useCallback((): ChatInputState | null => {
		return {
			text: inputValue,
			images: attachedImages,
		};
	}, [inputValue, attachedImages]);

	const setInputState = useCallback(
		(state: ChatInputState) => {
			setInputValue(state.text);
			setAttachedImages(state.images);
		},
		[setInputValue, setAttachedImages],
	);

	const sendMessageForBroadcast = useCallback(async (): Promise<boolean> => {
		const hasContent = inputValue.trim() !== "" || attachedImages.length > 0;
		if (!hasContent || !isSessionReady || sessionHistory.loading || isSending) return false;

		const imagesToSend: ImagePromptContent[] = attachedImages.map((img) => ({
			type: "image", data: img.data, mimeType: img.mimeType,
		}));
		const messageToSend = inputValue.trim();
		setInputValue("");
		setAttachedImages([]);
		await handleSendMessage(messageToSend, imagesToSend.length > 0 ? imagesToSend : undefined);
		return true;
	}, [inputValue, attachedImages, isSessionReady, sessionHistory.loading, isSending, handleSendMessage, setInputValue, setAttachedImages]);

	const canSendForBroadcast = useCallback((): boolean => {
		const hasContent = inputValue.trim() !== "" || attachedImages.length > 0;
		return hasContent && isSessionReady && !sessionHistory.loading && !isSending;
	}, [inputValue, attachedImages, isSessionReady, sessionHistory.loading, isSending]);

	const cancelForBroadcast = useCallback(async (): Promise<void> => {
		if (isSending) await handleStopGeneration();
	}, [isSending, handleStopGeneration]);

	useEffect(() => {
		view.registerInputCallbacks({
			getDisplayName: () => activeAgentLabel,
			getInputState,
			setInputState,
			sendMessage: sendMessageForBroadcast,
			canSend: canSendForBroadcast,
			cancel: cancelForBroadcast,
		});

		return () => {
			view.unregisterInputCallbacks();
		};
	}, [
		view,
		activeAgentLabel,
		getInputState,
		setInputState,
		sendMessageForBroadcast,
		canSendForBroadcast,
		cancelForBroadcast,
	]);

	// ============================================================
	// Shared Workspace Events (hotkeys)
	// ============================================================
	useWorkspaceEvents({
		workspace: plugin.app.workspace,
		viewId,
		lastActiveChatViewId: plugin.lastActiveChatViewId,
		autoMentionToggle: autoMention.toggle,
		handleNewChat: handleNewChatWithPersist,
		approveActivePermission: permission.approveActivePermission,
		rejectActivePermission: permission.rejectActivePermission,
		handleStopGeneration,
	});

	// ============================================================
	// Render
	// ============================================================
	const chatFontSizeStyle =
		settings.displaySettings.fontSize !== null
			? ({
					"--ac-chat-font-size": `${settings.displaySettings.fontSize}px`,
				} as React.CSSProperties)
			: undefined;

	return (
		<div
			className="agent-client-chat-view-container"
			style={chatFontSizeStyle}
		>
			<ChatHeader
				agentLabel={activeAgentLabel}
				isUpdateAvailable={isUpdateAvailable}
				hasHistoryCapability={sessionHistory.canShowSessionHistory}
				onNewChat={() => void handleNewChatWithPersist()}
				onExportChat={() => void handleExportChat()}
				onShowMenu={handleShowMenu}
				onOpenHistory={handleOpenHistory}
			/>

			<ChatMessages
				messages={messages}
				isSending={isSending}
				isSessionReady={isSessionReady}
				isRestoringSession={sessionHistory.loading}
				agentLabel={activeAgentLabel}
				plugin={plugin}
				view={view}
				acpClient={acpClientRef.current}
				onApprovePermission={permission.approvePermission}
			/>

			<ChatInput
				isSending={isSending}
				isSessionReady={isSessionReady}
				isRestoringSession={sessionHistory.loading}
				agentLabel={activeAgentLabel}
				availableCommands={session.availableCommands || []}
				autoMentionEnabled={settings.autoMentionActiveNote}
				restoredMessage={restoredMessage}
				mentions={mentions}
				slashCommands={slashCommands}
				autoMention={autoMention}
				plugin={plugin}
				view={view}
				onSendMessage={handleSendMessage}
				onStopGeneration={handleStopGeneration}
				onRestoredMessageConsumed={handleRestoredMessageConsumed}
				modes={session.modes}
				onModeChange={(modeId) => void handleSetMode(modeId)}
				models={session.models}
				onModelChange={(modelId) => void handleSetModel(modelId)}
				supportsImages={session.promptCapabilities?.image ?? false}
				agentId={session.agentId}
				inputValue={inputValue}
				onInputChange={setInputValue}
				attachedImages={attachedImages}
				onAttachedImagesChange={setAttachedImages}
				errorInfo={errorInfo}
				onClearError={handleClearError}
				messages={messages}
			/>
		</div>
	);
}

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
	private agentIdRestoredCallbacks: Set<(agentId: string) => void> =
		new Set();

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

		if (this.initialAgentId && this.initialAgentId !== previousAgentId) {
			this.agentIdRestoredCallbacks.forEach((cb) =>
				cb(this.initialAgentId!),
			);
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
			<ChatComponent
				plugin={this.plugin}
				view={this}
				viewId={this.viewId}
			/>,
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
		await this.plugin.removeAdapter(this.viewId);
	}
}
