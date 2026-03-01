import { setIcon } from "obsidian";
import type { UseAutoMentionReturn } from "../../../hooks/useAutoMention";

interface AutoMentionBadgeProps {
	autoMentionEnabled: boolean;
	autoMention: UseAutoMentionReturn;
}

export function AutoMentionBadge({
	autoMentionEnabled,
	autoMention,
}: AutoMentionBadgeProps) {
	if (!autoMentionEnabled || !autoMention.activeNote) {
		return null;
	}

	return (
		<div className="obsius-auto-mention-inline">
			<span
				className={`obsius-mention-badge ${autoMention.isDisabled ? "obsius-disabled" : ""}`}
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
