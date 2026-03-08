import * as React from "react";

const { useCallback } = React;

export interface TabItem {
	id: string;
	label: string;
}

interface TabBarProps {
	tabs: TabItem[];
	activeTabId: string;
	completedTabIds: ReadonlySet<string>;
	onTabClick: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
	canCloseTab: boolean;
}

export function TabBar({
	tabs,
	activeTabId,
	completedTabIds,
	onTabClick,
	onTabClose,
	canCloseTab,
}: TabBarProps) {
	const handleContextMenu = useCallback(
		(e: React.MouseEvent, tabId: string) => {
			if (!canCloseTab) return;
			e.preventDefault();
			onTabClose(tabId);
		},
		[canCloseTab, onTabClose],
	);

	const handleTabKeyDown = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onTabClick(tabs[index].id);
			} else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				const next = (index + 1) % tabs.length;
				const nextEl = e.currentTarget.parentElement?.children[
					next
				] as HTMLElement;
				nextEl?.focus();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				const prev = (index - 1 + tabs.length) % tabs.length;
				const prevEl = e.currentTarget.parentElement?.children[
					prev
				] as HTMLElement;
				prevEl?.focus();
			}
		},
		[tabs, onTabClick],
	);

	return (
		<div className="obsius-tab-bar" role="tablist">
			{tabs.map((tab, index) => (
				<div
					key={tab.id}
					role="tab"
					tabIndex={tab.id === activeTabId ? 0 : -1}
					aria-label={tab.label}
					title={tab.label}
					aria-selected={tab.id === activeTabId}
					className={`obsius-tab-badge${tab.id === activeTabId ? " obsius-tab-badge--active" : ""}${completedTabIds.has(tab.id) ? " obsius-tab-badge--completed" : ""}`}
					onClick={() => onTabClick(tab.id)}
					onContextMenu={(e) => handleContextMenu(e, tab.id)}
					onKeyDown={(e) => handleTabKeyDown(e, index)}
				>
					{index + 1}
				</div>
			))}
		</div>
	);
}
