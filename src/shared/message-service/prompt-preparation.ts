import type {
	IVaultAccess,
	NoteMetadata,
	EditorPosition,
} from "../../domain/ports/vault-access.port";
import type {
	PromptContent,
	ResourcePromptContent,
} from "../../domain/models/prompt-content";
import { extractMentionedNotes, type IMentionService } from "../mention-utils";
import { convertWindowsPathToWsl } from "../wsl-utils";
import { buildFileUri } from "../path-utils";
import {
	DEFAULT_MAX_NOTE_LENGTH,
	DEFAULT_MAX_SELECTION_LENGTH,
	type PreparePromptInput,
	type PreparePromptResult,
} from "./types";

export async function preparePrompt(
	input: PreparePromptInput,
	vaultAccess: IVaultAccess,
	mentionService: IMentionService,
): Promise<PreparePromptResult> {
	const mentionedNotes = extractMentionedNotes(input.message, mentionService);

	if (input.supportsEmbeddedContext) {
		return preparePromptWithEmbeddedContext(input, vaultAccess, mentionedNotes);
	}
	return preparePromptWithTextContext(input, vaultAccess, mentionedNotes);
}

async function preparePromptWithEmbeddedContext(
	input: PreparePromptInput,
	vaultAccess: IVaultAccess,
	mentionedNotes: Array<{
		noteTitle: string;
		file: { path: string; stat: { mtime: number } } | undefined;
	}>,
): Promise<PreparePromptResult> {
	const resourceBlocks: ResourcePromptContent[] = [];

	for (const { file } of mentionedNotes) {
		if (!file) {
			continue;
		}

		try {
			const content = await vaultAccess.readNote(file.path);
			const maxNoteLen = input.maxNoteLength ?? DEFAULT_MAX_NOTE_LENGTH;

			let processedContent = content;
			if (content.length > maxNoteLen) {
				processedContent =
					content.substring(0, maxNoteLen) +
					`\n\n[Note: Truncated from ${content.length} to ${maxNoteLen} characters]`;
			}

			let absolutePath = input.vaultBasePath
				? `${input.vaultBasePath}/${file.path}`
				: file.path;
			if (input.convertToWsl) {
				absolutePath = convertWindowsPathToWsl(absolutePath);
			}

			resourceBlocks.push({
				type: "resource",
				resource: {
					uri: buildFileUri(absolutePath),
					mimeType: "text/markdown",
					text: processedContent,
				},
				annotations: {
					audience: ["assistant"],
					priority: 1.0,
					lastModified: new Date(file.stat.mtime).toISOString(),
				},
			});
		} catch (error) {
			console.error(`Failed to read note ${file.path}:`, error);
		}
	}

	const autoMentionBlocks: PromptContent[] = [];
	if (input.activeNote && !input.isAutoMentionDisabled) {
		const autoMentionResource = await buildAutoMentionResource(
			input.activeNote,
			input.vaultBasePath,
			vaultAccess,
			input.convertToWsl ?? false,
			input.maxSelectionLength ?? DEFAULT_MAX_SELECTION_LENGTH,
		);
		autoMentionBlocks.push(...autoMentionResource);
	}

	const displayContent: PromptContent[] = [
		...(input.message ? [{ type: "text" as const, text: input.message }] : []),
		...(input.images || []),
	];

	const autoMentionPrefix =
		input.activeNote && !input.isAutoMentionDisabled
			? input.activeNote.selection
				? `@[[${input.activeNote.name}]]:${input.activeNote.selection.from.line + 1}-${input.activeNote.selection.to.line + 1}\n`
				: `@[[${input.activeNote.name}]]\n`
			: "";

	const agentContent: PromptContent[] = [
		...resourceBlocks,
		...autoMentionBlocks,
		...(input.message || autoMentionPrefix
			? [{ type: "text" as const, text: autoMentionPrefix + input.message }]
			: []),
		...(input.images || []),
	];

	const autoMentionContext =
		input.activeNote && !input.isAutoMentionDisabled
			? {
					noteName: input.activeNote.name,
					notePath: input.activeNote.path,
					selection: input.activeNote.selection
						? {
								fromLine: input.activeNote.selection.from.line + 1,
								toLine: input.activeNote.selection.to.line + 1,
							}
						: undefined,
				}
			: undefined;

	return {
		displayContent,
		agentContent,
		autoMentionContext,
	};
}

