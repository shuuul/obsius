import * as React from "react";
const { useRef, useImperativeHandle, useCallback, forwardRef, useEffect } =
	React;
import { setIcon } from "obsidian";

import { getFileIcon } from "./file-icons";
import {
	createChatContextToken,
	formatChatContextBadgeLabel,
	formatChatContextTooltip,
	parseChatContextToken,
	type ChatContextReference,
} from "../../../shared/chat-context-token";
import { parseSlashCommandToken } from "../../../shared/slash-command-token";

export interface RichTextareaHandle {
	focus(): void;
	insertMentionAtContext(
		name: string,
		contextStart: number,
		contextEnd: number,
	): void;
	insertSlashCommandAtContext(
		commandName: string,
		contextStart: number,
		contextEnd: number,
	): void;
	setContent(text: string): void;
	clear(): void;
	getContentAndCursor(): { text: string; cursorPos: number };
	getElement(): HTMLDivElement | null;
}

interface RichTextareaProps {
	onContentChange: (text: string, cursorPos: number) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
	placeholder?: string;
	spellCheck?: boolean;
	className?: string;
	onContextBadgeClick?: (reference: ChatContextReference) => void;
}

function createBadgeElement(name: string): HTMLSpanElement {
	const badge = document.createElement("span");
	badge.className = "obsius-inline-mention-badge";
	badge.contentEditable = "false";
	badge.dataset.mention = name;

	const icon = document.createElement("span");
	icon.className = "obsius-inline-mention-icon";
	const iconName = getFileIcon(name);
	icon.dataset.icon = iconName;
	icon.textContent = "";
	badge.appendChild(icon);

	const nameSpan = document.createElement("span");
	nameSpan.className = "obsius-inline-mention-name";
	nameSpan.textContent = name;
	badge.appendChild(nameSpan);

	return badge;
}

function createContextBadgeElement(
	reference: ChatContextReference,
	onContextBadgeClick?: (reference: ChatContextReference) => void,
): HTMLSpanElement {
	const badge = document.createElement("span");
	const typeClass = `obsius-inline-context-badge-${reference.type}`;
	const canOpenInEditor = reference.type !== "folder";
	badge.className = [
		"obsius-inline-mention-badge",
		"obsius-inline-context-badge",
		typeClass,
		canOpenInEditor ? "obsius-inline-context-badge-clickable" : "",
	]
		.filter(Boolean)
		.join(" ");
	badge.contentEditable = "false";

	const token = createChatContextToken(reference);
	badge.dataset.contextToken = token;
	badge.dataset.contextPath = reference.notePath;
	badge.dataset.contextType = reference.type;
	badge.title = formatChatContextTooltip(reference);

	const icon = document.createElement("span");
	icon.className = "obsius-inline-mention-icon";
	if (reference.type === "folder") {
		icon.dataset.icon = "folder";
	} else if (reference.type === "selection") {
		icon.dataset.icon = "list";
	} else {
		icon.dataset.icon = getFileIcon(reference.notePath);
	}
	icon.textContent = "";
	badge.appendChild(icon);

	const nameSpan = document.createElement("span");
	nameSpan.className = "obsius-inline-mention-name";
	nameSpan.textContent = formatChatContextBadgeLabel(reference);
	badge.appendChild(nameSpan);

	if (onContextBadgeClick && canOpenInEditor) {
		badge.tabIndex = 0;
		badge.setAttribute("role", "button");
		badge.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onContextBadgeClick(reference);
		});
		badge.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				event.stopPropagation();
				onContextBadgeClick(reference);
			}
		});
	}

	return badge;
}

function createSlashCommandBadgeElement(commandName: string): HTMLSpanElement {
	const badge = document.createElement("span");
	badge.className = "obsius-inline-mention-badge obsius-inline-slash-badge";
	badge.contentEditable = "false";
	badge.dataset.slashCommand = commandName;

	const icon = document.createElement("span");
	icon.className = "obsius-inline-mention-icon";
	icon.dataset.icon = "terminal";
	icon.textContent = "";
	badge.appendChild(icon);

	const nameSpan = document.createElement("span");
	nameSpan.className = "obsius-inline-mention-name";
	nameSpan.textContent = `/${commandName}`;
	badge.appendChild(nameSpan);

	return badge;
}

