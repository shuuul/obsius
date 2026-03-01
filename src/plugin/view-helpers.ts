import type { App, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import type { ChatViewLocation } from "../plugin";

function createSidebarTab(
	app: App,
	side: "right" | "left",
	viewType: string,
): WorkspaceLeaf | null {
	const { workspace } = app;
	const split = side === "right" ? workspace.rightSplit : workspace.leftSplit;
	const existingLeaves = workspace.getLeavesOfType(viewType);
	const sidebarLeaf = existingLeaves.find((leaf) => leaf.getRoot() === split);

	if (sidebarLeaf) {
		const tabGroup = sidebarLeaf.parent;
		return workspace.createLeafInParent(
			tabGroup as unknown as WorkspaceSplit,
			Number.MAX_SAFE_INTEGER,
		);
	}

	return side === "right"
		? workspace.getRightLeaf(false)
		: workspace.getLeftLeaf(false);
}

export function createNewChatLeaf(
	app: App,
	location: ChatViewLocation,
	isAdditional: boolean,
	viewType: string,
): WorkspaceLeaf | null {
	const { workspace } = app;

	switch (location) {
		case "right-tab":
			if (isAdditional) {
				return createSidebarTab(app, "right", viewType);
			}
			return workspace.getRightLeaf(false);
		case "right-split":
			return workspace.getRightLeaf(isAdditional);
		case "editor-tab":
			return workspace.getLeaf("tab");
		case "editor-split":
			return workspace.getLeaf("split");
		default:
			return workspace.getRightLeaf(false);
	}
}

export function focusChatTextarea(leaf: WorkspaceLeaf, delayMs = 50): void {
	const viewContainerEl = leaf.view?.containerEl;
	if (!viewContainerEl) {
		return;
	}

	window.setTimeout(() => {
		const textarea = viewContainerEl.querySelector(
			"textarea.obsius-chat-input-textarea",
		);
		if (textarea instanceof HTMLTextAreaElement) {
			textarea.focus();
		}
	}, delayMs);
}
