import { useState, useCallback } from "react";
import type { SlashCommand } from "../domain/models/chat-session";

export interface SlashCommandContext {
	query: string;
	/** Start position of the `/` in the input */
	start: number;
	/** End position of the query (cursor position) */
	end: number;
}

export interface UseSlashCommandsReturn {
	suggestions: SlashCommand[];
	selectedIndex: number;
	isOpen: boolean;
	context: SlashCommandContext | null;

	updateSuggestions: (input: string, cursorPosition: number) => void;
	selectSuggestion: (input: string, command: SlashCommand) => string;
	navigate: (direction: "up" | "down") => void;
	close: () => void;
}

function detectSlashCommand(
	input: string,
	cursorPosition: number,
): SlashCommandContext | null {
	const textUpToCursor = input.slice(0, cursorPosition);

	let slashPos = -1;
	for (let i = textUpToCursor.length - 1; i >= 0; i--) {
		const ch = textUpToCursor[i];
		if (ch === "/") {
			if (i === 0 || /\s/.test(textUpToCursor[i - 1])) {
				slashPos = i;
				break;
			}
			return null;
		}
		if (/\s/.test(ch)) {
			return null;
		}
	}

	if (slashPos === -1) return null;

	const afterSlash = textUpToCursor.slice(slashPos + 1);
	if (afterSlash.includes(" ")) return null;

	return {
		query: afterSlash.toLowerCase(),
		start: slashPos,
		end: cursorPosition,
	};
}

export function useSlashCommands(
	availableCommands: SlashCommand[],
	onAutoMentionToggle?: (disabled: boolean) => void,
): UseSlashCommandsReturn {
	const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [context, setContext] = useState<SlashCommandContext | null>(null);

	const isOpen = suggestions.length > 0;

	const updateSuggestions = useCallback(
		(input: string, cursorPosition: number) => {
			const wasOpen = suggestions.length > 0;

			const ctx = detectSlashCommand(input, cursorPosition);

			if (!ctx) {
				if (wasOpen) {
					onAutoMentionToggle?.(false);
				}
				setSuggestions([]);
				setSelectedIndex(0);
				setContext(null);
				return;
			}

			const filtered = availableCommands.filter((cmd) =>
				cmd.name.toLowerCase().includes(ctx.query),
			);

			setSuggestions(filtered);
			setSelectedIndex(0);
			setContext(ctx);
			onAutoMentionToggle?.(true);
		},
		[availableCommands, onAutoMentionToggle, suggestions.length],
	);

	const selectSuggestion = useCallback(
		(input: string, command: SlashCommand): string => {
			if (!context) {
				const commandText = `/${command.name} `;
				setSuggestions([]);
				setSelectedIndex(0);
				setContext(null);
				return commandText;
			}

			const before = input.slice(0, context.start);
			const after = input.slice(context.end);
			const commandText = `/${command.name} `;
			const newText = before + commandText + after;

			setSuggestions([]);
			setSelectedIndex(0);
			setContext(null);

			return newText;
		},
		[context],
	);

	const navigate = useCallback(
		(direction: "up" | "down") => {
			if (suggestions.length === 0) return;

			const maxIndex = suggestions.length - 1;
			setSelectedIndex((current) => {
				if (direction === "down") {
					return Math.min(current + 1, maxIndex);
				}
				return Math.max(current - 1, 0);
			});
		},
		[suggestions.length],
	);

	const close = useCallback(() => {
		setSuggestions([]);
		setSelectedIndex(0);
		setContext(null);
	}, []);

	return {
		suggestions,
		selectedIndex,
		isOpen,
		context,
		updateSuggestions,
		selectSuggestion,
		navigate,
		close,
	};
}
