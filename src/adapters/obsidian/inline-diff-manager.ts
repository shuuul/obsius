import type { App, WorkspaceLeaf } from "obsidian";
import { MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
import { Compartment, StateEffect } from "@codemirror/state";
import { inlineDiffExtension, setInlineDiff } from "./inline-diff-extension";
import {
	computeAnchoredInlineDiffSegments,
	computeInlineDiffSegments,
	type InlineDiffOptions,
} from "../../shared/word-diff";

interface TrackedLeaf {
	leaf: WorkspaceLeaf;
	compartment: Compartment;
	filePath: string;
}

export class InlineDiffManager {
	private tracked = new Map<string, TrackedLeaf>();

	constructor(private app: App) {}

	async applyDiff(
		filePath: string,
		originalText: string,
		currentText: string,
		options: InlineDiffOptions = {},
	): Promise<void> {
		const leaf = await this.ensureFileOpen(filePath);
		if (!leaf) return;

		const cm = this.getEditorView(leaf);
		if (!cm) return;

		const segments = this.computeSegments(
			cm.state.doc.toString(),
			originalText,
			currentText,
			options,
		);

		const existing = this.tracked.get(filePath);
		if (existing) {
			cm.dispatch({ effects: setInlineDiff.of(segments) });
			return;
		}

		const compartment = new Compartment();
		cm.dispatch({
			effects: StateEffect.appendConfig.of(
				compartment.of(inlineDiffExtension()),
			),
		});

		cm.dispatch({ effects: setInlineDiff.of(segments) });

		this.tracked.set(filePath, { leaf, compartment, filePath });
	}

	clearDiff(filePath: string): void {
		const entry = this.tracked.get(filePath);
		if (!entry) return;

		const cm = this.getEditorView(entry.leaf);
		if (cm) {
			cm.dispatch({ effects: entry.compartment.reconfigure([]) });
		}
		this.tracked.delete(filePath);
	}

	clearAll(): void {
		for (const [path] of this.tracked) {
			this.clearDiff(path);
		}
	}

	isTracked(filePath: string): boolean {
		return this.tracked.has(filePath);
	}

	private async ensureFileOpen(
		filePath: string,
	): Promise<WorkspaceLeaf | null> {
		const existing = this.app.workspace
			.getLeavesOfType("markdown")
			.find((leaf) => {
				if ("file" in leaf.view) {
					return (
						(leaf.view as { file: { path: string } | null }).file?.path ===
						filePath
					);
				}
				return false;
			});

		if (existing) {
			this.app.workspace.setActiveLeaf(existing, { focus: true });
			return existing;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file) return null;

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file as never);
		return leaf;
	}

	private getEditorView(leaf: WorkspaceLeaf): EditorView | null {
		if (!(leaf.view instanceof MarkdownView)) return null;
		const editor = leaf.view.editor;
		const cm = (editor as unknown as { cm?: EditorView }).cm;
		return cm ?? null;
	}

	private computeSegments(
		documentText: string,
		originalText: string,
		currentText: string,
		options: InlineDiffOptions,
	) {
		if (options.mode === "snippet") {
			return (
				computeAnchoredInlineDiffSegments(
					documentText,
					originalText,
					currentText,
				) ?? []
			);
		}

		return computeInlineDiffSegments(originalText, currentText);
	}
}
