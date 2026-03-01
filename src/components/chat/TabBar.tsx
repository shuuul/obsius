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

	return (
		<div className="obsius-tab-bar">
			{tabs.map((tab, index) => (
				<div
					key={tab.id}
					role="tab"
					tabIndex={0}
					aria-label={tab.label}
					title={tab.label}
					aria-selected={tab.id === activeTabId}
					className={`obsius-tab-badge${tab.id === activeTabId ? " obsius-tab-badge--active" : ""}${completedTabIds.has(tab.id) ? " obsius-tab-badge--completed" : ""}`}
					onClick={() => onTabClick(tab.id)}
					onContextMenu={(e) => handleContextMenu(e, tab.id)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onTabClick(tab.id);
						}
					}}
				>
					{index + 1}
				</div>
			))}
		</div>
	);
}
