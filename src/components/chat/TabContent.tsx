import * as React from "react";

const { useRef, useEffect } = React;

import type { IAcpClient } from "../../adapters/acp/acp.adapter";
import type { ChatInputState } from "../../domain/models/chat-input-state";
import type { ImagePromptContent } from "../../domain/models/prompt-content";
import { useChatController } from "../../hooks/useChatController";
import type AgentClientPlugin from "../../plugin";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
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
}

export function TabContent({
	plugin,
	view,
	tabId,
	agentId,
	isActive,
	onActionsReady,
}: {
	plugin: AgentClientPlugin;
	view: ChatView;
	tabId: string;
	agentId: string;
	isActive: boolean;
	viewId: string;
	onActionsReady: (tabId: string, actions: TabContentActions | null) => void;
}) {
	const controller = useChatController({
		plugin,
		viewId: tabId,
		initialAgentId: agentId,
	});

	const {
		acpAdapter,
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
		handleOpenHistory,
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
			/>
		</div>
	);
}
