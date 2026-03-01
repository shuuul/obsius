import * as React from "react";
const { useState, useMemo, useCallback } = React;
import * as Diff from "diff";
import { FileSystemAdapter } from "obsidian";
import type { MessageContent } from "../../domain/models/chat-message";
import type { IAcpClient } from "../../adapters/acp/acp.adapter";
import type AgentClientPlugin from "../../plugin";
import { TerminalRenderer } from "./TerminalRenderer";
import { PermissionRequestSection } from "./PermissionRequestSection";
import { DiffRenderer } from "./DiffRenderer";
import { toRelativePath } from "../../shared/path-utils";
import { CollapsibleSection } from "./CollapsibleSection";
import { ObsidianIcon } from "./ObsidianIcon";
import {
	getToolIconName,
	getToolDisplayName,
	getToolSummary,
	getStatusDisplayClass,
	getStatusIconName,
} from "../../shared/tool-icons";

const FILE_EDIT_TITLES = new Set([
	"write", "edit", "notebookedit", "editnotebook", "multiedit",
	"strreplace", "writefile", "createfile", "editfile", "writetofile",
	"applydiff", "replaceinfile",
]);

const FILE_READ_TITLES = new Set([
	"read", "readfile", "viewfile",
]);

const SHELL_TITLES = new Set([
	"bash", "shell", "runcommand", "executecommand",
]);

interface ToolCallRendererProps {
	content: Extract<MessageContent, { type: "tool_call" }>;
	plugin: AgentClientPlugin;
	acpClient?: IAcpClient;
	onApprovePermission?: (requestId: string, optionId: string) => Promise<void>;
}

function countDiffStats(
	content: Extract<MessageContent, { type: "tool_call" }>["content"],
): { added: number; removed: number } | null {
	if (!content) return null;
	let added = 0;
	let removed = 0;
	for (const item of content) {
		if (item.type !== "diff") continue;
		const oldText = item.oldText || "";
		const newText = item.newText || "";
		if (!oldText && !newText) continue;
		if (!oldText) {
			added += newText.split("\n").length;
			continue;
		}
		const changes = Diff.diffLines(oldText, newText);
		for (const change of changes) {
			if (change.added) added += change.count ?? 0;
			else if (change.removed) removed += change.count ?? 0;
		}
	}
	if (added === 0 && removed === 0) return null;
	return { added, removed };
}

