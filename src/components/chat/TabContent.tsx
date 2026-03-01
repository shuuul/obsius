import * as React from "react";

const { useRef, useEffect, useCallback, useState } = React;

import { TFile, Notice } from "obsidian";
import type { IAcpClient } from "../../adapters/acp/acp.adapter";
import type { ChatInputState } from "../../domain/models/chat-input-state";
import type { ImagePromptContent } from "../../domain/models/prompt-content";
import type { ChatViewContextReference } from "../../domain/ports/chat-view-container.port";
import { useChatController } from "../../hooks/useChatController";
import { useSessionRestore } from "../../hooks/useSessionRestore";
import type AgentClientPlugin from "../../plugin";
import { appendChatContextToken } from "../../shared/chat-context-token";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { SessionHistoryPopover } from "./SessionHistoryPopover";
import { RestoredSessionToolbar } from "./RestoredSessionToolbar";
import { SessionChangesModal } from "./SessionChangesModal";
import type { ChatView } from "./ChatView";

export interface TabContentActions {
	handleNewChat: (agentId?: string) => Promise<void>;
	handleOpenHistory: () => void;
	handleStopGeneration: () => Promise<void>;
	canShowSessionHistory: boolean;
	autoMentionToggle: (force?: boolean) => void;
	approveActivePermission: () => Promise<boolean>;
	rejectActivePermission: () => Promise<boolean>;
	getDisplayName: () => string;
	getInputState: () => ChatInputState | null;
	setInputState: (state: ChatInputState) => void;
	sendMessage: () => Promise<boolean>;
	canSend: () => boolean;
	cancel: () => Promise<void>;
	addContextReference: (reference: ChatViewContextReference) => boolean;
	getLastAssistantText: () => string | null;
}

