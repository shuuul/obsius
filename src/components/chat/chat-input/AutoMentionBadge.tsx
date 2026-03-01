import { setIcon, type App } from "obsidian";
import type { UseAutoMentionReturn } from "../../../hooks/useAutoMention";

interface AutoMentionBadgeProps {
	autoMentionEnabled: boolean;
	autoMention: UseAutoMentionReturn;
	app: App;
}

export function AutoMentionBadge({
	autoMentionEnabled,
	autoMention,
	app,
}: AutoMentionBadgeProps) {
	if (!autoMentionEnabled || !autoMention.activeNote) {
		return null;
	}

	const handleOpenNote = () => {
		if (autoMention.activeNote) {
			void app.workspace.openLinkText(autoMention.activeNote.path, "");
		}
	};

	return (
		<div className="obsius-auto-mention-inline">
			<span
				className={`obsius-mention-badge obsius-mention-badge-link ${autoMention.isDisabled ? "obsius-disabled" : ""}`}
				onClick={handleOpenNote}
				role="link"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleOpenNote();
					}
				}}
			>
				@{autoMention.activeNote.name}
				{autoMention.activeNote.selection && (
					<span className="obsius-selection-indicator">
						{":"}
						{autoMention.activeNote.selection.from.line + 1}-
						{autoMention.activeNote.selection.to.line + 1}
					</span>
				)}
			</span>
			<button
				className="obsius-auto-mention-toggle-btn"
				onClick={(e) => {
					const newDisabledState = !autoMention.isDisabled;
					autoMention.toggle(newDisabledState);
					setIcon(e.currentTarget, newDisabledState ? "x" : "plus");
				}}
				title={
					autoMention.isDisabled
						? "Enable auto-mention"
						: "Temporarily disable auto-mention"
				}
				ref={(el) => {
					if (el) {
						setIcon(el, autoMention.isDisabled ? "plus" : "x");
					}
				}}
			/>
		</div>
	);
}