function extractContent(editor: HTMLDivElement): {
	text: string;
	cursorPos: number;
} {
	const selection = window.getSelection();
	const focusNode = selection?.focusNode ?? null;
	const focusOffset = selection?.focusOffset ?? 0;

	let text = "";
	let cursorPos = 0;
	let foundCursor = false;

	function walk(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			const content = node.textContent ?? "";
			if (!foundCursor && node === focusNode) {
				cursorPos = text.length + focusOffset;
				foundCursor = true;
			}
			text += content;
		} else if (node instanceof HTMLElement) {
			if (node.dataset.contextToken) {
				const contextToken = node.dataset.contextToken;
				if (!contextToken) {
					return;
				}
				if (!foundCursor && (node === focusNode || node.contains(focusNode))) {
					cursorPos = text.length + contextToken.length;
					foundCursor = true;
				}
				text += contextToken;
			} else if (node.dataset.slashCommand) {
				const slashToken = `@[obsius-slash:${node.dataset.slashCommand}]`;
				if (!foundCursor && (node === focusNode || node.contains(focusNode))) {
					cursorPos = text.length + slashToken.length;
					foundCursor = true;
				}
				text += slashToken;
			} else if (node.dataset.mention) {
				const mentionText = `@[[${node.dataset.mention}]]`;
				if (!foundCursor && (node === focusNode || node.contains(focusNode))) {
					cursorPos = text.length + mentionText.length;
					foundCursor = true;
				}
				text += mentionText;
			} else if (node.tagName === "BR") {
				if (!foundCursor && node === focusNode) {
					cursorPos = text.length;
					foundCursor = true;
				}
				text += "\n";
			} else {
				Array.from(node.childNodes).forEach(walk);
			}
		}
	}

	Array.from(editor.childNodes).forEach(walk);

	if (!foundCursor) {
		cursorPos = text.length;
	}

	return { text, cursorPos };
}

function buildContentFromText(
	editor: HTMLDivElement,
	text: string,
	cursorAtEnd = true,
	onContextBadgeClick?: (reference: ChatContextReference) => void,
) {
	editor.innerHTML = "";

	const regex =
		/@\[obsius-context:[A-Za-z0-9_-]+\]|@\[obsius-slash:([^\]]+)\]|@\[\[([^\]]+)\]\]/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			editor.appendChild(
				document.createTextNode(text.slice(lastIndex, match.index)),
			);
		}

		const token = match[0];
		if (token.startsWith("@[obsius-context:")) {
			const contextReference = parseChatContextToken(token);
			if (contextReference) {
				editor.appendChild(
					createContextBadgeElement(contextReference, onContextBadgeClick),
				);
			} else {
				editor.appendChild(document.createTextNode(token));
			}
		} else if (token.startsWith("@[obsius-slash:")) {
			const cmdName = parseSlashCommandToken(token);
			if (cmdName) {
				editor.appendChild(createSlashCommandBadgeElement(cmdName));
			} else {
				editor.appendChild(document.createTextNode(token));
			}
		} else {
			editor.appendChild(createBadgeElement(match[2] ?? match[1]));
		}
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		editor.appendChild(document.createTextNode(text.slice(lastIndex)));
	}

	if (editor.childNodes.length === 0) {
		editor.appendChild(document.createTextNode(""));
	}

	if (cursorAtEnd) {
		const sel = window.getSelection();
		if (sel) {
			const range = document.createRange();
			const lastChild = editor.lastChild!;
			if (lastChild.nodeType === Node.TEXT_NODE) {
				range.setStart(lastChild, lastChild.textContent?.length ?? 0);
			} else {
				range.setStartAfter(lastChild);
			}
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}
}