export function TabContent({
	plugin,
	view,
	tabId,
	agentId,
	isActive,
	onActionsReady,
	onSendComplete,
}: {
	plugin: AgentClientPlugin;
	view: ChatView;
	tabId: string;
	agentId: string;
	isActive: boolean;
	viewId: string;
	onActionsReady: (tabId: string, actions: TabContentActions | null) => void;
	onSendComplete?: (tabId: string) => void;
}) {
	const controller = useChatController({
		plugin,
		viewId: tabId,
		initialAgentId: agentId,
	});

	const {
		acpAdapter,
		vaultPath,
		settings,
		session,
		isSessionReady,
		messages,
		isSending,
		permission,
		mentions,
		autoMention,
		slashCommands,
		sessionHistory,
		activeAgentLabel,
		errorInfo,
		handleSendMessage,
		handleStopGeneration,
		handleNewChat,
		handleClearError,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
		handleOpenHistory,
		handleCloseHistory,
		isHistoryPopoverOpen,
		filteredModels,
		handleSetMode,
		handleSetModel,
		inputValue,
		setInputValue,
		attachedImages,
		setAttachedImages,
		restoredMessage,
		handleRestoredMessageConsumed,
	} = controller;

	const sessionRestore = useSessionRestore();
	const [showChangesModal, setShowChangesModal] = useState(false);

	const prevSessionId = useRef<string | null>(null);
	useEffect(() => {
		if (
			session.sessionId &&
			prevSessionId.current !== null &&
			prevSessionId.current !== session.sessionId &&
			messages.length > 0
		) {
			sessionRestore.activateRestore(messages);
		}
		prevSessionId.current = session.sessionId;
	}, [session.sessionId, messages, sessionRestore]);

	const writeFile = useCallback(
		async (path: string, content: string) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await plugin.app.vault.modify(file, content);
			}
		},
		[plugin],
	);

	const readFile = useCallback(
		async (path: string) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);
			return await plugin.app.vault.read(file);
		},
		[plugin],
	);

	const handleRevert = useCallback(async () => {
		const { reverted, conflicts } = await sessionRestore.revertChanges(
			writeFile,
			readFile,
		);
		if (reverted.length > 0) {
			new Notice(`Reverted ${reverted.length} file(s)`);
		}
		if (conflicts.length > 0) {
			new Notice(`${conflicts.length} file(s) had conflicts and were skipped`);
		}
		setShowChangesModal(false);
	}, [sessionRestore, writeFile, readFile]);

	const handleUndo = useCallback(async () => {
		await sessionRestore.undoRevert(writeFile);
		new Notice("Undo complete");
	}, [sessionRestore, writeFile]);

	const handleCopyBack = useCallback(() => {
		if (sessionRestore.copyLastAssistantMessage(messages)) {
			new Notice("Copied to clipboard");
		} else {
			new Notice("No assistant message found");
		}
	}, [sessionRestore, messages]);

	const handleInsertAtCursor = useCallback(() => {
		if (sessionRestore.insertLastAssistantMessage(plugin.app, messages)) {
			new Notice("Inserted at cursor");
		} else {
			new Notice("No active editor or no assistant message");
		}
	}, [sessionRestore, plugin.app, messages]);

	const prevIsSendingRef = useRef(false);
	useEffect(() => {
		const wasSending = prevIsSendingRef.current;
		prevIsSendingRef.current = isSending;
		if (wasSending && !isSending && messages.length > 0) {
			onSendComplete?.(tabId);
		}
	}, [isSending, messages.length, tabId, onSendComplete]);

	const acpClientRef = useRef<IAcpClient>(acpAdapter);
	const agentIdRef = useRef(agentId);

	useEffect(() => {
		if (agentIdRef.current === agentId) return;
		agentIdRef.current = agentId;
		if (session.agentId !== agentId) {
			void handleNewChat(agentId);
		}
	}, [agentId, session.agentId, handleNewChat]);

	const actionsRef = useRef<TabContentActions | null>(null);
	actionsRef.current = {
		handleNewChat,
		handleOpenHistory,
		handleStopGeneration,
		canShowSessionHistory: sessionHistory.canShowSessionHistory,
		autoMentionToggle: autoMention.toggle,
		approveActivePermission: permission.approveActivePermission,
		rejectActivePermission: permission.rejectActivePermission,
		getDisplayName: () => activeAgentLabel,
		getInputState: () => ({ text: inputValue, images: attachedImages }),
		setInputState: (state) => {
			setInputValue(state.text);
			setAttachedImages(state.images);
		},
		addContextReference: (reference) => {
			let added = false;
			setInputValue((prev) => {
				const next = appendChatContextToken(prev, reference);
				added = next !== prev;
				return next;
			});
			return added;
		},
		sendMessage: async () => {
			const hasContent = inputValue.trim() !== "" || attachedImages.length > 0;
			if (!hasContent || !isSessionReady || sessionHistory.loading || isSending)
				return false;
			const imagesToSend: ImagePromptContent[] = attachedImages.map((img) => ({
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
		canSend: () => {
			const hasContent = inputValue.trim() !== "" || attachedImages.length > 0;
			return (
				hasContent && isSessionReady && !sessionHistory.loading && !isSending
			);
		},
		cancel: async () => {
			if (isSending) await handleStopGeneration();
		},
		getLastAssistantText: () => {
			for (let i = messages.length - 1; i >= 0; i--) {
				const msg = messages[i];
				if (msg.role !== "assistant") continue;
				for (const content of msg.content) {
					if (content.type === "text" && content.text.trim()) {
						return content.text;
					}
				}
			}
			return null;
		},
	};

	useEffect(() => {
		onActionsReady(tabId, actionsRef.current);
	}, [tabId, onActionsReady, sessionHistory.canShowSessionHistory]);

	useEffect(() => {
		return () => {
			onActionsReady(tabId, null);
		};
	}, [tabId, onActionsReady]);

	const chatFontSizeStyle =
		settings.displaySettings.fontSize !== null
			? ({
					"--ac-chat-font-size": `${settings.displaySettings.fontSize}px`,
				} as React.CSSProperties)
			: undefined;

	return (
		<div
			className="obsius-tab-content"
			style={{
				display: isActive ? "flex" : "none",
				flexDirection: "column",
				flex: 1,
				minHeight: 0,
				...chatFontSizeStyle,
			}}
		>
			{isHistoryPopoverOpen && (
				<SessionHistoryPopover
					sessions={sessionHistory.sessions}
					loading={sessionHistory.loading}
					error={sessionHistory.error}
					hasMore={sessionHistory.hasMore}
					currentCwd={vaultPath}
					currentSessionId={session.sessionId}
					canList={sessionHistory.canList}
					canRestore={sessionHistory.canRestore}
					canFork={sessionHistory.canFork}
					isUsingLocalSessions={sessionHistory.isUsingLocalSessions}
					localSessionIds={sessionHistory.localSessionIds}
					isAgentReady={isSessionReady}
					debugMode={settings.debugMode}
					onRestoreSession={handleRestoreSession}
					onForkSession={handleForkSession}
					onDeleteSession={handleDeleteSession}
					onLoadMore={handleLoadMore}
					onFetchSessions={handleFetchSessions}
					onClose={handleCloseHistory}
				/>
			)}

			{sessionRestore.isRestored && sessionRestore.changeSet && (
				<RestoredSessionToolbar
					changesCount={sessionRestore.changeSet.changes.length}
					canUndo={sessionRestore.canUndo}
					onShowChanges={() => setShowChangesModal(true)}
					onRevert={() => void handleRevert()}
					onUndo={() => void handleUndo()}
					onCopyBack={handleCopyBack}
					onInsertAtCursor={handleInsertAtCursor}
					onDismiss={sessionRestore.dismiss}
				/>
			)}

			{showChangesModal && sessionRestore.changeSet && (
				<SessionChangesModal
					changes={sessionRestore.changeSet.changes}
					onClose={() => setShowChangesModal(false)}
					onRevert={() => void handleRevert()}
				/>
			)}

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
				models={filteredModels}
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
				vaultAccess={controller.vaultAccessAdapter}
				contextUsage={controller.contextUsage}
			/>
		</div>
	);
}
