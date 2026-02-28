import {
	Plugin,
	WorkspaceLeaf,
	Notice,
} from "obsidian";
import type { Root } from "react-dom/client";
import { ChatView, VIEW_TYPE_CHAT } from "./components/chat/ChatView";
import {
	createFloatingChat,
	FloatingViewContainer,
} from "./components/chat/FloatingChatView";
import { FloatingButtonContainer } from "./components/chat/FloatingButton";
import { ChatViewRegistry } from "./shared/chat-view-registry";
import {
	createSettingsStore,
	type SettingsStore,
} from "./adapters/obsidian/settings-store.adapter";
import { AgentClientSettingTab } from "./components/settings/AgentClientSettingTab";
import { AcpAdapter } from "./adapters/acp/acp.adapter";
import {
	AgentEnvVar,
	GeminiAgentSettings,
	ClaudeAgentSettings,
	CodexAgentSettings,
	CustomAgentSettings,
} from "./domain/models/agent-config";
import type { SavedSessionInfo } from "./domain/models/session-info";
import { initializeLogger } from "./shared/logger";
import {
	createDefaultSettings,
	parseStoredSettings,
	SETTINGS_SCHEMA_VERSION,
} from "./shared/settings-schema";
import {
	broadcastCancel,
	broadcastPrompt,
	broadcastSend,
	ensureDefaultAgentId,
	getAvailableAgents,
	openChatWithAgent,
	registerAgentCommands,
	registerBroadcastCommands,
	registerFloatingCommands,
	registerPermissionCommands,
} from "./plugin/agent-ops";
import { checkForUpdates } from "./plugin/update-check";
import { createNewChatLeaf, focusChatTextarea } from "./plugin/view-helpers";

// Re-export for backward compatibility
export type { AgentEnvVar, CustomAgentSettings };

/**
 * Send message shortcut configuration.
 * - 'enter': Enter to send, Shift+Enter for newline (default)
 * - 'cmd-enter': Cmd/Ctrl+Enter to send, Enter for newline
 */
export type SendMessageShortcut = "enter" | "cmd-enter";

/**
 * Chat view location configuration.
 * - 'right-tab': Open in right pane as tabs (default)
 * - 'right-split': Open in right pane with vertical split
 * - 'editor-tab': Open in editor area as tabs
 * - 'editor-split': Open in editor area with right split
 */
export type ChatViewLocation =
	| "right-tab"
	| "right-split"
	| "editor-tab"
	| "editor-split";

export interface AgentClientPluginSettings {
	schemaVersion: number;
	gemini: GeminiAgentSettings;
	claude: ClaudeAgentSettings;
	codex: CodexAgentSettings;
	customAgents: CustomAgentSettings[];
	/** Default agent ID for new views (renamed from activeAgentId for multi-session) */
	defaultAgentId: string;
	autoAllowPermissions: boolean;
	autoMentionActiveNote: boolean;
	debugMode: boolean;
	nodePath: string;
	exportSettings: {
		defaultFolder: string;
		filenameTemplate: string;
		autoExportOnNewChat: boolean;
		autoExportOnCloseChat: boolean;
		openFileAfterExport: boolean;
		includeImages: boolean;
		imageLocation: "obsidian" | "custom" | "base64";
		imageCustomFolder: string;
		frontmatterTag: string;
	};
	// WSL settings (Windows only)
	windowsWslMode: boolean;
	windowsWslDistribution?: string;
	// Input behavior
	sendMessageShortcut: SendMessageShortcut;
	// View settings
	chatViewLocation: ChatViewLocation;
	// Display settings
	displaySettings: {
		autoCollapseDiffs: boolean;
		diffCollapseThreshold: number;
		maxNoteLength: number;
		maxSelectionLength: number;
		showEmojis: boolean;
		fontSize: number | null;
	};
	// Locally saved session metadata (for agents without session/list support)
	savedSessions: SavedSessionInfo[];
	// Last used model per agent (agentId → modelId)
	lastUsedModels: Record<string, string>;
	// Floating chat button settings
	showFloatingButton: boolean;
	floatingButtonImage: string;
	floatingWindowSize: { width: number; height: number };
	floatingWindowPosition: { x: number; y: number } | null;
	floatingButtonPosition: { x: number; y: number } | null;
}

const DEFAULT_SETTINGS: AgentClientPluginSettings = {
	...createDefaultSettings(),
};

export default class AgentClientPlugin extends Plugin {
	settings: AgentClientPluginSettings;
	settingsStore!: SettingsStore;

	/** Registry for all chat view containers (sidebar + floating) */
	viewRegistry = new ChatViewRegistry();

	/** Map of viewId to AcpAdapter for multi-session support */
	private _adapters: Map<string, AcpAdapter> = new Map();
	/** Floating button container (independent from chat view instances) */
	private floatingButton: FloatingButtonContainer | null = null;
	/** Map of viewId to floating chat roots and containers (legacy, being migrated to viewRegistry) */
	private floatingChatInstances: Map<
		string,
		{ root: Root; container: HTMLElement }
	> = new Map();
	/** Counter for generating unique floating chat instance IDs */
	private floatingChatCounter = 0;