async function preparePromptWithTextContext(
	input: PreparePromptInput,
	vaultAccess: IVaultAccess,
	mentionedNotes: Array<{
		noteTitle: string;
		file: { path: string; stat: { mtime: number } } | undefined;
	}>,
): Promise<PreparePromptResult> {
	const contextBlocks: string[] = [];

	for (const { file } of mentionedNotes) {
		if (!file) {
			continue;
		}

		try {
			const content = await vaultAccess.readNote(file.path);
			const maxNoteLen = input.maxNoteLength ?? DEFAULT_MAX_NOTE_LENGTH;

			let processedContent = content;
			let truncationNote = "";
			if (content.length > maxNoteLen) {
				processedContent = content.substring(0, maxNoteLen);
				truncationNote = `\n\n[Note: This note was truncated. Original length: ${content.length} characters, showing first ${maxNoteLen} characters]`;
			}

			let absolutePath = input.vaultBasePath
				? `${input.vaultBasePath}/${file.path}`
				: file.path;
			if (input.convertToWsl) {
				absolutePath = convertWindowsPathToWsl(absolutePath);
			}

			const contextBlock = `<obsidian_mentioned_note ref="${absolutePath}">\n${processedContent}${truncationNote}\n</obsidian_mentioned_note>`;
			contextBlocks.push(contextBlock);
		} catch (error) {
			console.error(`Failed to read note ${file.path}:`, error);
		}
	}

	if (input.activeNote && !input.isAutoMentionDisabled) {
		const autoMentionContextBlock = await buildAutoMentionTextContext(
			input.activeNote.path,
			input.vaultBasePath,
			vaultAccess,
			input.convertToWsl ?? false,
			input.activeNote.selection,
			input.maxSelectionLength ?? DEFAULT_MAX_SELECTION_LENGTH,
		);
		contextBlocks.push(autoMentionContextBlock);
	}

	const autoMentionPrefix =
		input.activeNote && !input.isAutoMentionDisabled
			? input.activeNote.selection
				? `@[[${input.activeNote.name}]]:${input.activeNote.selection.from.line + 1}-${input.activeNote.selection.to.line + 1}\n`
				: `@[[${input.activeNote.name}]]\n`
			: "";

	const agentMessageText =
		contextBlocks.length > 0
			? contextBlocks.join("\n") + "\n\n" + autoMentionPrefix + input.message
			: autoMentionPrefix + input.message;

	const displayContent: PromptContent[] = [
		...(input.message ? [{ type: "text" as const, text: input.message }] : []),
		...(input.images || []),
	];
	const agentContent: PromptContent[] = [
		...(agentMessageText
			? [{ type: "text" as const, text: agentMessageText }]
			: []),
		...(input.images || []),
	];

	const autoMentionContext =
		input.activeNote && !input.isAutoMentionDisabled
			? {
					noteName: input.activeNote.name,
					notePath: input.activeNote.path,
					selection: input.activeNote.selection
						? {
								fromLine: input.activeNote.selection.from.line + 1,
								toLine: input.activeNote.selection.to.line + 1,
							}
						: undefined,
				}
			: undefined;

	return {
		displayContent,
		agentContent,
		autoMentionContext,
	};
}

