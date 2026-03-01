import { useCallback, useRef, useMemo } from "react";
import type { ChatMessage } from "../domain/models/chat-message";

export interface UseInputHistoryReturn {
	/**
	 * Key handler for ArrowUp/ArrowDown history navigation.
	 * Returns true if the event was handled (caller should return early).
	 */
	handleHistoryKeyDown: (
		e: React.KeyboardEvent,
		textareaEl: HTMLTextAreaElement | null,
	) => boolean;

	/**
	 * Reset history navigation state. Call after sending a message.
	 */
	resetHistory: () => void;
}

/**
 * Hook for navigating input history with ArrowUp/ArrowDown keys.
 *
 * - ArrowUp when input is empty recalls the previous user message.
 * - Continued ArrowUp/ArrowDown navigates through history.
 * - If the user edits a restored message, history navigation resets.
 * - ArrowDown from the most recent entry returns to empty input.
 *
 * When textareaEl is null (contenteditable mode), uses currentInputValue
 * for value checks and skips cursor positioning (handled externally).
 */
export function useInputHistory(
	messages: ChatMessage[],
	onInputChange: (value: string) => void,
	currentInputValue?: string,
): UseInputHistoryReturn {
	const historyIndexRef = useRef(-1);
	const restoredTextRef = useRef<string | null>(null);

	const userMessages = useMemo(() => {
		return messages
			.filter((m) => m.role === "user")
			.map((m) => {
				const textContent = m.content.find(
					(c) => c.type === "text" || c.type === "text_with_context",
				);
				return textContent && "text" in textContent ? textContent.text : "";
			})
			.filter((text) => text.trim() !== "");
	}, [messages]);

	const handleHistoryKeyDown = useCallback(
		(
			e: React.KeyboardEvent,
			textareaEl: HTMLTextAreaElement | null,
		): boolean => {
			if (e.nativeEvent.isComposing) return false;
			if (userMessages.length === 0) return false;

			const currentValue = textareaEl?.value ?? currentInputValue ?? "";

			if (historyIndexRef.current !== -1) {
				if (
					e.key === "ArrowLeft" ||
					e.key === "ArrowRight" ||
					(restoredTextRef.current !== null &&
						currentValue !== restoredTextRef.current)
				) {
					historyIndexRef.current = -1;
					restoredTextRef.current = null;
					return false;
				}
			}

			if (e.key === "ArrowUp") {
				if (currentValue.trim() !== "" && historyIndexRef.current === -1)
					return false;

				e.preventDefault();

				const nextIndex = historyIndexRef.current + 1;
				if (nextIndex >= userMessages.length) {
					return true;
				}

				historyIndexRef.current = nextIndex;
				const messageText = userMessages[userMessages.length - 1 - nextIndex];
				restoredTextRef.current = messageText;
				onInputChange(messageText);

				if (textareaEl) {
					window.setTimeout(() => {
						textareaEl.selectionStart = messageText.length;
						textareaEl.selectionEnd = messageText.length;
					}, 0);
				}

				return true;
			}

			if (e.key === "ArrowDown") {
				const currentIndex = historyIndexRef.current;
				if (currentIndex === -1) return false;

				e.preventDefault();

				const nextIndex = currentIndex - 1;
				historyIndexRef.current = nextIndex;

				if (nextIndex === -1) {
					restoredTextRef.current = null;
					onInputChange("");
				} else {
					const messageText = userMessages[userMessages.length - 1 - nextIndex];
					restoredTextRef.current = messageText;
					onInputChange(messageText);

					if (textareaEl) {
						window.setTimeout(() => {
							textareaEl.selectionStart = messageText.length;
							textareaEl.selectionEnd = messageText.length;
						}, 0);
					}
				}

				return true;
			}

			return false;
		},
		[userMessages, onInputChange, currentInputValue],
	);

	const resetHistory = useCallback(() => {
		historyIndexRef.current = -1;
		restoredTextRef.current = null;
	}, []);

	return { handleHistoryKeyDown, resetHistory };
}
