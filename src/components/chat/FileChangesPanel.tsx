import * as React from "react";
import * as Diff from "diff";
import { FileSystemAdapter } from "obsidian";
import type { FileChange } from "../../application/services/session-restore";
import type AgentClientPlugin from "../../plugin";
import { toRelativePath } from "../../shared/path-utils";
import { ObsidianIcon } from "./ObsidianIcon";

const { useMemo, useState, useCallback } = React;

interface FileChangesPanelProps {
	changes: FileChange[];
	plugin: AgentClientPlugin;
	onUndoAll: () => Promise<void> | void;
	onKeepAll: () => void;
	onRevertFile: (changePath: string) => Promise<void> | void;
	onKeepFile: (changePath: string) => void;
}

export function FileChangesPanel({
	changes,
	plugin,
	onUndoAll,
	onKeepAll,
	onRevertFile,
	onKeepFile,
}: FileChangesPanelProps) {
	const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());
	const [activePaths, setActivePaths] = useState<Set<string>>(new Set());

	const vaultPath = useMemo(() => {
		const adapter = plugin.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return "";
	}, [plugin]);

	const perFileStats = useMemo(() => {
		return changes.map((change) => {
			const relativeFromFullPath = vaultPath
				? toRelativePath(change.path, vaultPath)
				: change.path;
			const isAbsolutePath =
				relativeFromFullPath.startsWith("/") ||
				/^[A-Za-z]:\//.test(relativeFromFullPath);
			const fallbackRelative = relativeFromFullPath
				.replace(/\\/g, "/")
				.replace(/^\/+/, "");
			const openPath =
				change.vaultPath ?? (!isAbsolutePath ? fallbackRelative : null);
			const displayPath = openPath ?? change.path;

			if (change.isDeleted) {
				return {
					key: change.path,
					change,
					openPath: null,
					displayPath,
					path: change.vaultPath ?? change.path,
					hasAdditions: false,
					hasDeletions: true,
					isNewFile: false,
					isDeleted: true,
					canRevert: change.canRevert,
				};
			}

			if (change.isNewFile) {
				return {
					key: change.path,
					change,
					openPath,
					displayPath,
					path: change.vaultPath ?? change.path,
					hasAdditions: true,
					hasDeletions: false,
					isNewFile: true,
					isDeleted: false,
					canRevert: change.canRevert,
				};
			}

			const oldText = change.originalText ?? "";
			const newText = change.finalText ?? "";
			let hasAdditions = false;
			let hasDeletions = false;
			for (const part of Diff.diffWords(oldText, newText)) {
				if (part.added) hasAdditions = true;
				if (part.removed) hasDeletions = true;
				if (hasAdditions && hasDeletions) break;
			}

			return {
				key: change.path,
				change,
				openPath,
				displayPath,
				path: change.vaultPath ?? change.path,
				hasAdditions,
				hasDeletions,
				isNewFile: false,
				isDeleted: false,
				canRevert: change.canRevert,
			};
		});
	}, [changes, vaultPath]);

	const handleRevertFile = useCallback(
		async (changePath: string) => {
			setBusyPaths((prev) => new Set(prev).add(changePath));
			try {
				plugin.inlineDiffManager.clearDiff(changePath);
				setActivePaths((prev) => {
					const next = new Set(prev);
					next.delete(changePath);
					return next;
				});
				await onRevertFile(changePath);
			} finally {
				setBusyPaths((prev) => {
					const next = new Set(prev);
					next.delete(changePath);
					return next;
				});
			}
		},
		[onRevertFile, plugin],
	);

	const handleKeepFile = useCallback(
		(changePath: string) => {
			plugin.inlineDiffManager.clearDiff(changePath);
			setActivePaths((prev) => {
				const next = new Set(prev);
				next.delete(changePath);
				return next;
			});
			onKeepFile(changePath);
		},
		[onKeepFile, plugin],
	);

	const handleKeepAll = useCallback(() => {
		plugin.inlineDiffManager.clearAll();
		setActivePaths(new Set());
		onKeepAll();
	}, [onKeepAll, plugin]);

	const handleUndoAll = useCallback(async () => {
		plugin.inlineDiffManager.clearAll();
		setActivePaths(new Set());
		await onUndoAll();
	}, [onUndoAll, plugin]);

	const handleViewFile = useCallback(
		(row: (typeof perFileStats)[number]) => {
			if (!row.openPath) return;

			const isActive = activePaths.has(row.key);
			if (isActive) {
				plugin.inlineDiffManager.clearDiff(row.openPath);
				setActivePaths((prev) => {
					const next = new Set(prev);
					next.delete(row.key);
					return next;
				});
			} else {
				const originalText = row.change.isNewFile
					? ""
					: (row.change.originalText ?? "");
				const currentText = row.isDeleted ? "" : row.change.finalText;

				void plugin.inlineDiffManager.applyDiff(
					row.openPath,
					originalText,
					currentText,
					{ mode: "document" },
				);
				setActivePaths((prev) => new Set(prev).add(row.key));
			}
		},
		[plugin, activePaths],
	);

	return (
		<div className="obsius-changes-panel">
			<div className="obsius-changes-header">
				<span className="obsius-changes-title">
					{changes.length} file{changes.length !== 1 ? "s" : ""} changed
				</span>

				<div className="obsius-changes-actions">
					<button
						className="obsius-changes-btn"
						onClick={() => void handleUndoAll()}
						title="Revert all file changes"
					>
						Undo
					</button>
					<button
						className="obsius-changes-btn"
						onClick={handleKeepAll}
						title="Accept all changes and dismiss"
					>
						Keep
					</button>
				</div>
			</div>

			<div className="obsius-changes-files">
				{perFileStats.map((row) => {
					const isBusy = busyPaths.has(row.key);
					const isActive = activePaths.has(row.key);
					return (
						<div key={row.key} className="obsius-changes-file">
							<div
								className="obsius-changes-file-row"
								onClick={() => handleViewFile(row)}
							>
								<span
									className={`obsius-changes-file-name ${row.openPath ? "obsius-changes-file-name--link" : ""}`}
									title={
										row.openPath
											? isActive
												? "Hide inline diff"
												: "Show inline diff"
											: "File is outside vault"
									}
								>
									{row.displayPath}
								</span>

								{row.isNewFile && (
									<span className="obsius-changes-badge">NEW</span>
								)}
								{row.isDeleted && (
									<span className="obsius-changes-badge obsius-changes-badge--deleted">
										DELETED
									</span>
								)}

								<span className="obsius-changes-file-stats">
									{row.hasAdditions && (
										<span className="obsius-changes-file-stat--add">+</span>
									)}
									{row.hasDeletions && (
										<span className="obsius-changes-file-stat--remove">−</span>
									)}
								</span>

								<span
									className={`obsius-changes-file-seen ${isActive ? "obsius-changes-file-seen--yes" : ""}`}
									title={isActive ? "Hide changes" : "Show changes"}
								>
									<ObsidianIcon name={isActive ? "eye" : "eye-off"} size={14} />
								</span>

								<span className="obsius-changes-file-actions">
									<button
										className="obsius-changes-file-action obsius-changes-file-action--reject"
										onClick={(e) => {
											e.stopPropagation();
											void handleRevertFile(row.change.path);
										}}
										disabled={!row.canRevert || isBusy}
										title={
											row.canRevert
												? "Undo this file's changes"
												: "Cannot revert: no original content"
										}
									>
										<ObsidianIcon name="x" size={14} />
									</button>
									<button
										className="obsius-changes-file-action obsius-changes-file-action--accept"
										onClick={(e) => {
											e.stopPropagation();
											handleKeepFile(row.change.path);
										}}
										title="Keep this change"
									>
										<ObsidianIcon name="check" size={14} />
									</button>
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
