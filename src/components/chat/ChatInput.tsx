import * as React from "react";
const { useRef, useEffect, useCallback } = React;
import { setIcon } from "obsidian";

import type AgentClientPlugin from "../../plugin";
import type { IChatViewHost } from "./types";
import type {
	SlashCommand,
	SessionModeState,
	SessionModelState,
} from "../../domain/models/chat-session";
import type { ImagePromptContent } from "../../domain/models/prompt-content";
import type { UseMentionsReturn } from "../../hooks/useMentions";
import type { UseSlashCommandsReturn } from "../../hooks/useSlashCommands";
import type { UseAutoMentionReturn } from "../../hooks/useAutoMention";
import type { ChatMessage } from "../../domain/models/chat-message";
import { SuggestionDropdown } from "./SuggestionDropdown";
import { ErrorOverlay } from "./ErrorOverlay";
import { ImagePreviewStrip, type AttachedImage } from "./ImagePreviewStrip";
import { InputActions, type SendButtonState } from "./chat-input/InputActions";
import {
	RichTextarea,
	type RichTextareaHandle,
} from "./chat-input/RichTextarea";
import { useChatInputBehavior } from "./chat-input/use-chat-input-behavior";
import { useImageAttachments } from "./chat-input/use-image-attachments";
import { useInputHistory } from "../../hooks/useInputHistory";
import { getLogger } from "../../shared/logger";
import type { ErrorInfo } from "../../domain/models/agent-error";
import { useSettings } from "../../hooks/useSettings";
import { ObsidianIcon } from "./ObsidianIcon";

export interface ChatInputProps {
	isSending: boolean;
	isSessionReady: boolean;
	isRestoringSession: boolean;
	agentLabel: string;
	availableCommands: SlashCommand[];
	autoMentionEnabled: boolean;
	restoredMessage: string | null;
	mentions: UseMentionsReturn;
	slashCommands: UseSlashCommandsReturn;
	autoMention: UseAutoMentionReturn;
	plugin: AgentClientPlugin;
	view: IChatViewHost;
	onSendMessage: (
		content: string,
		images?: ImagePromptContent[],
	) => Promise<void>;
	onStopGeneration: () => Promise<void>;
	onRestoredMessageConsumed: () => void;
	modes?: SessionModeState;
	onModeChange?: (modeId: string) => void;
	models?: SessionModelState;
	onModelChange?: (modelId: string) => void;
	supportsImages?: boolean;
	agentId: string;
	inputValue: string;
	onInputChange: (value: string) => void;
	attachedImages: AttachedImage[];
	onAttachedImagesChange: (images: AttachedImage[]) => void;
	errorInfo: ErrorInfo | null;
	onClearError: () => void;
	messages: ChatMessage[];
}

