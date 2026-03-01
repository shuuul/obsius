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
import { AutoMentionBadge } from "./chat-input/AutoMentionBadge";
import { InputActions } from "./chat-input/InputActions";
import { useChatInputBehavior } from "./chat-input/use-chat-input-behavior";
import { useImageAttachments } from "./chat-input/use-image-attachments";
import { useObsidianDropdown } from "./chat-input/use-obsidian-dropdown";
import { useInputHistory } from "../../hooks/useInputHistory";
import { getLogger } from "../../shared/logger";
import type { ErrorInfo } from "../../domain/models/agent-error";
import { useSettings } from "../../hooks/useSettings";

/**
 * Props for ChatInput component
 */
export interface ChatInputProps {
	/** Whether a message is currently being sent */
	isSending: boolean;
	/** Whether the session is ready for user input */
	isSessionReady: boolean;
	/** Whether a session is being restored (load/resume/fork) */
	isRestoringSession: boolean;
	/** Display name of the active agent */
	agentLabel: string;
	/** Available slash commands */
	availableCommands: SlashCommand[];
	/** Whether auto-mention setting is enabled */
	autoMentionEnabled: boolean;
	/** Message to restore (e.g., after cancellation) */
	restoredMessage: string | null;
	/** Mentions hook state and methods */
	mentions: UseMentionsReturn;
	/** Slash commands hook state and methods */
	slashCommands: UseSlashCommandsReturn;
	/** Auto-mention hook state and methods */
	autoMention: UseAutoMentionReturn;
	/** Plugin instance */
	plugin: AgentClientPlugin;
	/** View instance for event registration */
	view: IChatViewHost;
	/** Callback to send a message with optional images */
	onSendMessage: (
		content: string,
		images?: ImagePromptContent[],
	) => Promise<void>;
	/** Callback to stop the current generation */
	onStopGeneration: () => Promise<void>;
	/** Callback when restored message has been consumed */
	onRestoredMessageConsumed: () => void;
	/** Session mode state (available modes and current mode) */
	modes?: SessionModeState;
	/** Callback when mode is changed */
	onModeChange?: (modeId: string) => void;
	/** Session model state (available models and current model) - experimental */
	models?: SessionModelState;
	/** Callback when model is changed */
	onModelChange?: (modelId: string) => void;
	/** Whether the agent supports image attachments */
	supportsImages?: boolean;
	/** Current agent ID (used to clear images on agent switch) */
	agentId: string;
	// Controlled component props (for broadcast commands)
	/** Current input text value */
	inputValue: string;
	/** Callback when input text changes */
	onInputChange: (value: string) => void;
	/** Currently attached images */
	attachedImages: AttachedImage[];
	/** Callback when attached images change */
	onAttachedImagesChange: (images: AttachedImage[]) => void;
	/** Error information to display as overlay */
	errorInfo: ErrorInfo | null;
	/** Callback to clear the error */
	onClearError: () => void;
	/** Messages array for input history navigation */
	messages: ChatMessage[];
}

