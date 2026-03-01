import * as React from "react";
import type { FileChange } from "../../shared/session-file-restoration";
import { ObsidianIcon } from "./ObsidianIcon";

const { useState } = React;

interface SessionChangesModalProps {
	changes: FileChange[];
	onClose: () => void;
	onRevert: () => void;
}

export function SessionChangesModal({
	changes,
	onClose,
	onRevert,
}: SessionChangesModalProps) {
	const [expandedPath, setExpandedPath] = useState<string | null>(null);

	return (
		<div className="obsius-modal-overlay" onClick={onClose}>
			<div
				className="obsius-modal-content obsius-session-changes-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="obsius-modal-header">
					<h3>Session Changes ({changes.length} files)</h3>
					<button className="obsius-modal-close" onClick={onClose}>
						<ObsidianIcon name="x" size={16} />
					</button>
				</div>

				<div className="obsius-modal-body">
					{changes.map((change) => (
						<div key={change.path} className="obsius-change-file">
							<div
								className="obsius-change-file-header"
								onClick={() =>
									setExpandedPath(
										expandedPath === change.path ? null : change.path,
									)
								}
							>
								<ObsidianIcon
									name={
										expandedPath === change.path
											? "chevron-down"
											: "chevron-right"
									}
									size={14}
								/>
								<span className="obsius-change-file-path">{change.path}</span>
								{change.originalText === null && (
									<span className="obsius-change-badge obsius-change-badge--new">
										new
									</span>
								)}
							</div>

							{expandedPath === change.path && (
								<div className="obsius-change-diff">
									{change.originalText !== null ? (
										<pre className="obsius-change-diff-content">
											{formatSimpleDiff(change.originalText, change.finalText)}
										</pre>
									) : (
										<pre className="obsius-change-diff-content obsius-change-diff--added">
											{change.finalText.length > 2000
												? change.finalText.slice(0, 2000) + "\n..."
												: change.finalText}
										</pre>
									)}
								</div>
							)}
						</div>
					))}
				</div>

				<div className="obsius-modal-footer">
					<button className="obsius-modal-btn" onClick={onClose}>
						Close
					</button>
					<button
						className="obsius-modal-btn obsius-modal-btn--danger"
						onClick={onRevert}
					>
						Revert all changes
					</button>
				</div>
			</div>
		</div>
	);
}

function formatSimpleDiff(oldText: string, newText: string): string {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const result: string[] = [];

	const maxLen = Math.max(oldLines.length, newLines.length);
	for (let i = 0; i < maxLen; i++) {
		const oldLine = oldLines[i];
		const newLine = newLines[i];
		if (oldLine === newLine) {
			result.push(`  ${oldLine ?? ""}`);
		} else {
			if (oldLine !== undefined) result.push(`- ${oldLine}`);
			if (newLine !== undefined) result.push(`+ ${newLine}`);
		}
	}

	const output = result.join("\n");
	return output.length > 3000 ? output.slice(0, 3000) + "\n..." : output;
}
