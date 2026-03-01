import { useCallback, useMemo, useState } from "react";

import type { TabItem } from "../components/chat/TabBar";

const MAX_TABS = 4;

export interface ChatTab {
	id: string;
	agentId: string;
}

interface AgentInfo {
	id: string;
	displayName: string;
}

interface UseTabsOptions {
	initialAgentId: string;
	defaultAgentId: string;
	availableAgents: AgentInfo[];
	onTabClose?: (tabId: string) => void;
}

export interface UseTabsReturn {
	tabs: ChatTab[];
	tabsWithLabels: TabItem[];
	activeTabId: string;
	activeTab: ChatTab;
	canAddTab: boolean;
	canCloseTab: boolean;
	handleTabClick: (tabId: string) => void;
	handleTabClose: (tabId: string) => void;
	handleNewTab: () => void;
	handleAgentChangeForTab: (agentId: string) => void;
	markTabCompleted: (tabId: string) => void;
	completedTabIds: ReadonlySet<string>;
}

export function useTabs({
	initialAgentId,
	defaultAgentId,
	availableAgents,
	onTabClose,
}: UseTabsOptions): UseTabsReturn {
	const [tabs, setTabs] = useState<ChatTab[]>(() => [
		{ id: crypto.randomUUID(), agentId: initialAgentId },
	]);
	const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
	const [completedTabIds, setCompletedTabIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const activeTab = useMemo(
		() => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
		[tabs, activeTabId],
	);

	const tabsWithLabels: TabItem[] = useMemo(() => {
		return tabs.map((tab) => ({
			id: tab.id,
			label:
				availableAgents.find((a) => a.id === tab.agentId)?.displayName ||
				tab.agentId,
		}));
	}, [tabs, availableAgents]);

	const handleTabClick = useCallback(
		(tabId: string) => {
			if (tabId === activeTabId) return;
			setActiveTabId(tabId);
			setCompletedTabIds((prev) => {
				if (!prev.has(tabId)) return prev;
				const next = new Set(prev);
				next.delete(tabId);
				return next;
			});
		},
		[activeTabId],
	);

	const markTabCompleted = useCallback(
		(tabId: string) => {
			if (tabId === activeTabId) return;
			setCompletedTabIds((prev) => {
				if (prev.has(tabId)) return prev;
				const next = new Set(prev);
				next.add(tabId);
				return next;
			});
		},
		[activeTabId],
	);

	const handleTabClose = useCallback(
		(tabId: string) => {
			if (tabs.length <= 1) return;
			const remaining = tabs.filter((t) => t.id !== tabId);
			setTabs(remaining);
			onTabClose?.(tabId);
			if (tabId === activeTabId) {
				setActiveTabId(remaining[0].id);
			}
		},
		[tabs, activeTabId, onTabClose],
	);

	const handleNewTab = useCallback(() => {
		if (tabs.length >= MAX_TABS) return;
		const newTab: ChatTab = {
			id: crypto.randomUUID(),
			agentId: defaultAgentId,
		};
		setTabs((prev) => [...prev, newTab]);
		setActiveTabId(newTab.id);
	}, [tabs.length, defaultAgentId]);

	const handleAgentChangeForTab = useCallback(
		(agentId: string) => {
			setTabs((prev) =>
				prev.map((t) => (t.id === activeTabId ? { ...t, agentId } : t)),
			);
		},
		[activeTabId],
	);

	return {
		tabs,
		tabsWithLabels,
		activeTabId,
		activeTab,
		canAddTab: tabs.length < MAX_TABS,
		canCloseTab: tabs.length > 1,
		handleTabClick,
		handleTabClose,
		handleNewTab,
		handleAgentChangeForTab,
		markTabCompleted,
		completedTabIds,
	};
}
