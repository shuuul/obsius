import * as React from "react";
const { useState, useMemo, useCallback } = React;
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
		const newLines = (item.newText || "").split("\n");
		const oldLines = (item.oldText || "").split("\n");
		added += Math.max(0, newLines.length - oldLines.length);
		removed += Math.max(0, oldLines.length - newLines.length);
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

	const handlePathClick = useCallback(
		(path: string, e?: React.MouseEvent) => {
			if (e) e.stopPropagation();
			const relativePath = toRelativePath(path, vaultPath);
			void plugin.app.workspace.openLinkText(relativePath, "", "tab");
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
			className="ac-toolcall"
			defaultExpanded={!!permissionRequest}
			header={header}
		>
			{kind === "execute" &&
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

			{locations && locations.length > 0 && (
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
