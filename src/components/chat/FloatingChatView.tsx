import * as React from "react";
const { useRef, useEffect, useCallback, useMemo } = React;
import { createRoot, type Root } from "react-dom/client";

import type AgentClientPlugin from "../../plugin";
import type {
	IChatViewContainer,
	ChatViewType,
} from "../../domain/ports/chat-view-container.port";
import type { ChatInputState } from "../../domain/models/chat-input-state";
import type { IChatViewHost } from "./types";
import type { ImagePromptContent } from "../../domain/models/prompt-content";

import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { InlineHeader } from "./InlineHeader";

import { useChatController } from "../../hooks/useChatController";
import { useWorkspaceEvents } from "../../hooks/useWorkspaceEvents";
import { useFloatingWindow } from "../../hooks/useFloatingWindow";

import { clampPosition } from "../../shared/floating-utils";

// ============================================================
// Type Definitions
// ============================================================

interface FloatingViewCallbacks {
	getDisplayName: () => string;
	getInputState: () => ChatInputState | null;
	setInputState: (state: ChatInputState) => void;
	canSend: () => boolean;
	sendMessage: () => Promise<boolean>;
	cancelOperation: () => Promise<void>;
	focus: () => void;
	hasFocus: () => boolean;
	expand: () => void;
	collapse: () => void;
}

interface RegisteredListener {
	target: Window | Document | HTMLElement;
	type: string;
	callback: EventListenerOrEventListenerObject;
}

// ============================================================
// FloatingViewContainer Class
// ============================================================

export class FloatingViewContainer implements IChatViewContainer {
	readonly viewType: ChatViewType = "floating";
	readonly viewId: string;

	private plugin: AgentClientPlugin;
	private root: Root | null = null;
	private containerEl: HTMLElement;
	private callbacks: FloatingViewCallbacks | null = null;

	constructor(plugin: AgentClientPlugin, instanceId: string) {
		this.plugin = plugin;
		this.viewId = `floating-chat-${instanceId}`;
		this.containerEl = document.body.createDiv({
			cls: "agent-client-floating-view-root",
		});
	}

	mount(
		initialExpanded: boolean,
		initialPosition?: { x: number; y: number },
	): void {
		this.root = createRoot(this.containerEl);
		this.root.render(
			<FloatingChatComponent
				plugin={this.plugin}
				viewId={this.viewId}
				initialExpanded={initialExpanded}
				initialPosition={initialPosition}
				onRegisterCallbacks={(cbs) => {
					this.callbacks = cbs;
				}}
			/>,
		);

		this.plugin.viewRegistry.register(this);
	}

	unmount(): void {
		this.plugin.viewRegistry.unregister(this.viewId);

		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		this.containerEl.remove();
	}

	// IChatViewContainer Implementation

	getDisplayName(): string {
		return this.callbacks?.getDisplayName() ?? "Chat";
	}

	onActivate(): void {
		this.containerEl.classList.add("is-focused");
	}

	onDeactivate(): void {
		this.containerEl.classList.remove("is-focused");
	}

	focus(): void {
		this.callbacks?.focus();
	}

	hasFocus(): boolean {
		return this.callbacks?.hasFocus() ?? false;
	}

	expand(): void {
		this.callbacks?.expand();
	}

	collapse(): void {
		this.callbacks?.collapse();
	}

	getInputState(): ChatInputState | null {
		return this.callbacks?.getInputState() ?? null;
	}

	setInputState(state: ChatInputState): void {
		this.callbacks?.setInputState(state);
	}

	canSend(): boolean {
		return this.callbacks?.canSend() ?? false;
	}

	async sendMessage(): Promise<boolean> {
		return (await this.callbacks?.sendMessage()) ?? false;
	}

	async cancelOperation(): Promise<void> {
		await this.callbacks?.cancelOperation();
	}

	getContainerEl(): HTMLElement {
		return this.containerEl;
	}
}

// ============================================================
// FloatingChatComponent
// ============================================================

interface FloatingChatComponentProps {
	plugin: AgentClientPlugin;
	viewId: string;
	initialExpanded?: boolean;
	initialPosition?: { x: number; y: number };
	onRegisterCallbacks?: (callbacks: FloatingViewCallbacks) => void;
}