/**
 * Walk the editor DOM to find the text node and offset corresponding
 * to a given plain-text position (where badges count as @[[name]]).
 */
function findNodeAtPlainTextOffset(
	editor: HTMLDivElement,
	targetOffset: number,
): { node: Node; offset: number } | null {
	let accumulated = 0;

	const children = Array.from(editor.childNodes);
	for (const child of children) {
		if (child.nodeType === Node.TEXT_NODE) {
			const len = child.textContent?.length ?? 0;
			if (accumulated + len >= targetOffset) {
				return { node: child, offset: targetOffset - accumulated };
			}
			accumulated += len;
		} else if (child instanceof HTMLElement && child.dataset.slashCommand) {
			const slashLen = `@[obsius-slash:${child.dataset.slashCommand}]`.length;
			if (accumulated + slashLen >= targetOffset) {
				const next = child.nextSibling;
				if (next) return { node: next, offset: 0 };
				return null;
			}
			accumulated += slashLen;
		} else if (child instanceof HTMLElement && child.dataset.mention) {
			const mentionLen = `@[[${child.dataset.mention}]]`.length;
			if (accumulated + mentionLen >= targetOffset) {
				const next = child.nextSibling;
				if (next) return { node: next, offset: 0 };
				return null;
			}
			accumulated += mentionLen;
		} else if (child instanceof HTMLElement && child.dataset.contextToken) {
			const contextToken = child.dataset.contextToken;
			if (!contextToken) {
				continue;
			}
			const contextTokenLength = contextToken.length;
			if (accumulated + contextTokenLength >= targetOffset) {
				const next = child.nextSibling;
				if (next) return { node: next, offset: 0 };
				return null;
			}
			accumulated += contextTokenLength;
		} else if (child instanceof HTMLElement && child.tagName === "BR") {
			if (accumulated + 1 >= targetOffset) {
				const next = child.nextSibling;
				if (next) return { node: next, offset: 0 };
				return null;
			}
			accumulated += 1;
		}
	}

	const last = editor.lastChild;
	if (last && last.nodeType === Node.TEXT_NODE) {
		return { node: last, offset: last.textContent?.length ?? 0 };
	}
	return null;
}

function insertTextAtSelection(text: string): void {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return;
	}

	const range = selection.getRangeAt(0);
	range.deleteContents();
	const textNode = document.createTextNode(text);
	range.insertNode(textNode);
	range.setStartAfter(textNode);
	range.setEndAfter(textNode);
	selection.removeAllRanges();
	selection.addRange(range);
}

