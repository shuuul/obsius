import { useState, useCallback, useRef } from "react";
import { type App, MarkdownView } from "obsidian";
import type { ChatMessage } from "../domain/models/chat-message";
import {
	extractSessionChangeSet,
	getLastAssistantMessage,
	type FileChange,
	type SessionChangeSet,
} from "../shared/session-file-restoration";

export interface UseSessionRestoreReturn {
	isRestored: boolean;
	changeSet: SessionChangeSet | null;
	canUndo: boolean;

	activateRestore: (messages: ChatMessage[]) => void;
	dismiss: () => void;

	showChanges: () => FileChange[];
	revertChanges: (
		writeFile: (path: string, content: string) => Promise<void>,
		readFile: (path: string) => Promise<string>,
	) => Promise<{ reverted: string[]; conflicts: string[] }>;
	undoRevert: (
		writeFile: (path: string, content: string) => Promise<void>,
	) => Promise<void>;

	copyLastAssistantMessage: (messages: ChatMessage[]) => boolean;
	insertLastAssistantMessage: (app: App, messages: ChatMessage[]) => boolean;
}

export function useSessionRestore(): UseSessionRestoreReturn {
	const [isRestored, setIsRestored] = useState(false);
	const [changeSet, setChangeSet] = useState<SessionChangeSet | null>(null);
	const [canUndo, setCanUndo] = useState(false);

	const preRevertSnapshotRef = useRef<Map<string, string>>(new Map());

	const activateRestore = useCallback((messages: ChatMessage[]) => {
		const cs = extractSessionChangeSet(messages);
		setChangeSet(cs);
		setIsRestored(cs.changes.length > 0);
		setCanUndo(false);
		preRevertSnapshotRef.current.clear();
	}, []);

	const dismiss = useCallback(() => {
		setIsRestored(false);
		setChangeSet(null);
		setCanUndo(false);
		preRevertSnapshotRef.current.clear();
	}, []);

	const showChanges = useCallback((): FileChange[] => {
		return changeSet?.changes ?? [];
	}, [changeSet]);

	const revertChanges = useCallback(
		async (
			writeFile: (path: string, content: string) => Promise<void>,
			readFile: (path: string) => Promise<string>,
		): Promise<{ reverted: string[]; conflicts: string[] }> => {
			if (!changeSet) return { reverted: [], conflicts: [] };

			const reverted: string[] = [];
			const conflicts: string[] = [];
			const snapshot = new Map<string, string>();

			for (const change of changeSet.changes) {
				if (change.originalText === null) continue;

				try {
					const currentContent = await readFile(change.path);
					snapshot.set(change.path, currentContent);

					if (currentContent === change.finalText) {
						await writeFile(change.path, change.originalText);
						reverted.push(change.path);
					} else {
						conflicts.push(change.path);
					}
				} catch {
					conflicts.push(change.path);
				}
			}

			preRevertSnapshotRef.current = snapshot;
			if (reverted.length > 0) {
				setCanUndo(true);
			}

			return { reverted, conflicts };
		},
		[changeSet],
	);

	const undoRevert = useCallback(
		async (
			writeFile: (path: string, content: string) => Promise<void>,
		): Promise<void> => {
			for (const [path, content] of preRevertSnapshotRef.current) {
				await writeFile(path, content);
			}
			preRevertSnapshotRef.current.clear();
			setCanUndo(false);
		},
		[],
	);

	const copyLastAssistantMessage = useCallback(
		(messages: ChatMessage[]): boolean => {
			const text = getLastAssistantMessage(messages);
			if (!text) return false;
			void navigator.clipboard.writeText(text);
			return true;
		},
		[],
	);

	const insertLastAssistantMessage = useCallback(
		(app: App, messages: ChatMessage[]): boolean => {
			const text = getLastAssistantMessage(messages);
			if (!text) return false;

			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.editor) return false;

			const cursor = view.editor.getCursor();
			view.editor.replaceRange(text, cursor);
			return true;
		},
		[],
	);

	return {
		isRestored,
		changeSet,
		canUndo,
		activateRestore,
		dismiss,
		showChanges,
		revertChanges,
		undoRevert,
		copyLastAssistantMessage,
		insertLastAssistantMessage,
	};
}
