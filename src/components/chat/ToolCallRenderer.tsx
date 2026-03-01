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

interface ToolCallRendererProps {
	content: Extract<MessageContent, { type: "tool_call" }>;
	plugin: AgentClientPlugin;
	acpClient?: IAcpClient;
	onApprovePermission?: (requestId: string, optionId: string) => Promise<void>;
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

	const showEmojis = plugin.settings.displaySettings.showEmojis;

	const getKindIcon = (kind?: string) => {
		if (!showEmojis) return null;

		switch (kind) {
			case "read":
				return "📖";
			case "edit":
				return "✏️";
			case "delete":
				return "🗑️";
			case "move":
				return "📦";
			case "search":
				return "🔍";
			case "execute":
				return "💻";
			case "think":
				return "💭";
			case "fetch":
				return "🌐";
			case "switch_mode":
				return "🔄";
			default:
				return "🔧";
		}
	};

	return (
		<div className="agent-client-message-tool-call">
			<div className="agent-client-message-tool-call-header">
				<div className="agent-client-message-tool-call-title">
					{showEmojis && (
						<span className="agent-client-message-tool-call-icon">
							{getKindIcon(kind)}
						</span>
					)}
					{title}
				</div>
				{kind === "execute" &&
					rawInput &&
					typeof rawInput.command === "string" && (
						<div className="agent-client-message-tool-call-command">
							<code>
								{rawInput.command}
								{Array.isArray(rawInput.args) &&
									rawInput.args.length > 0 &&
									` ${(rawInput.args as string[]).join(" ")}`}
							</code>
						</div>
					)}
				{locations && locations.length > 0 && (
					<div className="agent-client-message-tool-call-locations">
						{locations.map((loc, idx) => (
							<span
								key={idx}
								className="agent-client-message-tool-call-location"
							>
								{toRelativePath(loc.path, vaultPath)}
								{loc.line != null && `:${loc.line}`}
							</span>
						))}
					</div>
				)}
				<div className="agent-client-message-tool-call-status">
					Status: {status}
				</div>
			</div>

			{toolContent &&
				toolContent.map((item, index) => {
					if (item.type === "terminal") {
						return (
							<TerminalRenderer
								key={index}
								terminalId={item.terminalId}
								acpClient={acpClient || null}
								plugin={plugin}
							/>
						);
					}
					if (item.type === "diff") {
						return (
							<DiffRenderer
								key={index}
								diff={item}
								plugin={plugin}
								autoCollapse={plugin.settings.displaySettings.autoCollapseDiffs}
								collapseThreshold={
									plugin.settings.displaySettings.diffCollapseThreshold
								}
							/>
						);
					}
					return null;
				})}

			{permissionRequest && (
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
			)}
		</div>
	);
}
