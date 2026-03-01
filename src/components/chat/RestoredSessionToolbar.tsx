import * as React from "react";
import { ObsidianIcon } from "./ObsidianIcon";

interface RestoredSessionToolbarProps {
	changesCount: number;
	canUndo: boolean;
	onShowChanges: () => void;
	onRevert: () => void;
	onUndo: () => void;
	onCopyBack: () => void;
	onInsertAtCursor: () => void;
	onDismiss: () => void;
}

export function RestoredSessionToolbar({
	changesCount,
	canUndo,
	onShowChanges,
	onRevert,
	onUndo,
	onCopyBack,
	onInsertAtCursor,
	onDismiss,
}: RestoredSessionToolbarProps) {
	return (
		<div className="obsius-restore-toolbar">
			<span className="obsius-restore-toolbar-label">
				Restored session ({changesCount} file{changesCount !== 1 ? "s" : ""}{" "}
				changed)
			</span>

			<button
				className="obsius-restore-toolbar-btn"
				onClick={onShowChanges}
				title="Show file changes from this session"
			>
				<ObsidianIcon name="eye" size={14} />
				Show changes
			</button>

			<button
				className="obsius-restore-toolbar-btn obsius-restore-toolbar-btn--danger"
				onClick={onRevert}
				title="Revert files to their state before this session"
			>
				<ObsidianIcon name="undo-2" size={14} />
				Revert
			</button>

			{canUndo && (
				<button
					className="obsius-restore-toolbar-btn"
					onClick={onUndo}
					title="Undo the revert"
				>
					<ObsidianIcon name="redo-2" size={14} />
					Undo
				</button>
			)}

			<button
				className="obsius-restore-toolbar-btn"
				onClick={onCopyBack}
				title="Copy the final assistant message to clipboard"
			>
				<ObsidianIcon name="copy" size={14} />
				Copy
			</button>

			<button
				className="obsius-restore-toolbar-btn"
				onClick={onInsertAtCursor}
				title="Insert the final assistant message at editor cursor"
			>
				<ObsidianIcon name="plus" size={14} />
			</button>

			<button
				className="obsius-restore-toolbar-btn"
				onClick={onDismiss}
				title="Dismiss toolbar"
			>
				<ObsidianIcon name="x" size={14} />
			</button>
		</div>
	);
}
