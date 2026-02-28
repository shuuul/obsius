import { useCallback, useState } from "react";
import type * as React from "react";

import type { SlashCommand } from "../../../domain/models/chat-session";
import type { NoteMetadata } from "../../../domain/ports/vault-access.port";
import type { UseMentionsReturn } from "../../../hooks/useMentions";
import type { UseSlashCommandsReturn } from "../../../hooks/useSlashCommands";
import type { Logger } from "../../../shared/logger";

interface UseChatInputBehaviorParams {
	mentions: UseMentionsReturn;
	slashCommands: UseSlashCommandsReturn;
	inputValue: string;
	onInputChange: (value: string) => void;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	handleHistoryKeyDown: (
		e: React.KeyboardEvent,
		textarea: HTMLTextAreaElement | null,
	) => boolean;
	sendMessageShortcut: "enter" | "cmd-enter";
	isSending: boolean;
	isButtonDisabled: boolean;
	handleSendOrStop: () => Promise<void>;
	logger: Logger;
}

export function useChatInputBehavior({
	mentions,
	slashCommands,
	inputValue,
	onInputChange,
	textareaRef,
	handleHistoryKeyDown,
	sendMessageShortcut,
	isSending,
	isButtonDisabled,
	handleSendOrStop,
	logger,
}: UseChatInputBehaviorParams) {
	const [hintText, setHintText] = useState<string | null>(null);
	const [commandText, setCommandText] = useState<string>("");

	const setTextAndFocus = useCallback(
		(newText: string) => {
			onInputChange(newText);
			window.setTimeout(() => {
				const textarea = textareaRef.current;
				if (textarea) {
					const cursorPos = newText.length;
					textarea.selectionStart = cursorPos;
					textarea.selectionEnd = cursorPos;
					textarea.focus();
				}
			}, 0);
		},
		[onInputChange, textareaRef],
	);

	const selectMention = useCallback(
		(suggestion: NoteMetadata) => {
			const newText = mentions.selectSuggestion(inputValue, suggestion);
			setTextAndFocus(newText);
		},
		[mentions, inputValue, setTextAndFocus],
	);

	const handleSelectSlashCommand = useCallback(
		(command: SlashCommand) => {
			const newText = slashCommands.selectSuggestion(inputValue, command);
			onInputChange(newText);

			if (command.hint) {
				const cmdText = `/${command.name} `;
				setCommandText(cmdText);
				setHintText(command.hint);
			} else {
				setHintText(null);
				setCommandText("");
			}

			window.setTimeout(() => {
				const textarea = textareaRef.current;
				if (textarea) {
					const cursorPos = command.hint
						? `/${command.name} `.length
						: newText.length;
					textarea.selectionStart = cursorPos;
					textarea.selectionEnd = cursorPos;
					textarea.focus();
				}
			}, 0);
		},
		[slashCommands, inputValue, onInputChange, textareaRef],
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

			if (handleHistoryKeyDown(e, textareaRef.current)) {
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
			textareaRef,
			sendMessageShortcut,
			isButtonDisabled,
			isSending,
			handleSendOrStop,
		],
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const newValue = e.target.value;
			const cursorPosition = e.target.selectionStart || 0;
			logger.log("[DEBUG] Input changed:", newValue, "cursor:", cursorPosition);

			onInputChange(newValue);
			if (hintText) {
				const expectedText = commandText + hintText;
				if (newValue !== expectedText) {
					setHintText(null);
					setCommandText("");
				}
			}

			void mentions.updateSuggestions(newValue, cursorPosition);
			slashCommands.updateSuggestions(newValue, cursorPosition);
		},
		[logger, onInputChange, hintText, commandText, mentions, slashCommands],
	);

	return {
		hintText,
		commandText,
		handleInputChange,
		handleKeyDown,
		handleSelectSlashCommand,
		selectMention,
		setHintText,
		setCommandText,
	};
}
