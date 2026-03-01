import * as React from "react";

const { useMemo, useCallback, useEffect } = React;

import { SelectorButton, type SelectorOption } from "./chat-input/SelectorButton";
import { ProviderLogo, preloadProviderLogos } from "./chat-input/ProviderLogo";
import { getAgentSlug, getAgentFallbackIcon } from "./chat-input/mode-icons";
import { ObsidianIcon } from "./ObsidianIcon";
import { HeaderButton } from "./HeaderButton";
import { TabBar, type TabItem } from "./TabBar";

interface AgentInfo {
	id: string;
	displayName: string;
}

export interface ChatHeaderProps {
	agentLabel: string;
	availableAgents: AgentInfo[];
	currentAgentId: string;
	isUpdateAvailable: boolean;
	onAgentChange: (agentId: string) => void;
	onNewTab: () => void;
	onNewSession: () => void;
	onOpenSettings: () => void;
	onOpenHistory?: () => void;
	tabs: TabItem[];
	activeTabId: string;
	completedTabIds: ReadonlySet<string>;
	canAddTab: boolean;
	canCloseTab: boolean;
	onTabClick: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
}

export function ChatHeader({
	agentLabel,
	availableAgents,
	currentAgentId,
	isUpdateAvailable,
	onAgentChange,
	onNewTab,
	onNewSession,
	onOpenSettings,
	onOpenHistory,
	tabs,
	activeTabId,
	completedTabIds,
	canAddTab,
	canCloseTab,
	onTabClick,
	onTabClose,
}: ChatHeaderProps) {
	const hasMultipleAgents = availableAgents.length > 1;

	const agentOptions: SelectorOption[] = useMemo(
		() =>
			availableAgents.map((agent) => {
				const slug = getAgentSlug(agent.id, agent.displayName);
				return {
					id: agent.id,
					label: agent.displayName,
					iconElement: slug ? (
						<ProviderLogo slug={slug} size={18} />
					) : undefined,
					icon: slug
						? undefined
						: getAgentFallbackIcon(agent.id, agent.displayName),
				};
			}),
		[availableAgents],
	);

	// Preload agent icons eagerly
	useEffect(() => {
		const slugs = availableAgents
			.map((a) => getAgentSlug(a.id, a.displayName))
			.filter((s): s is string => s !== null);
		if (slugs.length > 0) preloadProviderLogos(slugs);
	}, [availableAgents]);

	const handleAgentChange = useCallback(
		(agentId: string) => {
			if (agentId !== currentAgentId) {
				onAgentChange(agentId);
			}
		},
		[currentAgentId, onAgentChange],
	);

	const currentOption = useMemo(
		() => agentOptions.find((a) => a.id === currentAgentId),
		[agentOptions, currentAgentId],
	);

	return (
		<div className="obsius-chat-view-header">
			<div className="obsius-chat-view-header-main">
				{hasMultipleAgents ? (
					<SelectorButton
						options={agentOptions}
						currentValue={currentAgentId}
						onChange={handleAgentChange}
						className="obsius-agent-header-selector"
						dropDown
					/>
				) : (
					<div className="obsius-agent-header-label">
						{currentOption?.iconElement ? (
							<span className="obsius-selector-icon">
								{currentOption.iconElement}
							</span>
						) : currentOption?.icon ? (
							<ObsidianIcon
								name={currentOption.icon}
								className="obsius-selector-icon"
								size={14}
							/>
						) : null}
						<span>{agentLabel}</span>
					</div>
				)}
			</div>

			<TabBar
				tabs={tabs}
				activeTabId={activeTabId}
				completedTabIds={completedTabIds}
				onTabClick={onTabClick}
				onTabClose={onTabClose}
				canCloseTab={canCloseTab}
			/>

			{isUpdateAvailable && (
				<span className="obsius-chat-view-header-update">Update</span>
			)}

			<div className="obsius-chat-view-header-actions">
				{canAddTab && (
					<HeaderButton
						iconName="square-plus"
						tooltip="New tab"
						onClick={onNewTab}
					/>
				)}
				<HeaderButton
					iconName="square-pen"
					tooltip="New session"
					onClick={onNewSession}
				/>
				{onOpenHistory && (
					<HeaderButton
						iconName="history"
						tooltip="Session history"
						onClick={onOpenHistory}
						className="obsius-history-anchor"
					/>
				)}
				<HeaderButton
					iconName="settings"
					tooltip="Plugin settings"
					onClick={onOpenSettings}
				/>
			</div>
		</div>
	);
}
