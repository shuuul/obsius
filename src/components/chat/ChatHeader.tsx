import * as React from "react";

const { useState, useRef, useEffect, useCallback } = React;

import { setIcon } from "obsidian";
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
	canAddTab,
	canCloseTab,
	onTabClick,
	onTabClose,
}: ChatHeaderProps) {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const chevronRef = useRef<HTMLSpanElement>(null);

	const hasMultipleAgents = availableAgents.length > 1;

	useEffect(() => {
		if (chevronRef.current) {
			setIcon(chevronRef.current, "chevron-down");
		}
	}, []);

	const handleTitleClick = useCallback(() => {
		if (hasMultipleAgents) {
			setIsDropdownOpen((prev) => !prev);
		}
	}, [hasMultipleAgents]);

	const handleAgentSelect = useCallback(
		(agentId: string) => {
			if (agentId !== currentAgentId) {
				onAgentChange(agentId);
			}
			setIsDropdownOpen(false);
		},
		[currentAgentId, onAgentChange],
	);

	useEffect(() => {
		if (!isDropdownOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isDropdownOpen]);

	return (
		<div className="obsius-chat-view-header">
			<div className="obsius-chat-view-header-main" ref={dropdownRef}>
				<h3
					className={`obsius-chat-view-header-title${hasMultipleAgents ? " obsius-chat-view-header-title--clickable" : ""}`}
					onClick={handleTitleClick}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							handleTitleClick();
						}
					}}
				>
					{agentLabel}
					{hasMultipleAgents && (
						<span
							className={`obsius-chat-view-header-chevron${isDropdownOpen ? " obsius-chat-view-header-chevron--open" : ""}`}
							ref={chevronRef}
						/>
					)}
				</h3>
				{isDropdownOpen && (
					<div className="obsius-header-agent-dropdown">
						{availableAgents.map((agent) => (
							<div
								key={agent.id}
								role="option"
								tabIndex={0}
								aria-selected={agent.id === currentAgentId}
								className={`obsius-header-agent-dropdown-item${agent.id === currentAgentId ? " obsius-header-agent-dropdown-item--active" : ""}`}
								onClick={() => handleAgentSelect(agent.id)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleAgentSelect(agent.id);
									}
								}}
							>
								{agent.displayName}
							</div>
						))}
					</div>
				)}
			</div>

			<TabBar
				tabs={tabs}
				activeTabId={activeTabId}
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
