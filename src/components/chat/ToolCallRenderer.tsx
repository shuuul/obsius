import * as React from "react";
const { useState, useMemo } = React;
import { FileSystemAdapter } from "obsidian";
import type { MessageContent } from "../../domain/models/chat-message";
import type { IAcpClient } from "../../adapters/acp/acp.adapter";
import type AgentClientPlugin from "../../plugin";
import { TerminalRenderer } from "./TerminalRenderer";
import { PermissionRequestSection } from "./PermissionRequestSection";
import { DiffRenderer } from "./DiffRenderer";
import { toRelativePath } from "../../shared/path-utils";
import { CollapsibleSection } from "./CollapsibleSection";

interface ToolCallRendererProps {
	content: Extract<MessageContent, { type: "tool_call" }>;
	plugin: AgentClientPlugin;
	acpClient?: IAcpClient;
	onApprovePermission?: (requestId: string, optionId: string) => Promise<void>;
}

function getStatusClass(status?: string): string {
	switch (status) {
		case "running":
			return "ac-status--running";
		case "completed":
			return "ac-status--completed";
		case "error":
			return "ac-status--error";
		default:
			return "";
	}
}

function getSummary(
	kind: string | undefined,
	locations: { path: string; line?: number | null }[] | undefined,
	rawInput: Record<string, unknown> | undefined,
	vaultPath: string,
): string {
	if (
		kind === "execute" &&
		rawInput &&
		typeof rawInput.command === "string"
	) {
		let cmd = rawInput.command as string;
		if (Array.isArray(rawInput.args) && rawInput.args.length > 0) {
			cmd += ` ${(rawInput.args as string[]).join(" ")}`;
		}
		return cmd.length > 60 ? `${cmd.slice(0, 60)}...` : cmd;
	}
	if (locations && locations.length > 0) {
		const rel = toRelativePath(locations[0].path, vaultPath);
		const suffix = locations[0].line != null ? `:${locations[0].line}` : "";
		return `${rel}${suffix}`;
	}
	return "";
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

	const summary = useMemo(
		() => getSummary(kind, locations, rawInput, vaultPath),
		[kind, locations, rawInput, vaultPath],
	);

	const header = (
		<>
			<span className="ac-row__title">{title}</span>
			{summary && <span className="ac-row__summary">{summary}</span>}
			<span className={`ac-status ${getStatusClass(status)}`} />
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
					{locations.map((loc, idx) => (
						<span key={idx} className="ac-tree__location">
							{toRelativePath(loc.path, vaultPath)}
							{loc.line != null && `:${loc.line}`}
						</span>
					))}
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