	async onload() {
		await this.loadSettings();

		initializeLogger(this.settings);

		// Initialize settings store
		this.settingsStore = createSettingsStore(this.settings, this);

		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		const ribbonIconEl = this.addRibbonIcon(
			"bot-message-square",
			"Open agent client",
			(_evt: MouseEvent) => {
				void this.activateView();
			},
		);
		ribbonIconEl.addClass("agent-client-ribbon-icon");

		this.addCommand({
			id: "open-chat-view",
			name: "Open agent chat",
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "focus-next-chat-view",
			name: "Focus next chat view",
			callback: () => {
				this.focusChatView("next");
			},
		});

		this.addCommand({
			id: "focus-previous-chat-view",
			name: "Focus previous chat view",
			callback: () => {
				this.focusChatView("previous");
			},
		});

		this.addCommand({
			id: "open-new-chat-view",
			name: "Open new chat view",
			callback: () => {
				void this.openNewChatViewWithAgent(
					this.settings.defaultAgentId,
				);
			},
		});

		// Register agent-specific commands
		this.registerAgentCommands();
		this.registerPermissionCommands();
		this.registerBroadcastCommands();
		registerFloatingCommands(this);

		this.addCommand({
			id: "close-floating-chat",
			name: "Close floating chat window",
			callback: () => {
				const focused = this.viewRegistry.getFocused();
				if (focused && focused.viewType === "floating") {
					focused.collapse();
				}
			},
		});

		this.addSettingTab(new AgentClientSettingTab(this.app, this));

		// Mount floating button (always present; visibility controlled by settings inside component)
		this.floatingButton = new FloatingButtonContainer(this);
		this.floatingButton.mount();

		// Mount initial floating chat instance only if enabled
		if (this.settings.showFloatingButton) {
			this.openNewFloatingChat();
		}

		// Clean up all ACP sessions when Obsidian quits
		// Note: We don't wait for disconnect to complete to avoid blocking quit
		this.registerEvent(
			this.app.workspace.on("quit", () => {
				// Fire and forget - don't block Obsidian from quitting
				for (const [viewId, adapter] of this._adapters) {
					adapter.disconnect().catch((error) => {
						console.warn(
							`[AgentClient] Quit cleanup error for view ${viewId}:`,
							error,
						);
					});
				}
				this._adapters.clear();
			}),
		);
	}

	onunload() {
		// Unmount floating button
		this.floatingButton?.unmount();
		this.floatingButton = null;

		// Unmount all floating chat instances via registry
		for (const container of this.viewRegistry.getByType("floating")) {
			if (container instanceof FloatingViewContainer) {
				container.unmount();
			}
		}

		// Clear registry (sidebar views are managed by Obsidian workspace)
		this.viewRegistry.clear();

		// Clear legacy storage
		this.floatingChatInstances.clear();
	}

	/**
	 * Get or create an AcpAdapter for a specific view.
	 * Each ChatView has its own adapter for independent sessions.
	 */
	getOrCreateAdapter(viewId: string): AcpAdapter {
		let adapter = this._adapters.get(viewId);
		if (!adapter) {
			adapter = new AcpAdapter(this);
			this._adapters.set(viewId, adapter);
		}
		return adapter;
	}

	/**
	 * Remove and disconnect the adapter for a specific view.
	 * Called when a ChatView is closed.
	 */
	async removeAdapter(viewId: string): Promise<void> {
		const adapter = this._adapters.get(viewId);
		if (adapter) {
			try {
				await adapter.disconnect();
			} catch (error) {
				console.warn(
					`[AgentClient] Failed to disconnect adapter for view ${viewId}:`,
					error,
				);
			}
			this._adapters.delete(viewId);
		}
		// Note: lastActiveChatViewId is now managed by viewRegistry
		// Clearing happens automatically when view is unregistered
	}

	/**
	 * Get the last active ChatView ID for keybind targeting.
	 */
	get lastActiveChatViewId(): string | null {
		return this.viewRegistry.getFocusedId();
	}