export function ChatInput({
	isSending,
	isSessionReady,
	isRestoringSession,
	agentLabel,
	availableCommands,
	autoMentionEnabled,
	restoredMessage,
	mentions,
	slashCommands,
	autoMention,
	plugin,
	view,
	onSendMessage,
	onStopGeneration,
	onRestoredMessageConsumed,
	modes,
	onModeChange,
	models,
	onModelChange,
	supportsImages = false,
	agentId,
	inputValue,
	onInputChange,
	attachedImages,
	onAttachedImagesChange,
	errorInfo,
	onClearError,
	messages,
}: ChatInputProps) {
	const logger = getLogger();
	const settings = useSettings(plugin);

	/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
	const obsidianSpellcheck: boolean =
		(plugin.app.vault as any).getConfig("spellcheck") ?? true;
	/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

	const historyInputChange = useCallback(
		(value: string) => {
			onInputChange(value);
			richTextareaRef.current?.setContent(value);
		},
		[onInputChange],
	);

	const { handleHistoryKeyDown, resetHistory } = useInputHistory(
		messages,
		historyInputChange,
		inputValue,
	);

	const richTextareaRef = useRef<RichTextareaHandle>(null);
	const sendButtonRef = useRef<HTMLButtonElement>(null);
	const {
		isDraggingOver,
		removeImage,
		handlePaste,
		handleDragOver,
		handleDragEnter,
		handleDragLeave,
		handleDrop,
	} = useImageAttachments({
		supportsImages,
		attachedImages,
		onAttachedImagesChange,
	});

	useEffect(() => {
		onAttachedImagesChange([]);
	}, [agentId, onAttachedImagesChange]);

	const sendButtonState: SendButtonState = isSending
		? "sending"
		: isSessionReady &&
			  !isRestoringSession &&
			  (inputValue.trim() !== "" || attachedImages.length > 0)
			? "ready"
			: "disabled";

	const handleSendOrStop = useCallback(async () => {
		if (isSending) {
			await onStopGeneration();
			return;
		}

		if (!inputValue.trim() && attachedImages.length === 0) return;

		const messageToSend = inputValue.trim();
		const imagesToSend: ImagePromptContent[] = attachedImages.map((img) => ({
			type: "image",
			data: img.data,
			mimeType: img.mimeType,
		}));

		onInputChange("");
		richTextareaRef.current?.clear();
		onAttachedImagesChange([]);
		setHintText(null);
		setCommandText("");
		resetHistory();

		await onSendMessage(
			messageToSend,
			imagesToSend.length > 0 ? imagesToSend : undefined,
		);
	}, [
		isSending,
		inputValue,
		attachedImages,
		onSendMessage,
		onStopGeneration,
		onInputChange,
		onAttachedImagesChange,
		resetHistory,
	]);

	const isButtonDisabled =
		!isSending &&
		((inputValue.trim() === "" && attachedImages.length === 0) ||
			!isSessionReady ||
			isRestoringSession);

	const {
		hintText,
		commandText,
		handleRichInput,
		handleKeyDown,
		handleSelectSlashCommand,
		selectMention,
		setHintText,
		setCommandText,
	} = useChatInputBehavior({
		mentions,
		slashCommands,
		inputValue,
		onInputChange,
		richTextareaRef,
		handleHistoryKeyDown,
		sendMessageShortcut: settings.sendMessageShortcut,
		isSending,
		isButtonDisabled,
		handleSendOrStop,
		logger,
	});

	useEffect(() => {
		if (sendButtonRef.current) {
			const iconMap: Record<SendButtonState, string> = {
				sending: "square",
				ready: "arrow-up",
				disabled: "arrow-up",
			};
			setIcon(sendButtonRef.current, iconMap[sendButtonState]);
		}
	}, [sendButtonState]);

	useEffect(() => {
		window.setTimeout(() => {
			richTextareaRef.current?.focus();
		}, 0);
	}, []);

	useEffect(() => {
		if (restoredMessage) {
			if (!inputValue.trim()) {
				onInputChange(restoredMessage);
				richTextareaRef.current?.setContent(restoredMessage);
				window.setTimeout(() => {
					richTextareaRef.current?.focus();
				}, 0);
			}
			onRestoredMessageConsumed();
		}
	}, [restoredMessage, onRestoredMessageConsumed, inputValue, onInputChange]);

	const showAutoMention =
		autoMentionEnabled &&
		autoMention.activeNote !== null &&
		!autoMention.isDisabled;

	const placeholder = `Message ${agentLabel} - @ to mention notes${availableCommands.length > 0 ? ", / for commands" : ""}`;

	return (
		<div className="obsius-chat-input-container">
			{errorInfo && (
				<ErrorOverlay
					errorInfo={errorInfo}
					onClose={onClearError}
					view={view}
				/>
			)}

			{mentions.isOpen && (
				<SuggestionDropdown
					type="mention"
					items={mentions.suggestions}
					selectedIndex={mentions.selectedIndex}
					onSelect={selectMention}
					onClose={mentions.close}
					plugin={plugin}
					view={view}
				/>
			)}

			{slashCommands.isOpen && (
				<SuggestionDropdown
					type="slash-command"
					items={slashCommands.suggestions}
					selectedIndex={slashCommands.selectedIndex}
					onSelect={handleSelectSlashCommand}
					onClose={slashCommands.close}
					plugin={plugin}
					view={view}
				/>
			)}

			<div
				className={`obsius-chat-input-box ${isDraggingOver ? "obsius-dragging-over" : ""}`}
				onDragOver={handleDragOver}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDrop={(e) => void handleDrop(e)}
			>
				<div className="obsius-textarea-wrapper">
					{showAutoMention && (
						<span
							className="obsius-auto-mention-fixed"
							onClick={() => {
								void plugin.app.workspace.openLinkText(
									autoMention.activeNote!.name,
									"",
								);
							}}
							title={`Auto-mention: ${autoMention.activeNote!.name}`}
						>
							<ObsidianIcon
								name="pin"
								className="obsius-auto-mention-pin"
								size={12}
							/>
							<span className="obsius-auto-mention-name">
								{autoMention.activeNote!.name}
							</span>
						</span>
					)}
					<RichTextarea
						ref={richTextareaRef}
						onContentChange={handleRichInput}
						onKeyDown={handleKeyDown}
						onPaste={(e) => void handlePaste(e as unknown as React.ClipboardEvent<HTMLTextAreaElement>)}
						placeholder={showAutoMention ? undefined : placeholder}
						spellCheck={obsidianSpellcheck}
					/>
					{hintText && (
						<div className="obsius-hint-overlay" aria-hidden="true">
							<span className="obsius-invisible">{commandText}</span>
							<span className="obsius-hint-text">{hintText}</span>
						</div>
					)}
				</div>

				{supportsImages && (
					<ImagePreviewStrip images={attachedImages} onRemove={removeImage} />
				)}

				<InputActions
					modes={modes}
					models={models}
					onModeChange={onModeChange}
					onModelChange={onModelChange}
					sendButtonRef={sendButtonRef}
					sendButtonState={sendButtonState}
					isButtonDisabled={isButtonDisabled}
					buttonTitle={
						!isSessionReady
							? "Connecting..."
							: isSending
								? "Stop generation"
								: "Send message"
					}
					onSendOrStop={() => void handleSendOrStop()}
				/>
			</div>
		</div>
	);
}