async function buildAutoMentionResource(
	activeNote: NoteMetadata,
	vaultPath: string,
	vaultAccess: IVaultAccess,
	convertToWsl: boolean,
	maxSelectionLength: number,
): Promise<PromptContent[]> {
	let absolutePath = vaultPath
		? `${vaultPath}/${activeNote.path}`
		: activeNote.path;
	if (convertToWsl) {
		absolutePath = convertWindowsPathToWsl(absolutePath);
	}

	const uri = buildFileUri(absolutePath);
	if (activeNote.selection) {
		const fromLine = activeNote.selection.from.line + 1;
		const toLine = activeNote.selection.to.line + 1;

		try {
			const content = await vaultAccess.readNote(activeNote.path);
			const lines = content.split("\n");
			const selectedLines = lines.slice(
				activeNote.selection.from.line,
				activeNote.selection.to.line + 1,
			);
			let selectedText = selectedLines.join("\n");
			if (selectedText.length > maxSelectionLength) {
				selectedText =
					selectedText.substring(0, maxSelectionLength) +
					`\n\n[Note: Truncated from ${selectedLines.join("\n").length} to ${maxSelectionLength} characters]`;
			}

			return [
				{
					type: "resource",
					resource: {
						uri,
						mimeType: "text/markdown",
						text: selectedText,
					},
					annotations: {
						audience: ["assistant"],
						priority: 0.8,
						lastModified: new Date(activeNote.modified).toISOString(),
					},
				} as ResourcePromptContent,
				{
					type: "text",
					text: `The user has selected lines ${fromLine}-${toLine} in the above note. This is what they are currently focusing on.`,
				},
			];
		} catch (error) {
			console.error(`Failed to read selection from ${activeNote.path}:`, error);
			return [
				{
					type: "text",
					text: `The user has selected lines ${fromLine}-${toLine} in ${uri}. If relevant, use the Read tool to examine the specific lines.`,
				},
			];
		}
	}

	return [
		{
			type: "text",
			text: `The user has opened the note ${uri} in Obsidian. This may or may not be related to the current conversation. If it seems relevant, consider using the Read tool to examine its content.`,
		},
	];
}

async function buildAutoMentionTextContext(
	notePath: string,
	vaultPath: string,
	vaultAccess: IVaultAccess,
	convertToWsl: boolean,
	selection: { from: EditorPosition; to: EditorPosition } | undefined,
	maxSelectionLength: number,
): Promise<string> {
	let absolutePath = vaultPath ? `${vaultPath}/${notePath}` : notePath;
	if (convertToWsl) {
		absolutePath = convertWindowsPathToWsl(absolutePath);
	}

	if (selection) {
		const fromLine = selection.from.line + 1;
		const toLine = selection.to.line + 1;

		try {
			const content = await vaultAccess.readNote(notePath);
			const lines = content.split("\n");
			const selectedLines = lines.slice(
				selection.from.line,
				selection.to.line + 1,
			);
			let selectedText = selectedLines.join("\n");

			let truncationNote = "";
			if (selectedText.length > maxSelectionLength) {
				selectedText = selectedText.substring(0, maxSelectionLength);
				truncationNote = `\n\n[Note: The selection was truncated. Original length: ${selectedLines.join("\n").length} characters, showing first ${maxSelectionLength} characters]`;
			}

			return `<obsidian_opened_note selection="lines ${fromLine}-${toLine}">
The user opened the note ${absolutePath} in Obsidian and selected the following text (lines ${fromLine}-${toLine}):

${selectedText}${truncationNote}

This is what the user is currently focusing on.
</obsidian_opened_note>`;
		} catch (error) {
			console.error(`Failed to read selection from ${notePath}:`, error);
			return `<obsidian_opened_note selection="lines ${fromLine}-${toLine}">The user opened the note ${absolutePath} in Obsidian and is focusing on lines ${fromLine}-${toLine}. This may or may not be related to the current conversation. If it seems relevant, consider using the Read tool to examine the specific lines.</obsidian_opened_note>`;
		}
	}

	return `<obsidian_opened_note>The user opened the note ${absolutePath} in Obsidian. This may or may not be related to the current conversation. If it seems relevant, consider using the Read tool to examine the content.</obsidian_opened_note>`;
}