export function ToolCallRenderer({
	content,
	plugin,
	acpClient,
	onApprovePermission,
}: ToolCallRendererProps) {
	const {
		kind,
		title,
		status,
		toolCallId,
		permissionRequest,
		locations,
		rawInput,
		content: toolContent,
	} = content;

	const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(
		permissionRequest?.selectedOptionId,
	);

	React.useEffect(() => {
		if (permissionRequest?.selectedOptionId !== selectedOptionId) {
			setSelectedOptionId(permissionRequest?.selectedOptionId);
		}
	}, [permissionRequest?.selectedOptionId]);

	const vaultPath = useMemo(() => {
		const adapter = plugin.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return "";
	}, [plugin]);

	const iconName = useMemo(() => getToolIconName(title, kind), [title, kind]);

	const displayName = useMemo(
		() => getToolDisplayName(title, kind),
		[title, kind],
	);

	const summary = useMemo(
		() => getToolSummary(title, kind, rawInput, locations, vaultPath),
		[title, kind, rawInput, locations, vaultPath],
	);

	const statusClass = getStatusDisplayClass(status);
	const statusIcon = getStatusIconName(status);

	const diffStats = useMemo(() => countDiffStats(toolContent), [toolContent]);

	const normalizedTitle = (title ?? "").replace(/[\s_-]+/g, "").toLowerCase();
	const isFileEditTool = kind === "edit" || FILE_EDIT_TITLES.has(normalizedTitle);
	const isFileReadTool = kind === "read" || FILE_READ_TITLES.has(normalizedTitle);
	const isFileTool = isFileEditTool || isFileReadTool;

	const fileTitle = useMemo(() => {
		if (!isFileTool) return "";
		if (summary) return summary;
		if (locations && locations.length > 0) {
			return toRelativePath(locations[0].path, vaultPath);
		}
		return displayName;
	}, [isFileTool, summary, locations, vaultPath, displayName]);

	const handlePathClick = useCallback(
		(path: string, e?: React.MouseEvent) => {
			if (e) e.stopPropagation();
			const relativePath = toRelativePath(path, vaultPath);
			const existing = plugin.app.workspace
				.getLeavesOfType("markdown")
				.find((leaf) => {
					if ("file" in leaf.view) {
						return (leaf.view as { file: { path: string } | null }).file
							?.path === relativePath;
					}
					return false;
				});
			if (existing) {
				plugin.app.workspace.setActiveLeaf(existing, { focus: true });
			} else {
				void plugin.app.workspace.openLinkText(relativePath, "", "tab");
			}
		},
		[plugin, vaultPath],
	);

	const summaryIsFile = useMemo(() => {
		if (!summary) return false;
		if (kind === "execute" || kind === "think" || kind === "fetch")
			return false;
		if (rawInput) {
			const filePath =
				(rawInput.file_path as string) ||
				(rawInput.path as string) ||
				(rawInput.filePath as string) ||
				"";
			if (filePath) return true;
		}
		if (locations && locations.length > 0) return true;
		return false;
	}, [summary, kind, rawInput, locations]);

	const summaryClickPath = useMemo(() => {
		if (!summaryIsFile) return "";
		if (rawInput) {
			const filePath =
				(rawInput.file_path as string) ||
				(rawInput.path as string) ||
				(rawInput.filePath as string) ||
				"";
			if (filePath) return filePath;
		}
		if (locations && locations.length > 0) return locations[0].path;
		return "";
	}, [summaryIsFile, rawInput, locations]);

	const header = (
		<>
			<ObsidianIcon name={iconName} className="ac-tool-icon" />
			{isFileTool ? (
				<>
					{isFileReadTool && (
						<span className="ac-row__title ac-row__action-label">
							Read
						</span>
					)}
					<span
						className={`ac-row__title ac-row__title--file ${summaryIsFile ? "ac-row__title--file-link" : ""}`}
						onClick={
							summaryIsFile && summaryClickPath
								? (e) => handlePathClick(summaryClickPath, e)
								: undefined
						}
					>
						{fileTitle}
					</span>
				</>
			) : (
				<>
					<span className="ac-row__title">{displayName}</span>
					{summary && (
						<span
							className={`ac-row__summary ${summaryIsFile ? "ac-row__summary--link" : ""}`}
							onClick={
								summaryIsFile && summaryClickPath
									? (e) => handlePathClick(summaryClickPath, e)
									: undefined
							}
						>
							{summary}
						</span>
					)}
				</>
			)}
			{diffStats && (
				<span className="ac-tool-diff-stats">
					<span className="ac-tool-diff-added">+{diffStats.added}</span>
					<span className="ac-tool-diff-removed">-{diffStats.removed}</span>
				</span>
			)}
			<span
				className={`ac-tool-status ${statusClass ? `ac-tool-status--${statusClass}` : ""}`}
			>
				{statusIcon && <ObsidianIcon name={statusIcon} size={14} />}
			</span>
		</>
	);

	return (
		<CollapsibleSection
			className={`ac-toolcall ${isFileEditTool ? "ac-toolcall--file-edit" : ""}`}
			defaultExpanded={!!permissionRequest}
			header={header}
		>
			{(kind === "execute" || SHELL_TITLES.has(normalizedTitle)) &&
				rawInput &&
				typeof rawInput.command === "string" && (
					<div className="ac-tree__item">
						<code className="ac-inline-code">
							{rawInput.command}
							{Array.isArray(rawInput.args) &&
								rawInput.args.length > 0 &&
								` ${(rawInput.args as string[]).join(" ")}`}
						</code>
					</div>
				)}

			{!isFileTool && locations && locations.length > 0 && (
				<div className="ac-tree__item ac-tree__locations">
					{locations.map((loc, idx) => {
						const rel = toRelativePath(loc.path, vaultPath);
						const isVaultFile = loc.path !== rel || !loc.path.startsWith("/");
						return (
							<span
								key={idx}
								className={`ac-tree__location ${isVaultFile ? "ac-tree__location--link" : ""}`}
								onClick={
									isVaultFile ? () => handlePathClick(loc.path) : undefined
								}
								onKeyDown={
									isVaultFile
										? (e) => {
												if (e.key === "Enter") handlePathClick(loc.path);
											}
										: undefined
								}
								role={isVaultFile ? "link" : undefined}
								tabIndex={isVaultFile ? 0 : undefined}
							>
								{rel}
								{loc.line != null && `:${loc.line}`}
							</span>
						);
					})}
				</div>
			)}

			{toolContent &&
				toolContent.map((item, index) => {
					if (item.type === "terminal") {
						return (
							<div key={index} className="ac-tree__item">
								<TerminalRenderer
									terminalId={item.terminalId}
									acpClient={acpClient || null}
									plugin={plugin}
								/>
							</div>
						);
					}
					if (item.type === "diff") {
						return (
							<div key={index} className="ac-tree__item">
								<DiffRenderer
									diff={item}
									plugin={plugin}
								showHeader={!isFileEditTool}
									autoCollapse={
										plugin.settings.displaySettings.autoCollapseDiffs
									}
									collapseThreshold={
										plugin.settings.displaySettings.diffCollapseThreshold
									}
								/>
							</div>
						);
					}
					return null;
				})}

			{permissionRequest && (
				<div className="ac-tree__item">
					<PermissionRequestSection
						permissionRequest={{
							...permissionRequest,
							selectedOptionId: selectedOptionId,
						}}
						toolCallId={toolCallId}
						plugin={plugin}
						onApprovePermission={onApprovePermission}
						onOptionSelected={setSelectedOptionId}
					/>
				</div>
			)}
		</CollapsibleSection>
	);
}