function FloatingChatComponent({
	plugin,
	viewId,
	initialExpanded = false,
	initialPosition,
	onRegisterCallbacks,
}: FloatingChatComponentProps) {
	const controller = useChatController({
		plugin,
		viewId,
		workingDirectory: undefined,
	});

	const {
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
		handleSwitchAgent,
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
	// Floating Window State (drag, resize, position persistence)
	// ============================================================
	const floatingWindow = useFloatingWindow({
		plugin,
		initialExpanded,
		initialPosition,
		settingsSize: settings.floatingWindowSize,
		settingsPosition: settings.floatingWindowPosition,
	});

	const acpClientRef = useRef(acpAdapter);

	// Track registered listeners for cleanup
	const registeredListenersRef = useRef<RegisteredListener[]>([]);

	const viewHost: IChatViewHost = useMemo(
		() => ({
			app: plugin.app,
			registerDomEvent: ((
				target: Window | Document | HTMLElement,
				type: string,
				callback: EventListenerOrEventListenerObject,
			) => {
				target.addEventListener(type, callback);
				registeredListenersRef.current.push({ target, type, callback });
			}) as IChatViewHost["registerDomEvent"],
		}),
		[plugin.app],
	);

	// Cleanup registered listeners on unmount
	useEffect(() => {
		return () => {
			for (const {
				target,
				type,
				callback,
			} of registeredListenersRef.current) {
				target.removeEventListener(type, callback);
			}
			registeredListenersRef.current = [];
		};
	}, []);

	// ============================================================
	// Window Management Handlers
	// ============================================================
	const handleOpenNewFloatingChat = useCallback(() => {
		plugin.openNewFloatingChat(
			true,
			clampPosition(
				floatingWindow.position.x - 30,
				floatingWindow.position.y - 30,
				floatingWindow.size.width,
				floatingWindow.size.height,
			),
		);
	}, [plugin, floatingWindow.position, floatingWindow.size.width, floatingWindow.size.height]);

	const handleCloseWindow = useCallback(() => {
		floatingWindow.setIsExpanded(false);
	}, [floatingWindow]);

	// Listen for expand requests
	useEffect(() => {
		const handleExpandRequest = (
			event: CustomEvent<{ viewId: string }>,
		) => {
			if (event.detail.viewId === viewId) {
				floatingWindow.setIsExpanded(true);
			}
		};

		window.addEventListener(
			"agent-client:expand-floating-chat" as never,
			handleExpandRequest as EventListener,
		);
		return () => {
			window.removeEventListener(
				"agent-client:expand-floating-chat" as never,
				handleExpandRequest as EventListener,
			);
		};
	}, [viewId, floatingWindow]);

	// ============================================================
	// Callback Registration for IChatViewContainer
	// ============================================================
	useEffect(() => {
		if (onRegisterCallbacks) {
			onRegisterCallbacks({
				getDisplayName: () => activeAgentLabel,
				getInputState: () => ({
					text: inputValue,
					images: attachedImages,
				}),
				setInputState: (state) => {
					setInputValue(state.text);
					setAttachedImages(state.images);
				},
				canSend: () => {
					const hasContent =
						inputValue.trim() !== "" || attachedImages.length > 0;
					return (
						hasContent &&
						isSessionReady &&
						!sessionHistory.loading &&
						!isSending
					);
				},
				sendMessage: async () => {
					if (!inputValue.trim() && attachedImages.length === 0) {
						return false;
					}
					if (!isSessionReady || sessionHistory.loading) {
						return false;
					}
					if (isSending) {
						return false;
					}

					const imagesToSend: ImagePromptContent[] =
						attachedImages.map((img) => ({
							type: "image",
							data: img.data,
							mimeType: img.mimeType,
						}));

					const messageToSend = inputValue.trim();
					setInputValue("");
					setAttachedImages([]);

					await handleSendMessage(
						messageToSend,
						imagesToSend.length > 0 ? imagesToSend : undefined,
					);
					return true;
				},
				cancelOperation: handleStopGeneration,
				focus: () => {
					if (!floatingWindow.isExpanded) {
						floatingWindow.setIsExpanded(true);
					}
					requestAnimationFrame(() => {
						const textarea =
							floatingWindow.containerRef.current?.querySelector(
								"textarea.agent-client-chat-input-textarea",
							);
						if (textarea instanceof HTMLTextAreaElement) {
							textarea.focus();
						}
					});
				},
				hasFocus: () =>
					floatingWindow.isExpanded &&
					(floatingWindow.containerRef.current?.contains(
						document.activeElement,
					) ?? false),
				expand: () => {
					floatingWindow.setIsExpanded(true);
				},
				collapse: () => {
					floatingWindow.setIsExpanded(false);
				},
			});
		}
	}, [
		onRegisterCallbacks,
		activeAgentLabel,
		inputValue,
		attachedImages,
		isSessionReady,
		isSending,
		sessionHistory.loading,
		floatingWindow,
		handleSendMessage,
		handleStopGeneration,
	]);

	// ============================================================
	// Shared Workspace Events (hotkeys)
	// ============================================================
	useWorkspaceEvents({
		workspace: plugin.app.workspace,
		viewId,
		lastActiveChatViewId: plugin.lastActiveChatViewId,
		autoMentionToggle: autoMention.toggle,
		handleNewChat,
		approveActivePermission: permission.approveActivePermission,
		rejectActivePermission: permission.rejectActivePermission,
		handleStopGeneration,
	});

	// ============================================================
	// Focus Tracking
	// ============================================================
	useEffect(() => {
		const handleFocus = () => {
			plugin.setLastActiveChatViewId(viewId);
		};

		const container = floatingWindow.containerRef.current;
		if (!container) return;

		container.addEventListener("focus", handleFocus, true);
		container.addEventListener("click", handleFocus);
		plugin.setLastActiveChatViewId(viewId);

		return () => {
			container.removeEventListener("focus", handleFocus, true);
			container.removeEventListener("click", handleFocus);
		};
	}, [plugin, viewId, floatingWindow.isExpanded]);

	// ============================================================
	// Render
	// ============================================================
	if (!floatingWindow.isExpanded) return null;

	return (
		<div
			ref={floatingWindow.containerRef}
			className="agent-client-floating-window"
			style={{
				left: floatingWindow.position.x,
				top: floatingWindow.position.y,
				width: floatingWindow.size.width,
				height: floatingWindow.size.height,
			}}
		>
			<div
				className="agent-client-floating-header"
				onMouseDown={floatingWindow.onMouseDown}
			>
				<InlineHeader
					variant="floating"
					agentLabel={activeAgentLabel}
					availableAgents={availableAgents}
					currentAgentId={session.agentId}
					isUpdateAvailable={isUpdateAvailable}
					hasMessages={messages.length > 0}
					onAgentChange={(agentId) => void handleSwitchAgent(agentId)}
					onNewSession={() => void handleNewChat()}
					onOpenHistory={() => void handleOpenHistory()}
					onExportChat={() => void handleExportChat()}
					onRestartAgent={() => void handleRestartAgent()}
					onOpenNewWindow={handleOpenNewFloatingChat}
					onClose={handleCloseWindow}
				/>
			</div>

			<div className="agent-client-floating-content">
				<div className="agent-client-floating-messages-container">
					<ChatMessages
						messages={messages}
						isSending={isSending}
						isSessionReady={isSessionReady}
						isRestoringSession={sessionHistory.loading}
						agentLabel={activeAgentLabel}
						plugin={plugin}
						view={viewHost}
						acpClient={acpClientRef.current}
						onApprovePermission={permission.approvePermission}
					/>
				</div>

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
					view={viewHost}
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
		</div>
	);
}

export function createFloatingChat(
	plugin: AgentClientPlugin,
	instanceId: string,
	initialExpanded = false,
	initialPosition?: { x: number; y: number },
): FloatingViewContainer {
	const container = new FloatingViewContainer(plugin, instanceId);
	container.mount(initialExpanded, initialPosition);
	return container;
}
