import * as React from "react";
const { useRef, useImperativeHandle, useCallback, forwardRef, useEffect } =
	React;

import { getFileIcon } from "./file-icons";

export interface RichTextareaHandle {
	focus(): void;
	insertMentionAtContext(
		name: string,
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
			if (node.dataset.mention) {
				const mentionText = `@[[${node.dataset.mention}]]`;
				if (
					!foundCursor &&
					(node === focusNode || node.contains(focusNode))
				) {
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
) {
	editor.innerHTML = "";

	const regex = /@\[\[([^\]]+)\]\]/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			editor.appendChild(
				document.createTextNode(text.slice(lastIndex, match.index)),
			);
		}
		editor.appendChild(createBadgeElement(match[1]));
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
		} else if (
			child instanceof HTMLElement &&
			child.dataset.mention
		) {
			const mentionLen = `@[[${child.dataset.mention}]]`.length;
			if (accumulated + mentionLen >= targetOffset) {
				const next = child.nextSibling;
				if (next) return { node: next, offset: 0 };
				return null;
			}
			accumulated += mentionLen;
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

export const RichTextarea = forwardRef<RichTextareaHandle, RichTextareaProps>(
	function RichTextarea(
		{ onContentChange, onKeyDown, onPaste, placeholder, spellCheck, className },
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

		useImperativeHandle(
			ref,
			() => ({
				focus: () => editorRef.current?.focus(),
				insertMentionAtContext,
				setContent: (text: string) => {
					if (editorRef.current) {
						buildContentFromText(editorRef.current, text);
						fireContentChange();
					}
				},
				clear: () => {
					if (editorRef.current) {
						editorRef.current.innerHTML = "";
						editorRef.current.appendChild(
							document.createTextNode(""),
						);
						isEmptyRef.current = true;
						editorRef.current.classList.add("obsius-rich-textarea-empty");
						fireContentChange();
					}
				},
				getContentAndCursor: () => {
					if (!editorRef.current)
						return { text: "", cursorPos: 0 };
					return extractContent(editorRef.current);
				},
				getElement: () => editorRef.current,
			}),
			[insertMentionAtContext, fireContentChange],
		);

		const handleInput = useCallback(() => {
			fireContentChange();
		}, [fireContentChange]);

		const handlePaste = useCallback(
			(e: React.ClipboardEvent<HTMLDivElement>) => {
				const text = e.clipboardData.getData("text/plain");
				if (text) {
					e.preventDefault();
					document.execCommand("insertText", false, text);
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
					root.querySelectorAll(
						".obsius-inline-mention-icon[data-icon]",
					),
				);
				for (const el of icons) {
					if (el.children.length > 0) continue;
					const iconName = (el as HTMLElement).dataset.icon;
					if (!iconName) continue;
					try {
						const { setIcon } = require("obsidian") as {
							setIcon: (el: HTMLElement, icon: string) => void;
						};
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