	/**
	 * Set the last active ChatView ID.
	 * Called when a ChatView receives focus or interaction.
	 */
	setLastActiveChatViewId(viewId: string | null): void {
		if (viewId) {
			this.viewRegistry.setFocused(viewId);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

		if (leaves.length > 0) {
			// Find the leaf matching lastActiveChatViewId, or fall back to first leaf
			const focusedId = this.lastActiveChatViewId;
			if (focusedId) {
				leaf =
					leaves.find(
						(l) => (l.view as ChatView)?.viewId === focusedId,
					) || leaves[0];
			} else {
				leaf = leaves[0];
			}
		} else {
			leaf = createNewChatLeaf(
				this.app,
				this.settings.chatViewLocation,
				false,
				VIEW_TYPE_CHAT,
			);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_CHAT,
					active: true,
				});
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
			focusChatTextarea(leaf);
		}
	}

	/**
	 * Focus the next or previous ChatView in the list.
	 * Uses ChatViewRegistry which includes both sidebar and floating views.
	 */
	private focusChatView(direction: "next" | "previous"): void {
		if (direction === "next") {
			this.viewRegistry.focusNext();
		} else {
			this.viewRegistry.focusPrevious();
		}
	}

	/**
	 * Create a new leaf for ChatView based on the configured location setting.
	 * @param isAdditional - true when opening additional views (e.g., Open New View)
	 */
	/**
	 * Open a new chat view with a specific agent.
	 * Always creates a new view (doesn't reuse existing).
	 */
	async openNewChatViewWithAgent(agentId: string): Promise<void> {
		const leaf = createNewChatLeaf(
			this.app,
			this.settings.chatViewLocation,
			true,
			VIEW_TYPE_CHAT,
		);
		if (!leaf) {
			console.warn("[AgentClient] Failed to create new leaf");
			return;
		}

		await leaf.setViewState({
			type: VIEW_TYPE_CHAT,
			active: true,
			state: { initialAgentId: agentId },
		});

		await this.app.workspace.revealLeaf(leaf);
		focusChatTextarea(leaf, 0);
	}

	/**
	 * Open a new floating chat window.
	 * Each window is independent with its own session.
	 */
	openNewFloatingChat(
		initialExpanded = false,
		initialPosition?: { x: number; y: number },
	): void {
		// instanceId is just the counter (e.g., "0", "1", "2")
		// FloatingViewContainer will create viewId as "floating-chat-{instanceId}"
		const instanceId = String(this.floatingChatCounter++);
		const container = createFloatingChat(
			this,
			instanceId,
			initialExpanded,
			initialPosition,
		);
		// Store by viewId for consistent lookup
		this.floatingChatInstances.set(container.viewId, {
			root: null as unknown as Root,
			container: container.getContainerEl(),
		});
	}

	/**
	 * Close a specific floating chat window.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	closeFloatingChat(viewId: string): void {
		const container = this.viewRegistry.get(viewId);
		if (container && container instanceof FloatingViewContainer) {
			container.unmount();
		}
		// Also remove from legacy floatingChatInstances if present
		this.floatingChatInstances.delete(viewId);
	}

	/**
	 * Get all floating chat instance viewIds.
	 * @returns Array of viewIds in "floating-chat-{id}" format
	 */
	getFloatingChatInstances(): string[] {
		return this.viewRegistry.getByType("floating").map((v) => v.viewId);
	}

	/**
	 * Expand a specific floating chat window by triggering a custom event.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	expandFloatingChat(viewId: string): void {
		window.dispatchEvent(
			new CustomEvent("agent-client:expand-floating-chat", {
				detail: { viewId },
			}),
		);
	}

	/**
	 * Get all available agents (claude, codex, gemini, custom)
	 */
	getAvailableAgents(): Array<{ id: string; displayName: string }> {
		return getAvailableAgents(this.settings);
	}

	/**
	 * Open chat view and switch to specified agent
	 */
	private async openChatWithAgent(agentId: string): Promise<void> {
		await openChatWithAgent(this, agentId);
	}

	/**
	 * Register commands for each configured agent
	 */
	private registerAgentCommands(): void {
		registerAgentCommands(this);
	}

	private registerPermissionCommands(): void {
		registerPermissionCommands(this);
	}

	/**
	 * Register broadcast commands for multi-view operations
	 */
	private registerBroadcastCommands(): void {
		registerBroadcastCommands(this);
	}

	/**
	 * Copy prompt from active view to all other views
	 */
	private broadcastPrompt(): void {
		broadcastPrompt(this);
	}

	/**
	 * Send message in all views that can send
	 */
	private async broadcastSend(): Promise<void> {
		await broadcastSend(this);
	}

	/**
	 * Cancel operation in all views
	 */
	private async broadcastCancel(): Promise<void> {
		await broadcastCancel(this);
	}

	async loadSettings() {
		const rawSettings: unknown = (await this.loadData()) ?? {};
		const { settings, resetReason } = parseStoredSettings(rawSettings);
		this.settings = settings;
		this.ensureDefaultAgentId();

		if (resetReason) {
			new Notice(
				`[Obsius] Settings were reset due to incompatible schema (${resetReason}). Clean break policy is active from schema version ${SETTINGS_SCHEMA_VERSION}.`,
			);
			await this.saveSettings();
		}
	}

	async saveSettings() {
		this.settings.schemaVersion = SETTINGS_SCHEMA_VERSION;
		await this.saveData(this.settings);
	}

	async saveSettingsAndNotify(nextSettings: AgentClientPluginSettings) {
		this.settings = {
			...nextSettings,
			schemaVersion: SETTINGS_SCHEMA_VERSION,
		};
		await this.saveData(this.settings);
		this.settingsStore.set(this.settings);
	}

	/**
	 * Check for plugin updates.
	 * - Stable version users: compare with latest stable release
	 * - Prerelease users: compare with both latest stable and latest prerelease
	 */
	async checkForUpdates(): Promise<boolean> {
		return await checkForUpdates(this.manifest.version);
	}

	ensureDefaultAgentId(): void {
		ensureDefaultAgentId(this.settings, DEFAULT_SETTINGS.claude.id);
	}
}
