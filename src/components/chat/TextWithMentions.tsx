import * as React from "react";
import type AgentClientPlugin from "../../plugin";
import { getFileIcon } from "./chat-input/file-icons";
import { ObsidianIcon } from "./ObsidianIcon";
import {
	formatChatContextBadgeLabel,
	formatChatContextTooltip,
	parseChatContextToken,
	type ChatContextReference,
} from "../../shared/chat-context-token";

interface TextWithMentionsProps {
	text: string;
	plugin: AgentClientPlugin;
	autoMentionContext?: {
		noteName: string;
		notePath: string;
		selection?: {
			fromLine: number;
			toLine: number;
		};
	};
}

function getContextIconName(reference: ChatContextReference): string {
	if (reference.type === "selection") {
		return "list";
	}
	if (reference.type === "folder") {
		return "folder";
	}
	return getFileIcon(reference.notePath);
}

function renderContextBadge(
	reference: ChatContextReference,
	key: string,
	plugin: AgentClientPlugin,
): React.ReactElement {
	const canOpenInEditor = reference.type !== "folder";

	return (
		<span
			key={key}
			className={`obsius-inline-mention-badge obsius-inline-context-badge${canOpenInEditor ? " obsius-inline-context-badge-clickable" : ""}`}
			title={formatChatContextTooltip(reference)}
			onClick={
				canOpenInEditor
					? () => void plugin.openContextReference(reference)
					: undefined
			}
			role={canOpenInEditor ? "button" : undefined}
			tabIndex={canOpenInEditor ? 0 : undefined}
			onKeyDown={(e) => {
				if (!canOpenInEditor) {
					return;
				}
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					void plugin.openContextReference(reference);
				}
			}}
		>
			<ObsidianIcon
				name={getContextIconName(reference)}
				className="obsius-inline-mention-icon"
				size={12}
			/>
			<span className="obsius-inline-mention-name">
				{formatChatContextBadgeLabel(reference)}
			</span>
		</span>
	);
}

// Function to render text with @mentions and optional auto-mention
export function TextWithMentions({
	text,
	plugin,
	autoMentionContext,
}: TextWithMentionsProps): React.ReactElement {
	// Match @[[filename]] and context token format
	const mentionRegex = /@\[obsius-context:[A-Za-z0-9_-]+\]|@\[\[([^\]]+)\]\]/g;
	const parts: React.ReactNode[] = [];

	if (autoMentionContext) {
		const autoContext: ChatContextReference = autoMentionContext.selection
			? {
					type: "selection",
					notePath: autoMentionContext.notePath,
					noteName: autoMentionContext.noteName,
					selection: {
						from: {
							line: Math.max(0, autoMentionContext.selection.fromLine - 1),
							ch: 0,
						},
						to: {
							line: Math.max(0, autoMentionContext.selection.toLine - 1),
							ch: 0,
						},
					},
				}
			: {
					type: "file",
					notePath: autoMentionContext.notePath,
					noteName: autoMentionContext.noteName,
				};
		parts.push(
			<span
				key="auto-context-prefix"
				className="obsius-text-inline-context-prefix"
			>
				{renderContextBadge(autoContext, "auto-context-badge", plugin)}
			</span>,
		);
		if (text.trim().length > 0) {
			parts.push("\n");
		}
	}

	let lastIndex = 0;
	let match;

	while ((match = mentionRegex.exec(text)) !== null) {
		// Add text before the mention
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}

		const token = match[0];
		if (token.startsWith("@[obsius-context:")) {
			const parsedContext = parseChatContextToken(token);
			if (parsedContext) {
				parts.push(
					renderContextBadge(
						parsedContext,
						`context-token-${match.index}`,
						plugin,
					),
				);
			} else {
				parts.push(token);
			}
		} else {
			// Extract filename from [[brackets]]
			const noteName = match[1];

			// Check if file actually exists
			const file = plugin.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === noteName);

			if (file) {
				// File exists - render as clickable mention
				parts.push(
					<span
						key={match.index}
						className="obsius-text-mention"
						onClick={() => {
							void plugin.app.workspace.openLinkText(file.path, "");
						}}
					>
						@{noteName}
					</span>,
				);
			} else {
				// File doesn't exist - render as plain text
				parts.push(`@${noteName}`);
			}
		}

		lastIndex = match.index + match[0].length;
	}

	// Add any remaining text
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return <div className="obsius-text-with-mentions">{parts}</div>;
}