/**
 * Input component for the chat view.
 *
 * Handles:
 * - Text input with auto-resize
 * - Mention dropdown (@-mentions)
 * - Slash command dropdown (/-commands)
 * - Auto-mention badge
 * - Hint overlay for slash commands
 * - Send/stop button
 * - Keyboard navigation
 */
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
	// Controlled component props
	inputValue,
	onInputChange,
	attachedImages,
	onAttachedImagesChange,
	// Error overlay props
	errorInfo,
	onClearError,
	// Input history
	messages,
}: ChatInputProps) {
	const logger = getLogger();
	const settings = useSettings(plugin);

	// Unofficial Obsidian API: app.vault.getConfig() is not in the public type definitions
	// but is widely used by the plugin community for accessing editor settings.
	/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
	const obsidianSpellcheck: boolean =
		(plugin.app.vault as any).getConfig("spellcheck") ?? true;
	/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

	// Input history navigation (ArrowUp/ArrowDown)
	const { handleHistoryKeyDown, resetHistory } = useInputHistory(
		messages,
		onInputChange,
	);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const sendButtonRef = useRef<HTMLButtonElement>(null);
	const availableModes = modes?.availableModes;
	const currentModeId = modes?.currentModeId;
	const modeDropdownRef = useObsidianDropdown(
		availableModes?.map((mode) => ({ id: mode.id, label: mode.name })),
		currentModeId,
		onModeChange,
	);
	const availableModels = models?.availableModels;
	const currentModelId = models?.currentModelId;
	const modelDropdownRef = useObsidianDropdown(
		availableModels?.map((model) => ({
			id: model.modelId,
			label: model.name,
		})),
		currentModelId,
		onModelChange,
	);
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

	// Clear attached images when agent changes
	useEffect(() => {
		onAttachedImagesChange([]);
	}, [agentId, onAttachedImagesChange]);

	/**
	 * Adjust textarea height based on content.
	 */
	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			// Remove previous dynamic height classes
			textarea.classList.remove(
				"agent-client-textarea-auto-height",
				"agent-client-textarea-expanded",
			);

			// Temporarily use auto to measure
			textarea.classList.add("agent-client-textarea-auto-height");
			const scrollHeight = textarea.scrollHeight;
			const minHeight = 80;
			const maxHeight = 300;

			// Calculate height
			const calculatedHeight = Math.max(
				minHeight,
				Math.min(scrollHeight, maxHeight),
			);

			// Apply expanded class if needed
			if (calculatedHeight > minHeight) {
				textarea.classList.add("agent-client-textarea-expanded");
				// Set CSS variable for dynamic height
				textarea.style.setProperty(
					"--textarea-height",
					`${calculatedHeight}px`,
				);
			} else {
				textarea.style.removeProperty("--textarea-height");
			}

			textarea.classList.remove("agent-client-textarea-auto-height");
		}
	}, []);

	/**
	 * Update send button icon color based on state.
	 */
	const updateIconColor = useCallback(
		(svg: SVGElement) => {
			// Remove all state classes
			svg.classList.remove(
				"agent-client-icon-sending",
				"agent-client-icon-active",
				"agent-client-icon-inactive",
			);

			if (isSending) {
				// Stop button - always active when sending
				svg.classList.add("agent-client-icon-sending");
			} else {
				// Send button - active when has input (text or images)
				const hasContent =
					inputValue.trim() !== "" || attachedImages.length > 0;
				svg.classList.add(
					hasContent
						? "agent-client-icon-active"
						: "agent-client-icon-inactive",
				);
			}
		},
		[isSending, inputValue, attachedImages.length],
	);

	/**
	 * Handle sending or stopping based on current state.
	 */
	const handleSendOrStop = useCallback(async () => {
		if (isSending) {
			await onStopGeneration();
			return;
		}

		// Allow sending if there's text OR images
		if (!inputValue.trim() && attachedImages.length === 0) return;

		// Save input value and images before clearing
		const messageToSend = inputValue.trim();
		const imagesToSend: ImagePromptContent[] = attachedImages.map((img) => ({
			type: "image",
			data: img.data,
			mimeType: img.mimeType,
		}));

		// Clear input, images, and hint state immediately
		onInputChange("");
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

	// Button disabled state - also allow sending if images are attached
	const isButtonDisabled =
		!isSending &&
		((inputValue.trim() === "" && attachedImages.length === 0) ||
			!isSessionReady ||
			isRestoringSession);

	const {
		hintText,
		commandText,
		handleInputChange,
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
		textareaRef,
		handleHistoryKeyDown,
		sendMessageShortcut: settings.sendMessageShortcut,
		isSending,
		isButtonDisabled,
		handleSendOrStop,
		logger,
	});

	// Adjust textarea height when input changes
	useEffect(() => {
		adjustTextareaHeight();
	}, [inputValue, adjustTextareaHeight]);

	// Update send button icon based on sending state
	useEffect(() => {
		if (sendButtonRef.current) {
			const iconName = isSending ? "square" : "send-horizontal";
			setIcon(sendButtonRef.current, iconName);
			const svg = sendButtonRef.current.querySelector("svg");
			if (svg) {
				updateIconColor(svg);
			}
		}
	}, [isSending, updateIconColor]);

	// Update icon color when input or attached images change
	useEffect(() => {
		if (sendButtonRef.current) {
			const svg = sendButtonRef.current.querySelector("svg");
			if (svg) {
				updateIconColor(svg);
			}
		}
	}, [inputValue, attachedImages.length, updateIconColor]);

	// Auto-focus textarea on mount
	useEffect(() => {
		window.setTimeout(() => {
			if (textareaRef.current) {
				textareaRef.current.focus();
			}
		}, 0);
	}, []);

	// Restore message when provided (e.g., after cancellation)
	// Only restore if input is empty to avoid overwriting user's new input
	useEffect(() => {
		if (restoredMessage) {
			if (!inputValue.trim()) {
				onInputChange(restoredMessage);
				// Focus and place cursor at end
				window.setTimeout(() => {
					if (textareaRef.current) {
						textareaRef.current.focus();
						textareaRef.current.selectionStart = restoredMessage.length;
						textareaRef.current.selectionEnd = restoredMessage.length;
					}
				}, 0);
			}
			onRestoredMessageConsumed();
		}
	}, [restoredMessage, onRestoredMessageConsumed, inputValue, onInputChange]);

	// Placeholder text
	const placeholder = `Message ${agentLabel} - @ to mention notes${availableCommands.length > 0 ? ", / for commands" : ""}`;

	return (
		<div className="agent-client-chat-input-container">
			{/* Error Overlay - displayed above input */}
			{errorInfo && (
				<ErrorOverlay
					errorInfo={errorInfo}
					onClose={onClearError}
					view={view}
				/>
			)}

			{/* Mention Dropdown */}
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

			{/* Slash Command Dropdown */}
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

			{/* Input Box - flexbox container with border */}
			<div
				className={`agent-client-chat-input-box ${isDraggingOver ? "agent-client-dragging-over" : ""}`}
				onDragOver={handleDragOver}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDrop={(e) => void handleDrop(e)}
			>
				<AutoMentionBadge
					autoMentionEnabled={autoMentionEnabled}
					autoMention={autoMention}
				/>

				{/* Textarea with Hint Overlay */}
				<div className="agent-client-textarea-wrapper">
					<textarea
						ref={textareaRef}
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						onPaste={(e) => void handlePaste(e)}
						placeholder={placeholder}
						className={`agent-client-chat-input-textarea ${autoMentionEnabled && autoMention.activeNote ? "has-auto-mention" : ""}`}
						rows={1}
						spellCheck={obsidianSpellcheck}
					/>
					{hintText && (
						<div className="agent-client-hint-overlay" aria-hidden="true">
							<span className="agent-client-invisible">{commandText}</span>
							<span className="agent-client-hint-text">{hintText}</span>
						</div>
					)}
				</div>

				{/* Image Preview Strip (only shown when agent supports images) */}
				{supportsImages && (
					<ImagePreviewStrip images={attachedImages} onRemove={removeImage} />
				)}

				<InputActions
					modes={modes}
					models={models}
					modeDropdownRef={modeDropdownRef}
					modelDropdownRef={modelDropdownRef}
					sendButtonRef={sendButtonRef}
					isSending={isSending}
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
