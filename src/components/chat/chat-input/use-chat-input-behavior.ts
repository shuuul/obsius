import { useCallback, useState } from "react";
import type * as React from "react";

import type { SlashCommand } from "../../../domain/models/chat-session";
import type { NoteMetadata } from "../../../domain/ports/vault-access.port";
import type { UseMentionsReturn } from "../../../hooks/useMentions";
import type { UseSlashCommandsReturn } from "../../../hooks/useSlashCommands";
import {
	buildMessageWithContextTokens,
	createChatContextToken,
	extractChatContextTokensFromMessage,
} from "../../../shared/chat-context-token";
import type { RichTextareaHandle } from "./RichTextarea";

interface UseChatInputBehaviorParams {
	mentions: UseMentionsReturn;
	slashCommands: UseSlashCommandsReturn;
	inputValue: string;
	onInputChange: (value: string) => void;
	richTextareaRef: React.RefObject<RichTextareaHandle | null>;
	handleHistoryKeyDown: (
		e: React.KeyboardEvent,
		textareaEl: HTMLTextAreaElement | null,
	) => boolean;
	sendMessageShortcut: "enter" | "cmd-enter";
	isSending: boolean;
	isButtonDisabled: boolean;
	handleSendOrStop: () => Promise<void>;
}

export function useChatInputBehavior({
	mentions,
	slashCommands,
	inputValue,
	onInputChange,
	richTextareaRef,
	handleHistoryKeyDown,
	sendMessageShortcut,
	isSending,
	isButtonDisabled,
	handleSendOrStop,
}: UseChatInputBehaviorParams) {
	const [hintText, setHintText] = useState<string | null>(null);
	const [commandText, setCommandText] = useState<string>("");

	const selectMention = useCallback(
		(suggestion: NoteMetadata) => {
			const ctx = mentions.context;
			if (!ctx) return;

			richTextareaRef.current?.insertMentionAtContext(
				suggestion.name,
				ctx.start,
				ctx.end,
			);
			mentions.close();
		},
		[mentions, richTextareaRef],
	);

	const handleSelectSlashCommand = useCallback(
		(command: SlashCommand) => {
			const { contexts } = extractChatContextTokensFromMessage(inputValue);
			const commandOnlyText = slashCommands.selectSuggestion(
				inputValue,
				command,
			);
			const newText = buildMessageWithContextTokens(
				commandOnlyText.trim(),
				contexts.map((ctx) => {
					return createChatContextToken(ctx);
				}),
			);
			onInputChange(newText);
			richTextareaRef.current?.setContent(newText);

			if (command.hint) {
				const cmdText = `/${command.name} `;
				setCommandText(cmdText);
				setHintText(command.hint);
			} else {
				setHintText(null);
				setCommandText("");
			}

			window.setTimeout(() => {
				richTextareaRef.current?.focus();
			}, 0);
		},
		[slashCommands, inputValue, onInputChange, richTextareaRef],
	);

	const handleDropdownKeyPress = useCallback(
		(e: React.KeyboardEvent): boolean => {
			const isSlashCommandActive = slashCommands.isOpen;
			const isMentionActive = mentions.isOpen;

			if (!isSlashCommandActive && !isMentionActive) {
				return false;
			}

			if (e.key === "ArrowDown") {
				e.preventDefault();
				if (isSlashCommandActive) {
					slashCommands.navigate("down");
				} else {
					mentions.navigate("down");
				}
				return true;
			}

			if (e.key === "ArrowUp") {
				e.preventDefault();
				if (isSlashCommandActive) {
					slashCommands.navigate("up");
				} else {
					mentions.navigate("up");
				}
				return true;
			}

			if (e.key === "Enter" || e.key === "Tab") {
				if (e.key === "Enter" && e.nativeEvent.isComposing) {
					return false;
				}
				e.preventDefault();
				if (isSlashCommandActive) {
					const selectedCommand =
						slashCommands.suggestions[slashCommands.selectedIndex];
					if (selectedCommand) {
						handleSelectSlashCommand(selectedCommand);
					}
				} else {
					const selectedSuggestion =
						mentions.suggestions[mentions.selectedIndex];
					if (selectedSuggestion) {
						selectMention(selectedSuggestion);
					}
				}
				return true;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				if (isSlashCommandActive) {
					slashCommands.close();
				} else {
					mentions.close();
				}
				return true;
			}

			return false;
		},
		[slashCommands, mentions, handleSelectSlashCommand, selectMention],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (handleDropdownKeyPress(e)) {
				return;
			}

			if (handleHistoryKeyDown(e, null)) {
				return;
			}

			const hasCmdCtrl = e.metaKey || e.ctrlKey;
			if (e.key === "Enter" && (!e.nativeEvent.isComposing || hasCmdCtrl)) {
				const shouldSend =
					sendMessageShortcut === "enter" ? !e.shiftKey : hasCmdCtrl;

				if (shouldSend) {
					e.preventDefault();
					if (!isButtonDisabled && !isSending) {
						void handleSendOrStop();
					}
				}
			}
		},
		[
			handleDropdownKeyPress,
			handleHistoryKeyDown,
			sendMessageShortcut,
			isButtonDisabled,
			isSending,
			handleSendOrStop,
		],
	);

	const handleRichInput = useCallback(
		(text: string, cursorPos: number) => {
			onInputChange(text);
			if (hintText) {
				const expectedText = commandText + hintText;
				const { messageWithoutContextTokens } =
					extractChatContextTokensFromMessage(text);
				if (messageWithoutContextTokens !== expectedText) {
					setHintText(null);
					setCommandText("");
				}
			}

			void mentions.updateSuggestions(text, cursorPos);
			slashCommands.updateSuggestions(text, cursorPos);
		},
		[onInputChange, hintText, commandText, mentions, slashCommands],
	);

	return {
		hintText,
		commandText,
		handleRichInput,
		handleKeyDown,
		handleSelectSlashCommand,
		selectMention,
		setHintText,
		setCommandText,
	};
}