export const RichTextarea = forwardRef<RichTextareaHandle, RichTextareaProps>(
	function RichTextarea(
		{
			onContentChange,
			onKeyDown,
			onPaste,
			placeholder,
			spellCheck,
			className,
			onContextBadgeClick,
		},
		ref,
	) {
		const editorRef = useRef<HTMLDivElement>(null);
		const isEmptyRef = useRef(true);

		const fireContentChange = useCallback(() => {
			const editor = editorRef.current;
			if (!editor) return;
			const { text, cursorPos } = extractContent(editor);
			isEmptyRef.current = text.trim() === "";
			editor.classList.toggle("obsius-rich-textarea-empty", isEmptyRef.current);
			onContentChange(text, cursorPos);
		}, [onContentChange]);

		const insertMentionAtContext = useCallback(
			(name: string, contextStart: number, contextEnd: number) => {
				const editor = editorRef.current;
				if (!editor) return;

				const startPos = findNodeAtPlainTextOffset(editor, contextStart);
				const endPos = findNodeAtPlainTextOffset(editor, contextEnd);
				if (!startPos || !endPos) return;

				const sel = window.getSelection();
				if (!sel) return;

				const range = document.createRange();
				range.setStart(startPos.node, startPos.offset);
				range.setEnd(endPos.node, endPos.offset);
				range.deleteContents();

				const badge = createBadgeElement(name);
				const space = document.createTextNode(" ");
				range.insertNode(space);
				range.insertNode(badge);

				range.setStartAfter(space);
				range.setEndAfter(space);
				sel.removeAllRanges();
				sel.addRange(range);

				fireContentChange();
			},
			[fireContentChange],
		);

		const insertSlashCommandAtContext = useCallback(
			(commandName: string, contextStart: number, contextEnd: number) => {
				const editor = editorRef.current;
				if (!editor) return;

				const startPos = findNodeAtPlainTextOffset(editor, contextStart);
				const endPos = findNodeAtPlainTextOffset(editor, contextEnd);
				if (!startPos || !endPos) return;

				const sel = window.getSelection();
				if (!sel) return;

				const range = document.createRange();
				range.setStart(startPos.node, startPos.offset);
				range.setEnd(endPos.node, endPos.offset);
				range.deleteContents();

				const badge = createSlashCommandBadgeElement(commandName);
				const space = document.createTextNode(" ");
				range.insertNode(space);
				range.insertNode(badge);

				range.setStartAfter(space);
				range.setEndAfter(space);
				sel.removeAllRanges();
				sel.addRange(range);

				fireContentChange();
			},
			[fireContentChange],
		);

		useImperativeHandle(
			ref,
			() => ({
				focus: () => editorRef.current?.focus(),
				insertMentionAtContext,
				insertSlashCommandAtContext,
				setContent: (text: string) => {
					if (editorRef.current) {
						buildContentFromText(
							editorRef.current,
							text,
							true,
							onContextBadgeClick,
						);
						fireContentChange();
					}
				},
				clear: () => {
					if (editorRef.current) {
						editorRef.current.innerHTML = "";
						editorRef.current.appendChild(document.createTextNode(""));
						isEmptyRef.current = true;
						editorRef.current.classList.add("obsius-rich-textarea-empty");
						fireContentChange();
					}
				},
				getContentAndCursor: () => {
					if (!editorRef.current) return { text: "", cursorPos: 0 };
					return extractContent(editorRef.current);
				},
				getElement: () => editorRef.current,
			}),
			[insertMentionAtContext, insertSlashCommandAtContext, fireContentChange, onContextBadgeClick],
		);

		const handleInput = useCallback(() => {
			fireContentChange();
		}, [fireContentChange]);

		const handlePaste = useCallback(
			(e: React.ClipboardEvent<HTMLDivElement>) => {
				const text = e.clipboardData.getData("text/plain");
				if (text) {
					e.preventDefault();
					insertTextAtSelection(text);
				}
				onPaste?.(e);
			},
			[onPaste],
		);

		useEffect(() => {
			const editor = editorRef.current;
			if (!editor) return;
			if (editor.childNodes.length === 0) {
				editor.appendChild(document.createTextNode(""));
				editor.classList.add("obsius-rich-textarea-empty");
			}
		}, []);

		// Render Obsidian icons inside badge elements via setIcon
		useEffect(() => {
			const editor = editorRef.current;
			if (!editor) return;

			function renderIcons(root: HTMLElement) {
				const icons = Array.from(
					root.querySelectorAll(".obsius-inline-mention-icon[data-icon]"),
				);
				for (const el of icons) {
					if (el.children.length > 0) continue;
					const iconName = (el as HTMLElement).dataset.icon;
					if (!iconName) continue;
					try {
						setIcon(el as HTMLElement, iconName);
					} catch {
						el.textContent = "📄";
					}
				}
			}

			const observer = new MutationObserver(() => renderIcons(editor));
			observer.observe(editor, { childList: true, subtree: true });
			renderIcons(editor);

			return () => observer.disconnect();
		}, []);

		return (
			<div
				ref={editorRef}
				contentEditable
				onInput={handleInput}
				onKeyDown={onKeyDown}
				onPaste={handlePaste}
				spellCheck={spellCheck}
				className={`obsius-rich-textarea ${className ?? ""} obsius-rich-textarea-empty`}
				data-placeholder={placeholder}
				role="textbox"
				aria-multiline="true"
			/>
		);
	},
);
